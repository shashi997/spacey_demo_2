// e:\Spacey-Intern\spacey_first_demo\spacey_demo_2\client\src\components\debug\DebugPanel.jsx

import React, { useState } from 'react';
import { X, ChevronsRight, GitBranch, Eye, EyeOff, Activity, CheckCircle, XCircle, User, MessageSquare, Clock, AlertTriangle, Zap, Send, Brain } from 'lucide-react';

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
 * AI Debug Panel - Shows request/response flow for AI chat
 */
const AIDebugPanel = ({ chatDebugData = [] }) => {
  const [showDetails, setShowDetails] = useState({});

  const toggleDetails = (index) => {
    setShowDetails(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'loading': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return <CheckCircle size={12} />;
      case 'error': return <XCircle size={12} />;
      case 'loading': return <Clock size={12} className="animate-spin" />;
      default: return <Activity size={12} />;
    }
  };

  return (
    <div className="border-t border-gray-700 mt-4 pt-4">
      <h4 className="font-mono text-sm text-gray-400 mb-2 flex items-center gap-2">
        <Brain size={14} /> AI Request/Response Log
      </h4>
      
      {chatDebugData.length === 0 ? (
        <p className="text-xs text-gray-500">No AI interactions logged yet.</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {chatDebugData.slice(-10).reverse().map((entry, index) => {
            const isExpanded = showDetails[index];
            return (
              <div key={index} className="bg-gray-800/50 rounded-md p-2 font-mono text-xs">
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleDetails(index)}
                >
                  <div className="flex items-center gap-2">
                    <span className={getStatusColor(entry.status)}>
                      {getStatusIcon(entry.status)}
                    </span>
                    <span className="text-gray-300">
                      {formatTime(entry.timestamp)}
                    </span>
                    <span className="text-cyan-400 text-xs truncate max-w-32">
                      "{entry.userMessage.substring(0, 30)}..."
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.responseTime && (
                      <span className="text-gray-500 text-xs">
                        {entry.responseTime}ms
                      </span>
                    )}
                    {isExpanded ? <EyeOff size={12} /> : <Eye size={12} />}
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="mt-2 space-y-2 border-t border-gray-600 pt-2">
                    {/* Request Details */}
                    <div>
                      <p className="text-gray-400 flex items-center gap-1">
                        <Send size={10} /> Request:
                      </p>
                      <div className="pl-3 text-gray-300">
                        <p><span className="text-gray-500">Message:</span> "{entry.userMessage}"</p>
                        <p><span className="text-gray-500">User:</span> {entry.userInfo ? 'Authenticated' : 'Anonymous'}</p>
                        <p><span className="text-gray-500">Endpoint:</span> {entry.endpoint}</p>
                      </div>
                    </div>
                    
                    {/* Response Details */}
                    {entry.status === 'success' && entry.aiResponse && (
                      <div>
                        <p className="text-gray-400 flex items-center gap-1">
                          <MessageSquare size={10} /> Response:
                        </p>
                        <div className="pl-3 text-gray-300">
                          <p><span className="text-gray-500">Message:</span> "{entry.aiResponse.substring(0, 100)}..."</p>
                          {entry.debug && (
                            <>
                              <p><span className="text-gray-500">Provider:</span> {entry.debug.provider}</p>
                              <p><span className="text-gray-500">Emotion:</span> {entry.debug.emotionalState?.emotion}</p>
                              <p><span className="text-gray-500">Learning Style:</span> {entry.debug.learningStyle}</p>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Error Details */}
                    {entry.status === 'error' && entry.error && (
                      <div>
                        <p className="text-red-400 flex items-center gap-1">
                          <AlertTriangle size={10} /> Error:
                        </p>
                        <div className="pl-3 text-red-300">
                          <p><span className="text-gray-500">Message:</span> {entry.error.message || entry.error}</p>
                          {entry.error.debug && (
                            <>
                              <p><span className="text-gray-500">AI Error:</span> {entry.error.debug.aiError}</p>
                              <p><span className="text-gray-500">Available Providers:</span> {entry.error.debug.availableProviders?.join(', ')}</p>
                              <p><span className="text-gray-500">Default Provider:</span> {entry.error.debug.defaultProvider}</p>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Network Details */}
                    <div>
                      <p className="text-gray-400 flex items-center gap-1">
                        <Zap size={10} /> Network:
                      </p>
                      <div className="pl-3 text-gray-300">
                        <p><span className="text-gray-500">Status:</span> {entry.status}</p>
                        {entry.responseTime && (
                          <p><span className="text-gray-500">Response Time:</span> {entry.responseTime}ms</p>
                        )}
                        {entry.httpStatus && (
                          <p><span className="text-gray-500">HTTP Status:</span> {entry.httpStatus}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
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


const DebugPanel = ({ isOpen, onClose, lesson, onJump, currentBlockId, lastAnalysis, userTags, chatDebugData = [] }) => {
  const [showTree, setShowTree] = useState(false);
  const [showAIDebug, setShowAIDebug] = useState(true);

  if (!isOpen) return null;

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

        {/* AI Debug Toggle */}
        <div className="space-y-2 mb-4">
            <button 
                onClick={() => setShowAIDebug(!showAIDebug)}
                className="w-full flex items-center justify-between text-left px-3 py-2 rounded transition-colors text-sm bg-green-500/10 hover:bg-green-500/20 text-green-300 border border-green-500/30"
            >
                <span className="flex items-center gap-2"><Brain size={16} /> AI Chat Debug</span>
                {showAIDebug ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
        </div>

        {/* AI Debug Panel - Always show if not in lesson mode */}
        {showAIDebug && <AIDebugPanel chatDebugData={chatDebugData} />}

        {/* Lesson Debug (only show if lesson exists) */}
        {lesson && (
          <>
            <div className="space-y-2 mb-4 mt-6">
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
                        onClick={() => {
                          onJump(block.block_id);
                          setTimeout(() => onClose(), 100); // Close panel after jump
                        }}                         
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
          </>
        )}
      </div>
    </>
  );
};

export default DebugPanel;
