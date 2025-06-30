import React, { useRef, useEffect } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';

const Avatar = (props) => {
  const group = useRef();
  const { scene, animations } = useGLTF('/models/greet-untitled.glb');
  const { actions, names } = useAnimations(animations, group);

  // This effect plays the first animation on loop
  useEffect(() => {
    const action = actions?.[names?.[0]];

    if (action) {
      action.reset().fadeIn(0.5).play();
      return () => {
        action.fadeOut(0.5);
      };
    }
  }, [actions, names]);

  // Adjusted scale and position for the side-by-side layout.
  return (
    <primitive
      ref={group}
      object={scene}
      scale={2.2} // Made the model larger to fill its new space
      position-y={-2.2} // Adjusted vertical position to be centered
      rotation-y={-0.2} // Slightly rotate the model to face the text
      {...props}
    />
  );
};

useGLTF.preload('/models/greet-untitled.glb');

export default Avatar;
