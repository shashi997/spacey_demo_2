import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { ArrowLeft, Construction } from 'lucide-react';
import Navbar from '../components/ui/Navbar';

// A self-contained component for the 3D star background for consistency
const StarCanvas = () => (
  <div className="absolute inset-0 z-0">
    <Canvas>
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0.9} fade speed={1} />
    </Canvas>
  </div>
);

const LessonPage = () => {
  // Get the dynamic lessonId from the URL (e.g., 'build-satellite')
  const { lessonId } = useParams();

  // A simple helper to format the ID into a readable title
  const formatTitle = (id) => {
    if (!id) return 'Lesson';
    return id
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const lessonTitle = formatTitle(lessonId);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[radial-gradient(ellipse_at_bottom,_#1b2735_0%,_#090a0f_100%)]">
      <Navbar />
      <StarCanvas />
      <div className="absolute inset-0 z-10 pointer-events-none bg-[radial-gradient(circle_at_20%_40%,_rgba(128,0,128,0.2),_transparent_40%),radial-gradient(circle_at_80%_60%,_rgba(0,139,139,0.2),_transparent_40%)]"></div>

      <main className="relative z-20 flex flex-col items-center justify-center h-full text-center px-4">
        <div className="w-full max-w-4xl p-8 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 animate-[fadeIn_1s_ease-in-out]">
          
          {/* Dynamic Title */}
          <h1 className="text-3xl md:text-5xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
            {lessonTitle}
          </h1>

          {/* Placeholder Content */}
          <p className="text-lg md:text-xl text-gray-300 my-8">
            Mission content for this lesson is currently being prepared. Check back soon!
          </p>
          <div className="w-full max-w-lg h-48 mx-auto border-2 border-dashed border-cyan-400/50 rounded-lg flex flex-col items-center justify-center gap-4 text-cyan-400/80">
            <Construction size={48} />
            <p className="font-mono">[ Lesson Content Area ]</p>
          </div>

          {/* Back to Dashboard Button */}
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-3 px-6 py-3 mt-10 font-semibold text-white bg-cyan-600/80 rounded-full hover:bg-cyan-500 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
          >
            <ArrowLeft size={20} />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default LessonPage;
