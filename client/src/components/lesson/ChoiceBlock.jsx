// src/components/lesson/ChoiceBlock.jsx

import React from 'react';
import { ChevronRight } from 'lucide-react';

const ChoiceBlock = ({ block, onChoice }) => {
  return (
    <div className="animate-fade-in space-y-6">
      <p className="text-lg text-gray-300 leading-relaxed">{block.content}</p>
      <div className="space-y-3">
        {block.choices.map((choice, index) => (
          <button
            key={index}
            onClick={() => onChoice(choice)} // Pass the entire choice object
            className="w-full text-left flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 border border-transparent hover:border-cyan-500/50 transition-all duration-200 group"
          >
            <span className="text-white">{choice.text}</span>
            <ChevronRight size={20} className="text-gray-500 group-hover:text-cyan-400 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default ChoiceBlock;
