// src/components/layout/AuthLayout.jsx

import React, { createContext, useContext } from 'react'; // Import createContext and useContext
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

// 1. Create a new Context for authentication and user data
const AuthContext = createContext(null);

// 2. Create a custom hook to easily consume the AuthContext
export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    // This error helps ensure the hook is used within the AuthLayout's provider
    throw new Error('useAuthContext must be used within an AuthLayout (AuthContext.Provider)');
  }
  return context;
};

const AuthLayout = () => {
  // Get both currentUser and userData from the enhanced useAuth hook
  const { currentUser, userData, loading } = useAuth();

  // While Firebase is checking the authentication state or fetching user data, show a loading indicator.
  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-[#090a0f]">
        <p className="text-white text-xl">Loading session...</p>
      </div>
    );
  }

  // If loading is finished and there is no user, redirect to the login page.
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // If a user is logged in, provide their data via context and render the child route component.
  return (
    // 3. Wrap the Outlet with the AuthContext.Provider
    <AuthContext.Provider value={{ currentUser, userData }}>
      <Outlet />
    </AuthContext.Provider>
  );
};

export default AuthLayout;