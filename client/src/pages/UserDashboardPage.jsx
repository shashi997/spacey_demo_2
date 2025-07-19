// src/pages/UserDashboardPage.jsx

import React, { useEffect, useState } from 'react';
import Navbar from '../components/ui/Navbar';
import { useAuthContext } from '../components/layout/AuthLayout';
import { db } from '../firebaseConfig';
import { collection, query, where, getDocs, documentId } from 'firebase/firestore';
import PlayerProfile from '../components/dashboard/PlayerProfile';
import axios from 'axios';

const UserDashboardPage = () => {
  const { currentUser, userData } = useAuthContext();
  const [traits, setTraits] = useState({});
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    const fetchTraitsAndMissions = async () => {
      if (currentUser) {
        try {
          console.log('Fetching traits for', currentUser.uid);
          const traitsRes = await axios.get(`/api/chat/profile/traits/${currentUser.uid}`);
          setTraits(traitsRes.data.traits || {});
          const missionsRes = await axios.get(`/api/chat/profile/missions/${currentUser.uid}`);
          setMissions(missionsRes.data.missions || []);
          setFetchError(null);
        } catch (error) {
          setTraits({});
          setMissions([]);
          setFetchError(error.message || 'Failed to fetch traits or missions');
          console.error('Error fetching traits or missions:', error);
        } finally {
          setLoading(false);
        }
      }
    };
    fetchTraitsAndMissions();
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-[#090a0f] text-white">
        <p>Please log in to view your dashboard.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full min-h-screen overflow-hidden bg-[radial-gradient(ellipse_at_bottom,_#1b2735_0%,_#090a0f_100%)] text-white flex flex-col items-center justify-center">
      <Navbar />
      <main className="flex flex-col items-center justify-start w-full min-h-[calc(100vh-64px)] pt-10 pb-8 px-2 sm:px-4">
        <div className="w-full max-w-lg mx-auto p-4 sm:p-8 space-y-6 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 text-center shadow-xl">
          <h1 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400">
            Welcome, {userData ? userData.name : currentUser.email}!
          </h1>
          <p className="text-base sm:text-lg text-gray-300">This is your personal Spacey profile dashboard.</p>

          {/* Player Profile Card */}
          <div className="flex justify-center my-6 sm:my-8">
            <PlayerProfile userId={currentUser.uid} traits={traits} missions={missions} loading={loading} />
          </div>

          {fetchError && (
            <div className="text-red-400 font-mono text-sm">Error loading traits: {fetchError}</div>
          )}

          {/* Optionally, keep other info below */}
          <div className="space-y-2 sm:space-y-4 text-left">
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

          <p className="text-gray-400 mt-2 sm:mt-4">More profile details and settings will be available here soon!</p>
        </div>
      </main>
    </div>
  );
};

export default UserDashboardPage;
