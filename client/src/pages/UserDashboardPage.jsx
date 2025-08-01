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
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      console.log('🔍 Fetching data for user:', currentUser.uid);
      
      const [traitsRes, missionsRes] = await Promise.all([
        axios.get(`/api/chat/profile/traits/${currentUser.uid}`, {
          validateStatus: false
        }),
        axios.get(`/api/chat/profile/missions/${currentUser.uid}`, {
          validateStatus: false
        })
      ]);

      console.log('📊 Received traits:', traitsRes.data);
      console.log('🎯 Received missions:', missionsRes.data);

      if (traitsRes.status !== 200) {
        throw new Error(`Traits API returned ${traitsRes.status}: ${JSON.stringify(traitsRes.data)}`);
      }

      if (missionsRes.status !== 200) {
        throw new Error(`Missions API returned ${missionsRes.status}: ${JSON.stringify(missionsRes.data)}`);
      }

      // Make sure we're handling the correct data structure
      const traitsData = traitsRes.data.traits || {};
      const missionsData = missionsRes.data.missions || [];

      console.log('Processed traits data:', traitsData);
      console.log('Processed missions data:', missionsData);

      // Make sure we're handling the data structure correctly
      setTraits(traitsRes.data.traits || {});
      setMissions(missionsRes.data.missions || []);
      setFetchError(null);

    } catch (error) {
      console.error('❌ Error fetching profile data:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      setFetchError(
        `Failed to load profile: ${error.response?.data?.error || error.message}`);
        setTraits({});
        setMissions([]);
    } finally {
      setLoading(false);
    }
  };

  fetchTraitsAndMissions();
}, [currentUser?.uid]); 

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
            {loading ? (
              <div className="text-center p-4">
                <p className="text-cyan-400">Loading profile data...</p>
              </div>
            ) : (
            <PlayerProfile userId={currentUser?.uid} initialTraits={traits || {}} initialMissions={missions || []} loading={loading} error={fetchError} />
            )}
          </div>

          {fetchError && (
            <div className="text-red-400 font-mono text-sm">Error loading traits: {fetchError}</div>
          )}

          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 p-4 bg-gray-900/50 rounded-lg text-left w-full">
              <h3 className="text-cyan-400 font-mono mb-2">Debug Data:</h3>
              <div className="text-xs text-gray-400 font-mono">
                <p>Loading: {loading.toString()}</p>
                <p>Traits: {JSON.stringify(traits, null, 2)}</p>
                <p>Missions: {JSON.stringify(missions, null, 2)}</p>
                <p>Error: {fetchError || 'none'}</p>
              </div>
            </div>
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