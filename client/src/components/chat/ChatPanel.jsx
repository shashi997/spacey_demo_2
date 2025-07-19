// e:\Spacey-Intern\spacey_second_demo\spacey_demo_2\client\src\components\chat\ChatPanel.jsx

import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { useCoordinatedSpeechSynthesis } from '../../hooks/useSpeechCoordination'; 

const ChatPanel = ({ isOpen, onClose, chatHistory, onSendMessage }) => {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);
  const { speak, cancel } = useCoordinatedSpeechSynthesis('chat'); // Use the speech synthesis hook

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      // Speak the latest AI message when chatHistory changes
      const latestMessage = chatHistory.length > 0 ? chatHistory[chatHistory.length - 1] : null;
      if (latestMessage && latestMessage.sender === 'ai') {
        speak(latestMessage.content);
      }
    } else {
      // Stop speaking when chat closes
      cancel();
    }
  }, [chatHistory, isOpen, speak, cancel]);

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage);
      setNewMessage('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden bg-gray-900/75 border border-gray-700">
        {/* Fancy Header */}
           <div className="flex items-center justify-between py-4 px-5 bg-gradient-to-r from-blue-600 to-indigo-700/75 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-white flex items-center">
             <MessageSquare className="mr-2" size={24} />
            Spacey Chat
          </h2>
          <button
            onClick={onClose}
            className="text-gray-300 cursor-pointer hover:text-white focus:outline-none"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Message Area with added effects */}
        <div className="h-96 overflow-y-auto p-5">
          {chatHistory.map((message, index) => (
            <div
              key={index}
              className={`mb-4 flex ${message.sender === 'user' ? 'justify-end' : ''}`}
            >
              <div
                className={`max-w-xs py-2 px-3 rounded-lg ${
                  message.sender === 'user'
                    ? 'bg-blue-500 text-white rounded-br-none'
                    : 'bg-gray-700 text-gray-200 rounded-bl-none'
                } shadow-md`}
              >
                <p className="text-sm">{message.content}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Enhanced Input Area */}
        <div className="p-5 bg-gray-800 border-t border-gray-700">
          <div className="flex rounded-lg overflow-hidden shadow-inner">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="flex-grow h-12 p-3 bg-gray-700 text-white rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#4f46e5 #2d3748',
              }}
            />
            <button
              onClick={handleSendMessage}
              className="bg-gradient-to-r cursor-pointer from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-2 px-4 rounded-r-lg focus:outline-none focus:shadow-outline flex items-center"
            >
              <Send size={20} className="mr-2" /> {/* Slightly larger icon */}
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
