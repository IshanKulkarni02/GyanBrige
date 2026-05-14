'use client';

import Link from 'next/link';
import { useState } from 'react';

const features = [
  {
    icon: '🎙️',
    title: 'Record & Transcribe',
    description: 'Record lectures in English, Hindi, or Marathi. AI automatically transcribes content.',
    color: 'from-emerald-500 to-teal-500',
  },
  {
    icon: '🧠',
    title: 'AI-Generated Notes',
    description: 'Transform hours of lectures into structured, easy-to-understand notes.',
    color: 'from-purple-500 to-indigo-500',
  },
  {
    icon: '📚',
    title: 'Multi-Subject Support',
    description: 'Organize content by subjects with customizable AI models.',
    color: 'from-amber-500 to-orange-500',
  },
  {
    icon: '📊',
    title: 'Attendance Tracking',
    description: 'Teachers can mark and track student attendance digitally.',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: '🎬',
    title: 'Video Streaming',
    description: 'Stream recorded lectures with HLS support on any device.',
    color: 'from-rose-500 to-pink-500',
  },
  {
    icon: '🔒',
    title: 'Privacy-First AI',
    description: 'Choose between cloud AI or local Ollama for sensitive content.',
    color: 'from-slate-500 to-zinc-500',
  },
];

const stats = [
  { value: '10K+', label: 'Students' },
  { value: '500+', label: 'Teachers' },
  { value: '50K+', label: 'Lectures' },
  { value: '3', label: 'Languages' },
];

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">📚</span>
              <span className="text-xl font-bold gradient-text">GyanBrige</span>
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <Link href="#features" className="text-white/70 hover:text-white transition">Features</Link>
              <Link href="#about" className="text-white/70 hover:text-white transition">About</Link>
              <Link href="/login" className="btn-secondary text-sm">Login</Link>
              <Link href="/signup" className="btn-primary text-sm">Get Started</Link>
            </div>
            <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              <span className="text-2xl">{mobileMenuOpen ? '✕' : '☰'}</span>
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden glass border-t border-white/10 px-4 py-4 space-y-3">
            <Link href="#features" className="block text-white/70">Features</Link>
            <Link href="/login" className="block text-white/70">Login</Link>
            <Link href="/signup" className="btn-primary block text-center">Get Started</Link>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full mb-8">
            <span className="text-emerald-400">✨</span>
            <span className="text-sm text-white/80">AI-Powered Education Platform</span>
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
            Learn Smarter with<br />
            <span className="gradient-text">Gyan Brige</span>
          </h1>
          <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-10">
            Transform lectures into structured notes instantly. Support for English, Hindi, and Marathi 
            with seamless video streaming and attendance management.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link href="/signup" className="btn-primary text-lg px-8 py-4 animate-pulse-glow">Start Learning Free →</Link>
            <Link href="#demo" className="btn-secondary text-lg px-8 py-4 flex items-center justify-center gap-2">
              <span>▶</span> Watch Demo
            </Link>
          </div>
          <div className="relative max-w-5xl mx-auto">
            <div className="glass p-4 rounded-2xl">
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-8 aspect-video flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4 animate-float">📱</div>
                  <p className="text-white/50">App Preview</p>
                </div>
              </div>
            </div>
            <div className="absolute -top-4 -left-4 glass p-3 rounded-xl animate-float"><span className="text-2xl">🎙️</span></div>
            <div className="absolute -top-4 -right-4 glass p-3 rounded-xl animate-float" style={{ animationDelay: '1s' }}><span className="text-2xl">🧠</span></div>
            <div className="absolute -bottom-4 left-1/4 glass p-3 rounded-xl animate-float" style={{ animationDelay: '1.5s' }}><span className="text-2xl">📝</span></div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="glass rounded-2xl p-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold gradient-text mb-2">{stat.value}</div>
                  <div className="text-white/60">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need to <span className="gradient-text">Transform Learning</span>
            </h2>
            <p className="text-white/60 max-w-2xl mx-auto">
              Powerful tools for students and teachers to make education more accessible.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div key={i} className="glass glass-hover p-6 rounded-2xl">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4`}>
                  <span className="text-2xl">{feature.icon}</span>
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-white/60">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold">How It <span className="gradient-text">Works</span></h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Record or Upload', desc: 'Teachers record lectures or upload existing files.', icon: '📤' },
              { step: '02', title: 'AI Processing', desc: 'AI transcribes and generates structured notes.', icon: '⚙️' },
              { step: '03', title: 'Learn & Review', desc: 'Students access notes synced with video playback.', icon: '📖' },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="glass w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-3xl">{item.icon}</span>
                </div>
                <div className="text-emerald-400 font-mono text-sm mb-2">STEP {item.step}</div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-white/60">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="glass rounded-3xl p-8 md:p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-purple-500/10" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Transform Your Learning?</h2>
              <p className="text-white/60 mb-8 max-w-xl mx-auto">
                Join thousands of students and teachers already using GyanBrige.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/signup" className="btn-primary text-lg px-8 py-4">Get Started Free</Link>
                <Link href="/login" className="btn-secondary text-lg px-8 py-4">Login to Dashboard</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <Link href="/" className="flex items-center gap-2 mb-4">
                <span className="text-2xl">📚</span>
                <span className="text-xl font-bold gradient-text">GyanBrige</span>
              </Link>
              <p className="text-white/50 text-sm">AI-powered education platform for the modern learner.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-white/50">
                <li><Link href="#features" className="hover:text-white transition">Features</Link></li>
                <li><Link href="#" className="hover:text-white transition">Pricing</Link></li>
                <li><Link href="#" className="hover:text-white transition">Mobile App</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-white/50">
                <li><Link href="#" className="hover:text-white transition">Documentation</Link></li>
                <li><Link href="#" className="hover:text-white transition">API</Link></li>
                <li><Link href="#" className="hover:text-white transition">Support</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Languages</h4>
              <div className="flex gap-2 flex-wrap">
                <span className="glass px-3 py-1 rounded-full text-sm">🇬🇧 English</span>
                <span className="glass px-3 py-1 rounded-full text-sm">🇮🇳 हिंदी</span>
                <span className="glass px-3 py-1 rounded-full text-sm">मराठी</span>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-white/50 text-sm">© 2024 GyanBrige. All rights reserved.</p>
            <div className="flex gap-6 text-white/50 text-sm">
              <Link href="#" className="hover:text-white transition">Privacy</Link>
              <Link href="#" className="hover:text-white transition">Terms</Link>
              <Link href="#" className="hover:text-white transition">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
