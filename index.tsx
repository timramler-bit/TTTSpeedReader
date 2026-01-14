import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';

// Helper: Optimal Recognition Point calculation for RSVP (Rapid Serial Visual Presentation)
const getParts = (w: string) => {
  if (!w) return { pre: '', p: '', suf: '' };
  const len = w.length;
  let pos = Math.floor(len / 2.5);
  if (len <= 1) pos = 0;
  else if (len <= 5) pos = 1;
  return { pre: w.slice(0, pos), p: w.slice(pos, pos + 1), suf: w.slice(pos + 1) };
};

const App = () => {
  // --- PERSISTENCE & SETTINGS ---
  const [text, setText] = useState(() => localStorage.getItem('sr_text') || "Welcome to Speed Reader. Paste your content here to begin. Use the loop settings to repeat the text as many times as you like. Adjust the WPM to find your perfect reading flow.");
  const [wpm, setWpm] = useState(350);
  const [fontSize, setFontSize] = useState(130);
  const [volume, setVolume] = useState(() => parseFloat(localStorage.getItem('sr_vol') || '0.7'));
  const [isRamping, setIsRamping] = useState(false);
  const [startWpm, setStartWpm] = useState(250);
  const [endWpm, setEndWpm] = useState(700);
  
  // --- LOOP STATE ---
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopMax, setLoopMax] = useState(3); // 0 for infinite
  const [currentLoop, setCurrentLoop] = useState(1);

  // --- AUDIO & ASSETS ---
  const [audioName, setAudioName] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- RUNTIME STATE ---
  const [playing, setPlaying] = useState(false);
  const [idx, setIdx] = useState(0);
  const [showSettings, setShowSettings] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  const words = useMemo(() => text.trim().replace(/[\r\n]+/g, ' ').split(/\s+/), [text]);
  const timer = useRef<number | null>(null);

  useEffect(() => { localStorage.setItem('sr_text', text); }, [text]);
  useEffect(() => { localStorage.setItem('sr_vol', volume.toString()); }, [volume]);

  // Audio Sync
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      if (playing) {
        audioRef.current.play().catch(() => console.log("Audio needs user interaction first."));
      } else {
        audioRef.current.pause();
      }
    }
  }, [playing, volume]);

  // Calculate current speed if ramping
  const currentWpm = useMemo(() => {
    if (!isRamping) return wpm;
    const progress = idx / Math.max(1, words.length - 1);
    return Math.round(startWpm + (endWpm - startWpm) * progress);
  }, [isRamping, wpm, startWpm, endWpm, idx, words.length]);

  // Advance Word Logic
  const next = useCallback(() => {
    setIdx(i => {
      if (i >= words.length - 1) { 
        // Handle Looping
        if (loopEnabled && (loopMax === 0 || currentLoop < loopMax)) {
          setCurrentLoop(prev => prev + 1);
          if (audioRef.current) audioRef.current.currentTime = 0;
          return 0; // Restart
        }
        // End of reading
        setPlaying(false); 
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        return i; 
      }
      return i + 1;
    });
  }, [words.length, loopEnabled, loopMax, currentLoop]);

  // Speed Timer
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (playing && words.length > 0) {
      const word = words[idx] || '';
      let ms = 60000 / currentWpm;
      // Add punctuation pauses for natural reading rhythm
      if (/[.!?]$/.test(word)) ms *= 2.2;
      else if (/[,;:]$/.test(word)) ms *= 1.5;
      timer.current = window.setTimeout(next, ms);
    }
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [playing, idx, currentWpm, next, words]);

  // OCR Logic
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    try {
      // @ts-ignore
      const { data: { text: res } } = await Tesseract.recognize(file, 'eng', {
        logger: (m: any) => { if (m.status === 'recognizing') setScanProgress(m.progress); }
      });
      setText(res);
      setIdx(0);
      setCurrentLoop(1);
      setShowSettings(true);
    } catch (e) { 
      alert("Note: Scanner requires an initial online load to cache Tesseract models.");
    }
    setIsScanning(false);
  };

  const onAudioFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
    } else {
      audioRef.current.src = url;
    }
    setAudioName(file.name);
    setPlaying(false);
  };

  const { pre, p, suf } = getParts(words[idx] || '');

  return (
    <div className="h-screen w-screen bg-black flex flex-col overflow-hidden relative text-white selection:bg-blue-500/30">
      {/* --- HUD --- */}
      <div className="absolute top-0 inset-x-0 p-8 flex justify-between items-start z-10 pointer-events-none">
        <div className="pointer-events-auto">
          <div className="flex flex-col mb-6">
            <h1 className="text-white text-3xl font-black italic tracking-tighter uppercase leading-none">Speed Reader</h1>
            <div className="h-1 w-12 bg-blue-600 mt-2 rounded-full" />
          </div>
          
          <div className="space-y-4">
            <div className="flex gap-8">
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-black tracking-[0.3em] text-zinc-600">Velocity</p>
                <p className="text-3xl font-bold text-blue-400 tabular-nums">{currentWpm} <span className="text-[10px] text-zinc-700 uppercase">WPM</span></p>
              </div>
              
              {loopEnabled && (
                <div className="space-y-1 border-l border-white/10 pl-8">
                  <p className="text-[10px] uppercase font-black tracking-[0.3em] text-zinc-600">Cycle</p>
                  <p className="text-3xl font-bold text-green-400 tabular-nums">
                    {currentLoop}<span className="text-xs text-zinc-800 uppercase font-bold tracking-widest ml-1">/ {loopMax === 0 ? '∞' : loopMax}</span>
                  </p>
                </div>
              )}
            </div>
            
            {audioName && (
              <div className="flex flex-col gap-3 glass p-4 rounded-2xl w-52 border-blue-500/20 shadow-2xl">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <p className="text-[9px] font-bold text-zinc-300 uppercase tracking-widest truncate">{audioName}</p>
                </div>
                <div className="flex items-center gap-3">
                   <svg className="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 24 24"><path d="M13.5 4.06c-.22-.13-.48-.19-.75-.19-.26 0-.52.06-.75.19L7 7H4c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h3l5.01 2.94c.23.13.49.19.75.19.27 0 .53-.06.75-.19.46-.27.75-.77.75-1.31V5.38c0-.53-.29-1.03-.75-1.31zM16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
                   <input type="range" min="0" max="1" step="0.01" value={volume} onChange={e => setVolume(parseFloat(e.target.value))} className="flex-1 h-1" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 pointer-events-auto">
          <label className={`p-4 glass rounded-2xl cursor-pointer hover:bg-white/10 transition-all active:scale-95 group ${audioName ? 'border-blue-500/40' : ''}`}>
            <svg className="w-5 h-5 text-zinc-500 group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
            <input type="file" className="hidden" accept="audio/*" onChange={onAudioFile} />
          </label>
          <label className="p-4 glass rounded-2xl cursor-pointer hover:bg-white/10 transition-all active:scale-95 group">
            <svg className="w-5 h-5 text-zinc-500 group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
            <input type="file" className="hidden" accept="image/*" onChange={onFile} />
          </label>
          <button onClick={() => setShowSettings(!showSettings)} className={`p-4 rounded-2xl transition-all active:scale-95 ${showSettings ? 'bg-blue-600 text-white' : 'glass text-zinc-500 hover:text-white'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
          </button>
        </div>
      </div>

      {/* --- READER CORE --- */}
      <div className="flex-1 flex flex-col items-center justify-center cursor-pointer px-10" onClick={() => setPlaying(!playing)}>
        <div className="flex font-black leading-none w-full select-none" style={{ fontSize: `${fontSize}px` }}>
          <div className="flex-1 text-right text-zinc-300/30 overflow-hidden pr-2">{pre}</div>
          <div className="pivot-red">{p}</div>
          <div className="flex-1 text-left text-zinc-300/30 overflow-hidden pl-2">{suf}</div>
        </div>
        
        {/* Progress Tracker */}
        <div className="mt-20 w-full max-w-xl h-1 bg-zinc-900 rounded-full overflow-hidden border border-white/5 relative">
          <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${(idx / words.length) * 100}%` }} />
        </div>
        
        {!playing && (
          <div className="mt-12 flex flex-col items-center gap-2 opacity-40">
             <p className="text-[10px] font-black uppercase tracking-[0.5em] animate-pulse-soft">System Idle</p>
             <p className="text-[9px] text-zinc-500 uppercase font-medium">Tap anywhere to resume</p>
          </div>
        )}
      </div>

      {/* --- SETTINGS MODAL --- */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl p-6 md:p-20 flex flex-col overflow-y-auto custom-scrollbar">
          <div className="max-w-4xl mx-auto w-full space-y-12">
            
            <div className="flex justify-between items-center border-b border-white/10 pb-10">
              <div className="flex flex-col">
                <h2 className="text-4xl md:text-6xl font-black italic tracking-tighter uppercase leading-tight">Configurator</h2>
                <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-2">Speed Reader Control Panel</p>
              </div>
              <button onClick={() => setShowSettings(false)} className="px-10 py-4 glass rounded-3xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all active:scale-95">Dismiss</button>
            </div>

            {/* Input Section */}
            <div className="space-y-4">
              <label className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] ml-2">Content Buffer</label>
              <textarea 
                value={text} 
                onChange={e => setText(e.target.value)} 
                className="w-full h-48 bg-white/5 border border-white/10 rounded-[2rem] p-8 text-zinc-200 focus:outline-none focus:border-blue-500/40 resize-none text-lg leading-relaxed custom-scrollbar"
                placeholder="Paste text here..." 
              />
            </div>

            {/* Config Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Loop Controls */}
              <div className="glass p-10 rounded-[2.5rem] space-y-8 border-white/5">
                <div className="flex justify-between items-center">
                   <h3 className="text-[10px] font-black text-green-500 uppercase tracking-[0.3em]">Loop System</h3>
                   <button 
                    onClick={() => setLoopEnabled(!loopEnabled)} 
                    className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all shadow-xl ${loopEnabled ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}
                   >
                    {loopEnabled ? 'Active' : 'Disabled'}
                   </button>
                </div>
                {loopEnabled ? (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Iterations (0 = ∞)</p>
                      <p className="text-2xl font-black text-green-400">{loopMax === 0 ? 'Infinite' : loopMax}</p>
                    </div>
                    <input type="range" min="0" max="20" step="1" value={loopMax} onChange={e => setLoopMax(parseInt(e.target.value))} />
                  </div>
                ) : (
                  <div className="h-16 flex items-center justify-center border-2 border-dashed border-white/5 rounded-2xl">
                     <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest italic">Continuous playback offline</p>
                  </div>
                )}
              </div>

              {/* Font Size */}
              <div className="glass p-10 rounded-[2.5rem] space-y-8 border-white/5">
                <div className="flex justify-between items-center">
                  <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Scale</h3>
                  <p className="text-2xl font-black text-blue-400">{fontSize}<span className="text-[10px] ml-1">PX</span></p>
                </div>
                <div className="space-y-6">
                  <input type="range" min="40" max="400" value={fontSize} onChange={e => setFontSize(parseInt(e.target.value))} />
                </div>
              </div>

              {/* Speed Controls */}
              <div className="glass p-10 rounded-[2.5rem] space-y-10 border-white/5 md:col-span-2">
                <div className="flex justify-between items-center">
                  <h3 className="text-[10px] font-black text-orange-500 uppercase tracking-[0.3em]">Velocity Engine</h3>
                  <button 
                    onClick={() => setIsRamping(!isRamping)} 
                    className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all shadow-xl ${isRamping ? 'bg-orange-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}
                  >
                    Ramping {isRamping ? 'On' : 'Off'}
                  </button>
                </div>
                
                {!isRamping ? (
                  <div className="space-y-6">
                    <input type="range" min="50" max="1500" step="10" value={wpm} onChange={e => setWpm(parseInt(e.target.value))} />
                    <p className="text-center text-5xl font-black text-orange-400 tabular-nums">{wpm} <span className="text-xs text-zinc-800 uppercase font-bold tracking-[0.4em]">WPM</span></p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-10">
                    <div className="space-y-3">
                      <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest text-center">Initial Speed</p>
                      <input type="number" value={startWpm} onChange={e => setStartWpm(parseInt(e.target.value) || 0)} className="w-full bg-black border border-white/10 p-6 rounded-3xl font-black text-orange-400 text-center text-3xl outline-none focus:border-orange-500/30" />
                    </div>
                    <div className="space-y-3">
                      <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest text-center">Target Speed</p>
                      <input type="number" value={endWpm} onChange={e => setEndWpm(parseInt(e.target.value) || 0)} className="w-full bg-black border border-white/10 p-6 rounded-3xl font-black text-orange-400 text-center text-3xl outline-none focus:border-orange-500/30" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Launch Button */}
            <button 
              onClick={() => { setShowSettings(false); setIdx(0); setCurrentLoop(1); setPlaying(true); }} 
              className="group relative w-full overflow-hidden py-12 bg-white text-black font-black rounded-[2.5rem] text-4xl hover:scale-[1.01] transition-all active:scale-[0.98] shadow-2xl uppercase tracking-tighter italic"
            >
              <div className="relative z-10 flex items-center justify-center gap-4">
                Engage Engine
                <svg className="w-10 h-10 transform group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* --- OCR OVERLAY --- */}
      {isScanning && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-3xl flex flex-col items-center justify-center p-12 text-center">
          <div className="relative w-32 h-32 mb-12">
            <div className="absolute inset-0 border-4 border-white/5 rounded-full" />
            <div className="absolute inset-0 border-4 border-t-blue-500 rounded-full animate-spin shadow-[0_0_20px_#3b82f6]" />
          </div>
          <h2 className="text-5xl font-black italic tracking-tighter uppercase text-white mb-2">Analyzing</h2>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em]">Digitizing Physical Source</p>
          <div className="w-64 h-1 bg-zinc-900 rounded-full mt-12 overflow-hidden border border-white/5">
            <div className="h-full bg-blue-500 transition-all shadow-[0_0_15px_#3b82f6]" style={{ width: `${scanProgress * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}