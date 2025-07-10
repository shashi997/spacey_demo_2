// src/components/dashboard/Webcam_Feed.jsx

import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Video, VideoOff, LoaderCircle, Eye, AlertCircle, Cpu, Zap } from 'lucide-react';
import EmotionAnalysisOverlay from './EmotionAnalysisOverlay';
import useEmotionDetection from '../../hooks/useEmotionDetection';

const WebcamFeed = forwardRef(({ onEmotionDetected, enableEmotionDetection = true }, ref) => {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEmotionOverlay, setShowEmotionOverlay] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  // Emotion detection hook
  const {
    isLoaded: emotionLoaded,
    isAnalyzing,
    faceDetected,
    dominantEmotion,
    confidence,
    modelsAvailable,
    loadingStatus,
    getEmotionalState,
    getVisualDescription,
    rawData
  } = useEmotionDetection(videoRef.current, enableEmotionDetection && videoReady);

  // Expose methods to parent components
  useImperativeHandle(ref, () => ({
    getVideoElement: () => videoRef.current,
    getEmotionalState,
    getVisualDescription,
    isEmotionDetectionReady: () => emotionLoaded && !error && videoReady,
    toggleEmotionOverlay: () => setShowEmotionOverlay(prev => !prev),
    getDebugInfo: () => ({
      videoReady,
      emotionLoaded,
      modelsAvailable,
      loadingStatus,
      faceDetected,
      dominantEmotion,
      confidence
    })
  }));

  // Throttle emotion detection calls
  const lastEmotionCallRef = useRef(0);
  const EMOTION_THROTTLE_MS = 500; // Limit to once every 500ms

  // Notify parent of emotion changes
  useEffect(() => {
    if (onEmotionDetected && emotionLoaded && faceDetected && videoReady) {
      const now = Date.now();
      
      // Throttle: only call if enough time has passed
      if (now - lastEmotionCallRef.current >= EMOTION_THROTTLE_MS) {
        const emotionalState = getEmotionalState();
        const visualDescription = getVisualDescription();
        
        onEmotionDetected({
          ...emotionalState,
          visualDescription,
          timestamp: now
        });
        
        lastEmotionCallRef.current = now;
      }
    }
  }, [dominantEmotion, confidence, faceDetected, emotionLoaded, videoReady, onEmotionDetected, getEmotionalState, getVisualDescription]);

  useEffect(() => {
    let stream = null;

    const startWebcam = async () => {
      try {
        console.log('📹 Starting webcam...');
        // Request access to the user's webcam
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          
          // Wait for video to be ready
          videoRef.current.onloadedmetadata = () => {
            console.log('📹 Video metadata loaded');
            setVideoReady(true);
          };
          
          videoRef.current.oncanplay = () => {
            console.log('📹 Video can play');
            setVideoReady(true);
          };
        }
      } catch (err) {
        console.error("Error accessing webcam:", err);
        setError("Webcam access denied. Please enable it in your browser settings.");
      } finally {
        setIsLoading(false);
      }
    };

    startWebcam();

    // Cleanup function to stop the webcam stream when the component unmounts
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  const getStatusIcon = () => {
    if (!emotionLoaded) return <LoaderCircle className="w-3 h-3 animate-spin text-yellow-400" />;
    if (!modelsAvailable) return <Cpu className="w-3 h-3 text-orange-400" />;
    if (faceDetected) return <Eye className="w-3 h-3 text-green-400" />;
    return <AlertCircle className="w-3 h-3 text-gray-400" />;
  };

  const getStatusText = () => {
    if (!emotionLoaded) return 'Loading...';
    if (loadingStatus === 'simulation_mode') return 'Simulation Mode';
    if (modelsAvailable) return 'ML Models Active';
    return 'Basic Detection';
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
          <LoaderCircle className="w-12 h-12 animate-spin text-cyan-400" />
          <p className="mt-4">Initializing Camera...</p>
          {enableEmotionDetection && (
            <p className="text-xs mt-2 text-gray-500">
              {loadingStatus === 'loading_models' ? 'Loading AI models...' : 'Loading emotion detection...'}
            </p>
          )}
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-red-400">
          <VideoOff className="w-12 h-12" />
          <p className="mt-4 text-center">{error}</p>
          <p className="text-xs mt-2 text-gray-500">Emotion detection requires camera access</p>
        </div>
      );
    }

    return (
      <>
        {/* The actual video feed, mirrored for a natural feel */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover rounded-md scale-x-[-1]"
        />
        
        {/* Futuristic UI Overlay */}
        <div className="absolute inset-0 pointer-events-none border-2 border-cyan-400/30 rounded-md animate-pulse-slow"></div>
        
        {/* Live Feed Indicator */}
        <div className="absolute top-3 left-3 flex items-center gap-2 text-xs font-mono uppercase text-cyan-400">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span>Live Feed</span>
        </div>

        {/* Emotion Detection Status */}
        {enableEmotionDetection && (
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <button 
              onClick={() => setShowEmotionOverlay(!showEmotionOverlay)}
              className="p-1 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
              title={`Emotion Detection: ${getStatusText()}`}
            >
              {getStatusIcon()}
            </button>
            {isAnalyzing && (
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-yellow-400 animate-pulse" />
              </div>
            )}
          </div>
        )}

        {/* Enhanced Emotion Overlay */}
        {showEmotionOverlay && enableEmotionDetection && (
          <EmotionAnalysisOverlay
            faceDetected={faceDetected}
            modelsAvailable={modelsAvailable}
            statusText={getStatusText()}
            dominantEmotion={dominantEmotion}
            confidence={confidence}
            emotionalState={getEmotionalState().emotion}
            visualDescription={getVisualDescription()}
            rawData={rawData}
            videoReady={videoReady}
          />
        )}
      </>
    );
  };

  return (
    <div className="relative w-full h-full p-2 bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
      {renderContent()}
    </div>
  );
});

WebcamFeed.displayName = 'WebcamFeed';

export default WebcamFeed;
