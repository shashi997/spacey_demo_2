// src/pages/LoginPage.jsx

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import Navbar from '../components/ui/Navbar';
import { auth } from '../firebaseConfig';
import { signInWithEmailAndPassword } from 'firebase/auth';

const StarCanvas = () => (
  <div className="absolute inset-0 z-0">
    <Canvas><Stars radius={100} depth={50} count={5000} factor={4} saturation={0.9} fade speed={1} /></Canvas>
  </div>
);

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      return setError("Please enter your email and password.");
    }
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/dashboard');
    } catch (err) {
      // Provide a generic error for security
      setError("Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[radial-gradient(ellipse_at_bottom,_#1b2735_0%,_#090a0f_100%)]">
      <Navbar />
      <StarCanvas />
      <div className="absolute inset-0 z-10 pointer-events-none bg-[radial-gradient(circle_at_20%_40%,_rgba(128,0,128,0.2),_transparent_40%),radial-gradient(circle_at_80%_60%,_rgba(0,139,139,0.2),_transparent_40%)]"></div>
      
      <main className="relative z-20 flex items-center justify-center h-full px-4">
        <div className="w-full max-w-md p-8 space-y-6 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 animate-[fadeIn_1s_ease-in-out]">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white">Welcome Back!</h1>
            <p className="text-gray-400 mt-2">Log in to continue your space mission.</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="email" 
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
              />
            </div>
            
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="password" 
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
              />
            </div>
            
            {error && <p className="flex items-center gap-2 text-sm text-red-400"><AlertCircle size={16} />{error}</p>}

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-3 font-semibold text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors disabled:bg-cyan-800 disabled:cursor-not-allowed"
            >
              {loading ? 'Logging In...' : 'Continue'}
            </button>
          </form>
          
          <p className="text-sm text-center text-gray-400">
            Don't have an account?{' '}
            <Link to="/signup" className="font-medium text-cyan-400 hover:underline">
              Sign Up
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
