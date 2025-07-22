import React, { useState, useEffect, useRef, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { BookOpen, Eye, Brain } from "lucide-react";

import Navbar from "../components/ui/Navbar";
import DebugPanel from "../components/debug/DebugPanel";
import AIAvatar from "../components/ui/AIAvatar";
import CameraFeed from "../components/ui/CameraFeed";
import AIChat from "../components/dashboard/AI_Chat";
import LessonCatalogueModal from "../components/dashboard/LessonCatalogueModal";
import { useAuth } from "../hooks/useAuth";
import { useConversationManager } from "../hooks/useConversationManager.jsx";

import { useSpeechRecognition } from "../hooks/useSpeechRecognition"; // NEW

const StarCanvas = () => (
  <div className="absolute inset-0 z-0">
    <Canvas>
      <Stars
        radius={100}
        depth={50}
        count={5000}
        factor={4}
        saturation={0.9}
        fade
        speed={1}
      />
    </Canvas>
  </div>
);

const DashboardPage = () => {
  const [isCatalogueOpen, setCatalogueOpen] = useState(false);
  const [isDebugOpen, setDebugOpen] = useState(false);
  const [chatDebugData, setChatDebugData] = useState([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const [isAnimating, setIsAnimating] = useState(false);

  // Enhanced Avatar States
  const [enablePersonalization, setEnablePersonalization] = useState(true);
  const [emotionData, setEmotionData] = useState(null);
  const { isAvatarSpeaking } = useConversationManager();

  // Refs for component communication
  const webcamRef = useRef(null);
  const { user } = useAuth(); // Get current user for personalization

  // Unified conversation management
  const {
    isReady: isConversationReady,
    conversationHistory,
    sendUserMessage,
    startNarration,
    updateEmotionContext,
  } = useConversationManager(user);

  useEffect(() => {
    if (isConversationReady) {
      sendUserMessage({
        type: "event",
        eventType: "greeting",
        message: "User has started a new session.",
      });
    }

    return () => {
      if (isConversationReady) {
        sendUserMessage({
          type: "event",
          eventType: "farewell",
          message: "User has ended the session.",
        });
      }
    };
  }, [isConversationReady, sendUserMessage]);

  const handleUserMessage = async (message) => {
    if (!isConversationReady) return;

    // Here, we'll use the conversation manager to handle the message
    await sendUserMessage({ type: "text", message, eventType: "interaction" });
  };

  const handleChatDebugUpdate = (debugEntry) => {
    setChatDebugData((prev) => {
      const existingIndex = prev.findIndex(
        (entry) =>
          entry.timestamp === debugEntry.timestamp &&
          entry.userMessage === debugEntry.userMessage
      );
      if (existingIndex !== -1) {
        const newData = [...prev];
        newData[existingIndex] = debugEntry;
        return newData;
      } else {
        const newData = [...prev, debugEntry];
        return newData.slice(-50);
      }
    });
  };

  // Handle emotion detection from webcam with unified conversation management
  const handleEmotionDetected = useCallback(
    (emotionData) => {
      // Update conversation manager's emotion context
      updateEmotionContext(emotionData);

      // Update local state for UI display with throttling
      setEmotionData((prevData) => {
        // Simple throttling: don't update if emotion is the same and confidence hasn't changed much
        if (
          prevData?.emotionalState?.emotion ===
            emotionData?.emotionalState?.emotion &&
          Math.abs(
            (prevData?.confidence || 0) - (emotionData?.confidence || 0)
          ) < 0.1
        ) {
          return prevData;
        }
        return emotionData;
      });

      console.log("🎭 Emotion detected and context updated:", emotionData);

      // Add to debug data if debug panel is open
      if (isDebugOpen && emotionData?.emotionalState?.emotion) {
        setChatDebugData((prev) =>
          [
            ...prev,
            {
              timestamp: new Date().toISOString(),
              type: "emotion_detection",
              userMessage: `[EMOTION] ${emotionData.emotionalState.emotion}`,
              aiResponse: emotionData.visualDescription || "Face detected",
              debug: {
                confidence: emotionData.confidence || 0,
                faceDetected: emotionData.faceDetected || false,
                rawData: emotionData,
                conversationContext: "Updated in conversation manager",
              },
            },
          ].slice(-50)
        );
      }
    },
    [isDebugOpen, updateEmotionContext]
  );

  // Handle avatar responses
  const handleAvatarResponse = (responseData) => {
    console.log("🤖 Avatar response:", responseData);

    // Add to debug data
    setChatDebugData((prev) =>
      [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          type: "avatar_response",
          userMessage: `[AVATAR] ${responseData.trigger}`,
          aiResponse: responseData.response,
          debug: {
            trigger: responseData.trigger,
            visualContext: responseData.visualContext,
            userTraits: responseData.userTraits,
          },
        },
      ].slice(-50)
    );
  };

  // Toggle personalization
  const togglePersonalization = () => {
    setEnablePersonalization((prev) => {
      const newState = !prev;
      setToastMessage(
        newState ? "🧠 Personalization Enabled" : "🧠 Personalization Disabled"
      );
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
      return newState;
    });
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "i") {
        event.preventDefault();
        setDebugOpen((prev) => {
          const newState = !prev;
          setToastMessage(
            newState ? "🐛 Debug Panel Opened" : "🐛 Debug Panel Closed"
          );
          setShowToast(true);
          setTimeout(() => setShowToast(false), 2000);
          return newState;
        });
      }
      if (event.key === "Escape" && isDebugOpen) {
        setDebugOpen(false);
        setToastMessage("🐛 Debug Panel Closed");
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      }
      // Toggle personalization with Ctrl+P
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        togglePersonalization();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDebugOpen]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[radial-gradient(ellipse_at_bottom,_#1b2735_0%,_#090a0f_100%)]">
      <Navbar />
      <StarCanvas />
      <div className="absolute inset-0 z-10 pointer-events-none bg-[radial-gradient(circle_at_20%_40%,_rgba(128,0,128,0.2),_transparent_40%),radial-gradient(circle_at_80%_60%,_rgba(0,139,139,0.2),_transparent_40%)]"></div>

      <DebugPanel
        isOpen={isDebugOpen}
        onClose={() => setDebugOpen(false)}
        chatDebugData={chatDebugData}
      />

      {/* Enhanced Controls Panel */}
      {!isDebugOpen && (
        <div className="fixed bottom-4 right-4 z-30 pointer-events-none">
          <div className="bg-black/80 backdrop-blur-sm text-gray-400 px-3 py-2 rounded-lg text-xs font-mono border border-gray-600/50 shadow-lg">
            <div className="flex flex-col gap-1">
              <div>
                <span className="text-purple-400">Ctrl</span> +{" "}
                <span className="text-purple-400">i</span> = Debug
              </div>
              <div>
                <span className="text-cyan-400">Ctrl</span> +{" "}
                <span className="text-cyan-400">p</span> = Personalization
              </div>
            </div>
          </div>
        </div>
      )}

      {isDebugOpen && (
        <div className="fixed bottom-4 right-4 z-30 pointer-events-none">
          <div className="bg-black/80 backdrop-blur-sm text-gray-400 px-3 py-2 rounded-lg text-xs font-mono border border-purple-500/50 shadow-lg">
            <div className="flex flex-col gap-1">
              <div>
                <span className="text-purple-400">Ctrl</span> +{" "}
                <span className="text-purple-400">i</span> = Toggle
              </div>
              <div>
                <span className="text-purple-400">Esc</span> = Close
              </div>
              <div>
                <span className="text-cyan-400">Ctrl</span> +{" "}
                <span className="text-cyan-400">p</span> = Personalization
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Indicators */}
      <div className="absolute top-22 left-[50px] z-30 space-y-2">
        {/* Personalization Status */}
        <button
          onClick={togglePersonalization}
          className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold transition-all pointer-events-auto shadow-lg backdrop-blur-sm ${
            enablePersonalization
              ? "bg-blue-700/90 text-white border border-blue-300"
              : "bg-gray-700/90 text-gray-100 border border-gray-400"
          }`}
        >
          <Brain className="w-3 h-3" />
          <span>
            {enablePersonalization
              ? "Personalization ON"
              : "Personalization OFF"}
          </span>
        </button>

        {/* Emotion Detection Status */}
        {emotionData?.faceDetected && emotionData?.emotionalState?.emotion && (
          <div className="flex items-center gap-2 px-3 py-1 bg-green-700/90 text-white text-xs font-semibold border border-green-300 rounded-full shadow-lg backdrop-blur-sm">
            <Eye className="w-3 h-3" />
            <span>Emotion: {emotionData.emotionalState.emotion}</span>
            <span className="text-green-200">
              ({Math.round((emotionData.confidence || 0) * 100)}%)
            </span>
          </div>
        )}
      </div>

      {showToast && (
        <div className="fixed top-20 right-4 z-50 transition-all duration-300 ease-in-out animate-pulse">
          <div className="bg-gradient-to-r from-purple-900/90 to-black/90 backdrop-blur-sm text-white px-4 py-3 rounded-lg border border-purple-500/50 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">{toastMessage}</span>
            </div>
          </div>
        </div>
      )}

      <aside className="fixed top-1/2 left-0 z-40 -translate-y-1/2 h-21 w-22 rounded-r-[10px] flex-col items-center justify-center bg-black/20 backdrop-blur-sm border-r border-white/10">
        <button
          onClick={() => setCatalogueOpen(true)}
          className="group flex flex-col items-center gap-2 p-4 rounded-lg text-gray-400 hover:text-cyan-400 hover:bg-white/5 transition-all duration-300"
          aria-label="Open Lesson Catalogue"
        >
          <BookOpen size={28} />
          <span className="text-xs font-semibold tracking-wider uppercase  transition-opacity">
            Lessons
          </span>
        </button>
      </aside>

      <button
        onClick={() => setCatalogueOpen(true)}
        className="lg:hidden fixed bottom-6 left-6 z-40 p-4 bg-cyan-600/80 backdrop-blur-sm text-white rounded-full shadow-lg hover:bg-cyan-500 transition-colors border border-cyan-400/50"
        aria-label="Open Lesson Catalogue"
      >
        <BookOpen size={24} />
      </button>

      <main className="relative z-20 h-full w-full p-4 pt-20 lg:p-6 lg:pt-20 lg:pl-24">
        <div className="w-full h-full grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 grid-rows-[minmax(200px,0.5fr)_minmax(200px,0.5fr)_1fr] lg:grid-rows-2">
          {/* Enhanced AI Avatar */}
          <div className="lg:col-span-2 lg:row-span-2 rounded-xl overflow-hidden">
            <AIAvatar
              webcamRef={webcamRef}
              userInfo={user}
              onAvatarResponse={handleAvatarResponse}
              enablePersonalization={enablePersonalization}
              mode="dashboard"
              className="w-full h-full"
            />
          </div>

          {/* Enhanced Webcam Feed with Emotion Detection */}
          <div className="lg:col-start-3 lg:row-start-1 rounded-xl overflow-hidden">
            <CameraFeed
              ref={webcamRef}
              onEmotionDetected={handleEmotionDetected}
              enableEmotionDetection={enablePersonalization}
            />
          </div>

          {/* AI Chat */}
          <div className="lg:col-start-3 lg:row-start-2 rounded-xl overflow-hidden">
            <AIChat
              onDebugDataUpdate={handleChatDebugUpdate}
              onAiSpeakingChange={setIsAnimating}
              emotionContext={emotionData}
              enableEnhancedChat={enablePersonalization}
            />
          </div>
        </div>
      </main>

      <LessonCatalogueModal
        isOpen={isCatalogueOpen}
        onClose={() => setCatalogueOpen(false)}
      />
    </div>
  );
};

export default DashboardPage;
