// src/components/dashboard/LessonCatalogueModal.jsx

import React, { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { X } from 'lucide-react';
import LessonCard from './Lesson_Cards';

// Import your lesson images
import satelliteImg from '../../assets/chirag-malik-FHGkbIJYVbg-unsplash.jpg';
import spaghettificationImg from '../../assets/boliviainteligente-MO6wb4hdhZo-unsplash.jpg';
import space_explorationImg from '../../assets/brian-mcgowan-I0fDR8xtApA-unsplash.jpg';
import MarsRoverImg from '../../assets/mars-67522_640.jpg';
import ZeroGravityImg from '../../assets/ai-generated-8143656_640.jpg';

// Your new lesson data structure
const lessons = [
    { id: 'build-satellite', title: 'Build Your Own Satellite', image: satelliteImg },
    { id: 'spaghettification', title: 'Spaghettification', image: spaghettificationImg },
    { id: 'space-exploration-news', title: `What's new in Space Exploration`, image: space_explorationImg },
    { id: 'mars-rover-mission', title: 'Mars Rover Mission', image: MarsRoverImg },
    { id: 'zero-gravity', title: 'Zero Gravity', image: ZeroGravityImg },
];

const LessonCatalogueModal = ({ isOpen, onClose }) => {
  const modalRef = useRef(null);
  const panelRef = useRef(null);

  // GSAP animation for the modal
  useEffect(() => {
    const body = document.body;
    if (isOpen) {
      body.style.overflow = 'hidden';
      gsap.to(modalRef.current, { autoAlpha: 1, duration: 0.3 });
      gsap.to(panelRef.current, { x: 0, duration: 0.4, ease: 'power3.out' });
    } else {
      body.style.overflow = 'auto';
      gsap.to(panelRef.current, { x: '-100%', duration: 0.4, ease: 'power3.in' });
      gsap.to(modalRef.current, { autoAlpha: 0, duration: 0.3, delay: 0.1 });
    }
    return () => {
      body.style.overflow = 'auto';
    };
  }, [isOpen]);

  // Handle closing with the Escape key
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 bg-black/60 invisible"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={panelRef}
        className="fixed top-0 left-0 h-full w-full max-w-md transform -translate-x-full 
                   bg-black/50 backdrop-blur-lg border-r border-white/10 
                   flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-2xl font-bold text-white">Lesson Catalogue</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Close lesson catalogue"
          >
            <X size={24} />
          </button>
        </div>

        {/* Lesson List - now uses the redesigned card */}
        <div className="flex-grow p-6 overflow-y-auto space-y-6">
          {lessons.map((lesson) => (
            <LessonCard
              key={lesson.id}
              id={lesson.id}
              title={lesson.title}
              image={lesson.image}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default LessonCatalogueModal;
