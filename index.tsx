import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';

// Helper: Optimal Recognition Point calculation for RSVP
const getParts = (w: string) => {
  if (!w) return { pre: '', p: '', suf: '' };
  const len = w.length;
  let pos = Math.floor(len / 2.5);
  if (len <= 1) pos = 0;
  else if (len <= 5) pos = 1;
  return { pre: w.slice(0, pos), p: w.slice(pos, pos + 1), suf: w.slice(pos + 1) };
};

const App = () => {
  // Persistence
  const [text, setText] = useState(() => localStorage.getItem('speedreader_txt') || "Welcome to Speed Reader. This tool is designed to help you consume information faster. Paste your text here or use the scan button to digitize printed pages. Adjust the WPM (Words Per Minute) in the settings to find your optimal reading speed.");
  const [wpm, setWpm] = useState(350);
  const [fontSize, setFontSize] = useState(130);
  const [volume, setVolume] = useState(() => parseFloat(localStorage.getItem('speedreader_vol') || '0.7'));
  const [isRamping, setIsRamping] = useState(false);
  const [startWpm, setStartWpm] = useState(250);
  const [endWpm, setEndWpm] = useState(700);
  
  // Audio State
  const [audioName, setAudioName] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Runtime State
  const [playing, setPlaying] = useState(false);
  const [idx, setIdx] = useState(0);
  const [showSettings, setShowSettings] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  const words = useMemo(() => text.trim().replace(/[\r\n]+/g, ' ').split(/\s+/), [text]);
  const timer = useRef<number | null>(null);

  useEffect(() => { localStorage.setItem('speedreader_txt', text); }, [text]);
  useEffect(() => { localStorage.setItem('speedreader_vol', volume.toString()); }, [volume]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      if (playing) {
        audioRef.current.play().catch(e => console.warn("Playback blocked by browser - will start on first click."));
      } else {
        audioRef.current.pause();
      }
    }
  }, [playing, volume]);

  const currentWpm = useMemo(() => {
    if (!isRamping) return wpm;
    const progress = idx / Math.max(1, words.length - 1);
    return Math.round(startWpm + (endWpm - startWpm) * progress);
  }, [isRamping, wpm, startWpm, endWpm, idx, words.length]);

  const next = useCallback(() => {
    setIdx(i => {
      if (i >= words.length - 1) { 
        setPlaying(false); 
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        return i; 
      }
      return i + 1;
    });
  }, [words.length]);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (playing && words.length > 0) {
      const word = words[idx] || '';
      let ms = 60000 / currentWpm;
      if (/[.!?]$/.test(word)) ms *= 2.4;
      else if (/[,;:]$/.test(word)) ms *= 1.6;
      timer.current = window.setTimeout(next, ms);
    }
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [playing, idx, currentWpm, next, words]);

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
      setShowSettings(true);
    } catch (e) { 
      alert("Note: To use the scanner offline, it must be run once while online to cache the OCR engine.");
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
    <div className="h-screen w-screen bg-black flex flex-col overflow-hidden relative">
      <div className="absolute top-0 inset-x-0 p-8 flex justify-between items-start z-10 pointer-events-none">
        <div className="pointer-events-auto">
          <div className="flex flex-col mb-6">
            <h1 className="text-blue-500 font-poppins font-medium text-lg tracking-tight">Tim the Teacher</h1>
            <h2 className="text-white text-3xl font-black italic tracking-tighter -mt-1 uppercase">Speed Reader</h2>
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-[10px] uppercase font-black tracking-[0.3em] text-zinc-600">Velocity</p>
              <p className="text-3xl font-bold text-blue-400 tabular-nums">{currentWpm} <span className="text-xs text-zinc-800">WPM</span></p>
            </div>
            {audioName && (
              <div className="flex flex-col gap-3 glass p-4 rounded-2xl w-48 border-blue-500/20">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_#3b82f6]" />
                  <p className="text-[9px] font-bold text-zinc-300 uppercase tracking-widest truncate">{audioName}</p>
                </div>
                <div className="flex items-center gap-3">
                   <svg className="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 24 24"><path d="M13.5 4.06c-.22-.13-.48-.19-.75-.19-.26 0-.52.06-.75.19L7 7H4c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h3l5.01 2.94c.23.13.49.19.75.19.27 0 .53-.06.75-.19.46-.27.75-.77.75-1.31V5.38c0-.53-.29-1.03-.75-1.31zM16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
                   <input type="range" min="0" max="1" step="0.01" value={volume} onChange={e => setVolume(parseFloat(e.target.value))} className="flex-1 accent-blue-500 h-1 cursor-pointer" />
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-4 pointer-events-auto">
          <label className={`p-5 glass rounded-2xl cursor-pointer hover:bg-white/10 transition-all active:scale-90 group shadow-2xl ${audioName ? 'border-blue-500/50' : ''}`}>
            <svg className="w-6 h-6 text-zinc-500 group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
            <input type="file" className="hidden" accept="audio/*" onChange={onAudioFile} />
          </label>
          <label className="p-5 glass rounded-2xl cursor-pointer hover:bg-white/10 transition-all active:scale-90 group shadow-2xl">
            <svg className="w-6 h-6 text-zinc-500 group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
            <input type="file" className="hidden" accept="image/*" onChange={onFile} />
          </label>
          <button onClick={() => setShowSettings(!showSettings)} className={`p-5 rounded-2xl transition-all active:scale-90 shadow-2xl ${showSettings ? 'bg-blue-600 text-white' : 'glass text-zinc-500 hover:text-white'}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center cursor-pointer px-10" onClick={() => setPlaying(!playing)}>
        <div className="flex font-black leading-none w-full select-none" style={{ fontSize: `${fontSize}px` }}>
          <div className="flex-1 text-right text-zinc-300/40 overflow-hidden pr-2">{pre}</div>
          <div className="pivot-red">{p}</div>
          <div className="flex-1 text-left text-zinc-300/40 overflow-hidden pl-2">{suf}</div>
        </div>
        <div className="mt-24 w-full max-w-2xl h-1.5 bg-zinc-900/50 rounded-full overflow-hidden border border-white/5">
          <div className="h-full bg-blue-500 transition-all duration-300 shadow-[0_0_20px_#3b82f6]" style={{ width: `${(idx / words.length) * 100}%` }} />
        </div>
        {!playing && <p className="mt-10 text-[11px] font-black uppercase tracking-[0.6em] text-zinc-700 animate-pulse-soft">Tap to Engage</p>}
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/98 backdrop-blur-3xl p-8 md:p-16 flex flex-col overflow-y-auto custom-scrollbar">
          <div className="max-w-4xl mx-auto w-full space-y-16 py-10">
            <div className="flex justify-between items-center border-b border-white/5 pb-10">
              <div className="flex flex-col">
                <span className="text-blue-500 font-poppins font-medium text-lg">Tim the Teacher</span>
                <h2 className="text-5xl font-black italic tracking-tighter uppercase">Settings</h2>
              </div>
              <button onClick={() => setShowSettings(false)} className="px-8 py-3 glass rounded-2xl text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all">Close</button>
            </div>
            <div className="space-y-6">
              <label className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Reading Material</label>
              <textarea value={text} onChange={e => setText(e.target.value)} className="w-full h-64 bg-zinc-900/30 border border-zinc-800 rounded-[2.5rem] p-8 text-zinc-300 focus:outline-none focus:border-blue-500/50 resize-none text-xl leading-relaxed custom-scrollbar" placeholder="Paste your text here..." />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="glass p-10 rounded-[3rem] space-y-8">
                <div className="flex justify-between items-center">
                  <h3 className="text-[10px] font-black text-orange-500 uppercase tracking-[0.3em]">WPM Speed</h3>
                  <button onClick={() => setIsRamping(!isRamping)} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-xl ${isRamping ? 'bg-orange-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}>Ramping {isRamping ? 'On' : 'Off'}</button>
                </div>
                {!isRamping ? (
                  <div className="space-y-6">
                    <input type="range" min="50" max="1200" step="10" value={wpm} onChange={e => setWpm(parseInt(e.target.value))} />
                    <p className="text-center text-4xl font-black text-orange-400 tabular-nums">{wpm} <span className="text-xs text-zinc-800 uppercase font-bold tracking-widest">WPM</span></p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest text-center">Start</p>
                      <input type="number" value={startWpm} onChange={e => setStartWpm(parseInt(e.target.value) || 0)} className="w-full bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl font-black text-orange-400 text-center text-2xl outline-none" />
                    </div>
                    <div className="space-y-3">
                      <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest text-center">End</p>
                      <input type="number" value={endWpm} onChange={e => setEndWpm(parseInt(e.target.value) || 0)} className="w-full bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl font-black text-orange-400 text-center text-2xl outline-none" />
                    </div>
                  </div>
                )}
              </div>
              <div className="glass p-10 rounded-[3rem] space-y-8">
                <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Visual Scale</h3>
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Size</p>
                    <p className="text-2xl font-black text-blue-400">{fontSize}px</p>
                  </div>
                  <input type="range" min="40" max="400" value={fontSize} onChange={e => setFontSize(parseInt(e.target.value))} />
                </div>
              </div>
            </div>
            <button onClick={() => { setShowSettings(false); setIdx(0); setPlaying(false); }} className="w-full py-8 bg-white text-black font-black rounded-[2.5rem] text-2xl hover:bg-blue-500 transition-all shadow-[0_20px_50px_rgba(59,130,246,0.2)] active:scale-[0.98]">START READING</button>
          </div>
        </div>
      )}

      {isScanning && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-12 text-center">
          <div className="w-24 h-24 border-8 border-white/5 border-t-blue-500 rounded-full animate-spin mb-10" />
          <h2 className="text-4xl font-black italic tracking-tighter mb-4 uppercase">Scanning...</h2>
          <div className="w-80 h-2 bg-zinc-900 rounded-full mt-12 overflow-hidden">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${scanProgress * 100}%` }} />
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