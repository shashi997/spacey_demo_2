// src/components/dashboard/Webcam_Feed.jsx

import React, { useRef, useEffect, useState } from 'react';
import { Video, VideoOff, LoaderCircle } from 'lucide-react';

const WebcamFeed = () => {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let stream = null;

    const startWebcam = async () => {
      try {
        // Request access to the user's webcam
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
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

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
          <LoaderCircle className="w-12 h-12 animate-spin text-cyan-400" />
          <p className="mt-4">Initializing Camera...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-red-400">
          <VideoOff className="w-12 h-12" />
          <p className="mt-4 text-center">{error}</p>
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
        <div className="absolute top-3 left-3 flex items-center gap-2 text-xs font-mono uppercase text-cyan-400">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span>Live Feed</span>
        </div>
      </>
    );
  };

  return (
    <div className="relative w-full h-full p-2 bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
      {renderContent()}
    </div>
  );
};

export default WebcamFeed;
