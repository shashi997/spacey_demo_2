// src/components/dashboard/AI_Avatar.jsx

import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';

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

export default function AI_Avatar({ isAnimating, isListening }) {
  const shouldAnimate = isAnimating || isListening;

  return (
    <Canvas camera={{ position: [0, 1.6, 3.8], fov: 30 }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 4, 2]} intensity={1.2} />
      <TalkingModel isTalking={shouldAnimate} />
    </Canvas>
  );
}
