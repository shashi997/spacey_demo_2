import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowRight, UserCircle, Menu } from 'lucide-react'; // Added Menu icon
import { signOut } from 'firebase/auth';
import { useAuth } from '../../hooks/useAuth';
import { auth } from '../../firebaseConfig';

const Navbar = ({ extraControls, rightControls }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, loading } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // State for mobile menu
  const dropdownRef = useRef(null);

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

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const isDashboard = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/profile');
  const navBackgroundStyle = (!currentUser || !isDashboard)
    ? "bg-gradient-to-b from-gray-900 to-transparent backdrop-blur-sm border-b border-white/10" // Gradient background
    : "";

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
      <div className={`w-full flex justify-between items-center py-4 px-6 md:px-8 lg:px-12 ${navBackgroundStyle}`}> {/* Increased padding */}
        {/* Left Side - Fancy Logo & Links */}
        <div className="flex items-center gap-6"> {/* Increased gap */}
          {/* Spacey Logo (you can replace this with an actual logo) */}
          <Link
            to="/"
            className="text-3xl font-extrabold tracking-wide text-white hover:text-cyan-300 transition-colors" // Enhanced text styles
          >
            🌌 Spacey {/* Example text logo */}
          </Link>
           {/* Dashboard link */}
          {currentUser && (
            <Link 
              to="/dashboard" 
              className={`text-lg font-semibold tracking-wide transition-colors px-1 ${location.pathname.startsWith('/dashboard') ? 'text-cyan-300' : 'text-white hover:text-gray-300'}`}
            >
              Dashboard
            </Link>
          )}
          {/* Main Navigation Links (hide on small screens) */}
          <div className="hidden md:flex items-center space-x-6"> {/* Use space-x-6 for spacing */}
            {extraControls}
          </div>
        </div>

        {/* Right Side - User Actions & Mobile Toggle */}
        <div className="flex items-center gap-4">
          {rightControls}

          {(!loading && currentUser) ? (
            <div className="relative group" ref={dropdownRef}>
              <button
                className="p-2 rounded-full hover:bg-white/10 transition-colors focus:outline-none" // Added focus outline
                onClick={toggleDropdown}
              >
                <UserCircle size={36} className="text-white" /> {/* Slightly larger icon */}
              </button>

              {/* Enhanced Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-3 w-64 bg-gray-900/90 backdrop-blur-md border border-gray-700 rounded-xl shadow-xl"> {/* Rounded corners, shadow */}
                  <div className="px-5 py-4 border-b border-gray-700">
                    <p className="text-sm text-gray-400">Signed in as</p>
                    <p className="text-sm font-medium text-white truncate">{currentUser.email}</p>
                  </div>
                  <div className="py-2">
                    <Link
                      to="/profile"
                      className="block w-full text-left px-5 py-3 text-sm text-gray-300 hover:bg-gray-800/80 transition-colors" // Added transition
                      onClick={closeDropdown}
                    >
                      Profile
                    </Link>
                    <button
                      onClick={() => { handleLogout(); closeDropdown(); }}
                      className="block w-full text-left px-5 py-3 text-sm text-red-400 hover:bg-gray-800/80 transition-colors" // Added transition
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3"> {/* Adjusted gap */}
              <button onClick={() => navigate('/login')} className="text-white font-medium px-5 py-2 rounded-full hover:bg-white/10 transition-colors text-sm md:text-base"> {/* Increased padding */}
                Log In
              </button>
              <button onClick={() => navigate('/signup')} className="bg-white text-black font-medium px-5 py-2 rounded-full flex items-center gap-2 hover:bg-gray-200 transition-colors text-sm md:text-base"> {/* Increased padding */}
                <span>Sign Up</span>
                <ArrowRight size={18} /> {/* Slightly larger icon */}
              </button>
            </div>
          )}

          {/* Mobile Menu Toggle (show on small screens) */}
          <div className="md:hidden">
            <button
              onClick={toggleMobileMenu}
              className="p-2 rounded-md hover:bg-white/10 transition-colors focus:outline-none"
            >
              <Menu size={28} className="text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu (full-screen overlay) */}
      {isMobileMenuOpen && (
        <div className="fixed top-0 left-0 w-full h-full bg-gray-900/95 backdrop-blur-lg z-50 flex flex-col items-center justify-center">
          <button
            onClick={closeMobileMenu}
            className="absolute top-6 right-6 p-2 rounded-md hover:bg-white/10 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex flex-col items-center space-y-8">
            <Link to="/" className="text-3xl font-bold text-white hover:text-cyan-300 transition-colors" onClick={closeMobileMenu}>Spacey</Link>
            {/* Add mobile navigation links here */}
            {/* Example: */}
            {/* <Link to="/about" className="text-2xl text-white hover:text-gray-300 transition-colors" onClick={closeMobileMenu}>About</Link>
            <Link to="/features" className="text-2xl text-white hover:text-gray-300 transition-colors" onClick={closeMobileMenu}>Features</Link> */}
            {extraControls && React.Children.map(extraControls, (child) => (
              React.cloneElement(child, { className: `${child.props.className} text-2xl text-white hover:text-gray-300 transition-colors`, onClick: closeMobileMenu })
            ))}
            {(!loading && currentUser) && (
              <>
                <Link to="/profile" className="text-2xl text-white hover:text-gray-300 transition-colors" onClick={closeMobileMenu}>Profile</Link>
                <button onClick={() => { handleLogout(); closeMobileMenu(); }} className="text-2xl text-red-400 hover:text-gray-300 transition-colors">Logout</button>
              </>
            )}
            {(!loading && !currentUser) && (
              <>
                <button onClick={() => { navigate('/login'); closeMobileMenu(); }} className="text-2xl text-white hover:text-gray-300 transition-colors">Log In</button>
                <button onClick={() => { navigate('/signup'); closeMobileMenu(); }} className="text-2xl text-white hover:text-gray-300 transition-colors">Sign Up</button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
