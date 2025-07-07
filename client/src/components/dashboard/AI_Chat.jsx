// src/components/dashboard/AI_Chat.jsx

import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import useSpeechSynthesis from '../../hooks/useSpeechSynthesis';
import { useAuth } from '../../hooks/useAuth';
import { sendChatMessageToAI } from '../../api/spacey_api';

const ChatMessage = ({ sender, text }) => {
  const isUser = sender === 'user';
  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-3 rounded-2xl shadow-md ${
          isUser
            ? 'bg-cyan-600 text-white rounded-br-none'
            : 'bg-gray-700 text-gray-200 rounded-bl-none'
        }`}
      >
        <p className="text-sm leading-relaxed">{text}</p>
      </div>
    </div>
  );
};

const AIChat = ({ onDebugDataUpdate, onAiSpeakingChange }) => {
  const [messages, setMessages] = useState([
    { sender: 'ai', text: "Hello! I'm your AI assistant. How can I help you on your mission today?" }
  ]);
  const [inputText, setInputText] = useState('');
  const [isAiResponding, setIsAiResponding] = useState(false);
  const chatContainerRef = useRef(null);
  const { currentUser } = useAuth();

  const {
    transcript,
    isListening,
    startListening,
    stopListening,
    isRecognitionSupported: speechSupported
  } = useSpeechRecognition();

  const {
    speak,
    cancel: stopSpeaking,
    isSpeaking: isAiSpeaking,
    isSupported: isTtsSupported
  } = useSpeechSynthesis();

  // Update avatar animation state via parent
  useEffect(() => {
    if (onAiSpeakingChange) {
      onAiSpeakingChange(isAiSpeaking);
    }
  }, [isAiSpeaking, onAiSpeakingChange]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!isListening && transcript) {
      setInputText(transcript);
    }
  }, [isListening, transcript]);

  const handleSendMessage = async (text) => {
    const trimmedText = text.trim();
    if (!trimmedText || isAiResponding || isAiSpeaking) return;

    const userMessage = { sender: 'user', text: trimmedText };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsAiResponding(true);

    try {
      const aiData = await sendChatMessageToAI(trimmedText, currentUser);
      const aiMessage = { sender: 'ai', text: aiData.message };
      setMessages(prev => [...prev, aiMessage]);

      // Speak the response
      if (isTtsSupported && aiData.message) {
        speak(aiData.message);
      }

      // Optional: send debug info
      if (onDebugDataUpdate) {
        onDebugDataUpdate({
          timestamp: Date.now(),
          userMessage: trimmedText,
          aiResponse: aiData.message
        });
      }
    } catch (err) {
      const fallback = { sender: 'ai', text: 'Sorry, something went wrong.' };
      setMessages(prev => [...prev, fallback]);
    } finally {
      setIsAiResponding(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSendMessage(inputText);
  };

  return (
    <div className="h-full flex flex-col bg-black/70">
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <ChatMessage key={i} sender={msg.sender} text={msg.text} />
        ))}
      </div>
      <form onSubmit={handleSubmit} className="p-4 border-t border-white/10 bg-black/20">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask me anything..."
            className="flex-1 px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white"
          />
          <button type="submit" className="p-3 bg-cyan-600 text-white rounded-lg">
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default AIChat;
