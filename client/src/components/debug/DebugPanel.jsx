// e:\Spacey-Intern\spacey_first_demo\spacey_demo_2\client\src\components\debug\DebugPanel.jsx

import React, { useState } from 'react';
import { X, ChevronsRight, GitBranch, Eye, EyeOff, Activity, CheckCircle, XCircle, User } from 'lucide-react';

// ... (MissionTree component remains the same) ...
const MissionTree = ({ blocks, currentBlockId }) => {
    // ... no changes needed here
    const renderNodeConnections = (block) => {
    switch (block.type) {
      case 'choice':
        return (
          <ul className="pl-6 mt-1 border-l border-gray-600">
            {block.choices.map((choice, i) => (
              <li key={i} className="text-xs text-purple-300/80 pt-1">
                <span className="text-gray-400">↳ Choice:</span> "{choice.text}" → <span className="font-semibold text-cyan-400">{choice.next_block}</span>
              </li>
            ))}
          </ul>
        );
      case 'narration':
      case 'reflection':
      case 'quiz':
        if (block.next_block) {
          return (
            <ul className="pl-6 mt-1 border-l border-gray-600">
              <li className="text-xs text-gray-400 pt-1">
                ↳ Next → <span className="font-semibold text-cyan-400">{block.next_block}</span>
              </li>
            </ul>
          );
        }
        return null;
      default:
        return null;
    }
  };

  return (
    <div className="border-t border-gray-700 mt-4 pt-4">
      <h4 className="font-mono text-sm text-gray-400 mb-2">Mission Flow:</h4>
      <ul className="space-y-3">
        {blocks.map((block) => (
          <li key={block.block_id} className={`p-2 rounded-md transition-colors ${currentBlockId === block.block_id ? 'bg-cyan-500/20' : ''}`}>
            <div className="flex items-center gap-2 font-mono text-sm">
              <GitBranch size={14} className="text-gray-500 flex-shrink-0" />
              <span className="font-semibold text-white">{block.block_id}</span>
              <span className="text-xs text-gray-400">({block.type})</span>
            </div>
            {renderNodeConnections(block)}
          </li>
        ))}
      </ul>
    </div>
  );
};


/**
 * A sub-component to display the user's current traits.
 */
const UserTraits = ({ tags }) => {
  return (
    <div className="border-t border-gray-700 mt-4 pt-4">
      <h4 className="font-mono text-sm text-gray-400 mb-2 flex items-center gap-2">
        <User size={14} /> Current User Traits
      </h4>
      {tags && tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tags.map(tag => (
            <span key={tag} className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs font-mono rounded-md">
              {tag}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500">No traits acquired yet.</p>
      )}
    </div>
  );
};

/**
 * A sub-component to display the last analysis from the backend.
 */
const LastAnalysis = ({ analysis }) => {
  if (!analysis) {
    return (
        <div className="border-t border-gray-700 mt-4 pt-4">
            <h4 className="font-mono text-sm text-gray-400 mb-2 flex items-center gap-2"><Activity size={14}/> Last Analysis</h4>
            <p className="text-xs text-gray-500">No interaction analyzed yet.</p>
        </div>
    );
  }

  return (
    <div className="border-t border-gray-700 mt-4 pt-4 font-mono text-xs space-y-2">
        <h4 className="text-sm text-gray-400 mb-2 flex items-center gap-2"><Activity size={14}/> Last Analysis</h4>
        <p><span className="text-gray-500">Method:</span> {analysis.analysis_method}</p>
        <p><span className="text-gray-500">Confidence:</span> {analysis.confidence}</p>
        
        {analysis.added_traits?.length > 0 && (
            <div>
                <p className="text-gray-500">Traits Added:</p>
                <ul className="pl-4">
                    {analysis.added_traits.map(trait => (
                        <li key={trait} className="flex items-center gap-2 text-green-400">
                            <CheckCircle size={12}/> {trait}
                        </li>
                    ))}
                </ul>
            </div>
        )}

        {analysis.removed_traits?.length > 0 && (
            <div>
                <p className="text-gray-500">Traits Removed:</p>
                <ul className="pl-4">
                    {analysis.removed_traits.map(trait => (
                        <li key={trait} className="flex items-center gap-2 text-red-400">
                            <XCircle size={12}/> {trait}
                        </li>
                    ))}
                </ul>
            </div>
        )}
    </div>
  );
};


const DebugPanel = ({ isOpen, onClose, lesson, onJump, currentBlockId, lastAnalysis, userTags }) => {
  const [showTree, setShowTree] = useState(false);

  if (!isOpen || !lesson) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose}></div>
      <div className={`fixed top-0 left-0 h-full w-96 bg-gray-900/90 backdrop-blur-md z-[60] p-4 overflow-y-auto shadow-2xl transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-700">
          <h3 className="text-lg font-bold text-cyan-300">Debug Panel</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-2 mb-4">
            <button 
                onClick={() => setShowTree(!showTree)}
                className="w-full flex items-center justify-between text-left px-3 py-2 rounded transition-colors text-sm bg-white/5 hover:bg-white/10 text-gray-300"
            >
                <span className="flex items-center gap-2"><GitBranch size={16} /> Mission Tree</span>
                {showTree ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
        </div>

        {showTree && <MissionTree blocks={lesson.blocks} currentBlockId={currentBlockId} />}

        {/* Display the current user traits */}
        <UserTraits tags={userTags} />

        {/* Display the last analysis here */}
        <LastAnalysis analysis={lastAnalysis} />

        <div className="border-t border-gray-700 mt-4 pt-4">
            <h4 className="font-mono text-sm text-gray-400 mb-2">Jump to Block:</h4>
            <ul className="space-y-1">
            {lesson.blocks.map((block, index) => (
                <li key={block.block_id}>
                <button 
                    onClick={() => onJump(block.block_id)} 
                    className={`w-full text-left px-3 py-2 rounded transition-colors text-sm ${currentBlockId === block.block_id ? 'bg-cyan-500/30 text-cyan-200 font-semibold' : 'text-gray-300 hover:bg-white/10'}`}
                >
                    <span className="flex items-center gap-2">
                    {currentBlockId === block.block_id && <ChevronsRight size={16} />}
                    {index + 1}. {block.block_id}
                    </span>
                </button>
                </li>
            ))}
            </ul>
        </div>
      </div>
    </>
  );
};

export default DebugPanel;
