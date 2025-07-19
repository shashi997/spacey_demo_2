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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-md bg-gray-900 rounded-lg shadow-lg overflow-hidden"> 
        {/* Header with a subtle gradient */}
        <div className="flex items-center justify-between bg-gradient-to-r from-gray-800 to-gray-700 py-3 px-4 border-b border-gray-700">
          <h2 className="text-white font-semibold flex items-center">
            <MessageSquare className="mr-2" size={18} />
            Chat</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            &times;
          </button>
        </div>

        <div className="h-80 overflow-y-auto p-4">
          {chatHistory.map((message, index) => (
            <div key={index} className={`mb-2 ${message.sender === 'user' ? 'text-right' : ''}`}>
              <div className={`inline-block p-2 rounded-lg ${message.sender === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-200'} 
                              ${message.sender === 'user' ? 'rounded-br-none' : 'rounded-bl-none'} transition-colors duration-200`}>
                {message.content}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area with a slightly different background */}
        <div className="p-4 bg-gray-800 border-t border-gray-700">
          <div className="flex rounded-lg overflow-hidden">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="flex-grow h-10 p-2 bg-gray-700 text-white rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <button
              onClick={handleSendMessage}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-r-lg focus:outline-none focus:shadow-outline flex items-center"
            >
              <Send size={18} /> {/* Icon for send button */}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
