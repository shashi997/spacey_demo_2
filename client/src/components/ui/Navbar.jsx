import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowRight, UserCircle } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { useAuth } from '../../hooks/useAuth';
import { auth } from '../../firebaseConfig';

const Navbar = ({ extraControls, rightControls }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, loading } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null); // Ref for the dropdown

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const closeDropdown = () => {
    setIsDropdownOpen(false);
  };

  const isDashboard = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/profile');
  const navBackgroundStyle = (!currentUser || !isDashboard) 
    ? "bg-black/20 backdrop-blur-sm border-b border-white/10" 
    : "";

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        closeDropdown();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  return (
    <nav className="fixed top-0 left-0 w-full z-50 transition-all duration-300">
      <div className={`w-full flex justify-between items-center py-3 px-4 md:px-8 lg:px-12 ${navBackgroundStyle}`}>
        {/* --- Left Side --- */}
        <div className="flex items-center gap-4">
          {/* Spacey link */}
          <Link 
            to="/" 
            className={`text-2xl font-bold tracking-wider transition-colors px-1 ${location.pathname === '/' ? 'text-cyan-300' : 'text-white hover:text-gray-300'}`}
          >
            Spacey
          </Link>
          {/* Dashboard link */}
          {/* {currentUser && (
            <Link 
              to="/dashboard" 
              className={`text-lg font-semibold tracking-wide transition-colors px-1 ${location.pathname.startsWith('/dashboard') ? 'text-cyan-300' : 'text-white hover:text-gray-300'}`}
            >
              Dashboard
            </Link>
          )} */}
          {extraControls}
        </div>

        {/* --- Right Side --- */}
        <div className="flex items-center gap-4">
          {/* Render custom controls for the right side */}
          {rightControls}

          {(!loading && currentUser) ? (
            <div className="relative group" ref={dropdownRef}> {/* Add ref here */}
              <button 
                className="p-1 rounded-full hover:bg-white/10 transition-colors"
                onClick={toggleDropdown}
              >
                <UserCircle size={32} className="text-white" />
              </button>

              {/* Dropdown menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-gray-900/80 backdrop-blur-md border border-gray-700 rounded-lg shadow-lg">
                  <div className="px-4 py-3 border-b border-gray-700">
                    <p className="text-sm text-gray-400">Signed in as</p>
                    <p className="text-sm font-medium text-white truncate">{currentUser.email}</p>
                  </div>
                  <div className="py-1">
                    <Link 
                      to="/profile" 
                      className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800/80"
                      onClick={closeDropdown}
                    >
                      Profile
                    </Link>
                    <button 
                      onClick={() => { handleLogout(); closeDropdown(); }}
                      className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-800/80"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
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
