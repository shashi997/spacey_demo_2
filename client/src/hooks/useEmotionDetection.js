import { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from 'face-api.js';

/**
 * React hook for real-time emotion and visual trait detection using face-api.js.
 * This hook is designed to be a free, browser-based alternative to cloud services.
 * 
 * @param {HTMLVideoElement} videoElement - The video element for webcam feed.
 * @param {boolean} isEnabled - Whether emotion detection is enabled.
 * @returns {Object} Hook interface with detection state and methods.
 */
const useEmotionDetection = (videoElement, isEnabled = true) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [emotions, setEmotions] = useState({
    neutral: 1,
    happy: 0,
    sad: 0,
    angry: 0,
    fearful: 0,
    disgusted: 0,
    surprised: 0
  });
  const [dominantEmotion, setDominantEmotion] = useState('neutral');
  const [faceDetected, setFaceDetected] = useState(false);
  const [error, setError] = useState(null);
  const [visualInfo, setVisualInfo] = useState({ age: null, gender: null });

  const intervalRef = useRef(null);
  const isMountedRef = useRef(true);

  // Load models from the public folder
  const loadModels = useCallback(async () => {
    const MODEL_URL = '/models';
    try {
      console.log('🎭 Loading face-api.js models...');
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL)
      ]);
      console.log('✅ face-api.js models loaded successfully');
      setIsLoaded(true);
    } catch (e) {
      console.error('❌ Error loading face-api.js models:', e);
      setError('Failed to load detection models. Please try refreshing the page.');
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    loadModels();
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [loadModels]);

  const analyzeFace = useCallback(async () => {
    if (!videoElement || !isLoaded || !isEnabled || isAnalyzing) {
      return;
    }

    if (videoElement.paused || videoElement.ended || videoElement.videoWidth === 0) {
      return;
    }

    setIsAnalyzing(true);
    try {
      const detections = await faceapi
        .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 }))
        .withFaceLandmarks(true)
        .withFaceExpressions()
        .withAgeAndGender();

      if (isMountedRef.current) {
        if (detections) {
          setFaceDetected(true);
          
          // Remap expressions to a simpler format
          const detectedEmotions = { ...detections.expressions };
          setEmotions(detectedEmotions);

          // Find dominant emotion
          const dominant = Object.entries(detectedEmotions).reduce((a, b) => a[1] > b[1] ? a : b);
          setDominantEmotion(dominant[0]);
          
          // Set visual traits
          setVisualInfo({
            age: Math.round(detections.age),
            gender: detections.gender,
            genderProbability: detections.genderProbability
          });

        } else {
          setFaceDetected(false);
          setDominantEmotion('neutral');
          setVisualInfo({ age: null, gender: null });
        }
      }
    } catch (e) {
      console.error('❌ Error during face analysis:', e);
      // Don't set a user-facing error for transient analysis failures
    } finally {
      if (isMountedRef.current) {
        setIsAnalyzing(false);
      }
    }
  }, [videoElement, isLoaded, isEnabled, isAnalyzing]);

  useEffect(() => {
    if (isEnabled && isLoaded && videoElement) {
      intervalRef.current = setInterval(analyzeFace, 1500); // Analyze every 1.5 seconds
      console.log('🎭 Face analysis started');
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        console.log('⏹️ Face analysis stopped');
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isEnabled, isLoaded, videoElement, analyzeFace]);

  const getEmotionalState = useCallback(() => {
    if (!faceDetected) {
      return { emotion: 'neutral', confidence: 0, visual: false };
    }

    let mappedEmotion = 'neutral';
    const confidence = emotions[dominantEmotion] || 0;

    // Simplified mapping based on dominant emotion
    if (confidence > 0.5) {
        switch (dominantEmotion) {
            case 'happy': mappedEmotion = 'excited'; break;
            case 'sad':
            case 'angry': mappedEmotion = 'frustrated'; break;
            case 'surprised': mappedEmotion = 'curious'; break;
            case 'fearful': mappedEmotion = 'uncertain'; break;
            default: mappedEmotion = 'neutral';
        }
    }

    return {
      emotion: mappedEmotion,
      confidence: confidence,
      visual: true,
      rawEmotions: emotions,
      dominantEmotion: dominantEmotion,
      faceDetected: faceDetected,
      provider: 'face-api.js',
      error: error
    };
  }, [dominantEmotion, emotions, faceDetected, error]);

  const getVisualDescription = useCallback(() => {
    if (!faceDetected || !visualInfo.age || !visualInfo.gender) {
      return "I can't see the user clearly.";
    }
    return `I see a user who appears to be around ${visualInfo.age} years old and presents as ${visualInfo.gender}.`;
  }, [faceDetected, visualInfo]);

  return {
    isLoaded,
    isAnalyzing,
    faceDetected,
    emotions,
    dominantEmotion,
    confidence: emotions[dominantEmotion] || 0,
    error,
    getEmotionalState,
    getVisualDescription,
    // For debug overlay, rawData might be useful
    rawData: {
      emotions: emotions,
      age: visualInfo.age,
      gender: visualInfo.gender,
      genderProbability: visualInfo.genderProbability
    }
  };
};

export default useEmotionDetection;