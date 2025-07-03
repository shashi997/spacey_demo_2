import React, { Suspense, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three'; // We need to import the three.js library to use its materials

// This component loads and displays the GLB model and plays its animation.
function Model(props) {
  const group = useRef();
  // Load the animated model
  const { scene, animations } = useGLTF('/models/breath-idle.glb');
  // Extract animation actions
  const { actions } = useAnimations(animations, group);

  // This effect will run once and play the first animation found in the file.
  useEffect(() => {
    if (actions) {
      const firstAnimationName = Object.keys(actions)[0];
      if (firstAnimationName) {
        actions[firstAnimationName].play();
      }
    }
  }, [actions]);

  // This effect will traverse the model and apply the new cartoon-like material
  useEffect(() => {
    if (scene) {
      scene.traverse((object) => {
        // We only want to change the material on the visible parts of the model (Meshes)
        if (object.isMesh) {
          // Create a new toon material, keeping the original texture if it exists
          const toonMaterial = new THREE.MeshToonMaterial({
            map: object.material.map,
            color: object.material.color,
          });
          object.material = toonMaterial;
          // Ensure shadows look correct with the new material
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
    }
  }, [scene]);
  
  // We move the model down to create the half-body view and apply rotation.
  // A value around -1.2 is usually good for a bust shot.
  return <primitive ref={group} object={scene} {...props} position-y={-3.2} scale={2.2} rotation-y={0.2} />;
}

// Preload the correct model for a smoother experience
useGLTF.preload('/models/breath-idle.glb');

const CharacterModel = () => {
  return (
    <div className="w-full h-full">
      <Canvas 
        camera={{ position: [0, 0.5, 3.5], fov: 45 }} // Moved camera back a bit for better framing
        shadows
      >
        {/* Simplified lighting for a stylized, high-performance look */}
        <ambientLight intensity={1.5} />
        <directionalLight 
          position={[5, 5, 5]} 
          intensity={1.0} 
          castShadow 
          // Lowering shadow map resolution improves performance
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        
        <Suspense fallback={null}>
          <Model />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default CharacterModel;
