'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/api';
import { toast } from 'sonner';

export default function AISettingsPage() {
  const router = useRouter();
  const [user, setUser]             = useState<{ id: string; name: string; role: string } | null>(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]                                   = useState(false);
  const [useLocalAI, setUseLocalAI]                           = useState(false);
  const [transcriptionLanguage, setTranscriptionLanguage]     = useState('auto');
  const [ollamaModel, setOllamaModel] = useState('llama3:latest');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');
  const [openaiKey, setOpenaiKey]   = useState('');
  const [hasKey, setHasKey]         = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    let parsed;
    try { parsed = JSON.parse(stored); } catch {
      localStorage.removeItem('user');
      router.push('/login'); return;
    }
    if (parsed.role !== 'admin') { router.push('/login'); return; }
    setUser(parsed);
    loadSettings(parsed);
  }, [router]);

  const loadSettings = async (me: { id: string; role: string }) => {
    try {
      const res  = await authFetch('/api/settings');
      const data = await res.json();
      setUseLocalAI(!!data.useLocalAI);
      setOllamaModel(data.ollamaModel || 'llama3:latest');
      setOpenaiModel(data.openaiModel || 'gpt-4o-mini');
      setOpenaiKey(data.openaiKey || '');   // admin sees full key
      setHasKey(!!data.hasOpenaiKey);
      setTranscriptionLanguage(data.transcriptionLanguage || 'auto');
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await authFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ useLocalAI, ollamaModel, openaiModel, openaiKey, transcriptionLanguage }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setHasKey(!!openaiKey);
      toast.success('Settings saved — all devices updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center"><div className="text-4xl mb-4 animate-pulse">🤖</div><p className="text-white/60">Loading...</p></div>
    </div>
  );

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <Link href="/dashboard/admin" className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-6 transition">
        ← Back to Dashboard
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🤖 AI Settings</h1>
        <p className="text-white/60">Settings are stored on the server — take effect on all devices immediately</p>
      </div>

      <div className="max-w-2xl space-y-6">

        {/* AI Provider Toggle */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4">AI Provider</h2>
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
            <div className="flex items-center gap-4">
              <span className="text-2xl">🤖</span>
              <div><span className="font-medium">ChatGPT (Cloud)</span><p className="text-white/50 text-sm">OpenAI GPT-4 API</p></div>
            </div>
            <button
              onClick={() => setUseLocalAI(!useLocalAI)}
              className={`w-14 h-8 rounded-full transition-colors relative ${useLocalAI ? 'bg-purple-500' : 'bg-emerald-500'}`}
            >
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${useLocalAI ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
            <div className="flex items-center gap-4">
              <div className="text-right"><span className="font-medium">Ollama (Local)</span><p className="text-white/50 text-sm">Run AI locally</p></div>
              <span className="text-2xl">🦙</span>
            </div>
          </div>
          <p className="text-white/50 text-sm mt-3">
            Currently using: <span className={useLocalAI ? 'text-purple-400' : 'text-emerald-400'}>{useLocalAI ? 'Ollama (Local)' : 'ChatGPT (Cloud)'}</span>
          </p>
        </div>

        {/* Transcription Language */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-1">🌐 Lecture Language</h2>
          <p className="text-white/50 text-sm mb-4">
            How your teachers deliver lectures — affects both transcription accuracy and how notes are written
          </p>
          <div className="space-y-2">
            {[
              { value: 'auto',    label: 'Mixed / Auto-detect',        sub: 'Hindi + English, Marathi + English, or any mix — recommended for most Indian colleges' },
              { value: 'hi',      label: 'Primarily Hindi',            sub: 'Hinglish OK; Whisper focuses on Hindi' },
              { value: 'mr',      label: 'Primarily Marathi',          sub: 'Marathi-English mix OK; Whisper focuses on Marathi' },
              { value: 'en',      label: 'Primarily English',          sub: 'Standard English lectures' },
            ].map(opt => (
              <label key={opt.value}
                className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition ${transcriptionLanguage === opt.value ? 'bg-emerald-500/15 border border-emerald-500/30' : 'bg-white/5 hover:bg-white/10'}`}>
                <input type="radio" name="lang" value={opt.value} checked={transcriptionLanguage === opt.value}
                  onChange={() => setTranscriptionLanguage(opt.value)} className="mt-1 accent-emerald-500" />
                <div>
                  <p className="font-medium text-sm">{opt.label}</p>
                  <p className="text-white/40 text-xs">{opt.sub}</p>
                </div>
              </label>
            ))}
          </div>
          <p className="text-white/30 text-xs mt-3">
            Notes, quizzes, and chapter titles are generated in the same language mix as the transcript.
          </p>
        </div>

        {/* OpenAI Settings */}
        {!useLocalAI && (
          <div className="glass rounded-2xl p-6">
            <h2 className="text-xl font-semibold mb-4">🔑 OpenAI Configuration</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-2">Model</label>
                <select value={openaiModel} onChange={e => setOpenaiModel(e.target.value)} className="input-glass">
                  <optgroup label="GPT-4o">
                    <option value="gpt-4o">GPT-4o (Latest)</option>
                    <option value="gpt-4o-mini">GPT-4o Mini (Fast &amp; Cheap)</option>
                  </optgroup>
                  <optgroup label="GPT-4">
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    <option value="gpt-4">GPT-4</option>
                  </optgroup>
                  <optgroup label="GPT-3.5">
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Cheapest)</option>
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-2">
                  API Key
                  {hasKey && <span className="ml-2 text-emerald-400 text-xs">✓ key saved</span>}
                </label>
                <input
                  type="password"
                  value={openaiKey}
                  onChange={e => setOpenaiKey(e.target.value)}
                  className="input-glass"
                  placeholder={hasKey ? '••••••••  (enter new key to replace)' : 'sk-...'}
                />
                <p className="text-white/40 text-sm mt-2">Stored securely on the server — not in the browser</p>
              </div>
            </div>
          </div>
        )}

        {/* Ollama Settings */}
        {useLocalAI && (
          <div className="glass rounded-2xl p-6">
            <h2 className="text-xl font-semibold mb-4">🦙 Ollama Configuration</h2>
            <div>
              <label className="block text-sm text-white/70 mb-2">Model</label>
              <select value={ollamaModel} onChange={e => setOllamaModel(e.target.value)} className="input-glass">
                <option value="llama3:latest">Llama 3 (recommended)</option>
                <option value="llama2">Llama 2</option>
                <option value="mistral">Mistral</option>
                <option value="codellama">Code Llama</option>
                <option value="gemma">Gemma</option>
              </select>
              <p className="text-white/40 text-sm mt-2">Make sure Ollama is running on port 11434</p>
            </div>
          </div>
        )}

        {/* Save */}
        <button onClick={saveSettings} disabled={saving} className="btn-primary w-full py-4 text-lg disabled:opacity-50">
          {saving ? <span className="flex items-center justify-center gap-2"><span className="animate-spin">⏳</span> Saving...</span> : '💾 Save Settings'}
        </button>
      </div>
    </div>
  );
}
