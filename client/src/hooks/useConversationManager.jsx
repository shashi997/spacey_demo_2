// src/hooks/useConversationManager.jsx

import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useSpeechCoordination, useCoordinatedSpeechSynthesis } from './useSpeechCoordination.jsx';
import { sendChatMessageToAI, generateAvatarResponse } from '../api/spacey_api';

// Context for unified conversation management
const ConversationManagerContext = createContext();

// Provider component
export const ConversationManagerProvider = ({ children }) => {
  const [conversationHistory, setConversationHistory] = useState([]);
  const [currentContext, setCurrentContext] = useState({
    emotionContext: null,
    userActivity: 'active',
    lastInteractionTime: Date.now(),
    conversationTopic: null,
    userMood: 'neutral',
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingResponses, setPendingResponses] = useState([]);
  const [hasGreeted, setHasGreeted] = useState(false);

  // Speech coordination
  const { globalSpeechState, canAvatarBeIdle, setContextState, trackActivity } = useSpeechCoordination();
  
  // =================================================================================
  // THE FIX: Use the 'avatar' sourceId so the AI_Avatar component can react to it.
  // I've also renamed the functions for clarity (e.g., `speak` -> `speakAsAvatar`).
  // =================================================================================
  const { speak: speakAsAvatar, cancel: cancelAvatarSpeech } = useCoordinatedSpeechSynthesis('avatar');

  // Refs for managing state
  const lastEmotionResponseTime = useRef(0);
  const lastIdleResponseTime = useRef(0);

  // Add message to conversation history with context
  const addToHistory = useCallback((type, content, metadata = {}) => {
    const historyEntry = {
      id: Date.now() + Math.random(),
      type, // 'user', 'spacey', 'system', 'emotion-context'
      content,
      timestamp: Date.now(),
      context: { ...currentContext },
      metadata
    };

    setConversationHistory(prev => [...prev.slice(-19), historyEntry]); // Keep last 20 entries
    setCurrentContext(prev => ({
      ...prev,
      lastInteractionTime: Date.now()
    }));

    return historyEntry;
  }, [currentContext]);

  // Update emotion context without triggering immediate responses
  const updateEmotionContext = useCallback((emotionData) => {
    if (!emotionData) return;

    setCurrentContext(prev => {
      const newContext = {
        ...prev,
        emotionContext: {
          emotion: emotionData.emotionalState?.emotion || 'neutral',
          confidence: emotionData.confidence || 0,
          visualDescription: emotionData.visualDescription,
          faceDetected: emotionData.faceDetected,
          timestamp: Date.now()
        },
        userMood: emotionData.emotionalState?.emotion || prev.userMood
      };

      const emotionChanged = prev.emotionContext?.emotion !== newContext.emotionContext.emotion;
      const highConfidence = newContext.emotionContext.confidence > 0.4;
      
      if (emotionChanged && highConfidence) {
        setTimeout(() => {
          addToHistory('emotion-context', `User's emotional state changed to ${newContext.emotionContext.emotion}`, {
            confidence: newContext.emotionContext.confidence,
            visualDescription: newContext.emotionContext.visualDescription
          });
        }, 0);
      }

      return newContext;
    });
  }, [addToHistory]);

  // Build comprehensive context for AI requests
  const buildConversationContext = useCallback(() => {
    const recentHistory = conversationHistory.slice(-8).map(entry => ({
      type: entry.type,
      content: entry.content.length > 500 ? entry.content.substring(0, 500) + '...' : entry.content,
      timestamp: entry.timestamp
    }));
    
    return {
      conversationHistory: recentHistory,
      emotionContext: currentContext.emotionContext,
      userActivity: currentContext.userActivity,
      currentTopic: currentContext.conversationTopic,
      userMood: currentContext.userMood,
      timeSinceLastInteraction: Date.now() - currentContext.lastInteractionTime,
      isUserActive: Date.now() - currentContext.lastInteractionTime < 30000,
    };
  }, [conversationHistory, currentContext]);

  // Unified Spacey response generator
  const generateSpaceyResponse = useCallback(async (
    input, 
    responseType = 'chat',
    userInfo = null
  ) => {
    if (isProcessing) {
      setPendingResponses(prev => [...prev, { input, responseType, userInfo, timestamp: Date.now() }]);
      return null;
    }

    setIsProcessing(true);
    trackActivity();

    try {
      const contextData = buildConversationContext();
      let response;

      if (responseType === 'chat') {
        const enhancedInput = contextData.emotionContext ? 
          `${input}\n\n[VISUAL CONTEXT: User appears ${contextData.userMood}, ${contextData.emotionContext.visualDescription || 'engaged'}]` : 
          input;

        response = await sendChatMessageToAI(enhancedInput, userInfo, {
          conversationContext: contextData,
          includeEmotionContext: true
        });
        
        addToHistory('user', input);
        addToHistory('spacey', response.message, { responseType, context: contextData });

      } else {
        const avatarPayload = {
          ...userInfo,
          conversationHistory: contextData.conversationHistory,
          emotionContext: contextData.emotionContext
        };

        response = await generateAvatarResponse(
          avatarPayload,
          contextData.emotionContext,
          responseType
        );

        addToHistory('spacey', response.response, { 
          responseType, 
          trigger: responseType,
          context: contextData 
        });
      }

      return response;

    } catch (error) {
      console.error('Error generating Spacey response:', error);
      const fallbackResponse = {
        message: "Oops, my circuits got a bit tangled there! Give me a moment to recalibrate my stellar wit.",
        response: "Oops, my circuits got a bit tangled there! Give me a moment to recalibrate my stellar wit.",
        type: 'fallback'
      };
      addToHistory('spacey', fallbackResponse.message || fallbackResponse.response, { 
        responseType: 'fallback',
        error: error.message 
      });
      return fallbackResponse;
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, buildConversationContext, trackActivity, addToHistory]);

  // Smart response coordinator that prevents conflicts
  const generateCoordinatedResponse = useCallback(async (input, responseType, userInfo, options = {}) => {
    const { force = false, priority = 'normal' } = options;

    if (!force) {
      if (globalSpeechState.isAnySpeaking && priority !== 'high') {
        console.log('🔇 Skipping response - speech already active');
        return null;
      }
      const now = Date.now();
      if (responseType === 'emotion-aware' && now - lastEmotionResponseTime.current < 15000) {
        console.log('🔇 Skipping emotion response - too frequent');
        return null;
      }
      if (responseType === 'idle' && now - lastIdleResponseTime.current < 300000) {
        console.log('🔇 Skipping idle response - too frequent');
        return null;
      }
    }

    const response = await generateSpaceyResponse(input, responseType, userInfo);
    
    if (response && (response.message || response.response)) {
      const textToSpeak = response.message || response.response;
      
      if (responseType === 'emotion-aware') lastEmotionResponseTime.current = Date.now();
      else if (responseType === 'idle') lastIdleResponseTime.current = Date.now();

      // =================================================================================
      // THE FIX: Use the correctly named `speakAsAvatar` function.
      // =================================================================================
      speakAsAvatar(textToSpeak, {
        onEnd: () => {
          if (pendingResponses.length > 0) {
            const nextResponse = pendingResponses[0];
            setPendingResponses(prev => prev.slice(1));
            setTimeout(() => {
              generateCoordinatedResponse(
                nextResponse.input,
                nextResponse.responseType,
                nextResponse.userInfo,
                { force: false, priority: 'low' }
              );
            }, 1000);
          }
        }
      });

      return response;
    }

    return null;
  }, [generateSpaceyResponse, globalSpeechState.isAnySpeaking, speakAsAvatar, pendingResponses]);


  const handleGreeting = useCallback(async (userInfo) => {
    // Exit if already greeted, processing something, or something is already being said.
    if (hasGreeted || isProcessing || globalSpeechState.isAnySpeaking) {
      return;
    }
    // Mark as greeted immediately to prevent repeats.
    setHasGreeted(true);
    setIsProcessing(true);

    const userName = userInfo?.displayName?.split(' ')[0] || 'there';
    const greetingText = `Hello ${userName}! I'm Spacey, your personal guide to the cosmos. I'm all set up and ready to explore. What's on your mind today?`;
    
    addToHistory('spacey', greetingText, { responseType: 'greeting' });

    try {
      // Speak the greeting as the avatar
      await speakAsAvatar(greetingText);
    } catch (error) {
      console.error("Greeting speech failed:", error);
    } finally {
      // Ensure processing is set to false even if speech fails
      setIsProcessing(false);
    }
  }, [hasGreeted, isProcessing, globalSpeechState.isAnySpeaking, addToHistory, speakAsAvatar]);
  // Handle user chat input
  const handleUserChat = useCallback(async (message, userInfo) => {
    setContextState('isInChat', true);
    trackActivity();
    
    const response = await generateCoordinatedResponse(message, 'chat', userInfo, { priority: 'high' });
    
    setTimeout(() => {
      setContextState('isInChat', false);
    }, 10000);

    return response;
  }, [generateCoordinatedResponse, setContextState, trackActivity]);



  // Intelligent idle responses
  const handleIdleCheck = useCallback(async (userInfo) => {
    if (!canAvatarBeIdle()) return null;

    const contextData = buildConversationContext();
    let idlePrompt = "Ready to continue our cosmic journey?";
    
    const lastInteraction = contextData.conversationHistory.at(-1);
    if (lastInteraction?.type === 'user') {
      idlePrompt = "I'm here when you're ready to continue our conversation!";
    }

    if (contextData.emotionContext?.emotion && contextData.emotionContext.emotion !== 'neutral') {
      idlePrompt = `I notice you seem ${contextData.userMood} - want to chat about what's on your mind?`;
    }

    return generateCoordinatedResponse(idlePrompt, 'idle', userInfo);
  }, [canAvatarBeIdle, buildConversationContext, generateCoordinatedResponse]);

  // Smart emotion-aware responses
  const handleEmotionAwareResponse = useCallback(async (userInfo) => {
    const contextData = buildConversationContext();
    if (!contextData.emotionContext || contextData.emotionContext.confidence < 0.4) return null;
    if (contextData.timeSinceLastInteraction > 60000) return null;

    const emotionPrompt = `I can see you're feeling ${contextData.emotionContext.emotion}. ${contextData.emotionContext.visualDescription}`;
    return generateCoordinatedResponse(emotionPrompt, 'emotion-aware', userInfo);
  }, [buildConversationContext, generateCoordinatedResponse]);

  // Clear old conversation data
  useEffect(() => {
    const cleanup = setInterval(() => {
      setConversationHistory(prev => prev.filter(entry => 
        Date.now() - entry.timestamp < 3600000 // Keep last hour
      ));
    }, 300000);

    return () => clearInterval(cleanup);
  }, []);

  const value = {
    conversationHistory,
    currentContext,
    isProcessing,
    updateEmotionContext,
    handleUserChat,
    handleIdleCheck,
    handleEmotionAwareResponse,
    handleGreeting,
    generateCoordinatedResponse,
    addToHistory,
    buildConversationContext,
    clearHistory: () => setConversationHistory([]),
    getRecentHistory: (count = 5) => conversationHistory.slice(-count),
  };

  return (
    <ConversationManagerContext.Provider value={value}>
      {children}
    </ConversationManagerContext.Provider>
  );
};

// Hook to use the conversation manager
export const useConversationManager = () => {
  const context = useContext(ConversationManagerContext);
  if (!context) {
    throw new Error('useConversationManager must be used within a ConversationManagerProvider');
  }
  return context;
};
