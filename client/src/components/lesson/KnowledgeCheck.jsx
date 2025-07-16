// src/components/lesson/KnowledgeCheck.jsx
import React, { useState, useEffect } from 'react';
import { useCoordinatedSpeechSynthesis } from '../../hooks/useSpeechCoordination.jsx'; // Import the hook

const KnowledgeCheck = ({ question, onSubmit, initialMessage, onCorrect }) => {
  const [answer, setAnswer] = useState('');
  const [messages, setMessages] = useState([{ role: 'ai', content: initialMessage }]);
  const { speak, cancel, isSpeaking, isSupported } = useCoordinatedSpeechSynthesis('knowledge-check'); // Use the hook

  useEffect(() => {
    if (initialMessage) {
      setMessages([{ role: 'ai', content: initialMessage }]);
      if (isSupported) {
        speak(initialMessage); // Speak the initial message
      }
    }
  }, [initialMessage, isSupported, speak]);

  const handleSubmit = () => {
    if (answer.trim()) {
      setMessages([...messages, { role: 'user', content: answer }]);
      onSubmit(answer, updateMessages, handleCorrectAnswer); // Pass the answer and the message update function
      setAnswer('');
    }
  };

  const updateMessages = (newAiMessage) => {
    setMessages([...messages, { role: 'user', content: answer }, { role: 'ai', content: newAiMessage }]);
    if (isSupported) {
      speak(newAiMessage); // Speak the new AI message
    }
  };

  const handleCorrectAnswer = (newAiMessage, afterSpeechCallback) => {
    setMessages([...messages, { role: 'user', content: answer }, { role: 'ai', content: newAiMessage }]);
    if (isSupported) {
      speak(newAiMessage, { onEnd: afterSpeechCallback }); // Speak the success message
    } else if (afterSpeechCallback) {
      afterSpeechCallback();  // Still call the callback if speech is not supported
    }
  }

  return (
    <div className="knowledge-check bg-gray-900 p-4 rounded-lg shadow-md">
      <p className="text-cyan-300 mb-2">{question}</p>

      <div className="messages-container h-48 overflow-y-auto mb-4 p-2 bg-gray-800 rounded-md">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`message ${msg.role === 'user' ? 'user-message' : 'ai-message'} p-2 rounded-md mb-2`}
            style={{
              backgroundColor: msg.role === 'user' ? '#334155' : '#1e293b',
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            {msg.content}
          </div>
        ))}
      </div>

      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Type your answer here..."
        className="w-full h-24 p-2 bg-gray-800 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
      />
      <button
        onClick={handleSubmit}
        disabled={!answer.trim()}
        className="mt-4 bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Submit Answer
      </button>
    </div>
  );
};

export default KnowledgeCheck;
