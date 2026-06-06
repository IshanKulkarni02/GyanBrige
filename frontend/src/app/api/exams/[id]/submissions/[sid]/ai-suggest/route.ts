import { NextRequest, NextResponse } from 'next/server';
import { examSubmissions, examAnswers, examQuestions, exams, settings } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const user = requireAuth(request);
  if (!user || user.role === 'student') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: examId, sid } = await params;
  const submission = examSubmissions.getById(sid);
  if (!submission) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });

  const exam = exams.getById(examId);
  if (!exam) return NextResponse.json({ error: 'Exam not found' }, { status: 404 });

  const questions = examQuestions.getByExam(examId);
  const answersToMark = examAnswers.getBySubmission(sid);

  // Gather already-marked submissions for this exam (teacher's reference examples)
  const allSubmissions = examSubmissions.getByExam(examId).filter(
    s => s.status === 'marked' && s.id !== sid
  );

  const examples: { question: string; answer: string; marks: number; maxMarks: number; feedback: string }[] = [];
  for (const ms of allSubmissions.slice(0, 5)) {
    const msAnswers = examAnswers.getBySubmission(ms.id);
    for (const ma of msAnswers) {
      if (ma.marksAwarded != null) {
        const q = questions.find(q => q.id === ma.questionId);
        if (q) {
          examples.push({ question: q.question, answer: ma.answer, marks: ma.marksAwarded, maxMarks: q.maxMarks, feedback: ma.teacherFeedback });
        }
      }
    }
  }

  // Get AI config from settings / request headers
  const useLocal = request.headers.get('x-use-local-ai') === 'true' || settings.get('useLocalAI') === 'true';
  const openAIKey = request.headers.get('x-openai-key') || settings.get('openAIKey') || '';
  const openAIModel = request.headers.get('x-openai-model') || settings.get('openAIModel') || 'gpt-4o-mini';
  const ollamaModel = request.headers.get('x-ollama-model') || settings.get('ollamaModel') || 'llama3';

  if (!useLocal && !openAIKey) {
    return NextResponse.json({ error: 'No AI key configured. Go to Admin → AI Settings.' }, { status: 400 });
  }

  const suggestions: Record<string, { suggestedMarks: number; confidence: number; reasoning: string }> = {};

  for (const answer of answersToMark) {
    const q = questions.find(q => q.id === answer.questionId);
    if (!q) continue;

    const relevantExamples = examples.filter(e => e.question === q.question).slice(0, 3);

    const prompt = `You are an exam marker. Your job is to suggest marks for a student's answer.

Question: ${q.question}
Max marks: ${q.maxMarks}
Model answer (for reference): ${q.expectedAnswer || 'Not provided'}

${relevantExamples.length > 0 ? `Examples of how this teacher has marked similar answers:
${relevantExamples.map((e, i) => `Example ${i + 1}:
  Answer: "${e.answer}"
  Marks awarded: ${e.marks}/${e.maxMarks}
  Feedback: "${e.feedback}"`).join('\n\n')}

` : ''}Student answer: "${answer.answer}"

Based on the question, model answer${relevantExamples.length > 0 ? ', and examples of how the teacher marks' : ''}, suggest marks and brief feedback.

Respond ONLY with valid JSON in this exact format:
{"marks": <number 0-${q.maxMarks}>, "confidence": <number 0.0-1.0>, "reasoning": "<brief feedback for the student>"}`;

    try {
      let raw = '';
      if (useLocal) {
        const res = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: ollamaModel, prompt, stream: false }),
        });
        const data = await res.json();
        raw = data.response ?? '';
      } else {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openAIKey}` },
          body: JSON.stringify({
            model: openAIModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
          }),
        });
        const data = await res.json();
        raw = data.choices?.[0]?.message?.content ?? '';
      }

      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const suggestedMarks = Math.min(q.maxMarks, Math.max(0, Math.round(parsed.marks ?? 0)));
        const confidence = Math.min(1, Math.max(0, parsed.confidence ?? 0.5));
        suggestions[answer.id] = { suggestedMarks, confidence, reasoning: parsed.reasoning ?? '' };

        // Persist AI suggestion
        examAnswers.upsert({ ...answer, aiSuggestedMarks: suggestedMarks, aiConfidence: confidence });
      }
    } catch {
      suggestions[answer.id] = { suggestedMarks: 0, confidence: 0, reasoning: 'AI failed to suggest marks' };
    }
  }

  return NextResponse.json({ suggestions });
}
