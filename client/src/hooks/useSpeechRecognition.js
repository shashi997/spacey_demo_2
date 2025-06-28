// e:\Spacey-Intern\spacey_first_demo\spacey_demo_1\client\src\hooks\useSpeechRecognition.js
import { useState, useEffect, useRef, useCallback } from 'react';

// Check for browser support once
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export const useSpeechRecognition = ({ onFinalResult } = {}) => {
    const recognitionRef = useRef(null);
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState(''); // This will hold interim results for live display
    const [speechError, setSpeechError] = useState(null);
  
    // Effect 1: Initialize the recognition instance once on mount
    useEffect(() => {
      if (!SpeechRecognition) {
        console.warn("Speech recognition not supported by this browser.");
        setSpeechError("Speech recognition not supported by this browser."); // Set error for UI
        return;
      }

      const recognition = new SpeechRecognition();
      
      recognition.continuous = false; // Stop after a pause in speech
      recognition.interimResults = true; // Get results as the user speaks for live feedback
      recognition.lang = 'en-US';
      recognitionRef.current = recognition; // Store the instance in the ref

      // Cleanup function for the recognition instance itself
      return () => {
        if (recognitionRef.current) {
          recognitionRef.current.abort(); // Ensure recognition is stopped
          recognitionRef.current = null; // Clear the ref
        }
      };
    }, []); // Empty dependency array: runs only once on mount

    // Memoized event handlers to prevent unnecessary re-attachments of listeners
    const handleResult = useCallback((event) => {
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        setTranscript(finalTranscript + interimTranscript);
  
        // If a final result is received, call the provided callback
        if (finalTranscript.trim()) {
          console.log("Transcribed audio text (final):", finalTranscript.trim()); // Console log the final text
          if (onFinalResult) {
            onFinalResult(finalTranscript.trim());
          }
          // Clear internal transcript state after final result is passed to consumer
          setTranscript(''); 
        }
    }, [onFinalResult]); // Dependency: onFinalResult prop

    const handleError = useCallback((event) => {
        console.error('Speech recognition error:', event.error);
        // Provide user-friendly error messages for common cases
        if (event.error === 'no-speech') {
          setSpeechError("I didn't catch that. Please try again.");
        } else if (event.error === 'audio-capture') {
          setSpeechError('Audio capture failed. Please check your microphone settings.');
        } else if (event.error === 'not-allowed') {
          setSpeechError('Microphone access denied. Please allow it in your browser settings.');
        } else {
          setSpeechError(`Speech error: ${event.error}`);
        }
        setIsListening(false); // Stop listening on any error
        setTranscript(''); // Clear any partial transcript on error
    }, []); // No dependencies, as it only uses setters

    const handleStart = useCallback(() => {
        setIsListening(true);
        setTranscript(''); // Clear transcript on start
        setSpeechError(null); // Clear error on start
    }, []); // No dependencies

    const handleEnd = useCallback(() => {
        setIsListening(false);
        // The `transcript` state is managed by `handleResult` (for final) or `handleStart`/`handleError`.
        // The AI_Chat component's `useEffect` for `liveTranscript` will handle clearing its display.
        // So, no need to clear `transcript` here.
    }, []); // No dependencies

    // Effect 2: Attach and detach event listeners
    useEffect(() => {
        const recognition = recognitionRef.current;
        if (!recognition) return;

        recognition.addEventListener('result', handleResult);
        recognition.addEventListener('error', handleError);
        recognition.addEventListener('start', handleStart);
        recognition.addEventListener('end', handleEnd);

        // Cleanup function for event listeners
        return () => {
            recognition.removeEventListener('result', handleResult);
            recognition.removeEventListener('error', handleError);
            recognition.removeEventListener('start', handleStart);
            recognition.removeEventListener('end', handleEnd);
            // Do NOT call recognition.abort() here; it's handled in the first useEffect's cleanup.
        };
    }, [handleResult, handleError, handleStart, handleEnd]); // Dependencies are the memoized handlers

    // Functions to control listening, memoized with useCallback
    const startListening = useCallback(() => {
      const recognition = recognitionRef.current;
      if (recognition && !isListening) {
        try {
          recognition.start();
        } catch (e) {
          console.error("Error starting recognition:", e);
          setIsListening(false);
          setSpeechError('Could not start voice recognition.');
        }
      }
    }, [isListening]);
  
    const stopListening = useCallback(() => {
      const recognition = recognitionRef.current;
      if (recognition && isListening) {
        recognition.stop();
      }
    }, [isListening]);
  
    return {
      isListening,
      transcript, // Provides live interim transcript for UI feedback
      speechError,
      startListening,
      stopListening,
      isRecognitionSupported: !!SpeechRecognition,
    };
};