"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseSpeechRecognitionProps {
  continuous?: boolean;
  autoRestart?: boolean;
}

export default function useSpeechRecognition({
  continuous = false,
  autoRestart = false,
}: UseSpeechRecognitionProps = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const autoRestartRef = useRef(autoRestart);
  const continuousRef = useRef(continuous);

  useEffect(() => {
    autoRestartRef.current = autoRestart;
  }, [autoRestart]);

  useEffect(() => {
    continuousRef.current = continuous;
  }, [continuous]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.continuous = continuousRef.current;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setInterimTranscript("");
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        setTranscript((prev) => prev + final);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: any) => {
      console.warn("Speech recognition error:", event.error);
      setIsListening(false);
      // Auto-restart on no-speech or aborted if in continuous mode
      if (
        autoRestartRef.current &&
        (event.error === "no-speech" || event.error === "aborted")
      ) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch {
            // May already be starting
          }
        }, 500);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
      // Auto-restart if continuous mode
      if (autoRestartRef.current) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch {
            // Already started or unsupported
          }
        }, 300);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        // Ignore
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return;
    setTranscript("");
    setInterimTranscript("");
    try {
      recognitionRef.current.start();
    } catch (err) {
      console.warn("Start error:", err);
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      // Ignore
    }
    setIsListening(false);
    setInterimTranscript("");
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  };
}
