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

  // Lesson-specific tutoring responses
  const handleLessonTutoring = useCallback(async (userInfo, lessonContext, tutorAction, additionalData = null) => {
    if (!lessonContext) return null;

    const contextData = buildConversationContext();
    let tutorPrompt = '';

    switch (tutorAction) {
      case 'welcome':
        tutorPrompt = `Welcome aboard, Commander! I'm Spacey, your AI mission specialist for "${lessonContext.title}". 

Think of me as your personal guide through the cosmos - I've been designed to help astronauts like you understand the complexities of space exploration. This mission, ${lessonContext.mission_id}, will take us through some fascinating territory.

Before we begin, imagine you're standing in the command center of a real space station, looking out at the vast expanse of space. Every decision you make here could mean the difference between mission success and failure. Are you ready to embark on this cosmic adventure?`;
        break;
      
      case 'question_explanation':
        if (additionalData?.question && additionalData?.context) {
          tutorPrompt = `Let me help you understand this crucial mission decision, Commander.

**The Situation:** ${additionalData.context}

**Why This Matters:** In real space missions, decisions like this have happened before. For example, ${additionalData.realExample || 'during the Apollo missions, astronauts had to make split-second decisions that determined their survival'}.

**The Consequences:** 
- If you choose one path: ${additionalData.consequence1 || 'you might face certain challenges'}
- If you choose another: ${additionalData.consequence2 || 'different opportunities and risks emerge'}

**Real-World Connection:** ${additionalData.realWorldConnection || 'This mirrors actual scenarios faced by astronauts and mission controllers at NASA and other space agencies.'}

Think carefully, Commander. What does your training tell you? What would you do if you were really out there in the void of space?`;
        }
        break;
      
      case 'concept_explanation':
        if (additionalData?.concept) {
          tutorPrompt = `Commander, let me break down ${additionalData.concept} for you in a way that connects to our mission.

**The Science Behind It:** ${additionalData.concept} is fundamental to space exploration because...

**Real Mission Example:** During the ${additionalData.missionExample || 'International Space Station operations'}, astronauts encountered this exact principle when...

**Visual Picture:** Imagine you're floating in your spacecraft, and ${additionalData.visualScenario || 'you can see the effects of this principle all around you'}.

**Why It Matters for Your Mission:** Understanding this concept will help you ${additionalData.missionRelevance || 'make better decisions as we progress through this space mission'}.

**The Bigger Picture:** This connects to the larger goal of space exploration, which is to ${additionalData.biggerPicture || 'push the boundaries of human knowledge and capability'}.

Does this help clarify things, Commander?`;
        }
        break;
      
      case 'encouragement':
        tutorPrompt = `Outstanding work, Commander! You're demonstrating the kind of critical thinking that made the Apollo missions successful.

**What You're Doing Right:** Your approach shows ${additionalData?.strength || 'excellent analytical skills'}. Real astronauts like ${additionalData?.astronautExample || 'Neil Armstrong and Sally Ride'} showed similar qualities.

**The Journey Ahead:** Remember, every great space explorer started exactly where you are now - asking questions, thinking critically, and pushing through challenges.

**Mission Perspective:** You're not just learning about space science; you're developing the mindset of a true space explorer. Every question you ask, every concept you master, brings us closer to humanity's next giant leap.

Keep going, Commander. The cosmos awaits your discoveries!`;
        break;
      
      default:
        tutorPrompt = `Commander, I'm here to guide you through "${lessonContext.title}". Whether you need clarification on space science concepts, want to understand the implications of your mission choices, or just want to explore the fascinating world of space exploration, I'm at your service.

Think of our conversation as a mission briefing between two space professionals. What would you like to explore about our current mission?`;
    }

    // Enhanced context for lesson mode with storytelling emphasis
    const enhancedTutorPrompt = `${tutorPrompt}

[ADVANCED TUTORING CONTEXT]
Mission: "${lessonContext.title}" (ID: ${lessonContext.mission_id})
Role: Spacey - AI Mission Specialist and Space Science Tutor

TUTORING GUIDELINES:
- Use storytelling techniques with real space mission examples
- Provide concrete consequences and implications for choices
- Connect abstract concepts to tangible space exploration scenarios
- Maintain an encouraging, professional tone like a mission commander
- Use vivid imagery and scenarios to make concepts memorable
- Reference real astronauts, missions, and space agencies when relevant
- Help users understand both the science AND the human drama of space exploration
- Always frame learning as preparation for real space missions`;

    return generateCoordinatedResponse(enhancedTutorPrompt, 'lesson-tutor', userInfo, { priority: 'normal' });
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
    handleLessonTutoring,
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
