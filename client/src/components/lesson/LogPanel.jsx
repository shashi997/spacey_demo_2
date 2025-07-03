// e:\Spacey-Intern\spacey_first_demo\spacey_demo_2\client\src\components\lesson\LogPanel.jsx

import React from 'react';
import { X, BookOpen } from 'lucide-react';

const LogPanel = ({ isOpen, onClose, logs }) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]" 
        onClick={onClose}
      ></div>
      
      {/* Modal Panel */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
        <div className="w-full max-w-2xl h-[70vh] bg-gray-900 border border-cyan-500/30 rounded-lg shadow-2xl flex flex-col animate-fade-in">
          <header className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-3">
              <BookOpen className="text-cyan-400" />
              <h3 className="text-xl font-bold text-cyan-300">Mission Log</h3>
            </div>
            <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-white/10 hover:text-white">
              <X size={24} />
            </button>
          </header>
          <main className="p-6 flex-grow overflow-y-auto space-y-5">
            {logs && logs.length > 0 ? (
              logs.map((log, index) => (
                <div key={index} className="p-3 border-l-2 border-gray-600 hover:border-cyan-500 transition-colors">
                  <p className="text-sm text-gray-500 font-mono mb-1">Log Entry #{index + 1}</p>
                  <p className="text-gray-200 italic">"{log}"</p>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>No log entries recorded yet.</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
};

export default LogPanel;
