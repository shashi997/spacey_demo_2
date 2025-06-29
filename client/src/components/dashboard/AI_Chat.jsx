import React, { useState, useEffect, useRef } from 'react';
import { SendHorizontal, Mic, MicOff, LoaderCircle } from 'lucide-react';
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

const AIChat = () => {
  const [messages, setMessages] = useState([
    { sender: 'ai', text: "Hello! I'm your AI assistant. How can I help you on your mission today?" }
  ]);
  const [inputText, setInputText] = useState('');
  const [isAiResponding, setIsAiResponding] = useState(false);
  const chatContainerRef = useRef(null);
  const { currentUser } = useAuth();

  const handleSpeechResult = (finalTranscript) => {
    handleSendMessage(finalTranscript);
  };

  const { isListening, transcript, startListening, stopListening, speechError, isRecognitionSupported } = useSpeechRecognition({ onFinalResult: handleSpeechResult });
  
  const { speak, isSpeaking: isAiSpeaking, isSupported: isTtsSupported, prime } = useSpeechSynthesis();

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isAiResponding]);

  useEffect(() => {
    if (isListening) {
      setInputText(transcript);
    }
  }, [transcript, isListening]);

  const handleSendMessage = async (text) => {
    const trimmedText = text.trim();
    if (!trimmedText || isAiResponding || isAiSpeaking) return;

    const newUserMessage = { sender: 'user', text: trimmedText };
    setMessages(prev => [...prev, newUserMessage]);
    setInputText('');
    setIsAiResponding(true);

    try {
      const aiResponseData = await sendChatMessageToAI(trimmedText, currentUser);
      const aiResponseMessage = { sender: 'ai', text: aiResponseData.message };
      setMessages(prev => [...prev, aiResponseMessage]);

      if (isTtsSupported && aiResponseData.message) {
        speak(aiResponseData.message);
      }

    } catch (error) {
      console.error(error);
      const errorText = "I'm having trouble connecting to my core systems. Please try again in a moment.";
      const errorMessage = { sender: 'ai', text: errorText };
      setMessages(prev => [...prev, errorMessage]);
      
      // --- ADDED THIS LINE ---
      // Speak the error message to the user
      if (isTtsSupported) {
        speak(errorText);
      }
      // -----------------------

    } finally {
      setIsAiResponding(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // --- ADDED: Prime the audio engine on user submit ---
    if (isTtsSupported) prime();

    if (isListening) {
      stopListening();
    } else {
      handleSendMessage(inputText);
    }
  };

  const handleMicClick = () => {
    // --- ADDED: Prime the audio engine on user mic click ---
    if (isTtsSupported) prime();
    
    if (isListening) {
      stopListening();
    } else {
      setInputText('');
      startListening();
    }
  };

  const isInputDisabled = isListening || isAiResponding || isAiSpeaking;

  return (
    <div className="flex flex-col h-full bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
      {/* Chat Messages Area */}
      <div
        ref={chatContainerRef}
        className="flex-grow p-4 md:p-6 space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800/50"
      >
        {messages.map((msg, index) => (
          <ChatMessage key={index} sender={msg.sender} text={msg.text} />
        ))}
        {isListening && (
          <div className="flex justify-start">
             <div className="max-w-xs md:max-w-md lg:max-w-lg px-4 py-3 rounded-2xl bg-gray-700 text-gray-400 rounded-bl-none italic">Listening...</div>
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
      </div>

      {/* Chat Input Area */}
      <div className="p-4 border-t border-white/10 bg-black/20">
        {speechError && <p className="text-xs text-red-400 mb-2 text-center">{speechError}</p>}
        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isListening ? "Listening..." : "Type your message or use the mic..."}
            className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
            disabled={isInputDisabled}
          />
          {isRecognitionSupported && (
            <button
              type="button"
              onClick={handleMicClick}
              className={`flex-shrink-0 p-2 rounded-full transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-700 text-cyan-400 hover:bg-gray-600'}`}
              aria-label={isListening ? 'Stop listening' : 'Start listening'}
              disabled={isInputDisabled}
            >
              {isListening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          )}
          <button
            type="submit"
            className="flex-shrink-0 p-2 rounded-full bg-cyan-600 text-white hover:bg-cyan-500 transition-colors disabled:bg-cyan-800/50 disabled:cursor-not-allowed"
            disabled={!inputText || isInputDisabled}
            aria-label="Send message"
          >
            <SendHorizontal size={20} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default AIChat;
