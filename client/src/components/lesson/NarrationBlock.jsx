import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Volume2, SkipForward, Loader2 } from 'lucide-react';
import { useSpeechCoordination } from '../../hooks/useSpeechCoordination.jsx';
import { useConversationManager } from '../../hooks/useConversationManager.jsx';

const NarrationBlock = ({ block, userTags, onNavigate, getDynamicText }) => {
  const { setContextState, trackActivity, globalSpeechState } = useSpeechCoordination();
  const { startNarration } = useConversationManager();
  const [speechComplete, setSpeechComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Check if avatar is speaking
  const isSpeaking = globalSpeechState.isAnySpeaking && globalSpeechState.activeSource === 'avatar';

  // Combine all text content into a single string for the speech synthesizer
  const textToSpeak = [
    block.content,
    block.dynamic_outcome ? getDynamicText(block.dynamic_outcome) : ''
  ].filter(Boolean).join(' . '); // Join with a period for a natural pause

  useEffect(() => {
    // Set lesson context and track activity
    setContextState('isInLesson', true);
    trackActivity();
    setIsLoading(true);
    
    // Small delay to ensure smooth transition
    const startDelay = setTimeout(() => {
      setIsLoading(false);
      // Use conversation manager to speak through avatar
      startNarration(textToSpeak, {
        onEnd: () => {
          setSpeechComplete(true);
          setContextState('isInLesson', false);
        }
      });
    }, 500);

    return () => {
      clearTimeout(startDelay);
      setContextState('isInLesson', false);
    };
  }, [block.block_id, textToSpeak, startNarration, setContextState, trackActivity]);

  const handleManualContinue = () => {
    trackActivity();
    setContextState('isInLesson', false);
    if (block.next_block) {
      onNavigate(block.next_block);
    }
  };

  return (
    <div className="text-center animate-[fadeIn_0.5s_ease-in-out]">
      {isLoading &&(
        <div className="flex justify-center items-center gap-2 text-cyan-400 mb-4">
          <Loader2 className="animate-spin" />
          <span>Preparing voice...</span>
        </div>
      )}
      {isSpeaking && (
        <div className="flex justify-center items-center gap-2 text-cyan-400 mb-4 animate-pulse">
          <Volume2 className="animate-pulse" />
          <span>Speaking...</span>
        </div>
      )}

      <p className="text-lg md:text-xl text-gray-300 my-8">{block.content}</p>
      
      {block.dynamic_outcome && (
        <p className="text-lg md:text-xl text-cyan-300 my-8 font-semibold">
          {getDynamicText(block.dynamic_outcome)}
        </p>
      )}

      {block.dynamic_traits && (
        <div className="my-8 p-4 border border-white/20 rounded-lg bg-black/20">
          <h3 className="font-bold text-cyan-400 mb-3">Personality Traits Exhibited:</h3>
          <ul className="list-disc list-inside text-gray-300">
            {userTags.map(tag => <li key={tag} className="capitalize">{tag}</li>)}
          </ul>
        </div>
      )}

      {block.educational_takeaways && (
        <div className="my-8 p-4 text-left border border-white/20 rounded-lg bg-black/20">
          <h3 className="font-bold text-cyan-400 mb-3">Educational Takeaways:</h3>
          <ul className="list-disc list-inside text-gray-300">
            {block.educational_takeaways.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      )}

      {block.next_block ? (
        <button
          onClick={handleManualContinue}
          className="inline-flex items-center gap-3 px-6 py-3 mt-10 font-semibold text-white bg-cyan-600/80 rounded-full hover:bg-cyan-500 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
        >
          Continue
          {isSpeaking && <SkipForward />} {/* Show skip icon while speaking */}
        </button>
      ) : (
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-3 px-6 py-3 mt-10 font-semibold text-white bg-purple-600/80 rounded-full hover:bg-purple-500 transition-colors"
        >
          Mission Complete! Return to Dashboard
        </Link>
      )}
      
    </div>
  );
};

export default NarrationBlock;
