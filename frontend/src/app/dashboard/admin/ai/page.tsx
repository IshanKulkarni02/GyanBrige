'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AISettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [useLocalAI, setUseLocalAI] = useState(false);
  const [ollamaModel, setOllamaModel] = useState('llama2');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');
  const [openaiKey, setOpenaiKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.role !== 'admin') {
        router.push('/login');
      } else {
        setUser(parsed);
        loadSettings();
      }
    } else {
      router.push('/login');
    }
  }, [router]);

  const loadSettings = () => {
    const aiSettings = localStorage.getItem('aiSettings');
    if (aiSettings) {
      const settings = JSON.parse(aiSettings);
      setUseLocalAI(settings.useLocalAI || false);
      setOllamaModel(settings.ollamaModel || 'llama2');
      setOpenaiModel(settings.openaiModel || 'gpt-4o-mini');
      setOpenaiKey(settings.openaiKey || '');
    }
    setLoading(false);
  };

  const saveSettings = () => {
    localStorage.setItem('aiSettings', JSON.stringify({
      useLocalAI,
      ollamaModel,
      openaiModel,
      openaiKey,
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🤖</div>
          <p className="text-white/60">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <Link href="/dashboard/admin" className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-6 transition">
        ← Back to Dashboard
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🤖 AI Settings</h1>
        <p className="text-white/60">Configure AI models for note generation</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* AI Provider Toggle */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4">AI Provider</h2>
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
            <div className="flex items-center gap-4">
              <span className="text-2xl">🤖</span>
              <div>
                <span className="font-medium">ChatGPT (Cloud)</span>
                <p className="text-white/50 text-sm">OpenAI GPT-4 API</p>
              </div>
            </div>
            <button
              onClick={() => setUseLocalAI(!useLocalAI)}
              className={`w-14 h-8 rounded-full transition-colors relative ${
                useLocalAI ? 'bg-purple-500' : 'bg-emerald-500'
              }`}
            >
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${
                useLocalAI ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </button>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="font-medium">Ollama (Local)</span>
                <p className="text-white/50 text-sm">Run AI locally</p>
              </div>
              <span className="text-2xl">🦙</span>
            </div>
          </div>
          <p className="text-white/50 text-sm mt-3">
            Currently using: <span className={useLocalAI ? 'text-purple-400' : 'text-emerald-400'}>
              {useLocalAI ? 'Ollama (Local)' : 'ChatGPT (Cloud)'}
            </span>
          </p>
        </div>

        {/* OpenAI Settings */}
        {!useLocalAI && (
          <div className="glass rounded-2xl p-6">
            <h2 className="text-xl font-semibold mb-4">🔑 OpenAI Configuration</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-2">Model</label>
                <select
                  value={openaiModel}
                  onChange={(e) => setOpenaiModel(e.target.value)}
                  className="input-glass"
                >
                  <optgroup label="GPT-4o">
                    <option value="gpt-4o">GPT-4o (Latest)</option>
                    <option value="gpt-4o-mini">GPT-4o Mini (Fast & Cheap)</option>
                  </optgroup>
                  <optgroup label="GPT-4">
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    <option value="gpt-4">GPT-4</option>
                  </optgroup>
                  <optgroup label="GPT-3.5">
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Cheapest)</option>
                  </optgroup>
                </select>
                <p className="text-white/40 text-sm mt-2">
                  {openaiModel === 'gpt-4o' && '🚀 Most capable model, best for complex tasks'}
                  {openaiModel === 'gpt-4o-mini' && '⚡ Great balance of speed, quality & cost'}
                  {openaiModel === 'gpt-4-turbo' && '💪 Powerful with 128K context window'}
                  {openaiModel === 'gpt-4' && '🎯 Original GPT-4, very capable'}
                  {openaiModel === 'gpt-3.5-turbo' && '💰 Most affordable, good for simple tasks'}
                </p>
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-2">API Key</label>
                <input
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  className="input-glass"
                  placeholder="sk-..."
                />
                <p className="text-white/40 text-sm mt-2">Your OpenAI API key</p>
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
              <select
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                className="input-glass"
              >
                <option value="llama2">Llama 2</option>
                <option value="llama3">Llama 3</option>
                <option value="mistral">Mistral</option>
                <option value="codellama">Code Llama</option>
                <option value="gemma">Gemma</option>
              </select>
              <p className="text-white/40 text-sm mt-2">Make sure Ollama is running locally on port 11434</p>
            </div>
          </div>
        )}

        {/* Features */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4">✨ AI Features</h2>
          <div className="space-y-4">
            {[
              { name: 'Auto Note Generation', desc: 'Generate notes from lecture transcripts', enabled: true },
              { name: 'Smart Summaries', desc: 'Create concise lecture summaries', enabled: true },
              { name: 'Quiz Generation', desc: 'Auto-generate quizzes from content', enabled: false },
              { name: 'Translation', desc: 'Translate content to other languages', enabled: false },
            ].map((feature, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                <div>
                  <span className="font-medium">{feature.name}</span>
                  <p className="text-white/50 text-sm">{feature.desc}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs ${
                  feature.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/50'
                }`}>
                  {feature.enabled ? 'Enabled' : 'Coming Soon'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={saveSettings}
          className={`btn-primary w-full py-4 text-lg ${saved ? 'bg-emerald-600' : ''}`}
        >
          {saved ? '✅ Settings Saved!' : '💾 Save Settings'}
        </button>
      </div>
    </div>
  );
}
