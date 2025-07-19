// src/components/dashboard/AI_Avatar.jsx

import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import { MessageCircle, Brain, Eye, Volume2, VolumeX, Settings } from 'lucide-react';
import { fetchUserTraits, getConversationContext } from '../../api/spacey_api';
import { useSpeechCoordination } from '../../hooks/useSpeechCoordination.jsx';
import { useConversationManager } from '../../hooks/useConversationManager.jsx';
import * as THREE from 'three';

const TalkingModel = React.memo(function TalkingModel({ isTalking, expression = 'neutral' }) {
  const group = useRef();
  const { scene, animations } = useGLTF("/models/talking11.glb");
  const { actions, names } = useAnimations(animations, group);
  const [blinkCooldown, setBlinkCooldown] = useState(0);
  const [animationName, setAnimationName] = useState(null);

  const expressionPresets = {
    neutral: { browInnerUp: 0.2, eyeSquintLeft: 0.6, eyeSquintRight: 0.6, mouthSmileLeft: 0.3, mouthSmileRight: 0.4 },
    happy: { browInnerUp: 0.2, eyeSquintLeft: 0.6, eyeSquintRight: 0.6, mouthSmileLeft: 0.7, mouthSmileRight: 0.7 },
    sad: { browInnerUp: 0.5, eyeSquintLeft: 0.4, eyeSquintRight: 0.4, mouthFrownLeft: 0.7, mouthFrownRight: 0.7 },
    surprised: { browInnerUp: 1.0, eyeWideLeft: 1.0, eyeWideRight: 1.0, jawOpen: 1.0 },
    angry: { browDownLeft: 1.0, browDownRight: 1.0, eyeSquintLeft: 0.7, eyeSquintRight: 0.7, mouthPressLeft: 0.8, mouthPressRight: 0.8 }
  };

  useFrame((state, delta) => {
    if (group.current) {
      group.current.position.y = Math.sin(state.clock.getElapsedTime() * 0.4) * 0.03 - 1.0;
    }

    const preset = expressionPresets[expression] || expressionPresets.neutral;
    group.current?.traverse((child) => {
      if (!child.isMesh || !child.morphTargetDictionary || !child.morphTargetInfluences) return;
      const dict = child.morphTargetDictionary;
      const influences = child.morphTargetInfluences;

      Object.entries(preset).forEach(([key, value]) => {
        if (dict[key] !== undefined) {
          influences[dict[key]] = THREE.MathUtils.lerp(influences[dict[key]], value, 0.1);
        }
      });

      const mouthKey = dict["mouthOpen"] ?? dict["jawOpen"];
      if (mouthKey !== undefined) {
        const mouthTarget = isTalking ? ((Math.sin(Date.now() / 90) + 1) / 2) * 0.4 : 0;
        influences[mouthKey] = THREE.MathUtils.lerp(influences[mouthKey], mouthTarget, 0.3);
      }

      const blinkLeft = dict["eyeBlinkLeft"];
      const blinkRight = dict["eyeBlinkRight"];
      const isBlinking = blinkCooldown < 0.3;
      const blinkTarget = isBlinking ? 1 : 0;
      if (blinkLeft !== undefined && blinkRight !== undefined) {
        influences[blinkLeft] = THREE.MathUtils.lerp(influences[blinkLeft], blinkTarget, 0.4);
        influences[blinkRight] = THREE.MathUtils.lerp(influences[blinkRight], blinkTarget, 0.4);
      }
    });

    if (blinkCooldown <= 0 && Math.random() < 0.02) {
      setBlinkCooldown(3 + Math.random() * 3);
    } else {
      setBlinkCooldown((prev) => Math.max(0, prev - delta));
    }
  });

  useEffect(() => {
    if (names.length > 0) setAnimationName(names[0]);
  }, [names]);

  useEffect(() => {
    if (!animationName || !actions[animationName]) return;
    const action = actions[animationName];
    if (isTalking) {
      action.reset().fadeIn(0.3).play();
    } else {
      action.fadeOut(0.3);
    }
  }, [isTalking, animationName, actions]);

  return (
    <group ref={group} scale={1.1} rotation={[0, Math.PI / 11, 0]} position={[0, -1.5, 0]}>
      <primitive object={scene} />
    </group>
  );
});

