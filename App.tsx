
import React, { useState } from 'react';
import VoiceInterface from './components/VoiceInterface';
import { Heart } from 'lucide-react';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#020202] text-white overflow-hidden font-sans selection:bg-pink-500/30">
      {/* Background Ambience */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-pink-600/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-indigo-600/10 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
      </div>

      <main className="relative z-10 h-screen">
        <VoiceInterface onClose={() => {}} />
      </main>

      {/* Footer Branding */}
      <div className="fixed bottom-8 left-0 right-0 text-center pointer-events-none">
        <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.8em] text-white/10 italic">
          Neural <Heart size={10} className="fill-current" /> Core
        </div>
      </div>
    </div>
  );
};

export default App;
