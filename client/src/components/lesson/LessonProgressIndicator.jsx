import React, { useState, useEffect } from 'react';
import { db, auth } from '../../firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';

const LessonProgressIndicator = ({ lessonId }) => {
  const [lessonProgress, setLessonProgress] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (currentUser && lessonId) {
      const progressDocId = `${currentUser.uid}_${lessonId}`;  // Generate combined ID
      const progressDocRef = doc(db, "lesson_progress", progressDocId);
      const unsubscribeFirestore = onSnapshot(progressDocRef, (docSnap) => {
        if (docSnap.exists()) {
          setLessonProgress(docSnap.data());
        } else {
          setLessonProgress(null);
        }
      });
      return () => unsubscribeFirestore();
    } else {
      setLessonProgress(null);
    }
  }, [currentUser, lessonId]);

  if (!lessonProgress) {
    return null; // Or a placeholder like "...Loading"
  }

  return (
    <div className="ml-4">
      {lessonProgress.completed ? (
        <span className="text-green-400 font-mono text-xs">Mission Complete!</span>
      ) : (
        <span className="text-yellow-300 font-mono text-xs">
          Current Block: {lessonProgress.currentBlockId}
        </span>
      )}
    </div>
  );
};

export default LessonProgressIndicator;
