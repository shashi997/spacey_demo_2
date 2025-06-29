import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * A robust custom hook to interact with the browser's SpeechSynthesis API.
 * @returns {object} An object containing the speak function, speaking state, and support status.
 */
const useSpeechSynthesis = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  // Use a ref to ensure we don't have stale state in the onend callback
  const isSpeakingRef = useRef(false);

  // Effect to check for browser support and load available voices robustly
  useEffect(() => {
    if ('speechSynthesis' in window) {
      setIsSupported(true);
      const synth = window.speechSynthesis;

      const updateVoices = () => {
        if (synth.getVoices().length > 0) {
          // Voices are loaded, no need to listen anymore on some browsers.
          // We keep the listener for browsers that load voices asynchronously.
        }
      };

      // The 'voiceschanged' event is the standard way to get voices.
      synth.addEventListener('voiceschanged', updateVoices);
      
      // Call it once, as voices might already be loaded.
      updateVoices();

      // Cleanup: remove listener and cancel any speech on component unmount
      return () => {
        synth.removeEventListener('voiceschanged', updateVoices);
        if (synth.speaking) {
          synth.cancel();
        }
      };
    }
  }, []);

    const speak = useCallback((text) => {
    const textToSpeak = text.trim();
    if (!isSupported || !textToSpeak) return;

    const synth = window.speechSynthesis;

    const trySpeak = () => {
      const availableVoices = synth.getVoices();
      if (availableVoices.length === 0) {
        // Retry after a short delay as voices may not be loaded yet.
        setTimeout(trySpeak, 100);
        return;
      }

      // If you call speak() immediately after cancel(), some browsers
      // can silently fail. We handle this with a timeout below.
      if (synth.speaking) {
        synth.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(textToSpeak);

      // IMPROVEMENT: Prioritize local voices for reliability first.
      const selectedVoice =
        availableVoices.find(v => v.name === 'Google UK English Female' && v.localService) ||
        availableVoices.find(v => v.name === 'Microsoft Zira - English (United States)' && v.localService) ||
        availableVoices.find(v => v.lang.startsWith('en') && v.localService) || // Prefer any local English voice
        availableVoices.find(v => v.name === 'Google UK English Female') || // Fallback to network voice
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
        // A small timeout helps prevent state update issues
        setTimeout(() => {
          if (isSpeakingRef.current) {
            isSpeakingRef.current = false;
            setIsSpeaking(false);
          }
        }, 100);
      };

      utterance.onerror = (event) => {
        console.error('SpeechSynthesis Error', event);
        isSpeakingRef.current = false;
        setIsSpeaking(false);
      };

      console.log("Selected voice:", selectedVoice ? `${selectedVoice.name} (local: ${selectedVoice.localService})` : "Default voice");

      // THE FIX: Wrap synth.speak in a small timeout.
      // This gives the browser's synthesis engine a moment to process the `cancel()`
      // call and avoids the race condition that causes silent failures.
      setTimeout(() => {
        console.log("Speaking:", textToSpeak);
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


  // This function "primes" the speech engine to allow audio playback
  // that isn't initiated directly by a user gesture.
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
