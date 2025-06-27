// src/pages/HomePage.jsx

import React from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { useNavigate } from 'react-router-dom';
import { Rocket } from 'lucide-react';
import Navbar from '../components/ui/Navbar';
import { useAuth } from '../hooks/useAuth';
import avatarImage from '../assets/avatar2.png';

// A self-contained component for the 3D star background
const StarCanvas = () => (
  <div className="absolute inset-0 z-0">
    <Canvas>
      {/* Drei's Stars component creates a beautiful, performant starfield */}
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0.9} fade speed={1} />
    </Canvas>
  </div>
);

const HomePage = () => {
  const navigate = useNavigate();
  const { currentUser, loading } = useAuth();

  return (
    // This div correctly sets the page-specific background
    <div className="relative w-full h-screen overflow-hidden bg-[radial-gradient(ellipse_at_bottom,_#1b2735_0%,_#090a0f_100%)]">
      <Navbar />
      <StarCanvas />
      
      {/* This div creates the subtle colored nebula effect */}
      <div className="absolute inset-0 z-10 pointer-events-none bg-[radial-gradient(circle_at_20%_40%,_rgba(128,0,128,0.2),_transparent_40%),radial-gradient(circle_at_80%_60%,_rgba(0,139,139,0.2),_transparent_40%)]"></div>

      {/* Main content, centered and animated */}
      <div className="relative z-20 flex flex-col items-center justify-center h-full text-center px-4">
        <div className="animate-[fadeIn_1.5s_ease-in-out]">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 ">
            🚀 <span className='text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400'>Welcome to AI Space Learning!</span>
          </h1>
          
          <img 
            src={avatarImage}
            alt="AI Avatar" 
            className="w-48 h-48 md:w-52 md:h-52 object-cover rounded-full my-6 mx-auto bg-black/30 backdrop-blur-sm border border-cyan-400/50 animate-glow"
          />
          
          <p className="text-lg md:text-xl text-gray-300 max-w-md mx-auto">
            Start your mission, explore fascinating lessons, and unlock the secrets of the universe!
          </p>

          {/* Conditionally render the dashboard button for logged-in users */}
          <div className="mt-10">
            {!loading && currentUser && (
              <button
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center gap-3 px-8 py-3 font-semibold text-lg text-black bg-white rounded-full hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black animate-[fadeIn_1s_ease-in-out_1s_forwards] opacity-0"
              >
                <Rocket size={22} />
                <span>Go to Dashboard</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
