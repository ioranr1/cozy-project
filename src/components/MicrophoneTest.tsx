import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

const MicrophoneTest: React.FC = () => {
  const { language } = useLanguage();
  const [isListening, setIsListening] = useState(false);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const stop = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    setLevel(0);
    setIsListening(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsListening(true);

      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i];
        const avg = sum / buf.length;
        setLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e: any) {
      setError(e.message || 'Microphone access denied');
      setIsListening(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stop(), [stop]);

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-white/60" />
          <h4 className="text-sm font-semibold text-white">
            {language === 'he' ? 'בדיקת מיקרופון' : 'Microphone Test'}
          </h4>
        </div>
        <Button
          size="sm"
          variant={isListening ? 'destructive' : 'default'}
          onClick={isListening ? stop : start}
          className="h-8 px-3 text-xs"
        >
          {isListening ? (
            <><MicOff className="w-3 h-3 mr-1" />{language === 'he' ? 'עצור' : 'Stop'}</>
          ) : (
            <><Mic className="w-3 h-3 mr-1" />{language === 'he' ? 'בדוק' : 'Test'}</>
          )}
        </Button>
      </div>

      {/* Level bar */}
      <div className="h-3 bg-slate-700/50 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-75 ${
            level > 60 ? 'bg-green-500' : level > 30 ? 'bg-yellow-500' : level > 5 ? 'bg-blue-500' : 'bg-slate-600'
          }`}
          style={{ width: `${level}%` }}
        />
      </div>

      {isListening && (
        <p className="text-xs text-white/50 mt-2 text-center">
          {language === 'he' ? `עוצמה: ${level}%` : `Level: ${level}%`}
        </p>
      )}

      {error && (
        <p className="text-xs text-red-400 mt-2">{error}</p>
      )}
    </div>
  );
};

export default MicrophoneTest;