export default function AI_Avatar({
  webcamRef,
  userInfo,
  onAvatarResponse,
  enablePersonalization = true,
  className = "",
}) {
  const [userTraits, setUserTraits] = useState(['curious']);
  const [conversationContext, setConversationContext] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [hasSeenFaceBefore, setHasSeenFaceBefore] = useState(false);
  const isInitialMount = useRef(true);

  const {
    updateEmotionContext,
    handleIdleCheck,
    handleEmotionAwareResponse,
    handleGreeting,
    conversationHistory,
    currentContext,
    isProcessing
  } = useConversationManager();

  const {
    canAvatarBeIdle,
    toggleAvatarMute,
    avatarSettings,
    globalSpeechState
  } = useSpeechCoordination();

  // This is the key variable. It correctly listens to the global state.
  // It will become true when the conversation manager triggers the speech hook.
  const isTalking = globalSpeechState.isAnySpeaking && globalSpeechState.activeSource === 'avatar';

  useEffect(() => {
    // We wait for userInfo to be available to personalize the greeting.
    if (userInfo) {
      // Use a timeout to give the 3D model a moment to load and prevent abruptness.
      const greetingTimeout = setTimeout(() => {
        handleGreeting(userInfo);
      }, 2000); // 2-second delay before greeting.

      return () => clearTimeout(greetingTimeout);
    }
    // This effect should only re-run if handleGreeting or userInfo changes.
    // Since handleGreeting is a stable useCallback, it effectively runs once userInfo is populated.
  }, [userInfo, handleGreeting]);

  useEffect(() => {
    const loadUserData = async () => {
      if (!userInfo?.uid || !enablePersonalization) return;
      try {
        const [traits, context] = await Promise.all([
          fetchUserTraits(userInfo.uid),
          getConversationContext(userInfo.uid, 5),
        ]);
        setUserTraits(traits.traits || ['curious']);
        setConversationContext(context);
      } catch (err) {
        console.warn('⚠️ Failed to load user data:', err);
      }
    };
    loadUserData();
  }, [userInfo?.uid, enablePersonalization]);

  useEffect(() => {
    if (!webcamRef?.current || !enablePersonalization) return;
    const interval = setInterval(() => {
      const emotionalState = webcamRef.current.getEmotionalState?.();
      if (emotionalState?.visual && emotionalState.confidence > 0.3) {
        updateEmotionContext({ emotionalState, faceDetected: emotionalState.faceDetected });
        if (emotionalState.faceDetected && !hasSeenFaceBefore) {
          setHasSeenFaceBefore(true);
          setTimeout(() => {
            if (!globalSpeechState.isAnySpeaking) {
              handleEmotionAwareResponse(userInfo, { trigger: 'first_sight' });
            }
          }, 1500);
        }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [webcamRef, enablePersonalization, hasSeenFaceBefore, userInfo, globalSpeechState.isAnySpeaking, handleEmotionAwareResponse, updateEmotionContext]);

  useEffect(() => {
    if (!enablePersonalization) return;
    const idleInterval = setInterval(() => {
      if (canAvatarBeIdle() && !globalSpeechState.isAnySpeaking) {
        handleIdleCheck(userInfo);
      }
    }, 60000);
    return () => clearInterval(idleInterval);
  }, [enablePersonalization, canAvatarBeIdle, globalSpeechState.isAnySpeaking, handleIdleCheck, userInfo]);

  return (
    <div className={`relative ${className}`}>
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button
          onClick={toggleAvatarMute}
          className={`p-2 rounded-full backdrop-blur-sm transition-all duration-200 ${avatarSettings.isMuted ? 'bg-red-500/80 text-white hover:bg-red-400/80' : 'bg-gray-700/80 text-gray-300 hover:bg-gray-600/80'}`}
          title={avatarSettings.isMuted ? 'Unmute Avatar' : 'Mute Avatar'}
        >
          {avatarSettings.isMuted ? (
            <VolumeX size={16} />
          ) : (
            <Volume2 size={16} />
          )}
        </button>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 rounded-full bg-gray-700/80 text-gray-300 hover:bg-gray-600/80 backdrop-blur-sm transition-all duration-200"
          title="Avatar Settings"
        >
          <Settings size={16} />
        </button>
      </div>

      {showSettings && (
        <div className="absolute top-16 right-4 z-10 bg-black/90 backdrop-blur-sm rounded-lg p-4 min-w-[200px] border border-gray-600/50">
          <h3 className="text-white text-sm font-semibold mb-3">Avatar Settings</h3>
          <div className="space-y-3 text-xs text-gray-300">
            <div className="flex justify-between">
              <span>Muted</span>
              <span className={avatarSettings.isMuted ? 'text-red-400' : 'text-green-400'}>
                {avatarSettings.isMuted ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Speech Active</span>
              <span className={globalSpeechState.isAnySpeaking ? 'text-yellow-400' : 'text-gray-400'}>
                {globalSpeechState.isAnySpeaking ? globalSpeechState.activeSource : 'None'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Can Be Idle</span>
              <span className={canAvatarBeIdle() ? 'text-green-400' : 'text-red-400'}>
                {canAvatarBeIdle() ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </div>
      )}

      <Canvas camera={{ position: [0, 1.2, 3.2], fov: 35 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 4, 2]} intensity={1.2} />
        <TalkingModel
          isTalking={isTalking}
          expression={currentContext.emotionContext?.emotion?.toLowerCase() || 'neutral'}
        />
      </Canvas>

      <div className="absolute top-4 left-4 space-y-2">
        {enablePersonalization && (
          <div className="flex items-center gap-2 px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full text-xs">
            <Brain className="w-3 h-3 text-blue-400" />
            <span className="text-white">{userTraits.slice(0, 2).join(', ')}</span>
          </div>
        )}
        {currentContext.emotionContext?.faceDetected && (
          <div className="flex items-center gap-2 px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full text-xs">
            <Eye className="w-3 h-3 text-green-400" />
            <span className="text-white capitalize">{currentContext.emotionContext.emotion}</span>
            <span className="text-gray-300">{Math.round(currentContext.emotionContext.confidence * 100)}%</span>
          </div>
        )}
        {(isTalking || isProcessing) && (
          <div className="flex items-center gap-2 px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full text-xs">
            {isProcessing && !isTalking ? (
              <div className="w-3 h-3 border border-yellow-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Volume2 className="w-3 h-3 text-cyan-400 animate-pulse" />
            )}
            <span className="text-white">{isProcessing && !isTalking ? 'Thinking...' : 'Speaking'}</span>
          </div>
        )}
      </div>

      {isTalking && (
        <div className="absolute bottom-4 left-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-4 border border-cyan-400/30">
          <div className="flex items-start gap-3">
            <MessageCircle className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
            <p className="text-white text-sm leading-relaxed">
              {conversationHistory.at(-1)?.content ?? ""}
            </p>
          </div>
        </div>
      )}

      {import.meta.env.DEV && (
        <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm rounded-lg p-2 text-xs max-w-64">
          <div className="text-gray-300 space-y-1">
            <div>Traits: {userTraits.join(", ")}</div>
            <div>
              Responses:{" "}
              {conversationHistory.filter((h) => h.type === "spacey").length}
            </div>
            {currentContext.emotionContext && (
              <div>
                Visual: {currentContext.emotionContext.emotion} ({Math.round(currentContext.emotionContext.confidence * 100)}%)
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}