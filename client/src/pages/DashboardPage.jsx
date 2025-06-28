// src/pages/DashboardPage.jsx

import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { BookOpen } from 'lucide-react';

// Import the Navbar
import Navbar from '../components/ui/Navbar';
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

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[radial-gradient(ellipse_at_bottom,_#1b2735_0%,_#090a0f_100%)]">
      {/* Add the Navbar here for consistent navigation */}
      <Navbar />
      
      <StarCanvas />
      {/* Subtle nebula effect for consistency */}
      <div className="absolute inset-0 z-10 pointer-events-none bg-[radial-gradient(circle_at_20%_40%,_rgba(128,0,128,0.2),_transparent_40%),radial-gradient(circle_at_80%_60%,_rgba(0,139,139,0.2),_transparent_40%)]"></div>

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
      
      {/* --- Floating Action Button for Mobile/Tablet (Position Updated) --- */}
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
            <AIChat />
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
