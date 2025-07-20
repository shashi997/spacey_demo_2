// src/hooks/useAuth.js

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore'; // Import Firestore functions
import { auth, db } from '../firebaseConfig'; // Import db from firebaseConfig

export const useAuth = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null); // New state for user's Firestore data
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => { // Make the callback async
      setCurrentUser(user);
      if (user) {
        // If a user is logged in, fetch their data from Firestore
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            setUserData(userDocSnap.data());
          } else {
            // This case might happen if a user signs up but their Firestore doc isn't created yet
            // or if there's a mismatch. Log a warning.
            console.warn("User document not found in Firestore for UID:", user.uid);
            setUserData(null); // Ensure userData is null if doc doesn't exist
          }
        } catch (error) {
          console.error("Error fetching user data from Firestore:", error);
          setUserData(null); // Clear user data on error
        }
      } else {
        // If no user is logged in, clear both currentUser and userData
        setUserData(null);
      }
      setLoading(false); // Set loading to false once auth state and data fetch are complete
    });

    // Cleanup subscription on unmount
    return unsubscribe;
  }, []); // Empty dependency array means this effect runs once on mount

  // Return both currentUser and userData
  return { currentUser, userData, loading };
};