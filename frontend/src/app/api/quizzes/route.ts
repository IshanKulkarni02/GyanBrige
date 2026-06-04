import { NextRequest, NextResponse } from 'next/server';
import { quizzes, lectures, settings as dbSettings } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';
import { logRoute } from '@/lib/logger';

// GET /api/quizzes?lectureId=xxx
export const GET = logRoute(async function GET(request: NextRequest) {
  if (!requireAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const lectureId = new URL(request.url).searchParams.get('lectureId');
  if (!lectureId) return NextResponse.json({ error: 'lectureId required' }, { status: 400 });
  const list = quizzes.getByLecture(lectureId).map(q => quizzes.getById(q.id)!);
  return NextResponse.json({ quizzes: list });
}
);

// POST /api/quizzes  — create quiz (manual or AI-generated)
export const POST = logRoute(async function POST(request: NextRequest) {
  const caller = requireAuth(request);
  if (!caller || caller.role === 'student') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const { lectureId, courseId, title, generateAI, questionCount = 5 } = body;

  if (!lectureId || !courseId || !title) return NextResponse.json({ error: 'lectureId, courseId, title required' }, { status: 400 });

  const lecture = lectures.getById(lectureId);
  if (!lecture) return NextResponse.json({ error: 'Lecture not found' }, { status: 404 });

  const quiz = quizzes.create({ lectureId, courseId, title });

  if (!generateAI) return NextResponse.json({ quiz });

  // AI generation
  const openaiKey   = dbSettings.get('openaiKey')   || process.env.OPENAI_API_KEY;
  const openaiModel = dbSettings.get('openaiModel')  || 'gpt-4o-mini';
  if (!openaiKey) return NextResponse.json({ error: 'OpenAI key not set — configure in Admin → AI Settings', quiz }, { status: 400 });

  const source = lecture.notes || lecture.segments?.map((s: {text:string}) => s.text).join(' ') || lecture.title;

  const prompt = `Create ${questionCount} multiple-choice quiz questions based on this lecture content.

LANGUAGE RULE: The lecture may be in English, Hindi, Marathi, or a mix. Write questions and options in the EXACT SAME LANGUAGE(S) as the content — do NOT translate.

Lecture: ${lecture.title}
Content: ${source.slice(0, 6000)}

Rules:
- Each question must have exactly 4 answer options
- Only one correct answer per question
- Include a brief explanation for the correct answer
- Questions should test understanding, not just memorization
- Vary difficulty (easy, medium, hard)

Return ONLY valid JSON array, no markdown:
[
  {
    "question": "What is...",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "Because..."
  }
]`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: openaiModel,
        messages: [
          { role: 'system', content: 'You create educational quiz questions. Return only JSON arrays.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 2000, temperature: 0.7,
      }),
    });

    if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
    const data = await res.json();
    const raw  = data.choices[0].message.content.trim();
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Invalid AI response');

    let questions: { question: string; options: string[]; correctAnswer: number; explanation: string }[];
    try {
      questions = JSON.parse(match[0]);
    } catch {
      // Try to recover truncated JSON by closing the array
      try {
        const fixed = match[0].replace(/,\s*$/, '').replace(/\{[^}]*$/, '').replace(/,\s*$/, '') + ']';
        questions = JSON.parse(fixed);
      } catch {
        return NextResponse.json({ quiz, aiError: 'AI returned malformed JSON — quiz created empty, add questions manually.' });
      }
    }
    questions.forEach((q, i) => quizzes.addQuestion(quiz.id, { ...q, order: i + 1 }));

    return NextResponse.json({ quiz: quizzes.getById(quiz.id) });
  } catch (err) {
    // Return the empty quiz even if AI fails so teacher can add manually
    return NextResponse.json({ quiz, aiError: err instanceof Error ? err.message : 'AI generation failed' });
  }
}
);
