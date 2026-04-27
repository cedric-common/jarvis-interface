"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export default function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const synth = window.speechSynthesis;

    const loadVoices = () => {
      const available = synth.getVoices();
      setVoices(available);
    };

    loadVoices();

    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = loadVoices;
    }

    return () => {
      if (synth.onvoiceschanged !== undefined) {
        synth.onvoiceschanged = null;
      }
    };
  }, []);

  const getFrenchVoice = useCallback(() => {
    let voice = voices.find((v) => v.lang === "fr-FR");
    if (!voice) {
      voice = voices.find((v) => v.lang.startsWith("fr"));
    }
    return voice || null;
  }, [voices]);

  const speak = useCallback(
    (text: string) => {
      if (typeof window === "undefined") return;
      const synth = window.speechSynthesis;
      if (synth.speaking) {
        synth.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      const frenchVoice = getFrenchVoice();
      if (frenchVoice) {
        utterance.voice = frenchVoice;
        utterance.lang = frenchVoice.lang;
      } else {
        utterance.lang = "fr-FR";
      }
      utterance.pitch = 1.0;
      utterance.rate = 1.1;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      utteranceRef.current = utterance;
      synth.speak(utterance);
    },
    [getFrenchVoice]
  );

  const stop = useCallback(() => {
    if (typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking, voices };
}
