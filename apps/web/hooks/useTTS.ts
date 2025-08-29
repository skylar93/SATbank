'use client';
import { useState, useCallback } from 'react';

export function useTTS() {
  const [isPlaying, setIsPlaying] = useState(false);

  const speak = useCallback((text: string, lang: string = 'en-US') => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.error("TTS not supported in this browser.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9; // Slightly slower for vocabulary learning
    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);

    // Cancel any previous speech
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    }
  }, []);

  return { speak, stop, isPlaying };
}