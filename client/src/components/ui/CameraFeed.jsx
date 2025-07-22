// src/components/ui/CameraFeed.jsx

import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Video, VideoOff, LoaderCircle, Eye, AlertCircle, Cpu, Zap } from 'lucide-react';
import useEmotionDetection from '../../hooks/useEmotionDetection';

const CameraFeed = forwardRef(({ 
  onEmotionDetected, 
  enableEmotionDetection = true, 
  className = "",
  showOverlay = true,
  compact = false
}, ref) => {
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
            width: { ideal: compact ? 480 : 640 },
            height: { ideal: compact ? 480 : 480 },
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
  }, [compact]); // Re-run if compact mode changes

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
          <LoaderCircle className={`${compact ? 'w-8 h-8' : 'w-12 h-12'} animate-spin text-cyan-400`} />
          <p className={`mt-4 ${compact ? 'text-xs' : 'text-sm'}`}>Initializing Camera...</p>
          {enableEmotionDetection && (
            <p className={`${compact ? 'text-xs' : 'text-xs'} mt-2 text-gray-500`}>
              {loadingStatus === 'loading_models' ? 'Loading AI models...' : 'Loading emotion detection...'}
            </p>
          )}
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-red-400">
          <VideoOff className={`${compact ? 'w-8 h-8' : 'w-12 h-12'}`} />
          <p className={`mt-4 text-center ${compact ? 'text-xs' : 'text-sm'}`}>{error}</p>
          {enableEmotionDetection && (
            <p className={`${compact ? 'text-xs' : 'text-xs'} mt-2 text-gray-500`}>
              Emotion detection requires camera access
            </p>
          )}
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
        {showOverlay && (
          <div className="absolute inset-0 pointer-events-none border-2 border-cyan-400/30 rounded-md animate-pulse-slow"></div>
        )}
        
        {/* Live Feed Indicator */}
        {showOverlay && (
          <div className={`absolute ${compact ? 'top-1 left-1' : 'top-3 left-3'} flex items-center gap-2 text-xs font-mono uppercase text-cyan-400`}>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className={compact ? 'text-xs' : 'text-xs'}>Live Feed</span>
          </div>
        )}

        {/* Emotion Detection Status */}
        {enableEmotionDetection && showOverlay && (
          <div className={`absolute ${compact ? 'top-1 right-1' : 'top-3 right-3'} flex items-center gap-2`}>
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
        {showEmotionOverlay && enableEmotionDetection && showOverlay && (
          <div className={`absolute ${compact ? 'bottom-1 left-1 right-1' : 'bottom-3 left-3 right-3'} bg-black/80 backdrop-blur-sm rounded-lg p-3 text-xs`}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-cyan-400 font-mono">EMOTION ANALYSIS</span>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${faceDetected ? 'text-green-400' : 'text-red-400'}`}>
                  {faceDetected ? 'FACE DETECTED' : 'NO FACE'}
                </span>
                {modelsAvailable ? (
                  <span className="text-blue-400 text-xs">ML</span>
                ) : (
                  <span className="text-orange-400 text-xs">SIM</span>
                )}
              </div>
            </div>
            
            {/* Status Information */}
            <div className="mb-2 text-gray-300 text-xs">
              Status: <span className="text-yellow-400">{getStatusText()}</span>
            </div>
            
            {faceDetected && (
              <div className="space-y-1">
                <div className="grid grid-cols-2 gap-1 text-white">
                  <div>Emotion: <span className="text-yellow-400">{dominantEmotion}</span></div>
                  <div>Confidence: <span className="text-yellow-400">{Math.round(confidence * 100)}%</span></div>
                </div>
                <div className="text-gray-300 text-xs">
                  State: <span className="text-cyan-400">{getEmotionalState().emotion}</span>
                </div>
                <div className="text-gray-300 text-xs">
                  Description: <span className="text-green-400">{getVisualDescription()}</span>
                </div>
                
                {/* Emotion bars for top emotions */}
                {!compact && (
                  <div className="mt-2 space-y-1">
                    {Object.entries(rawData.emotions)
                      .sort(([,a], [,b]) => b - a)
                      .slice(0, 3)
                      .map(([emotion, value]) => (
                        <div key={emotion} className="flex items-center gap-2">
                          <span className="text-xs w-12 text-gray-400 capitalize">{emotion}</span>
                          <div className="flex-1 bg-gray-700 rounded-full h-1">
                            <div 
                              className="bg-cyan-400 h-1 rounded-full transition-all duration-300"
                              style={{ width: `${value * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 w-8">{Math.round(value * 100)}%</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
            
            {!videoReady && (
              <div className="text-yellow-400 text-xs">
                Waiting for video stream to stabilize...
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  return (
    <div className={`relative w-full h-full p-2 bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden ${className}`}>
      {renderContent()}
    </div>
  );
});

CameraFeed.displayName = 'CameraFeed';

export default CameraFeed; 