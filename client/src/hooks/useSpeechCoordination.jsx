import { synthesizeSpeech, cleanup } from '../api/voice_api';
import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

// Context for global speech coordination
const SpeechCoordinationContext = createContext();

// Provider component
export const SpeechCoordinationProvider = ({ children }) => {
  const [globalSpeechState, setGlobalSpeechState] = useState({
    isAnySpeaking: false,
    activeSource: null, // 'avatar', 'chat', 'lesson', etc.
    activeSources: [], // array of all currently speaking sources
  });
  
  const [userActivity, setUserActivity] = useState({
    isUserActive: true,
    lastActivityTime: Date.now(),
    isInLesson: false,
    isInChat: false,
  });

  const [avatarSettings, setAvatarSettings] = useState({
    isMuted: false,
    idleResponsesEnabled: true,
  });

  const activityTimeoutRef = useRef(null);
  const idleThreshold = 1 * 60 * 1000; // 1 minutes of no activity = idle

  // Track user activity
  const trackActivity = useCallback(() => {
    setUserActivity(prev => ({
      ...prev,
      isUserActive: true,
      lastActivityTime: Date.now(),
    }));

    // Clear existing timeout
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }

    // Set new timeout to mark user as idle
    activityTimeoutRef.current = setTimeout(() => {
      setUserActivity(prev => ({
        ...prev,
        isUserActive: false,
      }));
    }, idleThreshold);
  }, [idleThreshold]);

  // Set up activity listeners
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, trackActivity, true);
    });

    // Initial activity tracking
    trackActivity();

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, trackActivity, true);
      });
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
    };
  }, [trackActivity]);

  // Register a speech source
  const registerSpeechSource = useCallback((sourceId) => {
    setGlobalSpeechState(prev => ({
      ...prev,
      isAnySpeaking: true,
      activeSource: prev.activeSource || sourceId,
      activeSources: [...prev.activeSources, sourceId],
    }));
  }, []);

  // Unregister a speech source
  const unregisterSpeechSource = useCallback((sourceId) => {
    setGlobalSpeechState(prev => {
      const newActiveSources = prev.activeSources.filter(id => id !== sourceId);
      return {
        ...prev,
        isAnySpeaking: newActiveSources.length > 0,
        activeSource: newActiveSources[0] || null,
        activeSources: newActiveSources,
      };
    });
  }, []);

  // Set context state (lesson, chat, etc.)
  const setContextState = useCallback((context, isActive) => {
    setUserActivity(prev => ({
      ...prev,
      [context]: isActive,
    }));
  }, []);

  // Check if avatar should be idle
  const canAvatarBeIdle = useCallback(() => {
    const now = Date.now();
    const timeSinceActivity = now - userActivity.lastActivityTime;
    
    return (
      !avatarSettings.isMuted &&
      avatarSettings.idleResponsesEnabled &&
      !globalSpeechState.isAnySpeaking &&
      !userActivity.isUserActive &&
      !userActivity.isInLesson &&
      !userActivity.isInChat &&
      timeSinceActivity > idleThreshold
    );
  }, [globalSpeechState.isAnySpeaking, userActivity, avatarSettings, idleThreshold]);

  // Avatar controls
  const toggleAvatarMute = useCallback(() => {
    setAvatarSettings(prev => ({
      ...prev,
      isMuted: !prev.isMuted,
    }));
  }, []);

  const toggleIdleResponses = useCallback(() => {
    setAvatarSettings(prev => ({
      ...prev,
      idleResponsesEnabled: !prev.idleResponsesEnabled,
    }));
  }, []);

  const value = {
    // State
    globalSpeechState,
    userActivity,
    avatarSettings,
    
    // Actions
    registerSpeechSource,
    unregisterSpeechSource,
    setContextState,
    canAvatarBeIdle,
    toggleAvatarMute,
    toggleIdleResponses,
    trackActivity,
  };

  return (
    <SpeechCoordinationContext.Provider value={value}>
      {children}
    </SpeechCoordinationContext.Provider>
  );
};

// Hook to use the speech coordination context
export const useSpeechCoordination = () => {
  const context = useContext(SpeechCoordinationContext);
  if (!context) {
    throw new Error('useSpeechCoordination must be used within a SpeechCoordinationProvider');
  }
  return context;
};

