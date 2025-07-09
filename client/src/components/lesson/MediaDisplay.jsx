// src/components/lesson/MediaDisplay.jsx
import React, { useState, useEffect, useRef } from 'react';
import LessonImage from './LessonImage';
import Lesson3DModel from './Lesson3DModel';
import useAudio from '../../hooks/useAudio';

const MediaDisplay = ({ media, initialIndex = 0, onMediaChange }) => { // Added initialIndex and onMediaChange
  const [currentMediaIndex, setCurrentMediaIndex] = useState(initialIndex);
  const videoRef = useRef(null);

  useEffect(() => {
    setCurrentMediaIndex(initialIndex); // Reset index when initialIndex changes
  }, [initialIndex]);

  const getMediaArray = () => {
    if (!media) return [];
    const mediaArray = [];
    if (media['3d_model']) mediaArray.push({ type: '3d', src: media['3d_model'] });
    if (media.image) mediaArray.push({ type: 'image', src: media.image });
    if (media.video) mediaArray.push({ type: 'video', src: media.video });
    if (media.audio) mediaArray.push({ type: 'audio', src: media.audio });
    return mediaArray;
  };

  const mediaArray = getMediaArray();
  const currentMedia = mediaArray[currentMediaIndex];

  useAudio(currentMedia?.type === 'audio' ? currentMedia.src : null);


  const nextMedia = () => {
    if (mediaArray.length <= 1) return; // No next media if only one or zero
    const nextIndex = (currentMediaIndex + 1) % (mediaArray.length - (media.audio ? 1 : 0));  // Loop excluding audio
    setCurrentMediaIndex(nextIndex);
    onMediaChange(nextIndex);
    if (mediaArray[nextIndex].type === 'video' && videoRef.current) {
      videoRef.current.pause(); // Pause previous video
    }
  };

  const renderMedia = () => {
    if (!currentMedia || currentMedia.type === 'audio') return null;
    switch (currentMedia.type) {
      case '3d':
        return <Lesson3DModel modelPath={currentMedia.src} />;
      case 'image':
        return <LessonImage src={currentMedia.src} alt="Lesson Illustration" />;
      case 'video':
        return (
          <video
            ref={videoRef}
            src={currentMedia.src}
            controls
            className="w-full h-80 rounded-lg border border-white/10 shadow-lg shadow-cyan-500/10"
          />
        );
      default:
        return null;
    }
  };

  const hasMultipleVisualMedia = mediaArray.filter(m => m.type !== "audio").length > 1;

  return (
    <div className="mb-8 animate-fade-in">
      {renderMedia()}
      {hasMultipleVisualMedia ? (
        <button
          onClick={nextMedia}
          className="mt-4 px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-500 transition-colors"
        >
          Next Media
        </button>
      ) : null}
    </div>
  );
};

export default MediaDisplay;
