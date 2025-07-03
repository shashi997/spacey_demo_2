import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * A robust custom hook to interact with the browser's SpeechSynthesis API.
 * @returns {object} An object containing the speak function, speaking state, and support status.
 */
const useSpeechSynthesis = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isSpeakingRef = useRef(false);

  useEffect(() => {
    if ('speechSynthesis' in window) {
      setIsSupported(true);
      const synth = window.speechSynthesis;
      const updateVoices = () => {
        if (synth.getVoices().length > 0) {
          // Voices loaded
        }
      };
      synth.addEventListener('voiceschanged', updateVoices);
      updateVoices();
      return () => {
        synth.removeEventListener('voiceschanged', updateVoices);
        if (synth.speaking) {
          synth.cancel();
        }
      };
    }
  }, []);

  const speak = useCallback((text, { onEnd } = {}) => {
    const textToSpeak = text.trim();
    if (!isSupported || !textToSpeak) {
      if (onEnd) setTimeout(() => onEnd(), 0); // Ensure onEnd is called to not block flow
      return;
    }

    const synth = window.speechSynthesis;

    const trySpeak = () => {
      const availableVoices = synth.getVoices();
      if (availableVoices.length === 0) {
        setTimeout(trySpeak, 100);
        return;
      }

      if (synth.speaking) {
        synth.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      const selectedVoice =
        availableVoices.find(v => v.name === 'Google UK English Female' && v.localService) ||
        availableVoices.find(v => v.name === 'Microsoft Zira - English (United States)' && v.localService) ||
        availableVoices.find(v => v.lang.startsWith('en') && v.localService) ||
        availableVoices.find(v => v.name === 'Google UK English Female') ||
        availableVoices.find(v => v.name === 'Microsoft Zira - English (United States)') ||
        availableVoices.find(v => v.lang === 'en-US') ||
        availableVoices.find(v => v.lang.startsWith('en'));

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.pitch = 1;
      utterance.rate = 1;
      utterance.volume = 1;

      utterance.onstart = () => {
        isSpeakingRef.current = true;
        setIsSpeaking(true);
      };

      utterance.onend = () => {
        setTimeout(() => {
          if (isSpeakingRef.current) {
            isSpeakingRef.current = false;
            setIsSpeaking(false);
            if (onEnd) onEnd(); // <-- Call the provided onEnd callback
          }
        }, 100);
      };

      utterance.onerror = (event) => {
        console.error('SpeechSynthesis Error', event);
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        if (onEnd) onEnd(); // <-- Also call onEnd on error
      };

      setTimeout(() => {
        synth.speak(utterance);
      }, 50);
    };

    trySpeak();
  }, [isSupported]);

  const cancel = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    isSpeakingRef.current = false;
    setIsSpeaking(false);
  }, [isSupported]);

  const prime = useCallback(() => {
    if (!isSupported) return;
    const synth = window.speechSynthesis;
    if (synth.speaking || synth.pending) return;
    const utterance = new SpeechSynthesisUtterance(' ');
    utterance.volume = 0;
    synth.speak(utterance);
  }, [isSupported]);

  return {
    isSupported,
    isSpeaking,
    speak,
    cancel,
    prime,
  };
};

export default useSpeechSynthesis;
