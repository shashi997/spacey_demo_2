// src/components/dashboard/AI_Avatar.jsx

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import { MessageCircle, Brain, Eye, Volume2, VolumeX, Settings } from 'lucide-react';
import { fetchUserTraits, getConversationContext } from '../../api/spacey_api';
import { useSpeechCoordination } from '../../hooks/useSpeechCoordination.jsx';
import { useConversationManager } from '../../hooks/useConversationManager.jsx';

function TalkingModel({ isTalking }) {
  const group = useRef();
  const { scene, animations } = useGLTF('/models/Talking1.glb');
  const { actions, names } = useAnimations(animations, group);
  const [animationName, setAnimationName] = useState(null);

  // Floating effect
  useFrame((state) => {
    if (group.current) {
      const t = state.clock.getElapsedTime();
      group.current.position.y = Math.sin(t * 1.5) * 0.08 - 1.0; // Raised from -1.4 to -1.0 to prevent clipping
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
      scale={1.1}
      rotation={[0, Math.PI / 11, 0]}
      position={[0, -0.8, 0]}
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
  className = "",
  isExternalSpeaking = false // 👈 NEW PROP
}) {
  const [isTalking, setIsTalking] = useState(false);
  const [userTraits, setUserTraits] = useState(['curious']);
  const [conversationContext, setConversationContext] = useState(null);
  const [lastEmotionChange, setLastEmotionChange] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // Refs for managing intervals and state
  const emotionCheckInterval = useRef(null);
  const idleCheckInterval = useRef(null);

  // Unified conversation management
  const { 
    updateEmotionContext, 
    handleIdleCheck, 
    handleEmotionAwareResponse,
    conversationHistory,
    currentContext,
    isProcessing 
  } = useConversationManager();

  // Speech coordination
  const { 
    canAvatarBeIdle, 
    toggleAvatarMute, 
    avatarSettings, 
    globalSpeechState,
    trackActivity 
  } = useSpeechCoordination();

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

  // Monitor webcam for emotion changes and update context
  useEffect(() => {
    if (!webcamRef?.current || !enablePersonalization) return;

    const checkEmotions = () => {
      try {
        const emotionalState = webcamRef.current.getEmotionalState?.();
        const visualDescription = webcamRef.current.getVisualDescription?.();
        
        if (emotionalState?.visual && emotionalState.confidence > 0.3) {
          const emotionData = {
            emotionalState,
            visualDescription,
            faceDetected: emotionalState.faceDetected,
            timestamp: Date.now(),
            confidence: emotionalState.confidence
          };

          // Update emotion context in conversation manager (no immediate response)
          updateEmotionContext(emotionData);

          // Check if emotion has significantly changed for potential smart response
          const hasEmotionChanged = lastEmotionChange?.emotion !== emotionalState.emotion;
          const hasHighConfidence = emotionalState.confidence > 0.4;
          
          if (hasEmotionChanged && hasHighConfidence) {
            setLastEmotionChange({
              emotion: emotionalState.emotion,
              timestamp: Date.now()
            });
            
            // Let conversation manager decide if/when to respond based on context
            setTimeout(() => {
              if (!globalSpeechState.isAnySpeaking) {
                handleEmotionAwareResponse(userInfo);
              }
            }, 2000); // Longer delay to prevent interruptions
          }
        }
      } catch (error) {
        console.warn('⚠️ Error checking emotions:', error);
      }
    };

    // Check emotions every 5 seconds (less frequent to reduce interruptions)
    emotionCheckInterval.current = setInterval(checkEmotions, 5000);
    
    return () => {
      if (emotionCheckInterval.current) {
        clearInterval(emotionCheckInterval.current);
      }
    };
  }, [webcamRef, enablePersonalization, lastEmotionChange, updateEmotionContext, handleEmotionAwareResponse, userInfo, globalSpeechState.isAnySpeaking]);

  // Monitor conversation manager for avatar responses
  useEffect(() => {
    // Watch for new responses in conversation history
    if (conversationHistory.length > 0) {
      const lastEntry = conversationHistory[conversationHistory.length - 1];
      
      if (lastEntry.type === 'spacey' && lastEntry.timestamp > Date.now() - 2000) {
        // New Spacey response - trigger talking animation
        setIsTalking(true);
        
        // Notify parent component
        if (onAvatarResponse) {
          onAvatarResponse({
            response: lastEntry.content,
            trigger: lastEntry.metadata?.responseType || 'conversation',
            visualContext: currentContext.emotionContext,
            userTraits,
            conversationContext: lastEntry.context
          });
        }

        // Stop talking animation after estimated speech time
        const estimatedDuration = Math.max(3000, lastEntry.content.length * 50);
        setTimeout(() => setIsTalking(false), estimatedDuration);
      }
    }
  }, [conversationHistory, onAvatarResponse, userTraits, currentContext.emotionContext]);

  // Set up intelligent idle checking
  useEffect(() => {
    if (!enablePersonalization) return;

    const checkForIdleResponse = () => {
      // Use conversation manager's intelligent idle checking
      if (canAvatarBeIdle() && !globalSpeechState.isAnySpeaking) {
        handleIdleCheck(userInfo);
      }
    };

    // Check every 60 seconds for idle responses (less frequent, more intelligent)
    idleCheckInterval.current = setInterval(checkForIdleResponse, 60 * 1000);

    return () => {
      if (idleCheckInterval.current) {
        clearInterval(idleCheckInterval.current);
      }
    };
  }, [enablePersonalization, canAvatarBeIdle, globalSpeechState.isAnySpeaking, handleIdleCheck, userInfo]);



  return (
    <div className={`relative ${className}`}>
      {/* Avatar Controls */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        {/* Mute Button */}
        <button
          onClick={toggleAvatarMute}
          className={`p-2 rounded-full backdrop-blur-sm transition-all duration-200 ${
            avatarSettings.isMuted
              ? 'bg-red-500/80 text-white hover:bg-red-400/80'
              : 'bg-gray-700/80 text-gray-300 hover:bg-gray-600/80'
          }`}
          title={avatarSettings.isMuted ? 'Unmute Avatar' : 'Mute Avatar'}
        >
          {avatarSettings.isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>

        {/* Settings Button */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 rounded-full bg-gray-700/80 text-gray-300 hover:bg-gray-600/80 backdrop-blur-sm transition-all duration-200"
          title="Avatar Settings"
        >
          <Settings size={16} />
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute top-16 right-4 z-10 bg-black/90 backdrop-blur-sm rounded-lg p-4 min-w-[200px] border border-gray-600/50">
          <h3 className="text-white text-sm font-semibold mb-3">Avatar Settings</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-300 text-xs">Muted</span>
              <span className={`text-xs ${avatarSettings.isMuted ? 'text-red-400' : 'text-green-400'}`}>
                {avatarSettings.isMuted ? 'Yes' : 'No'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-300 text-xs">Speech Active</span>
              <span className={`text-xs ${globalSpeechState.isAnySpeaking ? 'text-yellow-400' : 'text-gray-400'}`}>
                {globalSpeechState.isAnySpeaking ? globalSpeechState.activeSource : 'None'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-300 text-xs">Can Be Idle</span>
              <span className={`text-xs ${canAvatarBeIdle() ? 'text-green-400' : 'text-red-400'}`}>
                {canAvatarBeIdle() ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main 3D Avatar */}
      <Canvas camera={{ position: [0, 1.2, 3.2], fov: 35 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 4, 2]} intensity={1.2} />
        <TalkingModel isTalking={isTalking || isExternalSpeaking} />
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
        {currentContext.emotionContext?.faceDetected && (
          <div className="flex items-center gap-2 px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full text-xs">
            <Eye className="w-3 h-3 text-green-400" />
            <span className="text-white capitalize">
              {currentContext.emotionContext.emotion}
            </span>
            <span className="text-gray-300">
              {Math.round(currentContext.emotionContext.confidence * 100)}%
            </span>
          </div>
        )}

        {/* Speaking/Processing Status */}
        {(isTalking || isProcessing) && (
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
      {conversationHistory.length > 0 && isTalking && (
        <div className="absolute bottom-4 left-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-4 border border-cyan-400/30">
          <div className="flex items-start gap-3">
            <MessageCircle className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
            <p className="text-white text-sm leading-relaxed">
              {conversationHistory[conversationHistory.length - 1]?.type === 'spacey' 
                ? conversationHistory[conversationHistory.length - 1].content 
                : 'Speaking...'}
            </p>
          </div>
        </div>
      )}



      {/* Debug Panel (only in development) */}
      {import.meta.env.DEV && (
        <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm rounded-lg p-2 text-xs max-w-64">
          <div className="text-gray-300 space-y-1">
            <div>Traits: {userTraits.join(', ')}</div>
            <div>Responses: {conversationHistory.filter(h => h.type === 'spacey').length}</div>
            {currentContext.emotionContext && (
              <div>Visual: {currentContext.emotionContext.emotion} ({Math.round(currentContext.emotionContext.confidence * 100)}%)</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
