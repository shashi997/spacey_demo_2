// src/components/dashboard/AI_Avatar.jsx

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import { MessageCircle, Brain, Eye, Volume2 } from 'lucide-react';
import { generateAvatarResponse, fetchUserTraits, getConversationContext } from '../../api/spacey_api';
import useSpeechSynthesis from '../../hooks/useSpeechSynthesis';

function TalkingModel({ isTalking }) {
  const group = useRef();
  const { scene, animations } = useGLTF('/models/Talking1.glb');
  const { actions, names } = useAnimations(animations, group);
  const [animationName, setAnimationName] = useState(null);

  // Floating effect
  useFrame((state) => {
    if (group.current) {
      const t = state.clock.getElapsedTime();
      group.current.position.y = Math.sin(t * 1.5) * 0.08 - 1.4; // Smoother float
    }
  });

  useEffect(() => {
    if (names.length > 0) {
      setAnimationName(names[0]); // Auto-pick first animation
    }
  }, [names]);

  useEffect(() => {
    if (!animationName || !actions[animationName]) return;
    const action = actions[animationName];

    if (isTalking) {
      action.reset().fadeIn(0.3).play();
    } else {
      action.fadeOut(0.2);
    }
  }, [isTalking, animationName, actions]);

  return (
    <group
      ref={group}
      scale={1.35}
      rotation={[0, Math.PI / 11, 0]}
      position={[0, -1.4, 0]}
    >
      <primitive object={scene} />
    </group>
  );
}



