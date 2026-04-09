// packages/client/src/hooks/useSound.ts
import { useCallback, useRef } from 'react';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine') {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.value = 0.15;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // 静默失败（浏览器限制等）
  }
}

export function useSound() {
  const enabled = useRef(true);

  const playCard = useCallback(() => {
    if (!enabled.current) return;
    playTone(800, 0.1, 'square');
  }, []);

  const playPass = useCallback(() => {
    if (!enabled.current) return;
    playTone(300, 0.15, 'sine');
  }, []);

  const playBomb = useCallback(() => {
    if (!enabled.current) return;
    playTone(150, 0.4, 'sawtooth');
    setTimeout(() => playTone(100, 0.3, 'sawtooth'), 100);
  }, []);

  const playTuoSan = useCallback(() => {
    if (!enabled.current) return;
    playTone(600, 0.15, 'square');
    setTimeout(() => playTone(800, 0.15, 'square'), 150);
    setTimeout(() => playTone(1000, 0.2, 'square'), 300);
  }, []);

  const playTick = useCallback(() => {
    if (!enabled.current) return;
    playTone(1000, 0.05, 'sine');
  }, []);

  const playButton = useCallback(() => {
    if (!enabled.current) return;
    playTone(500, 0.05, 'sine');
  }, []);

  const playFinish = useCallback(() => {
    if (!enabled.current) return;
    playTone(523, 0.15, 'sine');
    setTimeout(() => playTone(659, 0.15, 'sine'), 150);
    setTimeout(() => playTone(784, 0.2, 'sine'), 300);
  }, []);

  const toggle = useCallback(() => {
    enabled.current = !enabled.current;
    return enabled.current;
  }, []);

  return { playCard, playPass, playBomb, playTuoSan, playTick, playButton, playFinish, toggle };
}
