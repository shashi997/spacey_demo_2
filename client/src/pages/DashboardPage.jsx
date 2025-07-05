// src/pages/DashboardPage.jsx

import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { BookOpen } from 'lucide-react';

// Import the Navbar and Debug Panel
import Navbar from '../components/ui/Navbar';
import DebugPanel from '../components/debug/DebugPanel';
// Import all the dashboard components
import AI_Avatar from '../components/dashboard/AI_Avatar';
import WebcamFeed from '../components/dashboard/Webcam_Feed';
import AIChat from '../components/dashboard/AI_Chat';
import LessonCatalogueModal from '../components/dashboard/LessonCatalogueModal';

// A self-contained component for the 3D star background
const StarCanvas = () => (
  <div className="absolute inset-0 z-0">
    <Canvas>
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0.9} fade speed={1} />
    </Canvas>
  </div>
);

const DashboardPage = () => {
  const [isCatalogueOpen, setCatalogueOpen] = useState(false);
  const [isDebugOpen, setDebugOpen] = useState(false);
  const [chatDebugData, setChatDebugData] = useState([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const handleChatDebugUpdate = (debugEntry) => {
    setChatDebugData(prev => {
      // Update existing entry or add new one
      const existingIndex = prev.findIndex(entry => 
        entry.timestamp === debugEntry.timestamp && 
        entry.userMessage === debugEntry.userMessage
      );
      
      if (existingIndex !== -1) {
        // Update existing entry
        const newData = [...prev];
        newData[existingIndex] = debugEntry;
        return newData;
      } else {
        // Add new entry (keep only last 50 entries)
        const newData = [...prev, debugEntry];
        return newData.slice(-50);
      }
    });
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Check for Ctrl+i (or Cmd+i on Mac)
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'i') {
        event.preventDefault();
        setDebugOpen(prev => {
          const newState = !prev;
          // Show toast notification
          if (newState) {
            setToastMessage('🐛 Debug Panel Opened');
          } else {
            setToastMessage('🐛 Debug Panel Closed');
          }
          setShowToast(true);
          
          // Hide toast after 2 seconds
          setTimeout(() => {
            setShowToast(false);
          }, 2000);
          
          return newState;
        });
      }
      
      // ESC key closes debug panel
      if (event.key === 'Escape' && isDebugOpen) {
        setDebugOpen(false);
        setToastMessage('🐛 Debug Panel Closed');
        setShowToast(true);
        setTimeout(() => {
          setShowToast(false);
        }, 2000);
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDebugOpen]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[radial-gradient(ellipse_at_bottom,_#1b2735_0%,_#090a0f_100%)]">
      {/* Add the Navbar here for consistent navigation */}
      <Navbar />
      
      <StarCanvas />
      {/* Subtle nebula effect for consistency */}
      <div className="absolute inset-0 z-10 pointer-events-none bg-[radial-gradient(circle_at_20%_40%,_rgba(128,0,128,0.2),_transparent_40%),radial-gradient(circle_at_80%_60%,_rgba(0,139,139,0.2),_transparent_40%)]"></div>

      {/* Debug Panel */}
      <DebugPanel 
        isOpen={isDebugOpen}
        onClose={() => setDebugOpen(false)}
        chatDebugData={chatDebugData}
      />

      {/* Debug Shortcut Indicator */}
      {!isDebugOpen && (
        <div className="fixed bottom-4 right-4 z-30 pointer-events-none">
          <div className="bg-black/80 backdrop-blur-sm text-gray-400 px-3 py-2 rounded-lg text-xs font-mono border border-gray-600/50 shadow-lg">
            <div className="flex flex-col gap-1">
              <div><span className="text-purple-400">Ctrl</span> + <span className="text-purple-400">i</span> = Debug</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Debug Panel Controls Indicator */}
      {isDebugOpen && (
        <div className="fixed bottom-4 right-4 z-30 pointer-events-none">
          <div className="bg-black/80 backdrop-blur-sm text-gray-400 px-3 py-2 rounded-lg text-xs font-mono border border-purple-500/50 shadow-lg">
            <div className="flex flex-col gap-1">
              <div><span className="text-purple-400">Ctrl</span> + <span className="text-purple-400">i</span> = Toggle</div>
              <div><span className="text-purple-400">Esc</span> = Close</div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
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

      {/* The redundant "Spacey" Link component has been removed from here */}

      {/* --- Left Sidebar for Desktop --- */}
      <aside className="hidden lg:flex fixed top-0 left-0 z-40 h-full w-20 flex-col items-center justify-center bg-black/20 backdrop-blur-sm border-r border-white/10">
        <button
          onClick={() => setCatalogueOpen(true)}
          className="group flex flex-col items-center gap-2 p-4 rounded-lg text-gray-400 hover:text-cyan-400 hover:bg-white/5 transition-all duration-300"
          aria-label="Open Lesson Catalogue"
        >
          <BookOpen size={28} />
          <span className="text-xs font-semibold tracking-wider uppercase opacity-0 group-hover:opacity-100 transition-opacity">
            Lessons
          </span>
        </button>
      </aside>
      
      {/* --- Floating Action Button for Mobile/Tablet --- */}
      <button
        onClick={() => setCatalogueOpen(true)}
        className="lg:hidden fixed bottom-6 left-6 z-40 p-4 bg-cyan-600/80 backdrop-blur-sm text-white rounded-full shadow-lg hover:bg-cyan-500 transition-colors border border-cyan-400/50"
        aria-label="Open Lesson Catalogue"
      >
        <BookOpen size={24} />
      </button>

      {/* --- Main Content Grid (Padding Updated) --- */}
      {/* The pt-20 class ensures the grid content starts below the fixed Navbar */}
      <main className="relative z-20 h-full w-full p-4 pt-20 lg:p-6 lg:pt-20 lg:pl-24">
        <div className="w-full h-full grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 
                        grid-rows-[minmax(200px,0.5fr)_minmax(200px,0.5fr)_1fr] lg:grid-rows-2">
          
          {/* AI Avatar: Spans 2 columns and 2 rows on large screens */}
          <div className="lg:col-span-2 lg:row-span-2 rounded-xl overflow-hidden">
            <AI_Avatar />
          </div>

          {/* Webcam Feed: Sits in the top-right corner on large screens */}
          <div className="lg:col-start-3 lg:row-start-1 rounded-xl overflow-hidden">
            <WebcamFeed />
          </div>

          {/* AI Chat: Sits in the bottom-right corner on large screens */}
          <div className="lg:col-start-3 lg:row-start-2 rounded-xl overflow-hidden">
            <AIChat onDebugDataUpdate={handleChatDebugUpdate} />
          </div>

        </div>
      </main>

      {/* The Modal itself, rendered outside the main layout flow */}
      <LessonCatalogueModal 
        isOpen={isCatalogueOpen} 
        onClose={() => setCatalogueOpen(false)} 
      />
    </div>
  );
};

export default DashboardPage;
