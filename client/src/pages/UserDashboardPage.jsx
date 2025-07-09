// src/pages/UserDashboardPage.jsx

import React, { useEffect, useState } from 'react';
import Navbar from '../components/ui/Navbar';
import { useAuthContext } from '../components/layout/AuthLayout';
import { db } from '../firebaseConfig';
import { collection, query, where, getDocs, documentId } from 'firebase/firestore';
import PlayerProfile from '../components/dashboard/PlayerProfile';

const UserDashboardPage = () => {
  const { currentUser, userData } = useAuthContext();
  const [lessonProgress, setLessonProgress] = useState([]);
  const [userTraits, setUserTraits] = useState([]); // New state for user traits

  useEffect(() => {
    const fetchLessonProgress = async () => {
      if (currentUser) {
        try {
          const progressRef = collection(db, "lesson_progress");
          const q = query(
            progressRef,
            where(documentId(), ">=", `${currentUser.uid}_`),
            where(documentId(), "<=", `${currentUser.uid}_\uf8ff`)
          );
          const querySnapshot = await getDocs(q);
          const progressData = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          }));
          setLessonProgress(progressData);

          // Aggregate user traits from all lessons
          const allTraits = progressData.reduce((acc, curr) => {
            return [...acc, ...(curr.userTags || [])];
          }, []);
          // Remove duplicates (if any) using Set
          setUserTraits([...new Set(allTraits)]);

        } catch (error) {
          console.error("Error fetching lesson progress:", error);
        }
      }
    };

    fetchLessonProgress();
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-[#090a0f] text-white">
        <p>Please log in to view your dashboard.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[radial-gradient(ellipse_at_bottom,_#1b2735_0%,_#090a0f_100%)] text-white">
      <Navbar />
      <main className="pt-20 flex flex-col items-center justify-center h-full px-4">
        <div className="w-full max-w-2xl p-8 space-y-6 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 text-center">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400">
            Welcome, {userData ? userData.name : currentUser.email}!
          </h1>
          <p className="text-lg text-gray-300">This is your personal Spacey profile dashboard.</p>

          {/* Player Profile Card */}
          <div className="flex justify-center my-8">
            <PlayerProfile userId={currentUser.uid} />
          </div>

          {/* Optionally, keep other info below */}
          <div className="space-y-4 text-left">
            <p className="text-md"><strong>Email:</strong> {currentUser.email}</p>
            {userData && (
              <>
                <p className="text-md"><strong>Name:</strong> {userData.name}</p>
                {userData.createdAt && (
                  <p className="text-md"><strong>Member Since:</strong> {new Date(userData.createdAt.seconds * 1000).toLocaleDateString()}</p>
                )}
              </>
            )}
          </div>

          <p className="text-gray-400 mt-4">More profile details and settings will be available here soon!</p>
        </div>
      </main>
    </div>
  );
};

export default UserDashboardPage;
