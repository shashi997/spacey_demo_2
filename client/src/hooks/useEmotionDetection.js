import { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from 'face-api.js';

const useEmotionDetection = (videoElement, isEnabled = true) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [modelsAvailable, setModelsAvailable] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('initializing');
  const [emotions, setEmotions] = useState({
    happy: 0,
    sad: 0,
    angry: 0,
    fearful: 0,
    disgusted: 0,
    surprised: 0,
    neutral: 0
  });
  const [dominantEmotion, setDominantEmotion] = useState('neutral');
  const [confidence, setConfidence] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const intervalRef = useRef(null);
  const lastAnalysisRef = useRef(0);
  const simulationStateRef = useRef({ lastEmotion: 'neutral', stability: 0 });

  // Load face-api.js models with better error handling
  useEffect(() => {
    const loadModels = async () => {
      try {
        setLoadingStatus('loading_models');
        console.log('🎭 Loading face-api.js models...');
        
        // Try loading from CDN directly (more reliable)
        const cdnBaseUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
        
        console.log('🌐 Loading models from CDN...');
        
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(cdnBaseUrl),
          faceapi.nets.faceExpressionNet.loadFromUri(cdnBaseUrl),
          faceapi.nets.faceLandmark68Net.loadFromUri(cdnBaseUrl)
        ]);
        
        setModelsAvailable(true);
        setLoadingStatus('models_loaded');
        console.log('✅ Face-api.js models loaded successfully from CDN');
      } catch (error) {
        console.warn('⚠️ Could not load face-api.js models:', error);
        console.log('🔧 Using enhanced simulation mode for emotion detection');
        setModelsAvailable(false);
        setLoadingStatus('simulation_mode');
      } finally {
        setIsLoaded(true);
      }
    };

    loadModels();
  }, []);

  // Enhanced simulation that responds to actual video feed
  const simulateEmotionDetection = useCallback(() => {
    if (!videoElement) return;

    // Check if video is actually playing and has data
    const hasVideoData = videoElement.videoWidth > 0 && videoElement.videoHeight > 0 && !videoElement.paused;
    
    if (!hasVideoData) {
      setFaceDetected(false);
      return;
    }

    // Enhanced simulation with more realistic behavior
    const shouldDetectFace = Math.random() > 0.2; // 80% chance of "detecting" a face when video is active
    
    if (shouldDetectFace) {
      setFaceDetected(true);
      
      // More dynamic emotion simulation based on time and previous state
      const time = Date.now() / 1000;
      const state = simulationStateRef.current;
      
      // Create emotion cycles that feel more natural
      const emotionCycle = Math.sin(time * 0.1) * 0.3; // Slow oscillation
      const randomVariation = (Math.random() - 0.5) * 0.2;
      
      // Tend to stay in the same emotion for a while (stability)
      let targetEmotion = state.lastEmotion;
      
      if (state.stability <= 0 || Math.random() < 0.1) {
        // Time to change emotion
        const emotions = ['neutral', 'happy', 'surprised', 'thoughtful'];
        targetEmotion = emotions[Math.floor(Math.random() * emotions.length)];
        state.stability = 5 + Math.random() * 10; // Stay in this emotion for 5-15 cycles
        state.lastEmotion = targetEmotion;
      } else {
        state.stability--;
      }
      
      // Generate emotion values based on target
      let emotionValues = {
        neutral: 0.6,
        happy: 0.1,
        sad: 0.1,
        angry: 0.05,
        fearful: 0.05,
        disgusted: 0.05,
        surprised: 0.05
      };
      
      // Adjust based on target emotion
      switch (targetEmotion) {
        case 'happy':
          emotionValues.happy = 0.7 + emotionCycle + randomVariation;
          emotionValues.neutral = 0.2;
          break;
        case 'surprised':
          emotionValues.surprised = 0.6 + emotionCycle + randomVariation;
          emotionValues.neutral = 0.3;
          break;
        case 'thoughtful':
          emotionValues.neutral = 0.8 + emotionCycle + randomVariation;
          emotionValues.sad = 0.1;
          break;
        default:
          emotionValues.neutral = 0.7 + emotionCycle + randomVariation;
      }
      
      // Normalize to ensure values are between 0 and 1
      Object.keys(emotionValues).forEach(key => {
        emotionValues[key] = Math.max(0, Math.min(1, emotionValues[key]));
      });
      
      setEmotions(emotionValues);
      
      // Find dominant emotion
      const dominant = Object.entries(emotionValues).reduce((prev, current) => 
        current[1] > prev[1] ? current : prev
      );
      
      setDominantEmotion(dominant[0]);
      setConfidence(Math.min(0.6, dominant[1])); // Cap confidence for simulation
      
      console.log(`🎭 Simulated emotion: ${dominant[0]} (${Math.round(dominant[1] * 100)}%)`);
    } else {
      setFaceDetected(false);
      setDominantEmotion('neutral');
      setConfidence(0);
    }
  }, [videoElement]);

  // Analyze emotions from video feed
  const analyzeEmotions = useCallback(async () => {
    if (!videoElement || !isLoaded || !isEnabled || isAnalyzing) return;

    // Throttle analysis to avoid performance issues
    const now = Date.now();
    if (now - lastAnalysisRef.current < 2000) return; // Increased to 2 seconds for more stable detection
    lastAnalysisRef.current = now;

    setIsAnalyzing(true);

    try {
      if (modelsAvailable) {
        console.log('🎭 Running ML-based emotion detection...');
        // Real face-api.js detection
        const detections = await faceapi
          .detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions())
          .withFaceExpressions();

        if (detections && detections.length > 0) {
          setFaceDetected(true);
          const expressions = detections[0].expressions;
          
          console.log('✅ Face detected with ML models:', expressions);
          
          // Update emotion state
          setEmotions({
            happy: expressions.happy || 0,
            sad: expressions.sad || 0,
            angry: expressions.angry || 0,
            fearful: expressions.fearful || 0,
            disgusted: expressions.disgusted || 0,
            surprised: expressions.surprised || 0,
            neutral: expressions.neutral || 0
          });

          // Find dominant emotion
          const emotionEntries = Object.entries(expressions);
          const dominant = emotionEntries.reduce((prev, current) => 
            current[1] > prev[1] ? current : prev
          );
          
          setDominantEmotion(dominant[0]);
          setConfidence(dominant[1]);
        } else {
          setFaceDetected(false);
          setDominantEmotion('neutral');
          setConfidence(0);
          console.log('👻 No face detected with ML models');
        }
      } else {
        // Enhanced simulation mode
        simulateEmotionDetection();
      }
    } catch (error) {
      console.warn('⚠️ Emotion analysis error:', error);
      setFaceDetected(false);
    } finally {
      setIsAnalyzing(false);
    }
  }, [videoElement, isLoaded, isEnabled, isAnalyzing, modelsAvailable, simulateEmotionDetection]);

  // Start/stop emotion detection
  useEffect(() => {
    if (isEnabled && isLoaded && videoElement) {
      // Start analysis interval
      intervalRef.current = setInterval(analyzeEmotions, 2500); // Increased interval for more stable detection
      console.log(`🎭 Emotion detection started (${modelsAvailable ? 'ML models' : 'enhanced simulation mode'})`);
      
      // Run initial analysis after a short delay
      setTimeout(analyzeEmotions, 1000);
    } else {
      // Stop analysis
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isEnabled, isLoaded, videoElement, analyzeEmotions, modelsAvailable]);

  // Map emotions to simpler categories for AI context
  const getEmotionalState = useCallback(() => {
    if (!faceDetected || !dominantEmotion) return { emotion: 'neutral', confidence: 0, visual: false };

    let mappedEmotion = 'neutral';
    
    // Map face-api emotions to our conversation system emotions
    if (dominantEmotion === 'happy' && confidence > 0.3) {
      mappedEmotion = 'excited';
    } else if (dominantEmotion === 'sad' && confidence > 0.25) {
      mappedEmotion = 'frustrated';
    } else if (dominantEmotion === 'angry' && confidence > 0.25) {
      mappedEmotion = 'frustrated';
    } else if (dominantEmotion === 'surprised' && confidence > 0.3) {
      mappedEmotion = 'excited';
    } else if (dominantEmotion === 'fearful' && confidence > 0.25) {
      mappedEmotion = 'uncertain';
    } else if (confidence < 0.2) {
      mappedEmotion = 'neutral';
    }

    return {
      emotion: mappedEmotion,
      confidence: Math.min(confidence || 0, modelsAvailable ? 0.8 : 0.5),
      visual: true,
      rawEmotions: emotions,
      dominantEmotion: dominantEmotion || 'neutral',
      faceDetected: !!faceDetected,
      modelsAvailable: !!modelsAvailable,
      loadingStatus: loadingStatus || 'unknown'
    };
  }, [dominantEmotion, confidence, emotions, faceDetected, modelsAvailable, loadingStatus]);

  // Get human-readable emotion description for compliments
  const getVisualDescription = useCallback(() => {
    if (!faceDetected) return null;

    const descriptions = {
      happy: "You're lighting up with that wonderful smile",
      surprised: "I can see that spark of curiosity in your eyes", 
      neutral: "You look focused and ready to learn",
      sad: "You seem thoughtful and contemplative",
      angry: "You appear to be concentrating intently",
      fearful: "You look like you're carefully considering something",
      disgusted: "You seem to be processing something complex"
    };

    return descriptions[dominantEmotion] || "I can see you're engaged and present";
  }, [dominantEmotion, faceDetected]);

  return {
    isLoaded,
    isAnalyzing,
    modelsAvailable,
    loadingStatus,
    emotions,
    dominantEmotion,
    confidence,
    faceDetected,
    getEmotionalState,
    getVisualDescription,
    // For debugging
    rawData: {
      isLoaded,
      isAnalyzing,
      modelsAvailable,
      loadingStatus,
      emotions,
      dominantEmotion,
      confidence,
      faceDetected
    }
  };
};

export default useEmotionDetection; 