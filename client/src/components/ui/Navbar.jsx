// e:\Spacey-Intern\spacey_first_demo\spacey_demo_2\client\src\components\ui\Navbar.jsx

import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowRight, UserCircle } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { useAuth } from '../../hooks/useAuth';
import { auth } from '../../firebaseConfig';

const Navbar = ({ extraControls, rightControls }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  const isDashboard = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/profile');
  const navBackgroundStyle = (!currentUser || !isDashboard) 
    ? "bg-black/20 backdrop-blur-sm border-b border-white/10" 
    : "";

  return (
    <nav className="fixed top-0 left-0 w-full z-50 transition-all duration-300">
      <div className={`w-full flex justify-between items-center py-3 px-4 md:px-8 lg:px-12 ${navBackgroundStyle}`}>
        {/* --- Left Side --- */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')} 
            className="text-2xl font-bold text-white tracking-wider hover:text-gray-300 transition-colors"
          >
            Spacey
          </button>
          {extraControls}
        </div>

        {/* --- Right Side --- */}
        <div className="flex items-center gap-4">
          {/* Render custom controls for the right side */}
          {rightControls}

          {currentUser ? (
            <div className="relative group">
              <button className="p-1 rounded-full hover:bg-white/10 transition-colors">
                <UserCircle size={32} className="text-white" />
              </button>
              <div className="absolute right-0 mt-2 w-56 bg-gray-900/80 backdrop-blur-md border border-gray-700 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-all invisible group-hover:visible pointer-events-none group-hover:pointer-events-auto">
                <div className="px-4 py-3 border-b border-gray-700">
                  <p className="text-sm text-gray-400">Signed in as</p>
                  <p className="text-sm font-medium text-white truncate">{currentUser.email}</p>
                </div>
                <div className="py-1">
                  <Link to="/profile" className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800/80">Profile</Link>
                  <button onClick={handleLogout} className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-800/80">
                    Logout
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => navigate('/login')} className="text-white font-medium px-4 py-2 rounded-full hover:bg-white/10 transition-colors text-sm md:text-base">
                Log In
              </button>
              <button onClick={() => navigate('/signup')} className="bg-white text-black font-medium px-4 py-2 rounded-full flex items-center gap-2 hover:bg-gray-200 transition-colors text-sm md:text-base">
                <span>Sign Up</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
