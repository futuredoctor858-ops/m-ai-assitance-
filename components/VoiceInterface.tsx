
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { encode, decode, decodeAudioData } from '../services/audio-utils';
import { MYRA_SYSTEM_INSTRUCTION, VOICES } from '../constants';
// Added missing MicOff import
import { Mic, MicOff, Volume2, Sparkles, Loader2, ShieldCheck, Brain, Zap, Sun, Volume1 } from 'lucide-react';

const VoiceInterface: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [assistantTranscription, setAssistantTranscription] = useState('');
  const [status, setStatus] = useState('Neural Standby');
  const [results, setResults] = useState<{type: 'image' | 'video' | 'system', data: any, prompt?: string}[]>([]);
  
  // System State - Optimized for PC/Android
  const [volume, setVolume] = useState(100);
  const [brightness, setBrightness] = useState(100);
  const [accentColor, setAccentColor] = useState('#ec4899');

  const audioContextRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const outputGainNodeRef = useRef<GainNode | null>(null);
  const sessionRef = useRef<any>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (e) {}
      sessionRef.current = null;
    }
    if (sourcesRef.current) {
      sourcesRef.current.forEach(source => { try { source.stop(); } catch(e) {} });
      sourcesRef.current.clear();
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.input?.close();
        audioContextRef.current.output?.close();
      } catch (e) {}
      audioContextRef.current = null;
    }
    setIsActive(false);
    setIsConnecting(false);
    setStatus('Link Severed');
  }, []);

  const handleToolCall = async (fc: any) => {
    // Creating a new GoogleGenAI instance right before making an API call to ensure it always uses the most up-to-date API key
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    if (fc.name === 'controlSystem') {
      const { volume: newVol, brightness: newBright, accentColor: newColor } = fc.args;
      if (newVol !== undefined) {
        const clampedVol = Math.max(0, Math.min(100, newVol));
        setVolume(clampedVol);
        if (outputGainNodeRef.current) outputGainNodeRef.current.gain.value = clampedVol / 100;
      }
      if (newBright !== undefined) setBrightness(Math.max(10, Math.min(100, newBright)));
      if (newColor !== undefined) setAccentColor(newColor);
      
      setStatus('System Sync Updated');
      setResults(prev => [{type: 'system', data: `M-Core: Vol ${newVol ?? volume}%, Bright ${newBright ?? brightness}%`, prompt: 'System Link'}, ...prev]);
      return { status: "success", result: "Environment adjusted." };
    }

    if (fc.name === 'generateImage') {
      setStatus('Synthesizing Visuals...');
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: { parts: [{ text: fc.args.prompt }] },
          config: { imageConfig: { aspectRatio: '1:1', imageSize: '1K' } }
        });
        const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (part?.inlineData) {
          const url = `data:image/png;base64,${part.inlineData.data}`;
          setResults(prev => [{type: 'image', data: url, prompt: fc.args.prompt}, ...prev]);
        }
      } catch (e) { console.error(e); }
    }

    if (fc.name === 'generateVideo') {
      setStatus('Rendering Neural Video...');
      try {
        let operation = await ai.models.generateVideos({
          model: 'veo-3.1-fast-generate-preview',
          prompt: fc.args.prompt,
          config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
        });
        while (!operation.done) {
          await new Promise(r => setTimeout(r, 8000));
          operation = await ai.operations.getVideosOperation({ operation });
        }
        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (downloadLink) {
          const resp = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          setResults(prev => [{type: 'video', data: url, prompt: fc.args.prompt}, ...prev]);
        }
      } catch (e) { console.error(e); }
    }

    setStatus('Link Active');
    return { status: "success" };
  };

  const startSession = async () => {
    // Vibration feedback for mobile
    if (navigator.vibrate) navigator.vibrate(50);
    
    setIsConnecting(true);
    setStatus('Establishing Core M...');
    try {
      // Creating a new GoogleGenAI instance right before making an API call to ensure it always uses the most up-to-date API key
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const gainNode = outputCtx.createGain();
      gainNode.gain.value = volume / 100;
      gainNode.connect(outputCtx.destination);
      outputGainNodeRef.current = gainNode;
      
      audioContextRef.current = { input: inputCtx, output: outputCtx };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const tools: FunctionDeclaration[] = [
        {
          name: 'controlSystem',
          description: 'Change volume, screen brightness, or theme color of the M interface.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              volume: { type: Type.NUMBER, description: 'New volume level (0-100)' },
              brightness: { type: Type.NUMBER, description: 'Interface brightness (10-100)' },
              accentColor: { type: Type.STRING, description: 'CSS Hex color code' }
            }
          }
        },
        {
          name: 'generateImage',
          description: 'Visualize a scene into an image',
          parameters: {
            type: Type.OBJECT,
            properties: { prompt: { type: Type.STRING } },
            required: ['prompt']
          }
        },
        {
          name: 'generateVideo',
          description: 'Visualize a scene into a high-quality video',
          parameters: {
            type: Type.OBJECT,
            properties: { prompt: { type: Type.STRING } },
            required: ['prompt']
          }
        }
      ];

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsActive(true);
            setIsConnecting(false);
            setStatus('M Link Active');
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              sessionPromise.then(s => {
                // Ensure data is streamed only after the session promise resolves
                if (s) s.sendRealtimeInput({ media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) setTranscription(message.serverContent.inputTranscription.text);
            if (message.serverContent?.outputTranscription) setAssistantTranscription(message.serverContent.outputTranscription.text);
            
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                const result = await handleToolCall(fc);
                sessionPromise.then(s => {
                  if (s) s.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: result }] });
                });
              }
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputGainNodeRef.current) {
              const outCtx = audioContextRef.current!.output;
              // Schedule nextStartTime to ensure smooth, gapless playback
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
              const buffer = await decodeAudioData(decode(base64Audio), outCtx, 24000, 1);
              const source = outCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputGainNodeRef.current);
              source.addEventListener('ended', () => sourcesRef.current.delete(source));
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
          },
          onerror: () => cleanup(),
          onclose: () => cleanup(),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ googleSearch: {} }, { functionDeclarations: tools }],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICES.FEMALE } } },
          systemInstruction: MYRA_SYSTEM_INSTRUCTION,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (e) {
      setIsConnecting(false);
      setStatus('Sync Failed');
      cleanup();
    }
  };

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return (
    <div 
      className="h-full flex flex-col items-center justify-center p-4 md:p-6 relative transition-all duration-1000 ease-in-out"
      style={{ 
        backgroundColor: `rgba(0,0,0,${1 - (brightness / 100)})`,
        filter: `brightness(${brightness}%)` 
      }}
    >
      {/* Background Ambience */}
      <div 
        className="fixed inset-0 pointer-events-none transition-all duration-1000 opacity-20"
        style={{ background: `radial-gradient(circle at center, ${accentColor}, transparent 70%)` }}
      />

      {/* Main Interface */}
      <div className="relative z-20 flex flex-col items-center w-full max-w-lg">
        {/* The 'M' Identity */}
        <div className="text-center mb-6 md:mb-12 animate-in fade-in zoom-in duration-1000">
           <h1 
             className="text-[10rem] md:text-[14rem] font-black italic tracking-tighter bg-gradient-to-b from-white to-white/5 bg-clip-text text-transparent leading-none"
             style={{ filter: `drop-shadow(0 0 30px ${accentColor}30)` }}
           >
             M
           </h1>
           <div className="flex items-center justify-center gap-4 -mt-4 md:-mt-8">
             <div 
               className={`w-3 h-3 rounded-full transition-all duration-500 ${isActive ? 'shadow-[0_0_20px_#22c55e]' : 'bg-white/10'}`} 
               style={{ backgroundColor: isActive ? '#22c55e' : undefined }}
             />
             <span className="text-[10px] md:text-[12px] font-black uppercase tracking-[0.5em] text-white/30">{status}</span>
           </div>
        </div>

        {/* Neural Orb Trigger */}
        <button 
          onClick={isActive ? cleanup : startSession}
          disabled={isConnecting}
          className={`relative w-56 h-56 md:w-72 md:h-72 rounded-full flex items-center justify-center transition-all duration-1000 ${
            isActive ? 'scale-110' : 'hover:scale-105 active:scale-95'
          }`}
        >
          {/* Pulsing Rings */}
          <div 
            className={`absolute inset-0 rounded-full border-2 transition-all duration-1000 ${isActive ? 'animate-ping scale-[1.8] opacity-30' : 'scale-100 opacity-5'}`} 
            style={{ borderColor: accentColor }}
          />
          <div 
            className={`absolute inset-0 rounded-full border transition-all duration-1000 delay-500 ${isActive ? 'animate-ping scale-[1.4] opacity-20' : 'scale-100 opacity-0'}`} 
            style={{ borderColor: accentColor }}
          />
          
          <div className={`w-36 h-36 md:w-48 md:h-48 rounded-full flex items-center justify-center transition-all duration-700 shadow-2xl ${
            isActive 
              ? 'shadow-lg ring-8 ring-white/10' 
              : 'bg-white/5 border border-white/10 backdrop-blur-3xl'
          }`}
          style={{ backgroundColor: isActive ? accentColor : undefined }}>
             {isConnecting ? <Loader2 className="text-white animate-spin" size={64} /> : 
              isActive ? <Volume2 className="text-white animate-pulse" size={64} /> : 
              <Mic className="text-white/20 group-hover:text-white" size={64} />
             }
          </div>
        </button>

        {/* Captions HUD */}
        <div className="mt-12 md:mt-16 w-full text-center min-h-[160px] px-6">
          {transcription && (
            <p className="text-2xl md:text-4xl font-black italic text-white/95 leading-none tracking-tight animate-in fade-in slide-in-from-bottom-4 duration-500">
              "{transcription}"
            </p>
          )}
          {assistantTranscription && (
            <p 
              className="text-lg md:text-xl font-bold mt-6 tracking-tight animate-in fade-in duration-1000 uppercase"
              style={{ color: accentColor }}
            >
              {assistantTranscription}
            </p>
          )}
        </div>
      </div>

      {/* Visual Execution Gallery */}
      {results.length > 0 && (
        <div className="absolute inset-x-0 bottom-24 md:bottom-32 z-30 flex gap-6 overflow-x-auto px-8 md:px-20 py-6 no-scrollbar mask-gradient-x">
          {results.map((res, i) => (
            <div key={i} className="flex-shrink-0 w-72 md:w-80 bg-[#080808]/90 backdrop-blur-2xl border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-12 duration-700">
               {res.type === 'image' && <img src={res.data} className="w-full aspect-square object-cover" />}
               {res.type === 'video' && <video src={res.data} autoPlay loop muted playsInline className="w-full aspect-video object-cover" />}
               {res.type === 'system' && (
                 <div className="p-8 flex items-center gap-4">
                   <Zap size={24} style={{ color: accentColor }} />
                   <div>
                     <p className="text-[10px] font-black uppercase tracking-widest text-white/20">System Command</p>
                     <p className="text-sm font-bold text-white mt-1">{res.data}</p>
                   </div>
                 </div>
               )}
               {res.type !== 'system' && (
                 <div className="p-6">
                   <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-40">M Execution</p>
                   <p className="text-xs text-white/60 font-medium italic line-clamp-1">"{res.prompt}"</p>
                 </div>
               )}
            </div>
          ))}
        </div>
      )}

      {/* System Monitoring HUD */}
      <div className="absolute bottom-10 left-10 flex gap-8 items-center text-white/20 font-black text-[10px] uppercase tracking-[0.6em] select-none">
        <div className="flex items-center gap-2 transition-colors duration-500" style={{ color: volume < 30 ? '#ef4444' : undefined }}>
          {volume === 0 ? <MicOff size={14} /> : <Volume1 size={14} />} VOL {volume}%
        </div>
        <div className="flex items-center gap-2">
          <Sun size={14} /> BRT {brightness}%
        </div>
      </div>

      <div className="absolute top-10 left-10 hidden md:flex items-center gap-3 text-white/20">
        <Brain size={18} />
        <span className="text-[10px] font-black uppercase tracking-[0.8em]">M-Neural 0.1</span>
      </div>

      <div className="absolute top-10 right-10 flex items-center gap-4 text-white/20 select-none">
        <ShieldCheck size={20} className="transition-all duration-700" style={{ color: isActive ? accentColor : undefined }} />
        <span className="text-[11px] font-black uppercase tracking-[0.4em]">Universal Link</span>
      </div>
    </div>
  );
};

export default VoiceInterface;