// Enhanced speech synthesis hook that integrates with global coordination
export const useCoordinatedSpeechSynthesis = (sourceId) => {
  const [isLoading, setIsLoading] = useState(false);
  // const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef(null);
  const audioUrlRef = useRef(null);
  const utteranceRef = useRef(null);
  const lastEngineRef = useRef('eleven'); // 'eleven' | 'web'
  // const isSpeakingRef = useRef(false);
  const { registerSpeechSource, unregisterSpeechSource, avatarSettings } = useSpeechCoordination();

  // Cleanup function
  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      cleanup(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio]);

  // useEffect(() => {
  //   if ('speechSynthesis' in window) {
  //     setIsSupported(true);
  //     const synth = window.speechSynthesis;
  //     const updateVoices = () => {
  //       if (synth.getVoices().length > 0) {
  //         // Voices loaded
  //       }
  //     };
  //     synth.addEventListener('voiceschanged', updateVoices);
  //     updateVoices();
  //     return () => {
  //       synth.removeEventListener('voiceschanged', updateVoices);
  //       if (synth.speaking) {
  //         synth.cancel();
  //       }
  //     };
  //   }
  // }, []);

  const speak = useCallback(async (text, { onEnd, onStart, force = false } = {}) => {
    const textToSpeak = text.trim();
    if (!textToSpeak) {
      if (onEnd) setTimeout(() => onEnd(), 0);
      return;
    }

    // Check if avatar is muted 
    if (sourceId === 'avatar' && avatarSettings.isMuted && !force) {
      if (onEnd) setTimeout(() => onEnd(), 0);
      return;
    }

    // Decide engine via env toggle + credentials
    const elevenLabsEnabled = (import.meta.env.VITE_ELEVEN_LABS_ENABLED ?? 'true') === 'true';
    const hasElevenKey = Boolean(import.meta.env.VITE_ELEVEN_LABS_API_KEY);
    const hasVoiceId = Boolean(import.meta.env.VITE_ELEVEN_LABS_VOICE_ID);
    const useEleven = elevenLabsEnabled && hasElevenKey && hasVoiceId;

    if (useEleven) {
      try {
        lastEngineRef.current = 'eleven';
        setIsLoading(true);

        cleanupAudio();

        const audioUrl = await synthesizeSpeech(textToSpeak);
        audioUrlRef.current = audioUrl;

        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.oncanplaythrough = () => {
          setIsLoading(false);
          setIsSpeaking(true);
          registerSpeechSource(sourceId);
          if (onStart) onStart();
          audio.play().catch(console.error);
        };

        audio.onended = () => {
          setIsSpeaking(false);
          unregisterSpeechSource(sourceId);
          cleanupAudio();
          if (onEnd) onEnd();
        };

        audio.onerror = (error) => {
          console.error('Audio playback error:', error);
          setIsLoading(false);
          setIsSpeaking(false);
          unregisterSpeechSource(sourceId);
          cleanupAudio();
          if (onEnd) onEnd();
        };
      } catch (error) {
        console.error('Speech synthesis error:', error);
        setIsLoading(false);
        setIsSpeaking(false);
        unregisterSpeechSource(sourceId);
        if (onEnd) onEnd();
      }
      return;
    }

    // Web Speech API fallback
    try {
      lastEngineRef.current = 'web';
      const synth = window.speechSynthesis;
      if (!synth) {
        console.warn('Web Speech API not supported.');
        if (onEnd) onEnd();
        return;
      }

      // Stop any existing speech
      try { synth.cancel(); } catch (_) {}

      const ensureVoicesLoaded = async () => {
        let list = synth.getVoices();
        if (list && list.length > 0) return list;
        await new Promise((resolve) => {
          const handler = () => {
            synth.removeEventListener('voiceschanged', handler);
            resolve();
          };
          synth.addEventListener('voiceschanged', handler);
          // Safety timeout in case event doesn't fire
          setTimeout(resolve, 500);
        });
        return synth.getVoices();
      };

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utteranceRef.current = utterance;

      // Try to pick a reasonable English voice if available
      const voices = await ensureVoicesLoaded();

      const femaleNameHints = [
        'female', 'zira', 'samantha', 'victoria', 'karen', 'serena', 'moira', 'tessa',
        'aria', 'jenny', 'joanna', 'emma', 'ivy', 'kimberly', 'kendra', 'salli', 'olivia', 'natalie'
      ];

      const isLikelyFemale = (v) => {
        const n = (v.name || '').toLowerCase();
        return femaleNameHints.some(h => n.includes(h));
      };

      const englishVoices = voices.filter(v => (v.lang || '').toLowerCase().startsWith('en'));
      // Hard preference order
      const preferred =
        englishVoices.find(v => v.name === 'Google UK English Female') ||
        englishVoices.find(v => /Microsoft Zira/i.test(v.name)) ||
        englishVoices.find(isLikelyFemale) ||
        englishVoices.find(v => v.localService && isLikelyFemale(v)) ||
        englishVoices.find(v => v.localService) ||
        englishVoices.find(v => v.lang?.toLowerCase() === 'en-us') ||
        englishVoices[0] ||
        null;

      const selectedVoice = preferred;
      if (selectedVoice) utterance.voice = selectedVoice;

      // Slightly higher pitch to align with typical female voice timbre
      utterance.pitch = 1.05;
      utterance.rate = 1;
      utterance.volume = 1;

      utterance.onstart = () => {
        setIsSpeaking(true);
        registerSpeechSource(sourceId);
        if (onStart) onStart();
      };
      utterance.onend = () => {
        setIsSpeaking(false);
        unregisterSpeechSource(sourceId);
        utteranceRef.current = null;
        if (onEnd) onEnd();
      };
      utterance.onerror = (event) => {
        console.error('SpeechSynthesis Error', event);
        setIsSpeaking(false);
        unregisterSpeechSource(sourceId);
        utteranceRef.current = null;
        if (onEnd) onEnd();
      };

      synth.speak(utterance);
    } catch (err) {
      console.error('Web TTS failed:', err);
      setIsSpeaking(false);
      unregisterSpeechSource(sourceId);
      if (onEnd) onEnd();
    }
    // const synth = window.speechSynthesis;

    // const trySpeak = () => {
    //   const availableVoices = synth.getVoices();
    //   if (availableVoices.length === 0) {
    //     setTimeout(trySpeak, 100);
    //     return;
    //   }

    //   if (synth.speaking) {
    //     synth.cancel();
    //   }

    //   const utterance = new SpeechSynthesisUtterance(textToSpeak);     
    //   const selectedVoice =
    //     availableVoices.find(v => v.name === 'Google UK English Female' && v.localService) ||
    //     availableVoices.find(v => v.name === 'Microsoft Zira - English (United States)' && v.localService) ||
    //     availableVoices.find(v => v.lang.startsWith('en') && v.localService) ||
    //     availableVoices.find(v => v.name === 'Google UK English Female') ||
    //     availableVoices.find(v => v.name === 'Microsoft Zira - English (United States)') ||
    //     availableVoices.find(v => v.lang === 'en-US') ||
    //     availableVoices.find(v => v.lang.startsWith('en'));

    //   if (selectedVoice) {
    //     utterance.voice = selectedVoice;
    //   }

    //   utterance.pitch = 1;
    //   utterance.rate = 1;
    //   utterance.volume = 1;

    //   utterance.onstart = () => {
    //     isSpeakingRef.current = true;
    //     setIsSpeaking(true);
    //     registerSpeechSource(sourceId);
    //     if (onStart) onStart();  // Call the onStart callback
    //   };

    //   utterance.onend = () => {
    //     setTimeout(() => {
    //       if (isSpeakingRef.current) {
    //         isSpeakingRef.current = false;
    //         setIsSpeaking(false);
    //         unregisterSpeechSource(sourceId);
    //         if (onEnd) onEnd();
    //       }
    //     }, 100);
    //   };

    //   utterance.onerror = (event) => {
    //     console.error('SpeechSynthesis Error', event);
    //     isSpeakingRef.current = false;
    //     setIsSpeaking(false);
    //     unregisterSpeechSource(sourceId);
    //     if (onEnd) onEnd();
    //   };

    //   setTimeout(() => {
    //     synth.speak(utterance);
    //   }, 50);
    // };

    // trySpeak();
  }, [sourceId, registerSpeechSource, unregisterSpeechSource, avatarSettings.isMuted, cleanupAudio]);

  const cancel = useCallback(() => {
    // if (!isSupported) return;
    try {
      if (lastEngineRef.current === 'web') {
        const synth = window.speechSynthesis;
        if (synth) synth.cancel();
        utteranceRef.current = null;
      }
    } catch (_) {}
    // isSpeakingRef.current = false;
    setIsLoading(false);
    setIsSpeaking(false);
    unregisterSpeechSource(sourceId);
    cleanupAudio();
  }, [sourceId, unregisterSpeechSource, cleanupAudio]);

  // const prime = useCallback(() => {
  //   if (!isSupported) return;
  //   const synth = window.speechSynthesis;
  //   if (synth.speaking || synth.pending) return;
  //   const utterance = new SpeechSynthesisUtterance(' ');
  //   utterance.volume = 0;
  //   synth.speak(utterance);
  // }, [isSupported]);

  return {
    isSupported: true,
    isSpeaking,
    isLoading,
    speak,
    cancel,
    // prime,
  };
}; 