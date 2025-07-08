// src/components/lesson/MediaDisplay.jsx
import React, { useState, useEffect, useRef } from 'react';
import LessonImage from './LessonImage';
import Lesson3DModel from './Lesson3DModel';
import useAudio from '../../hooks/useAudio';

const MediaDisplay = ({ media }) => {
  const [currentMedia, setCurrentMedia] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (media) {
      if (media['3d_model']) {
        setCurrentMedia({ type: '3d', src: media['3d_model'] });
      } else if (media.image) {
        setCurrentMedia({ type: 'image', src: media.image });
      } else if (media.video) { // Prioritize video over audio
        setCurrentMedia({ type: 'video', src: media.video });
      } else if (media.audio) {
        setCurrentMedia({ type: 'audio', src: media.audio });
      } else {
        setCurrentMedia(null);
      }
    }
  }, [media]);

  useAudio(currentMedia?.type === 'audio' ? currentMedia.src : null);

  const nextMedia = () => {
    if (!media) return;

    let nextType;
    switch (currentMedia?.type) {
      case '3d':
        nextType = media.image ? 'image' : (media.video ? 'video' : null);
        break;
      case 'image':
        nextType = media.video ? 'video' : null;
        break;
      case 'video':
        nextType = null; // Loop back to the beginning or handle no more media after video
        break;
      default: // Covers 'audio' and null cases
        nextType = media['3d_model'] ? '3d' : (media.image ? 'image' : (media.video ? 'video' : null));
        break;
    }


    if (nextType) {
      setCurrentMedia({ type: nextType, src: media[nextType === '3d' ? '3d_model' : nextType] });
    } else {
      // Loop back to the beginning, prioritizing 3D, Image, Video (no audio)
      if (media['3d_model']) {
        setCurrentMedia({ type: '3d', src: media['3d_model'] });
      } else if (media.image) {
        setCurrentMedia({ type: 'image', src: media.image });
      } else if (media.video) {
        setCurrentMedia({ type: 'video', src: media.video });
      } else {
        setCurrentMedia(null); // No visual media available
      }
    }

    if (currentMedia?.type === 'video' && videoRef.current) {
      videoRef.current.pause();
    }
  };

  const renderMedia = () => {
    if (!currentMedia || currentMedia.type === 'audio') return null; // Don't render anything for audio

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

  // Determine if the "Next Media" button should be shown (check for at least two visual media types)
  const hasMultipleVisualMedia = (
    (media['3d_model'] && (media.image || media.video)) ||
    (media.image && media.video) ||
    (media.video && media['3d_model'])
  );

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
