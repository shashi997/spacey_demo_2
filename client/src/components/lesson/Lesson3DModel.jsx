import React, { Suspense, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, Environment, OrbitControls, useAnimations, Stars } from '@react-three/drei';
import * as THREE from 'three';

function Model({ modelPath, isAnimating }) {
  const group = useRef();
  const { scene, animations } = useGLTF(modelPath);
  const { actions } = useAnimations(animations, group);

  // Check if there are any animations and get the name of the first one
  const animationName = animations.length > 0 ? animations[0].name : null;

  React.useEffect(() => {
    // Only try to play animation if it exists
    if (actions && animationName) {
      const action = actions[animationName];
      if (isAnimating) {
        action.reset().fadeIn(0.5).play();
      } else {
        action.fadeOut(0.5).stop();
      }
    }
  }, [actions, animationName, isAnimating]);

  React.useEffect(() => {
    if (scene) {
      console.log("Model loaded successfully:", scene);
      scene.traverse((object) => {
        if (object.isMesh) {
          const material = new THREE.MeshStandardMaterial({
            map: object.material.map,
            color: object.material.color,
            metalness: 0.7,
            roughness: 0.3,
          });
          object.material = material;
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
    }
  }, [scene]);

  return (
    <primitive 
      ref={group} 
      object={scene} 
      scale={2.5}
      position={[0, -1.5, 0]}
    />
  );
}

const Lesson3DModel = ({ modelPath }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const controlsRef = useRef();

  const handleModelClick = () => {
    // Animation will only be triggered if the model has animations
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 1000);
  };

  return (
    <div 
      className="w-full h-80 rounded-lg overflow-hidden cursor-pointer" // Made the whole div clickable
      onClick={handleModelClick} // Click handler on the main div
    >
      <Canvas camera={{ position: [0, 2, 5], fov: 45 }}>
        <directionalLight position={[5, 5, 5]} intensity={3} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} color={0xffffff} />
        <directionalLight position={[-5, 5, -5]} intensity={1.5} color={0xffffff} />
        <ambientLight intensity={1} color={0xffffff} />
        
        <Suspense fallback={null}>
          <Model modelPath={modelPath} isAnimating={isAnimating} />
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade />
        </Suspense>
        <OrbitControls 
          ref={controlsRef}
          minDistance={2}
          maxDistance={8}
        />
      </Canvas>
    </div>
  );
};

export default Lesson3DModel;
