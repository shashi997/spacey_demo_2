// src/pages/HomePage.jsx

import React from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { useNavigate } from 'react-router-dom';
import { Rocket } from 'lucide-react';
import Navbar from '../components/ui/Navbar';
import { useAuth } from '../hooks/useAuth';
import Avatar from '../components/ui/Avatar';

const HomePage = () => {
  const navigate = useNavigate();
  const { currentUser, loading } = useAuth();

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[radial-gradient(ellipse_at_bottom,_#1b2735_0%,_#090a0f_100%)]">
      <Navbar />
      
      {/* Background decorative gradient */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_20%_40%,_rgba(128,0,128,0.2),_transparent_40%),radial-gradient(circle_at_80%_60%,_rgba(0,139,139,0.2),_transparent_40%)]"></div>

      {/* Main content container with side-by-side layout for medium screens and up */}
      <main className="relative z-10 flex flex-col md:flex-row items-center justify-center w-full h-full px-6 md:px-12 lg:px-20">
        
        {/* Left side: Text content */}
        <div className="md:w-1/2 lg:w-2/5 text-center md:text-left animate-[fadeIn_2.5s_ease-in-out]">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            🚀 <span className='text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400'>Welcome to AI Space Learning!</span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-300 max-w-md mx-auto md:mx-0 mt-6">
            Start your mission, explore fascinating lessons, and unlock the secrets of the universe!
          </p>

          <div className="mt-10">
            {!loading && currentUser && (
              <button
                onClick={() => navigate('/dashboard')}
                className="inline-flex cursor-pointer items-center gap-3 px-8 py-3 font-semibold text-lg text-black bg-white rounded-full hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black animate-[fadeIn_1s_ease-in-out_1s_forwards] opacity-0"
              >
                <Rocket size={22} />
                <span>Go to Dashboard</span>
              </button>
            )}
          </div>
        </div>

        {/* Right side: 3D Avatar Canvas */}
        <div className="w-full md:w-1/2 lg:w-3/5 h-1/2 md:h-full">
          <Canvas camera={{ position: [0, 2, 5], fov: 55 }}>
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1.5} />
            <pointLight position={[-10, -10, -10]} intensity={1} />
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0.9} fade speed={1} />
            <Avatar />
          </Canvas>
        </div>

      </main>
    </div>
  );
};

export default HomePage;
