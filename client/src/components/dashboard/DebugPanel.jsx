import React, { useState, useEffect } from 'react';
import { Settings, User, Brain, Play, RefreshCw, Eye, EyeOff, Plus, Minus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { sendChatMessageToAI } from '../../api/spacey_api';

const DebugPanel = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const [playerMemory, setPlayerMemory] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [testMessage, setTestMessage] = useState("Tell me about space exploration");
  const [lastResponse, setLastResponse] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  
  // Debug context controls
  const [debugContext, setDebugContext] = useState({
    useEnhancedEngine: true,
    currentMission: 'dashboard',
    tone: 'supportive',
    emotionalState: 'neutral',
    debug: true
  });

  // Available options for testing
  const missions = ['dashboard', 'mars_mission_1', 'lesson_astronomy', 'crisis_mode'];
  const tones = ['supportive', 'witty', 'neutral', 'sarcastic', 'emergency'];
  const emotions = ['neutral', 'excited', 'curious', 'worried', 'confident'];
  const commonTraits = ['curious', 'risk_taker', 'cautious', 'science_minded', 'collaborative', 'analytical', 'beginner', 'experienced'];

  useEffect(() => {
    if (isOpen && currentUser) {
      loadPlayerMemory();
    }
  }, [isOpen, currentUser]);

  const loadPlayerMemory = async () => {
    try {
      setIsLoading(true);
      const playerId = currentUser?.uid || 'debug-user';
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/chat/player/${playerId}/memory`);
      const memory = await response.json();
      setPlayerMemory(memory);
    } catch (error) {
      console.error('Error loading player memory:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const testAI = async () => {
    try {
      setIsLoading(true);
      const playerId = currentUser?.uid || 'debug-user';
      
      const response = await sendChatMessageToAI(testMessage, currentUser, {
        ...debugContext,
        playerId
      });
      
      setLastResponse(response);
    } catch (error) {
      console.error('Error testing AI:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addTrait = async (trait) => {
    try {
      const playerId = currentUser?.uid || 'debug-user';
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/chat/player/${playerId}/trait`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trait, action: 'add', reason: 'debug_panel_test' })
      });
      
      if (response.ok) {
        await loadPlayerMemory();
      }
    } catch (error) {
      console.error('Error adding trait:', error);
    }
  };

  const removeTrait = async (trait) => {
    try {
      const playerId = currentUser?.uid || 'debug-user';
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/chat/player/${playerId}/trait`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trait, action: 'remove', reason: 'debug_panel_test' })
      });
      
      if (response.ok) {
        await loadPlayerMemory();
      }
    } catch (error) {
      console.error('Error removing trait:', error);
    }
  };

  const updateMission = async (missionId) => {
    try {
      const playerId = currentUser?.uid || 'debug-user';
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/chat/player/${playerId}/mission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missionId, progress: { debugUpdated: true } })
      });
      
      if (response.ok) {
        await loadPlayerMemory();
      }
    } catch (error) {
      console.error('Error updating mission:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-600 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold text-white">Spacey Debug Panel</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Player Memory Section */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-green-400" />
              <h3 className="text-lg font-semibold text-white">Player Memory</h3>
              <button
                onClick={loadPlayerMemory}
                className="ml-auto p-1 text-gray-400 hover:text-white transition-colors"
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            
            {playerMemory && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Name</p>
                    <p className="text-white">{playerMemory.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Current Mission</p>
                    <p className="text-white">{playerMemory.missions.current}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Emotional State</p>
                    <p className="text-white">{playerMemory.emotionalState}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Total Interactions</p>
                    <p className="text-white">{playerMemory.statistics.totalInteractions}</p>
                  </div>
                </div>

                {/* Current Traits */}
                <div>
                  <p className="text-sm text-gray-400 mb-2">Current Traits</p>
                  <div className="flex flex-wrap gap-2">
                    {playerMemory.traits.map(trait => (
                      <span
                        key={trait}
                        className="px-2 py-1 bg-cyan-600 text-white text-sm rounded-full flex items-center gap-1"
                      >
                        {trait}
                        <button
                          onClick={() => removeTrait(trait)}
                          className="hover:bg-red-600 rounded-full p-0.5"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Last Analysis Info */}
                {playerMemory.lastAnalysis && (
                  <div>
                    <p className="text-sm text-gray-400 mb-2">Last Trait Analysis</p>
                    <div className="bg-gray-700 rounded-lg p-3 text-sm">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <span className="text-gray-400">Method:</span>
                          <span className={`ml-2 px-2 py-1 rounded text-xs ${
                            playerMemory.lastAnalysis.method === 'llm_analysis' 
                              ? 'bg-green-600 text-white' 
                              : 'bg-yellow-600 text-white'
                          }`}>
                            {playerMemory.lastAnalysis.method}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Confidence:</span>
                          <span className="ml-2 text-white">
                            {(playerMemory.lastAnalysis.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div className="mt-2">
                        <span className="text-gray-400">Reasoning:</span>
                        <p className="text-white mt-1 text-xs">{playerMemory.lastAnalysis.reasoning}</p>
                      </div>
                      <div className="mt-2">
                        <span className="text-gray-400">Message:</span>
                        <p className="text-gray-300 mt-1 text-xs italic">"{playerMemory.lastAnalysis.message}"</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Add Traits */}
                <div>
                  <p className="text-sm text-gray-400 mb-2">Add Traits</p>
                  <div className="flex flex-wrap gap-2">
                    {commonTraits.filter(trait => !playerMemory.traits.includes(trait)).map(trait => (
                      <button
                        key={trait}
                        onClick={() => addTrait(trait)}
                        className="px-2 py-1 bg-gray-600 hover:bg-green-600 text-white text-sm rounded-full flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        {trait}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* AI Testing Section */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg font-semibold text-white">AI Response Testing</h3>
            </div>

            {/* Context Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Mission Context</label>
                <select
                  value={debugContext.currentMission}
                  onChange={(e) => setDebugContext({...debugContext, currentMission: e.target.value})}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                >
                  {missions.map(mission => (
                    <option key={mission} value={mission}>{mission}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Tone</label>
                <select
                  value={debugContext.tone}
                  onChange={(e) => setDebugContext({...debugContext, tone: e.target.value})}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                >
                  {tones.map(tone => (
                    <option key={tone} value={tone}>{tone}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Emotional State</label>
                <select
                  value={debugContext.emotionalState}
                  onChange={(e) => setDebugContext({...debugContext, emotionalState: e.target.value})}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                >
                  {emotions.map(emotion => (
                    <option key={emotion} value={emotion}>{emotion}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Test Message */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">Test Message</label>
              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white h-20 resize-none"
                placeholder="Enter a message to test..."
              />
            </div>

            <button
              onClick={testAI}
              disabled={isLoading || !testMessage.trim()}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 text-white py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              {isLoading ? 'Testing...' : 'Test AI Response'}
            </button>

            {/* Response Display */}
            {lastResponse && (
              <div className="mt-4 space-y-3">
                <div className="bg-gray-700 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-cyan-400 mb-2">Spacey's Response</h4>
                  <p className="text-white">{lastResponse.message}</p>
                </div>

                {lastResponse.promptUsed && (
                  <div className="bg-gray-700 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <button
                        onClick={() => setShowPrompt(!showPrompt)}
                        className="flex items-center gap-1 text-yellow-400 hover:text-yellow-300"
                      >
                        {showPrompt ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        <span className="text-sm font-semibold">Generated Prompt</span>
                      </button>
                    </div>
                    {showPrompt && (
                      <pre className="text-xs text-gray-300 whitespace-pre-wrap overflow-x-auto max-h-40 overflow-y-auto">
                        {lastResponse.promptUsed}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Trait Analyzer Testing */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Trait Analyzer Testing</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Test Message for Trait Detection</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g., I love taking risks and exploring the unknown!"
                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const message = e.target.value;
                        if (message.trim()) {
                          // Test the trait analyzer with this message
                          setTestMessage(message);
                          setDebugContext(prev => ({...prev, testAnalyzer: true}));
                          testAI();
                        }
                      }
                    }}
                  />
                  <button
                    onClick={(e) => {
                      const input = e.target.parentElement.querySelector('input');
                      const message = input.value;
                      if (message.trim()) {
                        setTestMessage(message);
                        setDebugContext(prev => ({...prev, testAnalyzer: true}));
                        testAI();
                      }
                    }}
                    className="bg-purple-600 hover:bg-purple-500 text-white py-2 px-4 rounded transition-colors"
                  >
                    Analyze
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Press Enter or click Analyze to test how the system detects personality traits
                </p>
              </div>
              
              {/* Example test phrases */}
              <div>
                <p className="text-sm text-gray-400 mb-2">Quick Test Phrases:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {[
                    "I love taking risks and being adventurous",
                    "Let's be careful and think this through",
                    "How does this rocket engine work exactly?",
                    "We should work together as a team",
                    "I'm curious about black holes and space",
                    "I need to analyze the data systematically"
                  ].map((phrase, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setTestMessage(phrase);
                        setDebugContext(prev => ({...prev, testAnalyzer: true}));
                        testAI();
                      }}
                      className="bg-gray-700 hover:bg-gray-600 text-gray-300 py-1 px-2 rounded text-xs transition-colors text-left"
                    >
                      "{phrase}"
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={() => updateMission('mars_mission_1')}
                className="bg-red-600 hover:bg-red-500 text-white py-2 px-4 rounded transition-colors"
              >
                Switch to Mars Mission
              </button>
              <button
                onClick={() => updateMission('lesson_astronomy')}
                className="bg-blue-600 hover:bg-blue-500 text-white py-2 px-4 rounded transition-colors"
              >
                Switch to Astronomy Lesson
              </button>
              <button
                onClick={() => addTrait('risk_taker')}
                className="bg-orange-600 hover:bg-orange-500 text-white py-2 px-4 rounded transition-colors"
              >
                Add Risk Taker Trait
              </button>
              <button
                onClick={() => addTrait('science_minded')}
                className="bg-green-600 hover:bg-green-500 text-white py-2 px-4 rounded transition-colors"
              >
                Add Science Minded Trait
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebugPanel; 