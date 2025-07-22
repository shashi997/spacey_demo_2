// e:\Spacey-Intern\spacey_second_demo\spacey_demo_2\client\src\pages\LessonPage.jsx

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader, AlertTriangle, RefreshCw, BookOpen, MessageSquare, Play, Mic, MicOff } from 'lucide-react';

// API Service
import { analyzeInteraction, saveChoice, saveFinalSummary } from '../api/lesson_api';

// Components
import Navbar from '../components/ui/Navbar';
import NarrationBlock from '../components/lesson/NarrationBlock';
import ChoiceBlock from '../components/lesson/ChoiceBlock';
import ReflectionBlock from '../components/lesson/ReflectionBlock';
import QuizBlock from '../components/lesson/QuizBlock';
import AIAvatar from '../components/ui/AIAvatar';
import DebugPanel from '../components/debug/DebugPanel';
import AiFeedback from '../components/lesson/AiFeedback';
import LogPanel from '../components/lesson/LogPanel';
import MediaDisplay from '../components/lesson/MediaDisplay';
import LessonProgressIndicator from '../components/lesson/LessonProgressIndicator'; // Import LessonProgressIndicator
// Remove ChatPanel import since we're using integrated chat
// import ChatPanel from '../components/chat/ChatPanel';

// Hooks
import useAudio from '../hooks/useAudio';
import { useAuth } from '../hooks/useAuth';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useConversationManager } from '../hooks/useConversationManager';

import { db, auth } from '../firebaseConfig';  // Import Firebase services
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth'; // Listen for auth changes
import CameraFeed from '../components/ui/CameraFeed';
import { hasLessonAccess, isLessonCompleted } from '../utils/lessonProgression';


const fetchLessonData = async (lessonId) => {
  try {
    const lessonModule = await import(`../../public/lessons/${lessonId}.json`);
    return lessonModule.default;
  } catch (error) {
    console.error("Failed to load lesson data:", error);
    return null;
  }
};

