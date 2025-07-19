// e:\Spacey-Intern\spacey_second_demo\spacey_demo_2\client\src\pages\LessonPage.jsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader, AlertTriangle, RefreshCw, BookOpen } from 'lucide-react';

// API Service
import { analyzeInteraction, saveChoice, saveFinalSummary } from '../api/lesson_api';

// Components
import Navbar from '../components/ui/Navbar';
import NarrationBlock from '../components/lesson/NarrationBlock';
import ChoiceBlock from '../components/lesson/ChoiceBlock';
import ReflectionBlock from '../components/lesson/ReflectionBlock';
import QuizBlock from '../components/lesson/QuizBlock';
import CharacterModel from '../components/lesson/CharacterModel';
import DebugPanel from '../components/debug/DebugPanel';
import AiFeedback from '../components/lesson/AiFeedback';
import LogPanel from '../components/lesson/LogPanel';
import MediaDisplay from '../components/lesson/MediaDisplay';
import LessonProgressIndicator from '../components/lesson/LessonProgressIndicator'; // Import LessonProgressIndicator
// Hooks
import useAudio from '../hooks/useAudio';

import { db, auth } from '../firebaseConfig';  // Import Firebase services
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth'; // Listen for auth changes


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
  
  const [lesson, setLesson] = useState(null);
  const [currentBlockId, setCurrentBlockId] = useState(null);
  const [userTags, setUserTags] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDebuggerOpen, setIsDebuggerOpen] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState(null);
  const [userId, setUserId] = useState(null);
  const [persistentUserTags, setPersistentUserTags] = useState([]); // For global traits
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);  // For media progress


  // --- STATE FOR UI FLOW & LOGS ---
  const [pageState, setPageState] = useState('idle'); 
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [backendAiMessage, setBackendAiMessage] = useState(null);
  const [analysisLog, setAnalysisLog] = useState([]);
  const [isLogOpen, setIsLogOpen] = useState(false);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
      }
    });
    return () => unsubscribe();  // Cleanup on unmount
  }, []);

  useEffect(() => {
    if (lessonId && userId) {
      loadLessonProgress();
      loadPersistentUserTags();
    } else if (lessonId && !userId) {  // Only load from scratch if no user is logged in
    loadLesson();
  }
  }, [lessonId, userId]);

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
      } else {
        setError(`Mission "${lessonId}" not found or is invalid.`);
      }
      setIsLoading(false);
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
      const progressDocId = `${userId}_${lessonId}`;
      const progressDocRef = doc(db, "lesson_progress", progressDocId);
      const docSnap = await getDoc(progressDocRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setCurrentBlockId(data.currentBlockId);
        setUserTags(data.userTags);
        // You might also want to handle loading 'completed' status here.
        setCurrentMediaIndex(data.currentMediaIndex || 0); // Load media index
        setLesson(await fetchLessonData(lessonId)); // Load lesson data after progress
      } else {
        // If no progress exists, load the lesson and start from the beginning.
        const lessonData = await fetchLessonData(lessonId);
        if (lessonData && lessonData.blocks && lessonData.blocks.length > 0) {
          setLesson(lessonData);
          setCurrentBlockId(lessonData.blocks[0].block_id);
          setUserTags([]);
          setCurrentMediaIndex(0);
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



  const saveLessonProgress = async (blockId, tags, mediaIndex = 0, completed = false) => {
    if (!userId || !lessonId || blockId === null || blockId === undefined) {
      console.warn("[saveLessonProgress] Not saving progress: blockId is null or undefined", { userId, lessonId, blockId, tags });
      return; // Ensure user, lesson, and blockId are valid
    }

    try {
      const progressDocId = `${userId}_${lessonId}`;
      const progressDocRef = doc(db, "lesson_progress", progressDocId);
      await setDoc(
        progressDocRef,
        {
          currentBlockId: blockId,
          userTags: tags,
          currentMediaIndex: mediaIndex, // Save media index
          completed: completed,
          lastUpdated: Timestamp.now(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Failed to save lesson progress:", error);
    }
  };

  const loadPersistentUserTags = async () => {
    if (!userId) return;
    try {
      const userDocRef = doc(db, "user_traits", userId); // Separate collection
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
    if (!userId) return;
    try {
      const userDocRef = doc(db, "user_traits", userId);
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
      saveLessonProgress(nextBlockId, userTags, currentMediaIndex);
    }
  }, [userTags, saveLessonProgress, currentMediaIndex]);

  const handleChoice = useCallback((choice) => {
    const { next_block, tag } = choice;
    setPendingNavigation(next_block);
    setPageState('thinking');

    const runAnalysis = async () => {
      try {
        const optimisticTags = tag ? [...new Set([...userTags, tag])] : [...userTags];
        const payload = {
          lessonData: lesson,
          currentBlock: currentBlock,
          userResponse: choice,
          userTags: optimisticTags,
        };
        const response = await analyzeInteraction(payload);
        setLastAnalysis(response);
        setBackendAiMessage(response.ai_message);
        if (response.ai_message && !response.error) {
          setAnalysisLog(prevLog => [...prevLog, response.ai_message]);
        }
        if (response.added_traits || response.removed_traits) {
            setUserTags(prevTags => {
                const withAdded = [...new Set([...prevTags, ...(response.added_traits || [])])];
                const withRemoved = withAdded.filter(t => !(response.removed_traits || []).includes(t));
                if (currentBlock.next_block || pendingNavigation) {
                  saveLessonProgress(currentBlock.next_block || pendingNavigation, withRemoved, currentMediaIndex);
                } else {
                  console.warn('[handleChoice] Not saving progress: next_block is null', { currentBlock, pendingNavigation });
                }
                // Update persistent traits
                const updatedPersistentTags = [...new Set([...persistentUserTags, ...withAdded])].filter(t => !response.removed_traits?.includes(t));
                savePersistentUserTags(updatedPersistentTags);
                setPersistentUserTags(updatedPersistentTags);
                return withRemoved;
            });
        }
        else {
          if (currentBlock.next_block || pendingNavigation) {
            saveLessonProgress(currentBlock.next_block || pendingNavigation, userTags, currentMediaIndex);
          } else {
            console.warn('[handleChoice] Not saving progress: next_block is null', { currentBlock, pendingNavigation });
          }
        }
        // --- NEW: Save choice to backend for trait tracking ---
        if (userId && lesson && currentBlock && currentBlock.block_id) {
          await saveChoice({
            userId,
            missionId: lesson.mission_id,
            blockId: currentBlock.block_id,
            choiceText: choice.text,
            tag: tag || null,
          });
        } else {
          console.warn('[handleChoice] Not saving choice: missing userId, lesson, or currentBlock.block_id', { userId, lesson, currentBlock });
        }
        // --- END NEW ---
        setPageState('feedback');
      } catch (err) {
        console.error("Failed to analyze interaction:", err);
        handleNavigate(next_block);
        setPageState('idle');
        if (next_block) {
          saveLessonProgress(next_block, userTags);
        } else {
          console.warn('[handleChoice] Not saving progress on error: next_block is null', { next_block });
        }
      }
    };
    runAnalysis();
  }, [userTags, lesson, currentBlock, handleNavigate, pendingNavigation, saveLessonProgress, currentMediaIndex, persistentUserTags, savePersistentUserTags, userId]);

  // When lesson is completed (e.g. in Debrief block or similar)
  const markLessonAsComplete = useCallback(() => {
    saveLessonProgress(currentBlockId, userTags, true); // Mark as completed.
    // --- NEW: Save final summary to backend for mission completion ---
    if (userId && lesson) {
      saveFinalSummary({
        userId,
        missionId: lesson.mission_id,
        summary: 'Mission completed', // You can pass a more detailed summary if available
      });
    }
    // --- END NEW ---
  }, [currentBlockId, userTags, saveLessonProgress, userId, lesson]);


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

  const handleReplay = useCallback(() => {
    loadLesson();
    loadPersistentUserTags().then(() => { // Ensure persistent tags are loaded first
      setUserTags(persistentUserTags); // Apply persistent traits to current lesson
    });
    setIsDebuggerOpen(false);
  }, [loadLesson, loadPersistentUserTags, persistentUserTags, setUserTags]);

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
            if (augmentedBlock.block_id === "Debrief") {
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

  const renderLessonContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 text-cyan-400/80 h-48">
          <Loader size={48} className="animate-spin" />
          <p className="font-mono">Loading Mission...</p>
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
    saveLessonProgress(currentBlockId, userTags, index); // Save media index
  }, [currentBlockId, userTags, saveLessonProgress]);

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

      <main className="relative z-10 flex items-start justify-center min-h-screen pt-24 pb-12 px-4 md:px-8">
        <div className="absolute top-24 left-8 z-20">
          <Link to="/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={20} />
            Back to Dashboard
          </Link>
        </div>

        <div className="flex flex-col md:flex-row items-start w-full max-w-screen-xl mx-auto gap-8">
          
          <div className="relative w-full md:w-2/5 h-80 md:h-[600px] top-24">
            {lesson && !isLoading && (
              <div className="absolute top-0 left-0 right-0 z-10 p-4 text-center md:text-left">
                <h1 className="text-3xl md:text-4xl font-bold text-cyan-300 mb-2 tracking-wide">
                  {lesson.title}
                </h1>
                <p className="text-gray-400 font-mono">
                  Mission ID: {lesson.mission_id}
                </p>
              </div>
            )}
            <CharacterModel />
          </div>

          <div className="w-full md:w-3/5">
            {renderLessonContent()}
          </div>

        </div>
      </main>

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
