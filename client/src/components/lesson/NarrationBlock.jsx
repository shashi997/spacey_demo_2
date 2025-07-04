import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Volume2 } from 'lucide-react';
import useSpeechSynthesis from '../../hooks/useSpeechSynthesis';

const NarrationBlock = ({ block, userTags, onNavigate, getDynamicText }) => {
  const { speak, cancel, isSpeaking, isSupported } = useSpeechSynthesis();

  // Combine all text content into a single string for the speech synthesizer
  const textToSpeak = [
    block.content,
    block.dynamic_outcome ? getDynamicText(block.dynamic_outcome) : ''
  ].filter(Boolean).join(' . '); // Join with a period for a natural pause

  useEffect(() => {
    // This function will be called by the hook when speech is finished
    const handleSpeechEnd = () => {
      if (block.next_block) {
        onNavigate(block.next_block);
      }
    };

    // If speech is supported, speak the text and provide our callback
    if (isSupported) {
      speak(textToSpeak, { onEnd: handleSpeechEnd });
    }

    // Cleanup: If the component unmounts (e.g., user clicks "Continue" early),
    // cancel any ongoing speech.
    return () => {
      cancel();
    };
  }, [block.block_id, textToSpeak, isSupported, speak, cancel, onNavigate]); // Re-run this effect when the block changes

  const handleManualContinue = () => {
    cancel(); // Stop any current speech immediately
    if (block.next_block) {
      onNavigate(block.next_block);
    }
  };

  return (
    <div className="text-center animate-[fadeIn_0.5s_ease-in-out]">
      {isSpeaking && (
        <div className="flex justify-center items-center gap-2 text-cyan-400 mb-4 animate-pulse">
          <Volume2 />
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
        </button>
      ) : (
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-3 px-6 py-3 mt-10 font-semibold text-white bg-purple-600/80 rounded-full hover:bg-purple-500 transition-colors"
        >
          Mission Complete! Return to Dashboard
        </Link>
      )}
      
      {!isSupported && (
        <p className="text-xs text-gray-500 mt-6 italic">
          Auto-narration is not supported by your browser. Please use the "Continue" button.
        </p>
      )}
    </div>
  );
};

export default NarrationBlock;