export default function AI_Avatar({ 
  webcamRef, 
  userInfo, 
  onAvatarResponse,
  enablePersonalization = true,
  className = ""
}) {
  const [isTalking, setIsTalking] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const [userTraits, setUserTraits] = useState(['curious']);
  const [conversationContext, setConversationContext] = useState(null);
  const [visualContext, setVisualContext] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastEmotionChange, setLastEmotionChange] = useState(null);
  const [responseHistory, setResponseHistory] = useState([]);
  
  // Refs for managing intervals and state
  const emotionCheckInterval = useRef(null);
  const idleResponseTimeout = useRef(null);
  const lastResponseTime = useRef(Date.now());

  // Speech synthesis for avatar responses
  const { speak, isSpeaking, cancel: stopSpeaking } = useSpeechSynthesis();

  // Load user data on mount
  useEffect(() => {
    const loadUserData = async () => {
      if (!userInfo?.uid || !enablePersonalization) return;

      try {
        const [traits, context] = await Promise.all([
          fetchUserTraits(userInfo.uid),
          getConversationContext(userInfo.uid, 5)
        ]);

        setUserTraits(traits.traits || ['curious']);
        setConversationContext(context);
        console.log('👤 User data loaded:', { traits: traits.traits, context: context.summary });
      } catch (error) {
        console.warn('⚠️ Failed to load user data:', error);
      }
    };

    loadUserData();
  }, [userInfo?.uid, enablePersonalization]);

  // Monitor webcam for emotion changes
  useEffect(() => {
    if (!webcamRef?.current || !enablePersonalization) return;

    const checkEmotions = () => {
      try {
        const emotionalState = webcamRef.current.getEmotionalState?.();
        const visualDescription = webcamRef.current.getVisualDescription?.();
        
        if (emotionalState?.visual && emotionalState.confidence > 0.3) {
          const newVisualContext = {
            emotionalState,
            visualDescription,
            faceDetected: emotionalState.faceDetected,
            timestamp: Date.now(),
            confidence: emotionalState.confidence
          };

          setVisualContext(newVisualContext);

          // Check if emotion has significantly changed
          const hasEmotionChanged = lastEmotionChange?.emotion !== emotionalState.emotion;
          const hasHighConfidence = emotionalState.confidence > 0.4;
          
          if (hasEmotionChanged && hasHighConfidence) {
            setLastEmotionChange({
              emotion: emotionalState.emotion,
              timestamp: Date.now()
            });
            
            // Generate response for emotion change with a slight delay
            setTimeout(() => generateContextualResponse('emotion_change', newVisualContext), 1500);
          }
        }
      } catch (error) {
        console.warn('⚠️ Error checking emotions:', error);
      }
    };

    // Check emotions every 3 seconds
    emotionCheckInterval.current = setInterval(checkEmotions, 3000);
    
    return () => {
      if (emotionCheckInterval.current) {
        clearInterval(emotionCheckInterval.current);
      }
    };
  }, [webcamRef, enablePersonalization, lastEmotionChange]);

  // Generate contextual avatar responses
  const generateContextualResponse = useCallback(async (trigger, currentVisualContext = null) => {
    if (isProcessing || !enablePersonalization) return;
    
    // Prevent too frequent responses (min 10 seconds between responses)
    const timeSinceLastResponse = Date.now() - lastResponseTime.current;
    if (timeSinceLastResponse < 10000) return;

    setIsProcessing(true);

    try {
      const response = await generateAvatarResponse(
        userInfo, 
        currentVisualContext || visualContext, 
        trigger
      );

      if (response?.response) {
        setCurrentResponse(response.response);
        setIsTalking(true);
        lastResponseTime.current = Date.now();

        // Add to response history
        setResponseHistory(prev => [...prev.slice(-4), {
          text: response.response,
          trigger,
          timestamp: Date.now(),
          visualContext: currentVisualContext || visualContext
        }]);

        // Notify parent component
        if (onAvatarResponse) {
          onAvatarResponse({
            response: response.response,
            trigger,
            visualContext: currentVisualContext || visualContext,
            userTraits
          });
        }

        // Speak the response
        speak(response.response);

        // Stop talking animation after a delay
        setTimeout(() => setIsTalking(false), Math.max(3000, response.response.length * 50));
      }
    } catch (error) {
      console.error('💫 Error generating avatar response:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, enablePersonalization, userInfo, visualContext, onAvatarResponse, userTraits, speak]);

  // Set up idle responses
  useEffect(() => {
    if (!enablePersonalization) return;

    const scheduleIdleResponse = () => {
      // Clear existing timeout
      if (idleResponseTimeout.current) {
        clearTimeout(idleResponseTimeout.current);
      }

      // Schedule next idle response (30-60 seconds)
      const delay = 30000 + Math.random() * 30000;
      idleResponseTimeout.current = setTimeout(() => {
        generateContextualResponse('idle');
        scheduleIdleResponse(); // Schedule the next one
      }, delay);
    };

    scheduleIdleResponse();

    return () => {
      if (idleResponseTimeout.current) {
        clearTimeout(idleResponseTimeout.current);
      }
    };
  }, [generateContextualResponse, enablePersonalization]);

  // Manual trigger for encouragement
  const triggerEncouragement = useCallback(() => {
    generateContextualResponse('encouragement');
  }, [generateContextualResponse]);

  // Manual trigger for personalized compliment
  const giveCompliment = useCallback(() => {
    if (visualContext?.visualDescription) {
      generateContextualResponse('compliment');
    } else {
      generateContextualResponse('encouragement');
    }
  }, [generateContextualResponse, visualContext]);

  return (
    <div className={`relative ${className}`}>
      {/* Main 3D Avatar */}
      <Canvas camera={{ position: [0, 1.6, 3.8], fov: 30 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 4, 2]} intensity={1.2} />
        <TalkingModel isTalking={isTalking || isSpeaking} />
      </Canvas>

      {/* Avatar Status Overlay */}
      <div className="absolute top-4 left-4 space-y-2">
        {/* Personalization Status */}
        {enablePersonalization && (
          <div className="flex items-center gap-2 px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full text-xs">
            <Brain className={`w-3 h-3 ${userTraits.length > 0 ? 'text-blue-400' : 'text-gray-400'}`} />
            <span className="text-white">
              {userTraits.length > 0 ? userTraits.slice(0, 2).join(', ') : 'Learning...'}
            </span>
          </div>
        )}

        {/* Visual Analysis Status */}
        {visualContext?.faceDetected && (
          <div className="flex items-center gap-2 px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full text-xs">
            <Eye className="w-3 h-3 text-green-400" />
            <span className="text-white capitalize">
              {visualContext.emotionalState.emotion}
            </span>
            <span className="text-gray-300">
              {Math.round(visualContext.confidence * 100)}%
            </span>
          </div>
        )}

        {/* Speaking/Processing Status */}
        {(isTalking || isSpeaking || isProcessing) && (
          <div className="flex items-center gap-2 px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full text-xs">
            {isProcessing ? (
              <div className="w-3 h-3 border border-yellow-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Volume2 className="w-3 h-3 text-cyan-400 animate-pulse" />
            )}
            <span className="text-white">
              {isProcessing ? 'Thinking...' : 'Speaking'}
            </span>
          </div>
        )}
      </div>

      {/* Current Response Display */}
      {currentResponse && (isTalking || isSpeaking) && (
        <div className="absolute bottom-4 left-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-4 border border-cyan-400/30">
          <div className="flex items-start gap-3">
            <MessageCircle className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
            <p className="text-white text-sm leading-relaxed">{currentResponse}</p>
          </div>
        </div>
      )}

      {/* Manual Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          onClick={triggerEncouragement}
          disabled={isProcessing}
          className="px-3 py-1 bg-cyan-600/80 hover:bg-cyan-600 disabled:bg-gray-600 text-white text-xs rounded-full transition-colors"
          title="Get encouragement"
        >
          💪 Encourage
        </button>
        <button
          onClick={giveCompliment}
          disabled={isProcessing || !visualContext?.faceDetected}
          className="px-3 py-1 bg-purple-600/80 hover:bg-purple-600 disabled:bg-gray-600 text-white text-xs rounded-full transition-colors"
          title="Get a personalized compliment"
        >
          ✨ Compliment
        </button>
      </div>

      {/* Debug Panel (only in development) */}
      {import.meta.env.DEV && (
        <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm rounded-lg p-2 text-xs max-w-64">
          <div className="text-gray-300 space-y-1">
            <div>Traits: {userTraits.join(', ')}</div>
            <div>Responses: {responseHistory.length}</div>
            {visualContext && (
              <div>Visual: {visualContext.emotionalState.emotion} ({Math.round(visualContext.confidence * 100)}%)</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
