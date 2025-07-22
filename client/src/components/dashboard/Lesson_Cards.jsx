// src/components/dashboard/Lesson_Cards.jsx

import React from 'react';
import { Link } from 'react-router-dom';
import { Rocket, Lock, CheckCircle, Clock, Star } from 'lucide-react';

const LessonCard = ({ 
  id, 
  title, 
  image, 
  description, 
  difficulty, 
  estimatedTime, 
  isLocked = false, 
  isCompleted = false, 
  hasAccess = true, 
  accessReason 
}) => {
  const getDifficultyColor = () => {
    switch (difficulty) {
      case 'Beginner': return 'text-green-400';
      case 'Intermediate': return 'text-yellow-400';
      case 'Advanced': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getDifficultyIcon = () => {
    switch (difficulty) {
      case 'Beginner': return <Star size={12} />;
      case 'Intermediate': return (
        <div className="flex">
          <Star size={12} />
          <Star size={12} />
        </div>
      );
      case 'Advanced': return (
        <div className="flex">
          <Star size={12} />
          <Star size={12} />
          <Star size={12} />
        </div>
      );
      default: return null;
    }
  };

  return (
    <div className={`group relative overflow-hidden rounded-xl border transition-all duration-300 ease-in-out ${
      isLocked 
        ? 'border-gray-600/50 bg-black/30 opacity-75' 
        : isCompleted 
          ? 'border-green-400/50 bg-black/50 hover:border-green-400/70'
          : 'border-white/10 bg-black/50 hover:border-cyan-400/50'
    }`}>
      
      {/* Background Image */}
      <img 
        src={image} 
        alt={title} 
        className={`w-full h-48 object-cover transition-transform duration-300 ease-in-out ${
          isLocked ? 'grayscale' : 'group-hover:scale-105'
        }`}
      />
      
      {/* Gradient Overlay for Text Readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
      
      {/* Status Icons */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        {isCompleted && (
          <div className="p-1 rounded-full bg-green-500/80">
            <CheckCircle size={16} className="text-white" />
          </div>
        )}
        {isLocked && (
          <div className="p-1 rounded-full bg-gray-600/80">
            <Lock size={16} className="text-white" />
          </div>
        )}
      </div>

      {/* Lesson Info */}
      <div className="absolute top-3 left-3 space-y-1">
        {difficulty && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 text-xs font-semibold ${getDifficultyColor()}`}>
            {getDifficultyIcon()}
            <span>{difficulty}</span>
          </div>
        )}
        {estimatedTime && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 text-xs text-gray-300">
            <Clock size={12} />
            <span>{estimatedTime}</span>
          </div>
        )}
      </div>
      
      {/* Content: Title, Description and Action Button */}
      <div className="absolute bottom-0 left-0 p-4 w-full">
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          {description && (
            <p className="text-sm text-gray-300 line-clamp-2">{description}</p>
          )}
          
          <div className="flex items-center justify-between pt-2">
            {isLocked && accessReason && (
              <p className="text-xs text-yellow-300 italic">{accessReason}</p>
            )}
            
            {hasAccess ? (
              <Link
                to={`/lesson/${id}`}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-full 
                           transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 
                           transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 
                           focus:ring-offset-2 focus:ring-offset-black ${
                  isCompleted 
                    ? 'text-black bg-green-400 hover:bg-green-300 focus:ring-green-400' 
                    : 'text-black bg-white hover:bg-gray-200 focus:ring-white'
                }`}
                aria-label={`Launch lesson: ${title}`}
              >
                <Rocket size={16} />
                <span>{isCompleted ? 'Replay' : 'Launch'}</span>
              </Link>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-400 bg-gray-600/50 rounded-full cursor-not-allowed">
                <Lock size={16} />
                <span>Locked</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LessonCard;
