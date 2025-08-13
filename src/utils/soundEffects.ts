import React, { useCallback, useRef } from 'react';

export const useSnapSound = () => {
  const audioContextRef = useRef<AudioContext | null>(null);

  const playSnapSound = useCallback(() => {
    if (typeof window.AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined') {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const audioContext = audioContextRef.current;
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } else {
      console.log('Snap!');
    }
  }, []);

  return playSnapSound;
};
