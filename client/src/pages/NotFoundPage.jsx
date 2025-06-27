import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SignalZero, Home } from 'lucide-react';
import Navbar from '../components/ui/Navbar';

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#090a0f] text-white">
      {/* The Navbar provides the consistent "Spacey" logo and home link */}
      <Navbar />

      <div className="relative z-20 flex flex-col items-center justify-center h-full text-center px-4">
        {/* Main content container with a subtle fade-in animation */}
        <div className="max-w-lg animate-[fadeIn_1.5s_ease-in-out]">
          
          {/* Icon representing the lost signal */}
          <SignalZero className="mx-auto mb-6 text-red-500" size={80} strokeWidth={1.5} />

          <h1 className="text-6xl md:text-8xl font-bold text-gray-400/80 mb-2">404</h1>
          
          <h2 className="text-2xl md:text-4xl font-semibold text-white mb-4">
            Transmission Interrupted
          </h2>
          
          <p className="text-lg text-gray-400 mb-8">
            Our satellite couldn't find this page. It might be out of range or lost in a cosmic anomaly.
          </p>

          {/* Prominent "Go Home" button */}
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-6 py-3 font-semibold text-black bg-white rounded-full hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
          >
            <Home size={20} />
            <span>Return to Home Base</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
