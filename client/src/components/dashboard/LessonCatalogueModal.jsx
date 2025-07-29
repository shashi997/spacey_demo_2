// src/components/dashboard/LessonCatalogueModal.jsx

import React, { useRef, useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { X, Loader, RefreshCw } from 'lucide-react';
import LessonCard from './Lesson_Cards';
import { getAllLessonsWithAccess } from '../../utils/lessonProgression';
import { useAuth } from '../../hooks/useAuth';

// Import your lesson images
import satelliteImg from '../../assets/satellite.jpg';
import spaghettificationImg from '../../assets/boliviainteligente-MO6wb4hdhZo-unsplash.jpg';
import space_explorationImg from '../../assets/space.jpg';
import MarsRoverImg from '../../assets/mars-67522_640.jpg';
import ZeroGravityImg from '../../assets/zerogravity.jpg';

// Image mapping for lessons
const lessonImages = {
  'mars_energy': MarsRoverImg,
  'build-satellite': satelliteImg,
  'spaghettification': spaghettificationImg,
  'space-exploration-news': space_explorationImg,
  'zero-gravity': ZeroGravityImg,
};

const LessonCatalogueModal = ({ isOpen, onClose }) => {
  const modalRef = useRef(null);
  const panelRef = useRef(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();

  // Load lessons with access status when modal opens
  useEffect(() => {
    if (isOpen && currentUser) {
      loadLessonsWithAccess();
    }
  }, [isOpen, currentUser]);

  // Refresh lessons when modal becomes visible (to catch completed lessons)
  useEffect(() => {
    if (isOpen && currentUser && !loading) {
      const refreshTimer = setTimeout(() => {
        loadLessonsWithAccess();
      }, 500); // Small delay to ensure any in-progress saves are complete
      
      return () => clearTimeout(refreshTimer);
    }
  }, [isOpen]);

  const loadLessonsWithAccess = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    try {
      const lessonsWithAccess = await getAllLessonsWithAccess(currentUser.uid);
      const lessonsWithImages = lessonsWithAccess.map(lesson => ({
        ...lesson,
        image: lessonImages[lesson.id] || MarsRoverImg // fallback image
      }));
      setLessons(lessonsWithImages);
    } catch (error) {
      console.error('Error loading lessons:', error);
    } finally {
      setLoading(false);
    }
  };

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

  // Refresh lesson access when window regains focus (user returns from lesson)
  useEffect(() => {
    const handleFocus = () => {
      if (isOpen && currentUser && !loading) {
        loadLessonsWithAccess();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isOpen, currentUser, loading]);

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
          <div className="flex items-center gap-2">
            <button
              onClick={loadLessonsWithAccess}
              disabled={loading}
              className="p-2 rounded-full text-gray-400 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
              aria-label="Refresh lessons"
              title="Refresh lesson status"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
              aria-label="Close lesson catalogue"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Lesson List - now uses the redesigned card with progression */}
        <div className="flex-grow p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Loader size={32} className="animate-spin mb-4" />
              <p>Loading missions...</p>
            </div>
          ) : lessons.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <p>No missions available</p>
            </div>
          ) : (
            lessons.map((lesson) => (
              <LessonCard
                key={lesson.id}
                id={lesson.id}
                title={lesson.title}
                image={lesson.image}
                description={lesson.description}
                difficulty={lesson.difficulty}
                estimatedTime={lesson.estimatedTime}
                isLocked={lesson.isLocked}
                isCompleted={lesson.isCompleted}
                hasAccess={lesson.hasAccess}
                accessReason={lesson.accessReason}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default LessonCatalogueModal;
