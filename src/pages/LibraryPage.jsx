import React from 'react';
import { Clock, FileText, CheckCircle2, BarChart3, Atom, FlaskConical, Dna, UploadCloud } from 'lucide-react';

export default function LibraryPage() {
  return (
    <section className="bg-slate-950 py-24 sm:py-32 overflow-hidden relative font-sans">
      
      {/* Background Ambient Glow Effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-indigo-600/20 rounded-full blur-[140px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
        
        {/* 1. Section Header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-6 shadow-[0_0_15px_rgba(99,102,241,0.15)]">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            <span className="text-xs font-bold tracking-widest text-indigo-400 uppercase">Simulation Platform</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white tracking-tight mb-6 leading-tight">
            From Static PDFs to <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Live Mock Exams.</span>
          </h2>
          
          <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Upload your Allen, Aakash, or local coaching modules. Our core engine instantly parses questions, diagrams, and options into a strict NTA-style CBT environment.
          </p>
        </div>

        {/* 2. Central Cluster (Hero Bento Grid) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          
          {/* Left Column Cards */}
          <div className="space-y-6 flex flex-col">
            {/* Card 1 */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-8 rounded-3xl hover:-translate-y-1 hover:border-indigo-500/40 hover:shadow-[0_20px_40px_-15px_rgba(99,102,241,0.2)] transition-all duration-300 group">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 mb-6 group-hover:scale-110 transition-transform duration-300">
                <UploadCloud className="text-indigo-400 w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Instant PDF Parsing</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Upload any institute's PDF. Our AI engine extracts clean MCQs, complex math equations, and diagrams seamlessly.
              </p>
            </div>
            
            {/* Card 2 */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-8 rounded-3xl hover:-translate-y-1 hover:border-rose-500/40 hover:shadow-[0_20px_40px_-15px_rgba(244,63,94,0.2)] transition-all duration-300 flex-1 group">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 mb-6 group-hover:scale-110 transition-transform duration-300">
                <CheckCircle2 className="text-rose-400 w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">NTA Scoring Engine</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Strict +4 / -1 negative marking simulation to build real exam temperament and penalty awareness.
              </p>
            </div>
          </div>

          {/* Centerpiece: 3D Exam Clock */}
          <div className="bg-gradient-to-br from-slate-800/80 to-slate-950/90 backdrop-blur-2xl border border-white/10 p-10 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden group shadow-2xl">
            {/* Inner Glow Hover */}
            <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            
            <div className="relative w-56 h-56 rounded-full border border-indigo-500/20 flex flex-col items-center justify-center mb-8 bg-slate-950/80 shadow-[inset_0_0_50px_rgba(99,102,241,0.15)] group-hover:shadow-[inset_0_0_60px_rgba(99,102,241,0.3)] transition-all duration-700">
              
              {/* Subtle Animated Rings */}
              <div className="absolute inset-[-2px] rounded-full border border-transparent border-t-indigo-500/60 animate-spin" style={{ animationDuration: '4s' }}></div>
              <div className="absolute inset-[-8px] rounded-full border border-transparent border-b-cyan-400/50 animate-spin" style={{ animationDuration: '6s', animationDirection: 'reverse' }}></div>
              
              <Clock className="w-10 h-10 text-indigo-400 mb-3" />
              <span className="text-4xl font-black text-white font-mono tracking-widest drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">
                03:20:00
              </span>
              <span className="text-xs text-indigo-400/80 uppercase font-bold tracking-[0.2em] mt-2">NTA Standard</span>
            </div>

            <h3 className="text-2xl font-extrabold text-white text-center mb-3 z-10">Pressure Simulation</h3>
            <p className="text-slate-400 text-center text-sm leading-relaxed z-10 px-4">
              Master time management with exact NEET test duration tracking and realistic CBT UI.
            </p>
          </div>

          {/* Right Column Cards */}
          <div className="space-y-6 flex flex-col">
            {/* Card 3 */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-8 rounded-3xl hover:-translate-y-1 hover:border-cyan-500/40 hover:shadow-[0_20px_40px_-15px_rgba(6,182,212,0.2)] transition-all duration-300 flex-1 group">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 mb-6 group-hover:scale-110 transition-transform duration-300">
                <FileText className="text-cyan-400 w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Live Question Palette</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Track your flow with standard NTA status indicators: Answered, Marked for Review, and Unvisited.
              </p>
            </div>

            {/* Card 4 */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-8 rounded-3xl hover:-translate-y-1 hover:border-purple-500/40 hover:shadow-[0_20px_40px_-15px_rgba(168,85,247,0.2)] transition-all duration-300 group">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 mb-6 group-hover:scale-110 transition-transform duration-300">
                <BarChart3 className="text-purple-400 w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Deep Analytics</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Post-test chapter-wise breakdown, accuracy tracking, and personalized rank booster insights.
              </p>
            </div>
          </div>

        </div>

        {/* 3. Bottom Row (3 Subject Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Physics */}
          <div className="bg-slate-900/30 backdrop-blur-md border border-white/5 p-6 rounded-[2rem] flex items-center gap-5 hover:bg-slate-900/70 hover:border-blue-500/30 hover:shadow-[0_10px_30px_-10px_rgba(59,130,246,0.15)] transition-all duration-300 cursor-default group">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 group-hover:scale-110 group-hover:bg-blue-500/20 transition-all duration-300">
              <Atom className="text-blue-400 w-8 h-8" />
            </div>
            <div>
              <h4 className="text-white font-bold text-lg mb-1">Physics</h4>
              <p className="text-slate-500 text-sm font-medium">Mechanics & Thermodynamics</p>
            </div>
          </div>

          {/* Chemistry */}
          <div className="bg-slate-900/30 backdrop-blur-md border border-white/5 p-6 rounded-[2rem] flex items-center gap-5 hover:bg-slate-900/70 hover:border-emerald-500/30 hover:shadow-[0_10px_30px_-10px_rgba(16,185,129,0.15)] transition-all duration-300 cursor-default group">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all duration-300">
              <FlaskConical className="text-emerald-400 w-8 h-8" />
            </div>
            <div>
              <h4 className="text-white font-bold text-lg mb-1">Chemistry</h4>
              <p className="text-slate-500 text-sm font-medium">Organic & Physical Chemistry</p>
            </div>
          </div>

          {/* Biology */}
          <div className="bg-slate-900/30 backdrop-blur-md border border-white/5 p-6 rounded-[2rem] flex items-center gap-5 hover:bg-slate-900/70 hover:border-fuchsia-500/30 hover:shadow-[0_10px_30px_-10px_rgba(217,70,239,0.15)] transition-all duration-300 cursor-default group">
            <div className="w-16 h-16 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center border border-fuchsia-500/20 group-hover:scale-110 group-hover:bg-fuchsia-500/20 transition-all duration-300">
              <Dna className="text-fuchsia-400 w-8 h-8" />
            </div>
            <div>
              <h4 className="text-white font-bold text-lg mb-1">Biology</h4>
              <p className="text-slate-500 text-sm font-medium">Botany & Human Physiology</p>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
