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
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);  // New state

  // Speech coordination
  const { globalSpeechState, canAvatarBeIdle, setContextState, trackActivity } = useSpeechCoordination();
  const { speak, isSpeaking, cancel: cancelSpeech } = useCoordinatedSpeechSynthesis('conversation-manager');

  // Refs for managing state
  const lastEmotionResponseTime = useRef(0);
  const lastIdleResponseTime = useRef(0);
  const conversationTimeoutRef = useRef(null);

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

      // Only add to history if emotion significantly changed
      const emotionChanged = prev.emotionContext?.emotion !== newContext.emotionContext.emotion;
      const highConfidence = newContext.emotionContext.confidence > 0.4;
      
      if (emotionChanged && highConfidence) {
        // Add emotion context to history but don't trigger immediate response
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
    // Get recent history and optimize payload size
    const recentHistory = conversationHistory.slice(-8).map(entry => ({
      type: entry.type,
      content: entry.content.length > 500 ? entry.content.substring(0, 500) + '...' : entry.content, // Truncate very long messages
      timestamp: entry.timestamp
    })); // Last 8 interactions (reduced from 10)
    
    const emotionContext = currentContext.emotionContext;
    
    return {
      conversationHistory: recentHistory,
      emotionContext,
      userActivity: currentContext.userActivity,
      currentTopic: currentContext.conversationTopic,
      userMood: currentContext.userMood,
      timeSinceLastInteraction: Date.now() - currentContext.lastInteractionTime,
      isUserActive: Date.now() - currentContext.lastInteractionTime < 30000, // 30 seconds
    };
  }, [conversationHistory, currentContext]);

  // Unified Spacey response generator with personality consistency
  const generateSpaceyResponse = useCallback(async (
    input, 
    responseType = 'chat', // 'chat', 'idle', 'emotion-aware', 'encouragement'
    userInfo = null
  ) => {
    if (isProcessing) {
      // Queue the request if currently processing
      setPendingResponses(prev => [...prev, { input, responseType, userInfo, timestamp: Date.now() }]);
      return null;
    }

    setIsProcessing(true);
    trackActivity();

    try {
      const contextData = buildConversationContext();
      let response;

      if (responseType === 'chat') {
        // Enhanced chat that includes emotion context
        const enhancedInput = contextData.emotionContext ? 
          `${input}\n\n[VISUAL CONTEXT: User appears ${contextData.userMood}, ${contextData.emotionContext.visualDescription || 'engaged'}]` : 
          input;

        response = await sendChatMessageToAI(enhancedInput, userInfo, {
          conversationContext: contextData,
          includeEmotionContext: true
        });
        
        // Add to conversation history
        addToHistory('user', input);
        addToHistory('spacey', response.message, { responseType, context: contextData });

      } else {
        // Avatar-style responses with full context
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

        // Add to conversation history
        addToHistory('spacey', response.response, { 
          responseType, 
          trigger: responseType,
          context: contextData 
        });
      }

      return response;

    } catch (error) {
      console.error('Error generating Spacey response:', error);
      
      // Fallback response that maintains personality
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

    // Check if we should respond based on current state
    if (!force) {
      // Don't interrupt active speech unless high priority
      if (globalSpeechState.isAnySpeaking && priority !== 'high') {
        console.log('🔇 Skipping response - speech already active');
        return null;
      }

      // Rate limiting for different response types
      const now = Date.now();
      if (responseType === 'emotion-aware' && now - lastEmotionResponseTime.current < 15000) {
        console.log('🔇 Skipping emotion response - too frequent');
        return null;
      }
      if (responseType === 'idle' && now - lastIdleResponseTime.current < 300000) { // 5 minutes
        console.log('🔇 Skipping idle response - too frequent');
        return null;
      }
    }

    // Generate response
    const response = await generateSpaceyResponse(input, responseType, userInfo);
    
    if (response && (response.message || response.response)) {
      const textToSpeak = response.message || response.response;
      
      // Update rate limiting
      if (responseType === 'emotion-aware') {
        lastEmotionResponseTime.current = Date.now();
      } else if (responseType === 'idle') {
        lastIdleResponseTime.current = Date.now();
      }

      // Speak the response with coordination
      speak(textToSpeak, {
        onStart: () => setIsAvatarSpeaking(true),  // Set speaking to true on start 
        onEnd: () => {
          setIsAvatarSpeaking(false);
          // Process pending responses after current speech ends
          if (pendingResponses.length > 0) {
            const nextResponse = pendingResponses[0];
            setPendingResponses(prev => prev.slice(1));
            
            // Process next response with delay
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
  }, [generateSpaceyResponse, globalSpeechState.isAnySpeaking, speak, pendingResponses]);

  // Handle user chat input
  const handleUserChat = useCallback(async (message, userInfo) => {
    setContextState('isInChat', true);
    trackActivity();
    
    const response = await generateCoordinatedResponse(message, 'chat', userInfo, { priority: 'high' });
    
    // Clear chat context after delay
    setTimeout(() => {
      setContextState('isInChat', false);
    }, 10000);

    return response;
  }, [generateCoordinatedResponse, setContextState, trackActivity]);

  // Intelligent idle responses
  const handleIdleCheck = useCallback(async (userInfo) => {
    if (!canAvatarBeIdle()) return null;

    const contextData = buildConversationContext();
    
    // Create contextual idle message based on conversation history and emotion
    let idlePrompt = "Ready to continue our cosmic journey?";
    
    if (contextData.conversationHistory.length > 0) {
      const lastInteraction = contextData.conversationHistory[contextData.conversationHistory.length - 1];
      if (lastInteraction.type === 'user') {
        idlePrompt = "I'm here when you're ready to continue our conversation!";
      }
    }

    if (contextData.emotionContext?.emotion && contextData.emotionContext.emotion !== 'neutral') {
      idlePrompt = `I notice you seem ${contextData.userMood} - want to chat about what's on your mind?`;
    }

    return generateCoordinatedResponse(idlePrompt, 'idle', userInfo);
  }, [canAvatarBeIdle, buildConversationContext, generateCoordinatedResponse]);

  // Smart emotion-aware responses (triggered by significant changes)
  const handleEmotionAwareResponse = useCallback(async (userInfo) => {
    const contextData = buildConversationContext();
    
    if (!contextData.emotionContext || contextData.emotionContext.confidence < 0.4) {
      return null;
    }

    // Only respond to significant emotion changes during conversation
    if (contextData.timeSinceLastInteraction > 60000) return null; // No response if idle too long

    const emotionPrompt = `I can see you're feeling ${contextData.emotionContext.emotion}. ${contextData.emotionContext.visualDescription}`;

    return generateCoordinatedResponse(emotionPrompt, 'emotion-aware', userInfo);
  }, [buildConversationContext, generateCoordinatedResponse]);

  // Clear old conversation data
  useEffect(() => {
    const cleanup = setInterval(() => {
      setConversationHistory(prev => prev.filter(entry => 
        Date.now() - entry.timestamp < 3600000 // Keep last hour
      ));
    }, 300000); // Clean every 5 minutes

    return () => clearInterval(cleanup);
  }, []);

  const value = {
    // State
    conversationHistory,
    currentContext,
    isProcessing,
    isAvatarSpeaking,  // Export new state
    
    // Actions
    updateEmotionContext,
    handleUserChat,
    handleIdleCheck,
    handleEmotionAwareResponse,
    generateCoordinatedResponse,
    addToHistory,
    buildConversationContext,
    
    // Utils
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