import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Rocket } from 'lucide-react';

const TRAIT_LABELS = [
  { key: 'cautious', label: 'Cautious', color: 'bg-cyan-400' },
  { key: 'bold', label: 'Bold', color: 'bg-yellow-400' },
  { key: 'creative', label: 'Creative', color: 'bg-purple-400' },
];

// Use a more visually appealing avatar placeholder
const AVATAR_URL = 'https://api.dicebear.com/7.x/adventurer/svg?seed=Spacey';

const StarryBg = () => (
  <svg className="absolute inset-0 w-full h-full z-0" style={{ pointerEvents: 'none' }}>
    <circle cx="30" cy="40" r="1.5" fill="#fff" opacity="0.7" />
    <circle cx="120" cy="80" r="1" fill="#fff" opacity="0.5" />
    <circle cx="200" cy="60" r="1.2" fill="#fff" opacity="0.6" />
    <circle cx="350" cy="120" r="1.7" fill="#fff" opacity="0.8" />
    <circle cx="400" cy="30" r="1.1" fill="#fff" opacity="0.4" />
    <circle cx="500" cy="100" r="1.3" fill="#fff" opacity="0.5" />
    <circle cx="600" cy="50" r="1.5" fill="#fff" opacity="0.7" />
    <circle cx="700" cy="90" r="1.2" fill="#fff" opacity="0.6" />
  </svg>
);

const PlayerProfile = ({ userId, traits = {}, missions = [], loading = false }) => {
  // Count completed missions
  const completedCount = missions.filter(m => m.completed_at).length;
  return (
    <div className="w-full max-w-md mx-auto rounded-2xl shadow-2xl border border-blue-200/30 p-5 text-white relative overflow-hidden bg-gradient-to-br from-[#23283a] to-[#181c24]" style={{minHeight:'350px'}}>
      <StarryBg />
      <div className="relative z-10 grid grid-cols-2 gap-5">
        {/* Left: Avatar, Quote, Mission History */}
        <div className="flex flex-col items-center">
          {/* Avatar with circular background and soft shadow */}
          <div className="relative mb-1 flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-blue-900 flex items-center justify-center border-4 border-blue-300 shadow-lg z-10">
              <img src={AVATAR_URL} alt="Avatar" className="w-16 h-16 rounded-full object-cover shadow-md" />
            </div>
            {/* Speech bubble quote, visually connected to avatar */}
            <div className="relative flex flex-col items-center mt-1">
              <div className="bg-[#23283a] text-gray-100 text-sm rounded-2xl px-4 py-2 shadow-xl border border-blue-300/30 font-semibold italic text-center max-w-xs">
                You think before you leap.<br />I like that.
              </div>
              {/* Pointer triangle */}
              <div style={{ width: 0, height: 0, borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '12px solid #23283a' }} className="mx-auto -mt-1"></div>
            </div>
          </div>
          {/* Mission History Placeholder */}
          <div className="w-full mt-10">
            <h3 className="text-base font-bold mb-1 tracking-wide text-blue-200">MISSION HISTORY</h3>
            <div className="space-y-2">
              <div className="text-xs text-gray-400">No missions completed yet.</div>
            </div>
          </div>
        </div>
        {/* Right: Traits */}
        <div className="flex flex-col justify-between h-full">
          <div>
            <h2 className="text-xl font-extrabold mb-2 tracking-wide text-white">PLAYER PROFILE</h2>
            <h3 className="text-base font-bold mb-2 tracking-wide text-blue-200">TRAITS</h3>
            <div className="space-y-3">
              {TRAIT_LABELS.map(({ key, label, color }) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-20 text-sm font-semibold font-mono text-gray-200">{label}</span>
                  <div className="flex-1 h-4 bg-gray-700 rounded-full overflow-hidden shadow-inner">
                    <div
                      className={`${color} h-4 rounded-full transition-all shadow-lg`}
                      style={{ width: `${Math.min((traits[key] || 0) * 33, 100)}%` }}
                    ></div>
                  </div>
                  <span className="ml-2 text-sm font-bold text-white drop-shadow-lg">{traits[key] || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Missions Completed Progress - moved to branding area */}
      {/* Branding with white circular background and shadow */}
      <div className="absolute bottom-3 right-3 flex flex-col items-center gap-2 opacity-95 z-10">
        <span className="font-extrabold tracking-widest text-base text-white mb-1">MISSIONS COMPLETED</span>
        <span className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-lg border border-blue-200 mb-1">
          <Rocket size={28} className="text-blue-500" />
        </span>
        <div className="flex gap-2 mb-1">
          {[...Array(5)].map((_, i) => (
            <span
              key={i}
              className={`w-5 h-5 rounded-full border-2 ${i < completedCount ? 'bg-blue-400 border-blue-400 shadow-lg' : 'bg-gray-800 border-gray-600'} transition-all`}
            ></span>
          ))}
        </div>
        <span className="font-extrabold tracking-widest text-lg text-white">SPACEY <span className="text-cyan-300">SCIENCE</span></span>
      </div>
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
          <span className="text-white text-lg font-bold">Loading...</span>
        </div>
      )}
    </div>
  );
};

export default PlayerProfile; 