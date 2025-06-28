// src/components/dashboard/Lesson_Cards.jsx

import React from 'react';
import { Link } from 'react-router-dom';
import { Rocket } from 'lucide-react';

const LessonCard = ({ id, title, image }) => {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 
                   bg-black/50 transition-all duration-300 ease-in-out hover:border-cyan-400/50">
      
      {/* Background Image */}
      <img 
        src={image} 
        alt={title} 
        className="w-full h-48 object-cover transition-transform duration-300 ease-in-out group-hover:scale-105" 
      />
      
      {/* Gradient Overlay for Text Readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
      
      {/* Content: Title and Launch Button */}
      <div className="absolute bottom-0 left-0 p-4 w-full flex items-end justify-between">
        <h3 className="text-lg font-bold text-white max-w-[70%]">{title}</h3>
        
        <Link
          to={`/lesson/${id}`}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-black bg-white rounded-full 
                     transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 
                     transition-all duration-300 ease-in-out hover:bg-gray-200 focus:outline-none focus:ring-2 
                     focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
          aria-label={`Launch lesson: ${title}`}
        >
          <Rocket size={16} />
          <span>Launch</span>
        </Link>
      </div>
    </div>
  );
};

export default LessonCard;