const LessonPage = () => {
  const { lessonId } = useParams();
  const { currentUser } = useAuth();
  
  // --- CONVERSATION MANAGER ---
  const { handleUserChat } = useConversationManager();
  
  const [hasStarted, setHasStarted] = useState(false); // Add a state to track if the lesson has started
  
  const [lesson, setLesson] = useState(null);
  const [currentBlockId, setCurrentBlockId] = useState(null);
  const [userTags, setUserTags] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDebuggerOpen, setIsDebuggerOpen] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState(null);

  const [persistentUserTags, setPersistentUserTags] = useState([]); // For global traits
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);  // For media progress

  // --- ACCESS CONTROL STATE ---
  const [hasAccess, setHasAccess] = useState(true);
  const [accessError, setAccessError] = useState(null);
  const [accessLoading, setAccessLoading] = useState(true);

  // --- CAMERA STATE ---
  const webcamRef = useRef(null);
  const [emotionData, setEmotionData] = useState(null);

  // --- STATE FOR UI FLOW & LOGS ---
  const [pageState, setPageState] = useState('idle'); 
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [backendAiMessage, setBackendAiMessage] = useState(null);
  const [analysisLog, setAnalysisLog] = useState([]);
  const [isLogOpen, setIsLogOpen] = useState(false);

  // --- CHAT STATE ---
  const [chatHistory, setChatHistory] = useState([]);
  const [isChatOpen, setIsChatOpen] = useState(false); // Control ChatPanel visibility

  // --- VOICE STATE ---
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  
  // --- VOICE RECOGNITION ---
  const {
    transcript,
    isListening,
    startListening,
    stopListening,
    isRecognitionSupported
  } = useSpeechRecognition({
    onFinalResult: (finalText) => {
      if (finalText.trim()) {
        handleSendMessage(finalText);
        setIsVoiceActive(false);
      }
    }
  });



  useEffect(() => {
    if (lessonId && currentUser?.uid) {
      checkLessonAccess();
      loadLessonProgress();
      loadPersistentUserTags();
    } else if (lessonId && !currentUser?.uid) {  // Only load from scratch if no user is logged in
    loadLesson();
  }
  }, [lessonId, currentUser?.uid]);

  // Check lesson access when user and lesson are available
  const checkLessonAccess = async () => {
    if (!currentUser?.uid || !lessonId) return;
    
    setAccessLoading(true);
    try {
      const accessResult = await hasLessonAccess(currentUser.uid, lessonId);
      setHasAccess(accessResult.hasAccess);
      setAccessError(accessResult.reason);
    } catch (error) {
      console.error('Error checking lesson access:', error);
      setHasAccess(false);
      setAccessError('Error checking lesson access');
    } finally {
      setAccessLoading(false);
    }
  };

  // Handle emotion detection from camera
  const handleEmotionDetected = useCallback((emotionInfo) => {
    setEmotionData(emotionInfo);
  }, []);

  const loadLesson = useCallback(() => {
    setIsLoading(true);
    setError(null);
    setBackendAiMessage(null);
    setLastAnalysis(null);
    setPageState('idle');
    setPendingNavigation(null);
    setAnalysisLog([]);
    fetchLessonData(lessonId).then(data => {
      if (data && data.blocks && data.blocks.length > 0) {
        setLesson(data);
        setCurrentBlockId(data.blocks[0].block_id);
        setUserTags([]);
        setChatHistory([]); // Initialize chat history
      } else {
        setError(`Mission "${lessonId}" not found or is invalid.`);
      }
      setIsLoading(false);
      setHasStarted(false);
    });
  }, [lessonId]);

  useEffect(() => {
    if (lessonId) {
      loadLesson();
    }
  }, [lessonId, loadLesson]);


  const loadLessonProgress = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const progressDocId = `${currentUser?.uid}_${lessonId}`;
      const progressDocRef = doc(db, "lesson_progress", progressDocId);
      const docSnap = await getDoc(progressDocRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setCurrentBlockId(data.currentBlockId);
        setUserTags(data.userTags);
        // You might also want to handle loading 'completed' status here.
        setCurrentMediaIndex(data.currentMediaIndex || 0); // Load media index
        setChatHistory(data.chatHistory || []);  // Load chat history
        setLesson(await fetchLessonData(lessonId)); // Load lesson data after progress
      } else {
        // If no progress exists, load the lesson and start from the beginning.
        const lessonData = await fetchLessonData(lessonId);
        if (lessonData && lessonData.blocks && lessonData.blocks.length > 0) {
          setLesson(lessonData);
          setCurrentBlockId(lessonData.blocks[0].block_id);
          setUserTags([]);
          setCurrentMediaIndex(0);
          setChatHistory([]); // Initialize chat history
          // Initialize progress in Firestore.
          await saveLessonProgress(lessonData.blocks[0].block_id, [], 0);
        } else {
          setError(`Mission "${lessonId}" not found or is invalid.`);
        }
      }
    } catch (error) {
      console.error("Failed to load or initialize lesson progress:", error);
      setError("Failed to load lesson progress.");
    } finally {
      setIsLoading(false);
    }
  };



  const saveLessonProgress = async (blockId, tags, mediaIndex = 0, chatHistory = [], completed = false) => {
    if (!currentUser?.uid || !lessonId || blockId === null || blockId === undefined) {
      console.warn("[saveLessonProgress] Not saving progress: blockId is null or undefined", { userId: currentUser?.uid, lessonId, blockId, tags });
      return; // Ensure user, lesson, and blockId are valid
    }

    try {
      const progressDocId = `${currentUser.uid}_${lessonId}`;
      const progressDocRef = doc(db, "lesson_progress", progressDocId);
      
      const progressData = {
          currentBlockId: blockId,
          userTags: tags,
          currentMediaIndex: mediaIndex, // Save media index
          chatHistory: chatHistory, // Save chat history
          completed: completed,
          lastUpdated: Timestamp.now(),
      };

      if (completed) {
        progressData.completedAt = Timestamp.now();
        console.log(`📚 Saving lesson completion for ${lessonId}:`, progressData);
      }

      await setDoc(progressDocRef, progressData, { merge: true });
      
      if (completed) {
        console.log(`✅ Lesson ${lessonId} marked as completed in database`);
      }
    } catch (error) {
      console.error("Failed to save lesson progress:", error);
      throw error; // Re-throw to handle in calling function
    }
  };

  const loadPersistentUserTags = async () => {
    if (!currentUser?.uid) return;
    try {
      const userDocRef = doc(db, "user_traits", currentUser.uid); // Separate collection
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        setPersistentUserTags(docSnap.data().tags || []);
      } else {
        setPersistentUserTags([]);
      }
    } catch (error) {
      console.error("Failed to load persistent user tags:", error);
    }
  };

  const savePersistentUserTags = async (tags) => {
    if (!currentUser?.uid) return;
    try {
      const userDocRef = doc(db, "user_traits", currentUser.uid);
      await setDoc(userDocRef, { tags }, { merge: true });
    } catch (error) {
      console.error("Failed to save persistent user tags:", error);
    }
  };


  const { currentBlock, currentBlockIndex } = useMemo(() => {
    if (!lesson || !currentBlockId) return { currentBlock: null, currentBlockIndex: -1 };
    const blockIndex = lesson.blocks.findIndex(b => b.block_id === currentBlockId);
    return { currentBlock: lesson.blocks[blockIndex], currentBlockIndex: blockIndex };
  }, [lesson, currentBlockId]);

  // --- NEW: Use the audio hook to play sound from the current block ---
  const audioSrc = useMemo(() => currentBlock?.media?.audio, [currentBlock]);
  useAudio(audioSrc);
  // --- END OF NEW CODE ---

  const handleNavigate = useCallback((nextBlockId) => {
    if (nextBlockId) {
      setCurrentBlockId(nextBlockId);
      saveLessonProgress(nextBlockId, userTags, currentMediaIndex, chatHistory);
    }
  }, [userTags, saveLessonProgress, currentMediaIndex, chatHistory]);

  const handleChoice = useCallback((choice) => {
    const { next_block, tag } = choice;
    setPendingNavigation(next_block);
    setPageState('thinking');

    const runAnalysis = async () => {
      try {
        const optimisticTags = tag ? [...new Set([...userTags, tag])] : [...userTags];
        
        // Use main AI system with storytelling context for choice analysis
        const storyPrompt = `As Spacey, the AI mission specialist, analyze the Commander's choice and provide engaging feedback.

MISSION CONTEXT:
- Mission: "${lesson?.title}"
- Current Situation: "${currentBlock?.content}"
- Commander's Choice: "${choice.text}"
- Learning Goal: "${currentBlock?.learning_goal}"
- Commander's Traits: ${optimisticTags.join(', ')}

STORYTELLING ANALYSIS REQUIRED:
1. **Immediate Consequences**: What happens next because of this choice?
2. **Real Space Connection**: How does this relate to actual space missions?
3. **Character Development**: What does this choice reveal about the Commander?
4. **Mission Impact**: How does this affect the overall mission success?
5. **Learning Moment**: What key concept should the Commander take away?

Respond as if you're debriefing with the Commander after a critical mission decision. Use vivid space imagery and real mission examples. Keep it engaging but educational.

Format your response to include both immediate feedback and any trait analysis.`;

        const response = await handleUserChat(storyPrompt, currentUser);
        
        if (response?.message) {
          setLastAnalysis({ ai_message: response.message });
          setBackendAiMessage(response.message);
          setAnalysisLog(prevLog => [...prevLog, response.message]);
        }

        // Handle trait updates
        if (tag) {
            setUserTags(prevTags => {
            const updatedTags = [...new Set([...prevTags, tag])];
            saveLessonProgress(next_block || pendingNavigation, updatedTags, currentMediaIndex, chatHistory);
            
                // Update persistent traits
            const updatedPersistentTags = [...new Set([...persistentUserTags, ...updatedTags])];
                savePersistentUserTags(updatedPersistentTags);
                setPersistentUserTags(updatedPersistentTags);
            
            return updatedTags;
            });
          } else {
          saveLessonProgress(next_block || pendingNavigation, userTags, currentMediaIndex, chatHistory);
        }

        // Save choice to backend for tracking
        if (currentUser?.uid && lesson && currentBlock && currentBlock.block_id) {
          await saveChoice({
            userId: currentUser.uid,
            missionId: lesson.mission_id,
            blockId: currentBlock.block_id,
            choiceText: choice.text,
            tag: tag || null,
          });
        }
        
        setPageState('feedback');
      } catch (err) {
        console.error("Failed to analyze choice:", err);
        // Fallback to navigation without analysis
        handleNavigate(next_block);
        setPageState('idle');
        saveLessonProgress(next_block, userTags, currentMediaIndex, chatHistory);
      }
    };
    runAnalysis();
  }, [userTags, lesson, currentBlock, handleNavigate, pendingNavigation, saveLessonProgress, currentMediaIndex, persistentUserTags, savePersistentUserTags, chatHistory, currentUser, handleUserChat]);


  // When lesson is completed (e.g. in Debrief block or similar)
  const markLessonAsComplete = useCallback(async () => {
    console.log('🎉 Marking lesson as complete:', lesson?.mission_id);
    try {
      // Mark as completed with all params
      await saveLessonProgress(currentBlockId, userTags, currentMediaIndex, chatHistory, true);
      console.log('✅ Lesson progress saved as completed');
      
    // --- NEW: Save final summary to backend for mission completion ---
      if (currentUser?.uid && lesson) {
        await saveFinalSummary({
          userId: currentUser.uid,
        missionId: lesson.mission_id,
        summary: 'Mission completed', // You can pass a more detailed summary if available
      });
        console.log('✅ Final summary saved to backend');
    }
    // --- END NEW ---
    } catch (error) {
      console.error('❌ Error marking lesson as complete:', error);
    }
  }, [currentBlockId, userTags, currentMediaIndex, chatHistory, saveLessonProgress, currentUser?.uid, lesson]);


  const handleFeedbackComplete = useCallback(() => {
    setPageState('idle');
    handleNavigate(pendingNavigation);
    setPendingNavigation(null);
    setBackendAiMessage(null);
  }, [pendingNavigation, handleNavigate]);

  const getDynamicText = useCallback((dynamicContent) => {
    if (!dynamicContent) return null;
    let bestMatch = { score: -1, text: '' };
    const defaultItem = dynamicContent.find(item => !item.condition_tags || item.condition_tags.length === 0);

    dynamicContent.forEach(item => {
      if (!item.condition_tags || item.condition_tags.length === 0) return;
      const score = item.condition_tags.filter(tag => userTags.includes(tag)).length;
      if (score > bestMatch.score) {
        bestMatch = { score, text: item.text };
      }
    });
    return bestMatch.score >= 0 ? bestMatch.text : (defaultItem?.text || '');
  }, [userTags]);

  const handleReplay = useCallback(async () => {
    // Reset all lesson state
    setIsLoading(true);
    setError(null);
    setBackendAiMessage(null);
    setLastAnalysis(null);
    setPageState('idle');
    setPendingNavigation(null);
    setAnalysisLog([]);
    setCurrentMediaIndex(0);
    setChatHistory([]);
    setUserTags([]);
    setHasStarted(false);
    setIsDebuggerOpen(false);
    
    try {
      // Load fresh lesson data
      const lessonData = await fetchLessonData(lessonId);
      if (lessonData && lessonData.blocks && lessonData.blocks.length > 0) {
        setLesson(lessonData);
        setCurrentBlockId(lessonData.blocks[0].block_id);
        
        // Reset lesson progress in database but keep completion status
        if (currentUser?.uid) {
          const progressDocId = `${currentUser.uid}_${lessonId}`;
          const progressDocRef = doc(db, "lesson_progress", progressDocId);
          const docSnap = await getDoc(progressDocRef);
          
          let wasCompleted = false;
          if (docSnap.exists()) {
            wasCompleted = docSnap.data().completed || false;
          }
          
          // Reset progress but maintain completion status if it was completed
          await saveLessonProgress(
            lessonData.blocks[0].block_id, 
            [], 
            0, 
            [], 
            wasCompleted // Keep completion status
          );
        }
        
        // Load persistent tags
        await loadPersistentUserTags();
      } else {
        setError(`Mission "${lessonId}" not found or is invalid.`);
      }
    } catch (error) {
      console.error('Error during lesson replay:', error);
      setError('Failed to restart lesson');
    } finally {
      setIsLoading(false);
    }
  }, [lessonId, currentUser?.uid, saveLessonProgress, loadPersistentUserTags, fetchLessonData]);

  const handleJumpToBlock = useCallback((blockId) => {
    setPageState('idle');
    setCurrentBlockId(blockId);
  }, []);

  const renderLessonFlow = () => {
    switch (pageState) {
      case 'thinking':
        return (
          <div className="flex flex-col items-center justify-center gap-4 text-cyan-400/80 h-48 animate-fade-in">
            <Loader size={48} className="animate-spin" />
            <p className="font-mono">Analyzing your decision...</p>
          </div>
        );
      case 'feedback':
        return (
          <AiFeedback 
            message={backendAiMessage} 
            onContinue={handleFeedbackComplete} 
          />
        );
      case 'idle':
      default:
        if (!currentBlock) return null;
        const augmentedBlock = { ...currentBlock };
        if (
          !augmentedBlock.next_block &&
          (augmentedBlock.type === 'narration' || augmentedBlock.type === 'reflection' || augmentedBlock.type === 'quiz') &&
          currentBlockIndex < lesson.blocks.length - 1
        ) {
          augmentedBlock.next_block = lesson.blocks[currentBlockIndex + 1].block_id;
        }

        switch (augmentedBlock.type) {
          case 'narration':
            // Mark lesson as complete for final blocks
            if (augmentedBlock.block_id === "Debrief" || 
                augmentedBlock.block_id === "Mission Complete" || 
                !augmentedBlock.next_block) {
              console.log('🎯 Triggering lesson completion for block:', augmentedBlock.block_id);
              markLessonAsComplete();
            }
            return <NarrationBlock block={augmentedBlock} onNavigate={handleNavigate} getDynamicText={getDynamicText} userTags={userTags} />;
          case 'choice':
            return <ChoiceBlock block={currentBlock} onChoice={handleChoice} />;
          case 'reflection':
            return <ReflectionBlock block={augmentedBlock} onNavigate={handleNavigate} getDynamicText={getDynamicText} />;
          case 'quiz':
            return <QuizBlock block={augmentedBlock} onComplete={() => handleNavigate(augmentedBlock.next_block)} />;
          default:
            return <p>Unsupported block type: {currentBlock.type}</p>;
        }
    }
  };

  const startLesson = useCallback(() => {
    if (lesson && lesson.blocks && lesson.blocks.length > 0) {
      // Check if progress already exists
      const progressDocId = `${currentUser?.uid}_${lessonId}`;
      const progressDocRef = doc(db, "lesson_progress", progressDocId);

      getDoc(progressDocRef).then((docSnap) => {
        if (docSnap.exists()) {
          // Progress exists, load from saved data
          const data = docSnap.data();
          setCurrentBlockId(data.currentBlockId);
          setUserTags(data.userTags);
          setCurrentMediaIndex(data.currentMediaIndex || 0);
          setChatHistory(data.chatHistory || []);
        } else {
          // No progress, start from the first block
          setCurrentBlockId(lesson.blocks[0].block_id);
          saveLessonProgress(lesson.blocks[0].block_id, [], 0, [], false); // Save initial progress
        }
        setHasStarted(true); // Mark the lesson as started
      }).catch((error) => {
        console.error("Failed to check lesson progress:", error);
        // Handle error, maybe start from beginning as fallback
        setCurrentBlockId(lesson.blocks[0].block_id);
        saveLessonProgress(lesson.blocks[0].block_id, [], 0, [], false);
        setHasStarted(true);
      });
    }
  }, [lesson, currentUser?.uid, lessonId, saveLessonProgress]);

  const renderLessonContent = () => {
    if (isLoading || accessLoading) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 text-cyan-400/80 h-48">
          <Loader size={48} className="animate-spin" />
          <p className="font-mono">Loading Mission...</p>
        </div>
      );
    }

    if (!hasAccess) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 text-yellow-400/80 h-48 bg-yellow-900/20 p-8 rounded-lg border border-yellow-400/30">
          <AlertTriangle size={48} />
          <h3 className="text-xl font-bold text-yellow-300">Mission Locked</h3>
          <p className="font-mono text-center">{accessError}</p>
          <Link to="/dashboard" className="mt-4 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors">
            Return to Dashboard
          </Link>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 text-red-400/80 h-48 bg-red-900/20 p-8 rounded-lg">
          <AlertTriangle size={48} />
          <p className="font-mono text-center">{error}</p>
          <Link to="/dashboard" className="mt-4 text-cyan-300 hover:underline">Return to Dashboard</Link>
        </div>
      );
    }

    if (!hasStarted) {
      return (
        <div className="flex flex-col items-center justify-center  gap-6 h-96">
          <h2 className="text-2xl font-bold text-cyan-300">Get Ready for Your Mission:</h2>
          <p className="text-gray-300 font-mono text-center max-w-md">
            Click the button below to begin your learning adventure!
          </p>
          <button
            onClick={startLesson}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-br from-purple-600 to-cyan-600 text-white font-bold tracking-wider rounded-full shadow-lg hover:scale-105 transition-all duration-300"
          >
            <Play size={20} />
            Start Mission
          </button>
        </div>
      );
    }

    return (
      <>
        <div className="mb-8">
            <div className="flex justify-between items-center mb-2 font-mono text-sm text-cyan-300">
                <span>Mission Progress</span>
                <span>Block {currentBlockIndex + 1} of {lesson.total_blocks}</span>
            </div>
            <div className="w-full bg-black/30 rounded-full h-2.5">
                <div 
                    className="bg-gradient-to-r from-cyan-500 to-purple-500 h-2.5 rounded-full transition-all duration-500" 
                    style={{ width: `${((currentBlockIndex + 1) / lesson.total_blocks) * 100}%` }}
                ></div>
            </div>
        </div>
        <MediaDisplay media={currentBlock?.media} initialIndex={currentMediaIndex} onMediaChange={handleMediaChange}  />
        {renderLessonFlow()}
      </>
    );
  };


  const handleMediaChange = useCallback((index) => {
    setCurrentMediaIndex(index);
    saveLessonProgress(currentBlockId, userTags, index, chatHistory); // Save media index
  }, [currentBlockId, userTags, saveLessonProgress, chatHistory]);

  const lessonNavControls = (
    <div className="flex items-center gap-2">
      <button 
        onClick={() => setIsDebuggerOpen(true)}
        className="font-mono text-xs bg-purple-500/20 text-purple-300 px-3 py-1.5 rounded-md hover:bg-purple-500/40 transition-colors flex items-center gap-1.5"
      >
        Debug
      </button>
      <button 
        onClick={handleReplay}
        className="font-mono text-xs bg-red-500/20 text-red-300 px-3 py-1.5 rounded-md hover:bg-red-500/40 transition-colors flex items-center gap-1.5"
      >
        <RefreshCw size={12} />
        Replay from beginning
      </button>
    </div>
  );


  const handleChatToggle = () => {
    setIsChatOpen(prev => !prev);
  };

  const handleVoiceToggle = useCallback(() => {
    if (!isRecognitionSupported) {
      alert('Voice recognition is not supported in your browser');
      return;
    }

    if (isListening) {
      stopListening();
      setIsVoiceActive(false);
    } else {
      startListening();
      setIsVoiceActive(true);
    }
  }, [isListening, isRecognitionSupported, startListening, stopListening]);

  const handleSendMessage = useCallback(async (message) => {
    let newHistory = [...chatHistory, { sender: 'user', content: message }];
    setChatHistory(newHistory);
    saveLessonProgress(currentBlockId, userTags, currentMediaIndex, newHistory); // Save user message immediately

      try {
      // Use the main AI conversation manager with lesson context
      const enhancedPrompt = `${message}

[LESSON CONTEXT]
Mission: "${lesson?.title}"
Current Block: "${currentBlock?.content}"
Block Type: ${currentBlock?.type}
Learning Goal: ${currentBlock?.learning_goal}
User Traits: ${userTags.join(', ')}

As Spacey, the AI tutor for this space mission, provide storytelling explanations with:
- Real examples from space exploration
- Consequences and implications  
- Engaging narratives that connect to the lesson topic
- Clear, educational guidance
- Encouragement and curiosity-building

Respond as if you're right there with the user during their mission.`;

      // Route through main AI system instead of separate lesson controller
      const response = await handleUserChat(enhancedPrompt, currentUser);
      
      if (response?.message) {
        newHistory = [...newHistory, { sender: 'ai', content: response.message }];
          setChatHistory(newHistory);
        saveLessonProgress(currentBlockId, userTags, currentMediaIndex, newHistory);
        }

      } catch (error) {
        console.error("Failed to send chat message:", error);
      // Fallback response
      const fallbackResponse = "I'm having trouble connecting to my systems right now. Please try again in a moment.";
      newHistory = [...newHistory, { sender: 'ai', content: fallbackResponse }];
      setChatHistory(newHistory);
      saveLessonProgress(currentBlockId, userTags, currentMediaIndex, newHistory);
      }
  }, [chatHistory, lesson, currentBlock, userTags, saveLessonProgress, currentBlockId, currentMediaIndex, currentUser, handleUserChat]);


  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_left,_rgba(236,72,153,0.15),_transparent_50%),radial-gradient(ellipse_at_bottom_right,_rgba(0,139,139,0.1),_transparent_60%)]"></div>
      
      <Navbar 
        rightControls={
          !isLoading && !error ? (
            <div className="flex items-center gap-2">
              {lessonId && <LessonProgressIndicator lessonId={lessonId} />} {/* Render here */}
              {lessonNavControls}
            </div>
          ) : null
        }
      />
      
      <DebugPanel 
        isOpen={isDebuggerOpen}
        onClose={() => setIsDebuggerOpen(false)}
        lesson={lesson}
        onJump={handleJumpToBlock}
        currentBlockId={currentBlockId}
        lastAnalysis={lastAnalysis}
        userTags={userTags}
      />

      <main className="relative z-10 min-h-screen pt-20 pb-24 px-4 md:px-8">
        
        {/* Header Section with Back Button and Title */}
        <div className="w-full max-w-7xl mx-auto mb-8">
          {/* Back Button - positioned to avoid overlap */}
          <div className="mb-6">
          <Link to="/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={20} />
            Back to Dashboard
          </Link>
        </div>

          {/* Mission Title Header - centered */}
          {lesson && !isLoading && !accessLoading && hasAccess && (
            <div className="text-center">
              <h1 className="text-4xl lg:text-5xl font-bold text-cyan-300 mb-2 tracking-wide">
                  {lesson.title}
                </h1>
              <p className="text-gray-400 font-mono text-lg">
                  Mission ID: {lesson.mission_id}
                </p>
              </div>
            )}
        </div>

        {/* Main Content Area - using full width */}
        <div className="w-full max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8 min-h-[500px]">
            
            {/* Left Column: AI Avatar in Tutor Mode */}
            <div className="lg:col-span-1">
              <div className="relative w-full h-80 lg:h-[500px]">
                <AIAvatar
                  webcamRef={webcamRef}
                  userInfo={currentUser}
                  enablePersonalization={true}
                  mode="lesson"
                  lessonContext={lesson}
                  compact={false}
                  className="w-full h-full"
                />
              </div>
          </div>

            {/* Center Column: Lesson Content - taking more space */}
            <div className="lg:col-span-2">
            {renderLessonContent()}
          </div>

            {/* Right Column: Mission Monitor with Chat & Voice */}
            <div className="lg:col-span-1 space-y-4">
              {hasAccess && !isLoading && !accessLoading && (
                <>
                  <div className="w-full">
                    <h3 className="text-lg font-semibold text-cyan-300 mb-3 text-center">Mission Monitor</h3>
                    <div className="aspect-square w-full max-w-sm mx-auto lg:max-w-none">
                      <CameraFeed
                        ref={webcamRef}
                        onEmotionDetected={handleEmotionDetected}
                        enableEmotionDetection={true}
                        compact={true}
                        className="w-full h-full rounded-lg"
                      />
                    </div>
                  </div>
                  
                  {/* Chat & Voice Controls */}
                  <div className="w-full space-y-3">
                    <div className="flex gap-2">
                      <button
                        onClick={handleChatToggle}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${
                          isChatOpen 
                            ? 'bg-blue-500/30 text-blue-300 border border-blue-400/50' 
                            : 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
                        }`}
                      >
                        <MessageSquare size={16} />
                        Chat
                      </button>
                      <button
                        onClick={handleVoiceToggle}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${
                          isVoiceActive 
                            ? 'bg-red-500/30 text-red-300 border border-red-400/50 animate-pulse' 
                            : 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                        }`}
                        disabled={!isRecognitionSupported}
                        title={!isRecognitionSupported ? 'Voice recognition not supported' : ''}
                      >
                        {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                        {isListening ? 'Stop' : 'Voice'}
                      </button>
                    </div>
                    
                    {/* Voice Status */}
                    {isListening && (
                      <div className="bg-red-500/20 border border-red-400/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                          <span className="text-red-300 text-sm font-semibold">Listening...</span>
                        </div>
                        {transcript && (
                          <p className="text-white text-sm italic">"{transcript}"</p>
                        )}
                      </div>
                    )}
                    
                    {/* Integrated Chat Interface */}
                    {isChatOpen && (
                      <div className="bg-black/40 border border-gray-600/50 rounded-lg p-4 space-y-3">
                        <h4 className="text-cyan-300 font-semibold text-sm">Mission Chat</h4>
                        
                        {/* Chat History */}
                        <div className="max-h-48 overflow-y-auto space-y-2">
                          {chatHistory.length === 0 ? (
                            <p className="text-gray-400 text-sm italic">Ask me anything about the mission...</p>
                          ) : (
                            chatHistory.slice(-5).map((msg, index) => (
                              <div key={index} className={`text-sm p-2 rounded ${
                                msg.sender === 'user' 
                                  ? 'bg-blue-500/20 text-blue-200 ml-2' 
                                  : 'bg-gray-700/50 text-gray-200 mr-2'
                              }`}>
                                <span className="font-semibold text-xs opacity-70">
                                  {msg.sender === 'user' ? 'You' : 'Spacey'}:
                                </span>
                                <br />
                                {msg.content}
                              </div>
                            ))
                          )}
                        </div>
                        
                        {/* Chat Input */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Ask about the mission..."
                            className="flex-1 px-3 py-2 bg-gray-800/50 border border-gray-600/50 rounded text-white text-sm"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter' && e.target.value.trim()) {
                                handleSendMessage(e.target.value.trim());
                                e.target.value = '';
                              }
                            }}
                          />
                          <button
                            onClick={() => {
                              const input = event.target.previousElementSibling;
                              if (input.value.trim()) {
                                handleSendMessage(input.value.trim());
                                input.value = '';
                              }
                            }}
                            className="px-3 py-2 bg-cyan-600 text-white rounded text-sm hover:bg-cyan-700 transition-colors"
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      </main>
      
      {/* Remove the old ChatPanel component since we have integrated chat */}
      {/* <ChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        chatHistory={chatHistory}
        onSendMessage={handleSendMessage}
      /> */}

      {/* Log Button */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <button
          onClick={() => setIsLogOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-br from-purple-600 to-cyan-600 text-white font-bold tracking-wider rounded-full shadow-lg hover:scale-105 transition-all duration-300"
          aria-label="Open Mission Log"
        >
          <BookOpen size={20} />
          <span>LOG</span>
        </button>
      </div>

      <LogPanel
        isOpen={isLogOpen}
        onClose={() => setIsLogOpen(false)}
        logs={analysisLog}
      />
    </div>
  );
};

export default LessonPage;
