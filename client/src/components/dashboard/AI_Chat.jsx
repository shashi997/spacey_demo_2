import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, MicOff, Volume2, VolumeX, LoaderCircle } from 'lucide-react';
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

const AIChat = ({ onDebugDataUpdate }) => {
  const [messages, setMessages] = useState([
    { sender: 'ai', text: "Hello! I'm your AI assistant. How can I help you on your mission today?" }
  ]);
  const [inputText, setInputText] = useState('');
  const [isAiResponding, setIsAiResponding] = useState(false);
  const chatContainerRef = useRef(null);
  const { currentUser, loading } = useAuth();

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

  const createDebugEntry = (userMessage, userInfo, status = 'loading') => {
    return {
      timestamp: new Date().toISOString(),
      userMessage,
      userInfo,
      endpoint: 'http://localhost:5000/api/chat/spacey',
      status,
      requestStartTime: Date.now()
    };
  };

  const updateDebugEntry = (debugEntry, updates) => {
    const updatedEntry = {
      ...debugEntry,
      ...updates,
      responseTime: updates.responseTime || (Date.now() - debugEntry.requestStartTime)
    };
    
    if (onDebugDataUpdate) {
      onDebugDataUpdate(updatedEntry);
    }
    
    return updatedEntry;
  };

  const handleSendMessage = async (text) => {
    const trimmedText = text.trim();
    if (!trimmedText || isAiResponding || isAiSpeaking) return;

    const newUserMessage = { sender: 'user', text: trimmedText };
    setMessages(prev => [...prev, newUserMessage]);
    setInputText('');
    setIsAiResponding(true);

    const debugEntry = createDebugEntry(trimmedText, currentUser, 'loading');
    if (onDebugDataUpdate) {
      onDebugDataUpdate(debugEntry);
    }

    try {
      console.log('🚀 Sending message to AI:', trimmedText);
      console.log('👤 User context:', currentUser);
      console.log('🔄 Authentication loading:', loading);
      
      const aiResponseData = await sendChatMessageToAI(trimmedText, currentUser);
      console.log('✅ AI Response received:', aiResponseData);
      
      const aiResponseMessage = { sender: 'ai', text: aiResponseData.message };
      setMessages(prev => [...prev, aiResponseMessage]);

      updateDebugEntry(debugEntry, {
        status: 'success',
        aiResponse: aiResponseData.message,
        debug: aiResponseData.debug,
        httpStatus: 200
      });

      if (isTtsSupported && aiResponseData.message) {
        speak(aiResponseData.message);
      }

    } catch (error) {
      console.error('❌ Error sending message:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers
      });
      
      let errorText = "I'm having trouble connecting to my core systems. Please try again in a moment.";
      let errorDetails = error;
      
      if (error.response) {
        const statusCode = error.response.status;
        const errorData = error.response.data;
        
        if (statusCode === 503) {
          errorText = errorData.message || "AI service is temporarily unavailable. Please try again in a moment.";
        } else if (statusCode === 400) {
          errorText = "There was an issue with your message. Please try rephrasing it.";
        } else if (statusCode >= 500) {
          errorText = "Server error occurred. Our team has been notified.";
        }
        
        errorDetails = errorData;
        
        updateDebugEntry(debugEntry, {
          status: 'error',
          error: errorDetails,
          httpStatus: statusCode
        });
        
      } else if (error.request) {
        errorText = "Unable to reach the AI service. Please check your connection and try again.";
        
        updateDebugEntry(debugEntry, {
          status: 'error',
          error: { message: 'Network error - no response received', type: 'network' },
          httpStatus: 0
        });
        
      } else {
        updateDebugEntry(debugEntry, {
          status: 'error',
          error: { message: error.message, type: 'unknown' }
        });
      }
      
      const errorMessage = { sender: 'ai', text: errorText, isError: true };
      setMessages(prev => [...prev, errorMessage]);

    } finally {
      setIsAiResponding(false);
    }
  };

  const handleInputSubmit = (e) => {
    e.preventDefault();
    handleSendMessage(inputText);
  };

  const handleMicrophoneClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleVoiceToggle = () => {
    if (isAiSpeaking) {
      stopSpeaking();
    }
  };

  const isInputDisabled = isListening || isAiResponding || isAiSpeaking || loading;

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-900/60 to-black/80 backdrop-blur-md border border-white/10 relative overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/20">
        <h3 className="text-lg font-semibold text-cyan-300 flex items-center gap-2">
          AI Assistant
        </h3>
        <div className="flex items-center gap-2">
          {isTtsSupported && (
            <button
              onClick={handleVoiceToggle}
              className={`p-2 rounded-full transition-colors ${
                isAiSpeaking 
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                  : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50'
              }`}
              title={isAiSpeaking ? 'Stop speaking' : 'AI voice'}
            >
              {isAiSpeaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          )}
        </div>
      </div>

      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20"
      >
        {loading && (
          <div className="flex justify-start">
             <div className="max-w-xs md:max-w-md lg:max-w-lg px-4 py-3 rounded-2xl bg-gray-700 text-gray-400 rounded-bl-none flex items-center gap-2">
                <LoaderCircle className="w-4 h-4 animate-spin" />
                <span>Initializing...</span>
             </div>
          </div>
        )}
        {isAiResponding && (
          <div className="flex justify-start">
             <div className="max-w-xs md:max-w-md lg:max-w-lg px-4 py-3 rounded-2xl bg-gray-700 text-gray-400 rounded-bl-none flex items-center gap-2">
                <LoaderCircle className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
             </div>
          </div>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-3 rounded-2xl ${
                message.sender === 'user'
                  ? 'bg-cyan-600 text-white rounded-br-none'
                  : message.isError
                  ? 'bg-red-600/80 text-red-100 rounded-bl-none'
                  : 'bg-gray-700 text-gray-100 rounded-bl-none'
              }`}
            >
              <p className="text-sm leading-relaxed">{message.text}</p>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleInputSubmit} className="p-4 border-t border-white/10 bg-black/20">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                loading ? "Initializing..." : 
                isListening ? "Listening..." : 
                isAiResponding ? "Processing..." : 
                "Ask me anything about space..."
              }
              disabled={isInputDisabled}
              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {isListening && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              </div>
            )}
          </div>
          
          {speechSupported && (
            <button
              type="button"
              onClick={handleMicrophoneClick}
              disabled={isAiResponding || isAiSpeaking}
              className={`p-3 rounded-lg transition-colors border ${
                isListening
                  ? 'bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30'
                  : 'bg-white/5 border-white/20 text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
              title={isListening ? 'Stop listening' : 'Start voice input'}
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          )}
          
          <button
            type="submit"
            disabled={isInputDisabled || !inputText.trim()}
            className="p-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Send message"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default AIChat;
