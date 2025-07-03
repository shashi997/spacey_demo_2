// src/components/lesson/ReflectionBlock.jsx

import React from 'react';
import { Loader } from 'lucide-react';

const ReflectionBlock = ({ block, onNavigate, getDynamicText, backendAiMessage, isAiThinking }) => {
  // Determine which text to show. Prioritize the live backend message.
  // Fallback to the static dynamic text from the JSON if no backend message exists.
  const reflectionText = backendAiMessage || getDynamicText(block.dynamic_content);

  return (
    <div className="animate-fade-in space-y-6">
      <p className="text-lg text-gray-300 leading-relaxed">{block.content}</p>
      
      <div className="my-4 p-4 border-l-4 border-cyan-500 bg-cyan-500/10 rounded-r-lg min-h-[56px] flex items-center">
        {isAiThinking ? (
          <div className="flex items-center gap-3 text-cyan-300/70 w-full">
            <Loader size={18} className="animate-spin" />
            <span>Spacey is analyzing your choice...</span>
          </div>
        ) : (
          <p className="italic text-cyan-200">"{reflectionText}"</p>
        )}
      </div>

      <button onClick={() => onNavigate(block.next_block)} disabled={isAiThinking}>
        {isAiThinking ? 'Analyzing...' : 'Continue'}
      </button>
    </div>
  );
};

export default ReflectionBlock;
