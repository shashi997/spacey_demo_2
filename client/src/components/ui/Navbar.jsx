import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowRight, UserCircle } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { useAuth } from '../../hooks/useAuth';
import { auth } from '../../firebaseConfig';

const Navbar = ({ extraControls, rightControls }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
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

              {/* Fixed dropdown with better hover behavior */}
              <div className="absolute right-0 top-full mt-1 w-56 bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-200 invisible group-hover:visible transform translate-y-2 group-hover:translate-y-0 pointer-events-none group-hover:pointer-events-auto">
                {/* Arrow pointer */}
                <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-900 border-l border-t border-gray-700 transform rotate-45"></div>
                
                <div className="px-4 py-3 border-b border-gray-700">
                  <p className="text-sm text-gray-400">Signed in as</p>
                  <p className="text-sm font-medium text-white truncate">{currentUser.email}</p>
                </div>
                <div className="py-1">
                  <Link 
                    to="/profile" 
                    className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800/80 transition-colors"
                  >
                    <UserCircle size={16} />
                    Profile
                  </Link>
                  <button 
                    onClick={handleLogout} 
                    className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-800/80 transition-colors"
                  >
                    <ArrowRight size={16} />
                    Logout
                  </button>
                </div>
              </div> b36fce8 (Commit-By-Ramesh)
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
