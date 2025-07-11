// src/components/dashboard/AI_Chat.jsx

import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, MicOff } from 'lucide-react';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { useSpeechCoordination } from '../../hooks/useSpeechCoordination.jsx';
import { useConversationManager } from '../../hooks/useConversationManager.jsx';
import { useAuth } from '../../hooks/useAuth';

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
  const [inputText, setInputText] = useState('');
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);
  const chatContainerRef = useRef(null);
  const { currentUser } = useAuth();

  const {
    transcript,
    isListening,
    startListening,
    stopListening,
    isRecognitionSupported: speechSupported
  } = useSpeechRecognition({
    onFinalResult: (finalText) => {
      handleSendMessage(finalText); // automatically sends message when user finishes speaking
    }
  });

  // Unified conversation management
  const { 
    handleUserChat, 
    conversationHistory, 
    isProcessing: isAiResponding 
  } = useConversationManager();

  const { setContextState, trackActivity } = useSpeechCoordination();

  // Convert conversation history to chat messages format
  const messages = conversationHistory
    .filter(entry => entry.type === 'user' || entry.type === 'spacey')
    .map(entry => ({
      sender: entry.type === 'user' ? 'user' : 'ai',
      text: entry.content,
      timestamp: entry.timestamp
    }));

  // Add initial greeting if no messages
  if (messages.length === 0) {
    messages.unshift({
      sender: 'ai',
      text: "Hello! I'm Spacey, your AI assistant. How can I help you on your cosmic journey today?",
      timestamp: Date.now()
    });
  }

  // Function to check if user is scrolled to bottom
  const isScrolledToBottom = () => {
    if (!chatContainerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const threshold = 5; // Allow 5px threshold for "close enough"
    return scrollHeight - scrollTop - clientHeight <= threshold;
  };

  // Handle scroll events to track user's scroll position
  const handleScroll = () => {
    setIsUserScrolledUp(!isScrolledToBottom());
  };

  useEffect(() => {
    if (onAiSpeakingChange) {
      onAiSpeakingChange(isAiResponding); // Use processing state instead of speech state
    }
  }, [isAiResponding, onAiSpeakingChange]);

  // Smart auto-scroll: only auto-scroll if user is at bottom or if it's a new user message
  useEffect(() => {
    if (chatContainerRef.current && !isUserScrolledUp) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isUserScrolledUp]);

  // Auto-scroll when user sends a message (always scroll for user's own messages)
  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1].sender === 'user') {
      setIsUserScrolledUp(false);
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    }
  }, [messages]);

  useEffect(() => {
    if (!isListening && transcript) {
      setInputText(transcript);
    }
  }, [isListening, transcript]);

  // Clear chat context when no longer actively chatting
  useEffect(() => {
    let chatTimeout;

    if (isAiResponding) {
      // If AI is responding, keep chat context active
      setContextState('isInChat', true);
    } else {
      // Clear chat context after 10 seconds of inactivity
      chatTimeout = setTimeout(() => {
        setContextState('isInChat', false);
      }, 10000);
    }

    return () => {
      if (chatTimeout) clearTimeout(chatTimeout);
    };
  }, [isAiResponding, setContextState]);

  const handleSendMessage = async (text) => {
    const trimmedText = text.trim();
    if (!trimmedText || isAiResponding) return;

    // Track activity and set chat context
    trackActivity();
    setInputText('');

    try {
      // Use conversation manager for unified chat handling
      const response = await handleUserChat(trimmedText, currentUser);

      if (response && onDebugDataUpdate) {
        onDebugDataUpdate({
          timestamp: Date.now(),
          userMessage: trimmedText,
          aiResponse: response.message || response.response,
          metadata: {
            responseType: 'unified-chat',
            hasEmotionContext: !!response.emotionContext
          }
        });
      }
    } catch (err) {
      console.error('Chat error:', err);
      // Conversation manager handles fallback responses
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSendMessage(inputText);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="h-full flex flex-col bg-black/70">
      <div 
        ref={chatContainerRef} 
        className="flex-1 overflow-y-auto p-4 space-y-4"
        onScroll={handleScroll}
      >
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
          {speechSupported && (
            <button
              type="button"
              onClick={toggleListening}
              className={`p-3 rounded-lg border ${
                isListening ? 'bg-red-600' : 'bg-gray-600'
              } text-white`}
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          )}
          <button type="submit" className="p-3 bg-cyan-600 text-white rounded-lg">
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default AIChat;
