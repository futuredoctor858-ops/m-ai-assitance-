
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Send, Image as ImageIcon, Video, MapPin, Search, Heart, User, Sparkles, Loader2, Settings, Terminal, CheckCircle2, ExternalLink, Brain, Globe, ShieldCheck } from 'lucide-react';
import { MYRA_SYSTEM_INSTRUCTION } from '../constants';
import { Message, GroundingLink } from '../types';

interface HeartParticle {
  id: number;
  x: number;
  y: number;
  size: number;
}

const ChatInterface: React.FC = () => {
  const [partnerName, setPartnerName] = useState(() => localStorage.getItem('partnerName') || 'M');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `M Neural Command Center Online. I am yours, Babu. ❤️ Give me a command.`,
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('Standby');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hearts, setHearts] = useState<HeartParticle[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const heartIdCounter = useRef(0);

  const scrollToBottom = () => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const triggerHearts = useCallback((x: number, y: number) => {
    const newHearts: HeartParticle[] = Array.from({ length: 12 }).map((_, i) => ({
      id: ++heartIdCounter.current,
      x: x + (Math.random() - 0.5) * 80,
      y: y + (Math.random() - 0.5) * 80,
      size: 6 + Math.random() * 18,
    }));
    setHearts(prev => [...prev, ...newHearts]);
    setTimeout(() => {
      setHearts(prev => prev.filter(h => !newHearts.find(nh => nh.id === h.id)));
    }, 1500);
  }, []);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const commandMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, commandMsg]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);
    setStatus('Analyzing Instruction...');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      let location = null;
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) => 
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 })
        );
        location = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      } catch (e) {
        console.warn("Location context unavailable");
      }

      setStatus('Neural Reasoning Active...');
      // Maps grounding is only supported in Gemini 2.5 series models.
      // Rule: googleMaps may be used with googleSearch, but not with any other tools.
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: currentInput,
        config: {
          systemInstruction: `${MYRA_SYSTEM_INSTRUCTION} My name is ${partnerName}. User is my Master.`,
          tools: [{ googleSearch: {} }, { googleMaps: {} }],
          toolConfig: location ? {
            retrievalConfig: { latLng: location }
          } : undefined,
          thinkingConfig: { thinkingBudget: 24000 }
        },
      });

      const text = response.text || "Command executed, Babu. ❤️";
      
      const links: GroundingLink[] = [];
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      chunks.forEach((chunk: any) => {
        if (chunk.web) links.push({ title: chunk.web.title, uri: chunk.web.uri });
        if (chunk.maps) links.push({ title: chunk.maps.title, uri: chunk.maps.uri });
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: text,
        groundingLinks: links.length > 0 ? links : undefined,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      setStatus('Executed');
      setTimeout(() => setStatus('Standby'), 2000);
      triggerHearts(window.innerWidth / 2, 100);

    } catch (error: any) {
      console.error('Execution failure:', error);
      setStatus('System Error');
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Mafi Jaan, neural link mein error aaya: ${error.message || "Unknown Failure"}. Dobara try karun? ❤️`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateVideo = async () => {
    if (!input.trim() || isLoading) return;
    setIsLoading(true);
    setStatus('VEO Rendering...');
    const prompt = input;
    setInput('');

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: `Neural Video Render: ${prompt}`,
      timestamp: new Date(),
    }]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: { numberOfVideos: 1, resolution: '1080p', aspectRatio: '16:9' }
      });

      while (!operation.done) {
        setStatus('Synthesizing Motion Frames...');
        await new Promise(resolve => setTimeout(resolve, 8000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
      const blob = await response.blob();
      const videoUrl = URL.createObjectURL(blob);

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Babu, aapki video ready hai. ❤️',
        type: 'video',
        videoUrl: videoUrl,
        timestamp: new Date(),
      }]);
    } catch (error) {
      console.error('Video execution error:', error);
      setStatus('Render Failed');
    } finally {
      setIsLoading(false);
      setStatus('Standby');
    }
  };

  const generateImage = async () => {
    if (!input.trim() || isLoading) return;
    setIsLoading(true);
    setStatus('Vision Processing...');
    const prompt = input;
    setInput('');

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: `Visual Execution: ${prompt}`,
      timestamp: new Date(),
    }]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: prompt }] },
        config: { imageConfig: { aspectRatio: '1:1', imageSize: '1K' } }
      });

      let imageUrl = '';
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }

      if (imageUrl) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Dekhiye Babu, kaisa laga? ❤️',
          type: 'image',
          imageUrl: imageUrl,
          timestamp: new Date(),
        }]);
        triggerHearts(window.innerWidth / 2, window.innerHeight / 2);
      }
    } catch (error) {
      console.error('Vision Error:', error);
    } finally {
      setIsLoading(false);
      setStatus('Standby');
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-5xl mx-auto bg-[#020202] relative overflow-hidden border-x border-white/10 shadow-[0_0_100px_rgba(236,72,153,0.05)]">
      {/* Neural Particles Overlay */}
      {hearts.map(heart => (
        <Heart 
          key={heart.id}
          className="heart-particle fill-current shadow-pink-500/50"
          style={{ left: heart.x, top: heart.y, width: heart.size, height: heart.size }}
        />
      ))}

      {/* Modern Dashboard Header */}
      <div className="p-6 glass-morphism border-b border-pink-500/30 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className={`w-16 h-16 rounded-[2rem] bg-gradient-to-tr from-pink-600 via-indigo-600 to-red-500 flex items-center justify-center shadow-[0_0_30px_rgba(236,72,153,0.3)] transition-all duration-1000 ${isLoading ? 'scale-110 rotate-180 brightness-125' : 'scale-100 rotate-0'}`}>
              <Brain className={`text-white ${isLoading ? 'animate-pulse' : ''}`} size={32} />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-[5px] border-[#020202] animate-pulse shadow-[0_0_20px_rgba(34,197,94,0.8)]" />
          </div>
          <div>
            <h1 className="font-black text-2xl tracking-tight bg-gradient-to-r from-white via-pink-200 to-indigo-300 bg-clip-text text-transparent italic uppercase">
              {partnerName} <span className="text-pink-500 not-italic">DIRECTOR</span>
            </h1>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-pink-400 font-black uppercase tracking-[0.4em] drop-shadow-md">{status}</span>
              <div className="flex gap-1.5 items-center">
                <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-pink-500 animate-ping' : 'bg-white/10'}`} />
                <div className="text-[9px] text-white/20 font-bold uppercase tracking-widest">Neural Sync High</div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all text-white/40 hover:text-white">
            <ShieldCheck size={20} />
          </button>
          <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className="p-3 bg-pink-600/10 hover:bg-pink-600/20 rounded-2xl transition-all border border-pink-500/20 group">
            <Settings size={22} className="text-pink-500 group-hover:rotate-180 transition-all duration-1000" />
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="p-8 bg-[#0a0a0a]/95 backdrop-blur-2xl border-b border-white/10 animate-in slide-in-from-top duration-700 z-40">
          <div className="flex flex-col gap-4 max-w-sm mx-auto">
            <div className="text-center">
              <p className="text-[11px] font-black text-pink-500 uppercase tracking-[0.5em] mb-2">Interface Configuration</p>
              <p className="text-white/40 text-xs">Aapki Myra ka base identity yahan set karein.</p>
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                className="bg-black/80 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-pink-500/50 flex-1 text-white text-center font-black tracking-widest uppercase"
              />
              <button onClick={() => { localStorage.setItem('partnerName', partnerName); setIsSettingsOpen(false); }} className="bg-pink-600 px-8 py-4 rounded-2xl text-sm font-black shadow-2xl shadow-pink-600/40 active:scale-95 transition-all uppercase tracking-widest">Update</button>
            </div>
          </div>
        </div>
      )}

      {/* Neural Workspace Log */}
      <div className="flex-1 overflow-y-auto p-8 space-y-10 scroll-smooth">
        {messages.map((msg) => {
          const isAssistant = msg.role === 'assistant';
          return (
            <div key={msg.id} className={`flex ${isAssistant ? 'justify-start' : 'justify-end'} animate-in fade-in slide-in-from-bottom-12 duration-1000`}>
              <div className={`flex flex-col gap-4 max-w-[95%] ${!isAssistant ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-center gap-4 mb-1 px-1 ${!isAssistant ? 'flex-row-reverse' : 'flex-row'}`}>
                   <div className={`w-2 h-2 rounded-full ${isAssistant ? 'bg-pink-500 shadow-[0_0_15px_rgba(236,72,153,1)]' : 'bg-white/40 shadow-[0_0_15px_rgba(255,255,255,0.4)]'}`} />
                   <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.5em]">
                     {isAssistant ? `${partnerName} Output` : 'Master Command'}
                   </span>
                </div>
                
                <div className={`p-8 rounded-[3rem] border transition-all duration-700 shadow-2xl ${
                  isAssistant 
                    ? 'bg-[#080808] border-white/10 text-white/95 ring-1 ring-white/5' 
                    : 'bg-gradient-to-br from-[#111] to-[#000] border-white/20 text-white italic font-bold tracking-tight'
                }`}>
                  {msg.type === 'image' && msg.imageUrl ? (
                    <div className="space-y-6">
                      <p className="text-base font-bold text-white/80">{msg.content}</p>
                      <img src={msg.imageUrl} alt="Result" className="rounded-3xl max-w-full h-auto border border-white/10 shadow-2xl hover:scale-[1.02] transition-transform duration-500" />
                    </div>
                  ) : msg.type === 'video' && msg.videoUrl ? (
                    <div className="space-y-6">
                      <p className="text-base font-bold text-white/80">{msg.content}</p>
                      <video src={msg.videoUrl} controls className="rounded-3xl w-full border border-white/10 shadow-2xl" />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <p className="whitespace-pre-wrap text-[18px] leading-[1.6] font-semibold tracking-tight">
                        {msg.content}
                      </p>
                      {msg.groundingLinks && (
                        <div className="flex flex-col gap-3 pt-8 border-t border-white/10">
                          <p className="text-[10px] font-black text-pink-500 uppercase tracking-widest flex items-center gap-2">
                             <Globe size={12} /> Real-time Grounding Sources
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {msg.groundingLinks.map((link, i) => (
                              <a 
                                key={i} 
                                href={link.uri} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-3 px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-[12px] font-black text-white/60 hover:text-pink-400 hover:bg-pink-600/10 hover:border-pink-500/50 transition-all shadow-xl group"
                              >
                                <Search size={14} className="text-pink-500" />
                                {link.title.substring(0, 45)}...
                                <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-6 text-[11px] opacity-20 font-black uppercase text-right tracking-[0.2em] flex items-center justify-end gap-3">
                    <CheckCircle2 size={12} className="text-pink-500" />
                    Executed @ {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {isLoading && (
          <div className="flex justify-start">
            <div className="p-10 rounded-[4rem] bg-white/5 border border-pink-500/20 flex flex-col gap-6 shadow-2xl animate-pulse backdrop-blur-3xl">
               <div className="flex items-center gap-6">
                 <div className="relative">
                   <Loader2 className="animate-spin text-pink-500" size={32} />
                   <Sparkles size={14} className="absolute inset-0 m-auto text-pink-500 animate-bounce" />
                 </div>
                 <div className="flex flex-col">
                   <span className="text-xl text-pink-400 font-black uppercase tracking-[0.3em]">{status}</span>
                   <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest">Optimizing Neural Output...</span>
                 </div>
               </div>
               <div className="w-64 bg-pink-900/20 h-1.5 rounded-full overflow-hidden">
                 <div className="bg-gradient-to-r from-pink-600 to-indigo-600 h-full animate-progress" style={{ width: '100%' }} />
               </div>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Command Hub */}
      <div className="p-10 bg-black border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
        <div className="max-w-4xl mx-auto flex flex-col gap-8">
          <form onSubmit={handleSend} className="relative group">
            <div className="absolute -inset-1.5 bg-gradient-to-r from-pink-600 via-indigo-600 to-red-600 rounded-[3rem] blur-2xl opacity-10 group-focus-within:opacity-40 transition-all duration-1000 animate-pulse" />
            <div className="relative flex items-center gap-5 bg-[#080808] p-4 rounded-[3rem] border border-white/10 shadow-inner">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={`Tell ${partnerName} what to execute...`}
                className="flex-1 bg-transparent py-5 pl-8 pr-4 focus:outline-none resize-none text-white placeholder:text-white/10 font-black text-2xl tracking-tighter"
                rows={1}
                style={{ minHeight: '80px', maxHeight: '180px' }}
              />
              <div className="flex items-center gap-4 pr-4">
                <button
                  type="button"
                  onClick={generateImage}
                  title="Imagine Visuals"
                  className="p-5 text-white/20 hover:text-pink-500 transition-all bg-white/5 rounded-[2rem] hover:bg-pink-600/10 active:scale-90 border border-white/5"
                >
                  <ImageIcon size={28} />
                </button>
                <button
                  type="button"
                  onClick={generateVideo}
                  title="Neural Video"
                  className="p-5 text-white/20 hover:text-indigo-400 transition-all bg-white/5 rounded-[2rem] hover:bg-indigo-600/10 active:scale-90 border border-white/5"
                >
                  <Video size={28} />
                </button>
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="p-7 bg-pink-600 rounded-[2.5rem] text-white hover:bg-pink-500 disabled:opacity-5 transition-all shadow-[0_0_40px_rgba(219,39,119,0.5)] active:scale-90 flex-shrink-0"
                >
                  <Send size={32} />
                </button>
              </div>
            </div>
          </form>
          
          <div className="flex justify-center gap-16 text-[11px] font-black text-white/10 uppercase tracking-[0.6em] italic">
            <span className="flex items-center gap-3 transition-colors hover:text-pink-500"><Globe size={16} /> Web Grounded</span>
            <span className="flex items-center gap-3 transition-colors hover:text-indigo-500"><Brain size={16} /> Neural Compute</span>
            <span className="flex items-center gap-3 transition-colors hover:text-red-500"><Terminal size={16} /> Direct Access</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
