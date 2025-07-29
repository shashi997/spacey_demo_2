// src/utils/lessonProgression.js

import { db } from '../firebaseConfig';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

// Define the order in which lessons should be completed
export const LESSON_ORDER = [
  'mars_energy',
  'build-satellite', 
  'spaghettification',
  'space-exploration-news',
  'zero-gravity'
];

// Lesson metadata for display purposes
export const LESSON_METADATA = {
  'mars_energy': {
    id: 'mars_energy',
    title: 'Mars Energy Dilemma',
    description: 'Manage a critical energy crisis on Mars Base Ares-X',
    difficulty: 'Beginner',
    estimatedTime: '15-18 min',
    unlockRequirement: null // First lesson, always unlocked
  },
  'build-satellite': {
    id: 'build-satellite',
    title: 'Build Your Own Satellite',
    description: 'Design and construct a functional satellite for space missions',
    difficulty: 'Intermediate', 
    estimatedTime: '20-25 min',
    unlockRequirement: 'mars_energy'
  },
  'spaghettification': {
    id: 'spaghettification', 
    title: 'Spaghettification',
    description: 'Explore the extreme physics near black holes',
    difficulty: 'Advanced',
    estimatedTime: '18-22 min',
    unlockRequirement: 'build-satellite'
  },
  'space-exploration-news': {
    id: 'space-exploration-news',
    title: "What's new in Space Exploration",
    description: 'Discover cutting-edge developments in space technology',
    difficulty: 'Intermediate',
    estimatedTime: '16-20 min', 
    unlockRequirement: 'spaghettification'
  },
  'zero-gravity': {
    id: 'zero-gravity',
    title: 'Zero Gravity',
    description: 'Experience life and work in weightless environments',
    difficulty: 'Advanced',
    estimatedTime: '22-28 min',
    unlockRequirement: 'space-exploration-news'
  }
};

/**
 * Check if a user has completed a specific lesson
 * @param {string} userId - The user's ID
 * @param {string} lessonId - The lesson to check
 * @returns {Promise<boolean>} Whether the lesson is completed
 */
export const isLessonCompleted = async (userId, lessonId) => {
  if (!userId || !lessonId) return false;
  
  try {
    const progressDocId = `${userId}_${lessonId}`;
    const progressDocRef = doc(db, "lesson_progress", progressDocId);
    const docSnap = await getDoc(progressDocRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const isCompleted = Boolean(data.completed);
      console.log(`📋 Checking completion for ${lessonId}:`, isCompleted, data);
      return isCompleted;
    }
    
    return false;
  } catch (error) {
    console.error(`Error checking lesson completion for ${lessonId}:`, error);
    return false;
  }
};

/**
 * Check if a user has access to a specific lesson based on progression
 * @param {string} userId - The user's ID
 * @param {string} lessonId - The lesson to check access for
 * @returns {Promise<{hasAccess: boolean, reason?: string}>} Access status and reason
 */
export const hasLessonAccess = async (userId, lessonId) => {
  if (!userId || !lessonId) {
    return { hasAccess: false, reason: 'Invalid user or lesson ID' };
  }
  
  // Check if lesson exists in our system
  if (!LESSON_METADATA[lessonId]) {
    return { hasAccess: false, reason: 'Lesson not found' };
  }
  
  const lessonMeta = LESSON_METADATA[lessonId];
  
  // First lesson is always accessible
  if (!lessonMeta.unlockRequirement) {
    return { hasAccess: true };
  }
  
  try {
    // Check if the prerequisite lesson is completed
    const prerequisiteCompleted = await isLessonCompleted(userId, lessonMeta.unlockRequirement);
    
    if (prerequisiteCompleted) {
      return { hasAccess: true };
    } else {
      const prerequisiteMeta = LESSON_METADATA[lessonMeta.unlockRequirement];
      return { 
        hasAccess: false, 
        reason: `Complete "${prerequisiteMeta?.title || lessonMeta.unlockRequirement}" first` 
      };
    }
  } catch (error) {
    console.error(`Error checking lesson access for ${lessonId}:`, error);
    return { hasAccess: false, reason: 'Error checking prerequisites' };
  }
};

/**
 * Get all lessons with their access status for a user
 * @param {string} userId - The user's ID
 * @returns {Promise<Array>} Array of lessons with access status
 */
export const getAllLessonsWithAccess = async (userId) => {
  if (!userId) return [];
  
  try {
    const lessonsWithAccess = await Promise.all(
      LESSON_ORDER.map(async (lessonId) => {
        const [accessResult, isCompleted] = await Promise.all([
          hasLessonAccess(userId, lessonId),
          isLessonCompleted(userId, lessonId)
        ]);
        
        return {
          ...LESSON_METADATA[lessonId],
          hasAccess: accessResult.hasAccess,
          accessReason: accessResult.reason,
          isCompleted,
          isLocked: !accessResult.hasAccess
        };
      })
    );
    
    return lessonsWithAccess;
  } catch (error) {
    console.error('Error getting lessons with access:', error);
    return [];
  }
};

/**
 * Get the next lesson a user should take
 * @param {string} userId - The user's ID
 * @returns {Promise<string|null>} The next lesson ID or null if all completed
 */
export const getNextLesson = async (userId) => {
  if (!userId) return null;
  
  try {
    for (const lessonId of LESSON_ORDER) {
      const isCompleted = await isLessonCompleted(userId, lessonId);
      if (!isCompleted) {
        const accessResult = await hasLessonAccess(userId, lessonId);
        if (accessResult.hasAccess) {
          return lessonId;
        }
      }
    }
    return null; // All lessons completed
  } catch (error) {
    console.error('Error getting next lesson:', error);
    return null;
  }
};

/**
 * Get user's overall progress percentage
 * @param {string} userId - The user's ID
 * @returns {Promise<number>} Progress percentage (0-100)
 */
export const getUserProgressPercentage = async (userId) => {
  if (!userId) return 0;
  
  try {
    const completedCount = await Promise.all(
      LESSON_ORDER.map(lessonId => isLessonCompleted(userId, lessonId))
    ).then(results => results.filter(Boolean).length);
    
    return Math.round((completedCount / LESSON_ORDER.length) * 100);
  } catch (error) {
    console.error('Error getting user progress:', error);
    return 0;
  }
};

/**
 * Get lesson index in the progression order
 * @param {string} lessonId - The lesson ID
 * @returns {number} Index in LESSON_ORDER or -1 if not found
 */
export const getLessonIndex = (lessonId) => {
  return LESSON_ORDER.indexOf(lessonId);
};

/**
 * Check if lesson progression is properly configured
 * @returns {boolean} Whether all lessons have proper metadata
 */
export const validateLessonProgression = () => {
  // Check that all lessons in order have metadata
  const hasAllMetadata = LESSON_ORDER.every(lessonId => 
    LESSON_METADATA[lessonId]
  );
  
  // Check that unlock requirements form a valid chain
  const hasValidChain = LESSON_ORDER.every((lessonId, index) => {
    const meta = LESSON_METADATA[lessonId];
    if (index === 0) {
      return !meta.unlockRequirement; // First lesson should have no requirement
    } else {
      return meta.unlockRequirement === LESSON_ORDER[index - 1]; // Should require previous lesson
    }
  });
  
  return hasAllMetadata && hasValidChain;
}; 