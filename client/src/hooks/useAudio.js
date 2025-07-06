import { useEffect, useRef } from 'react';

/**
 * A simple hook to play an audio file.
 * It handles creating, playing, and cleaning up the audio element.
 * @param {string} src - The path to the audio file.
 */
const useAudio = (src) => {
  const audioRef = useRef(null);

  useEffect(() => {
    if (src) {
      if (!audioRef.current) {
        audioRef.current = new Audio(src);
      } else {
        audioRef.current.src = src;
      }
      
      // --- UPDATED: Set the volume to a lower level ---
      // You can adjust this value. 0.3 is 30% volume.
      audioRef.current.volume = 0.3;
      
      // Play the audio. We catch potential errors if the user hasn't interacted with the page yet.
      audioRef.current.play().catch(e => console.warn("Audio playback was prevented. This is normal before user interaction.", e));
    }

    // Cleanup function: runs when the component unmounts or the src changes.
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0; // Reset for next time
      }
    };
  }, [src]); // This effect re-runs whenever the `src` prop changes.
};

export default useAudio;
