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

  const { 
    handleUserChat, 
    conversationHistory, 
    isProcessing: isAiResponding 
  } = useConversationManager();

  const { setContextState, trackActivity } = useSpeechCoordination();

  const messages = conversationHistory
    .filter(entry => entry.type === 'user' || entry.type === 'spacey')
    .map(entry => ({
      sender: entry.type === 'user' ? 'user' : 'ai',
      text: entry.content,
      timestamp: entry.timestamp
    }));

  if (messages.length === 0) {
    messages.unshift({
      sender: 'ai',
      text: "Hello! I'm Spacey, your AI assistant. How can I help you on your cosmic journey today?",
      timestamp: Date.now()
    });
  }

  const isScrolledToBottom = () => {
    if (!chatContainerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const threshold = 5; 
    return scrollHeight - scrollTop - clientHeight <= threshold;
  };

  const handleScroll = () => {
    setIsUserScrolledUp(!isScrolledToBottom());
  };

  useEffect(() => {
    if (onAiSpeakingChange) {
      onAiSpeakingChange(isAiResponding); 
    }
  }, [isAiResponding, onAiSpeakingChange]);

  useEffect(() => {
    if (chatContainerRef.current && !isUserScrolledUp) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isUserScrolledUp]);

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

  useEffect(() => {
    let chatTimeout;

    if (isAiResponding || (conversationHistory.length > 0 && conversationHistory.at(-1)?.type === 'user')) {
      setContextState('isInChat', true);
    } else {
      chatTimeout = setTimeout(() => {
        setContextState('isInChat', false);
      }, 10000);
    }

    return () => {
      if (chatTimeout) clearTimeout(chatTimeout);
    };
  }, [isAiResponding, conversationHistory, setContextState]);

  const handleSendMessage = async (text) => {
    const trimmedText = text.trim();
    if (!trimmedText || isAiResponding) return;

    trackActivity();
    setInputText('');

    try {
      // This is the key function call.
      // We assume `handleUserChat` has been updated in the useConversationManager hook
      // to perform two actions:
      // 1. Get the AI's text response and update the conversation history.
      // 2. Call the `speak` function from the `useCoordinatedSpeechSynthesis` hook with the response,
      //    which triggers the talking animation in the AI_Avatar component.
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
          <ChatMessage key={`${msg.timestamp}-${i}`} sender={msg.sender} text={msg.text} />
        ))}
      </div>
      <form onSubmit={handleSubmit} className="p-4 border-t border-white/10 bg-black/20">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={isListening ? transcript : inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isListening ? "Listening..." : "Ask me anything..."}
            className="flex-1 px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white"
            disabled={isListening}
          />
          {speechSupported && (
            <button
              type="button"
              onClick={toggleListening}
              className={`p-3 rounded-lg border ${
                isListening ? 'bg-red-600 border-red-500 animate-pulse' : 'bg-gray-600 border-gray-500'
              } text-white transition-colors`}
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          )}
          <button type="submit" className="p-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors">
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default AIChat;