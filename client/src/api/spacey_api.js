import axios from 'axios';
// You might need to import your firebase auth instance if you implement token-based auth
// import { auth } from '../firebaseConfig'; 

// Get the API base URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Create an Axios instance with a base URL.
// This is good practice so you don't have to type the full URL everywhere.
const apiClient = axios.create({
  // IMPORTANT: This is a placeholder URL. Replace it with your actual backend endpoint later.
  baseURL: `${API_BASE_URL}/api/chat`, // e.g., 'http://localhost:5000/api' or 'https://your-production-url.com/api'
  headers: {
    'Content-Type': 'application/json',
  }
});

/**
 * Sends a chat message to the AI backend.
 * 
 * @param {string} message - The user's message text.
 * @param {object} userInfo - An object containing user data (e.g., from Firebase Auth).
 * @param {object} context - Enhanced context for the prompt engine (optional).
 * @returns {Promise<object>} The AI's response from the backend.
 */
export const sendChatMessageToAI = async (message, userInfo, context = null) => {
  try {
    // In a real application, you would get the user's auth token from Firebase
    // and include it in the headers for secure, authenticated requests.
    // Example:
    // const token = await auth.currentUser.getIdToken();
    // apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    console.log("Sending to backend:", { message, userInfo, context });

    // The payload sent to your backend API.
    // It includes the user's message and any relevant user context.
    const payload = {
      prompt: message,
      user: {
        id: userInfo?.uid || 'anonymous-user', // User's Firebase UID
        email: userInfo?.email || 'anonymous@example.com',
        // You can add any other user attributes you fetch from Firestore here
        // e.g., name: userInfo?.displayName
      },
      // Enhanced context for the prompt engine
      context: context,
      // For a conversational AI, you might also include chat history
      // history: chatHistory, 
    };

    // Make the POST request to the '/spacey' endpoint
    const response = await apiClient.post('/spacey', payload);
    
    // Return the full response data
    return response.data;

  } catch (error) {
    console.error("Error calling AI backend:", error);
    // Re-throw a more specific error or return a default error message.
    throw new Error("Failed to get a response from the AI. Please try again.");
  }
};

/**
 * Get player memory for a specific user
 * @param {string} playerId - The player's unique ID
 * @returns {Promise<object>} Player memory data
 */
export const getPlayerMemory = async (playerId) => {
  try {
    const response = await apiClient.get(`/player/${playerId}/memory`);
    return response.data;
  } catch (error) {
    console.error("Error fetching player memory:", error);
    throw new Error("Failed to load player memory.");
  }
};

/**
 * Update player traits
 * @param {string} playerId - The player's unique ID
 * @param {string} trait - The trait to add/remove
 * @param {string} action - 'add' or 'remove'
 * @param {string} reason - Reason for the change
 * @returns {Promise<object>} Updated player memory
 */
export const updatePlayerTrait = async (playerId, trait, action, reason = 'manual_update') => {
  try {
    const response = await apiClient.post(`/player/${playerId}/trait`, {
      trait,
      action,
      reason
    });
    return response.data;
  } catch (error) {
    console.error("Error updating player trait:", error);
    throw new Error("Failed to update player trait.");
  }
};

/**
 * Update player's current mission
 * @param {string} playerId - The player's unique ID
 * @param {string} missionId - The mission ID
 * @param {object} progress - Mission progress data
 * @returns {Promise<object>} Updated player memory
 */
export const updatePlayerMission = async (playerId, missionId, progress = {}) => {
  try {
    const response = await apiClient.post(`/player/${playerId}/mission`, {
      missionId,
      progress
    });
    return response.data;
  } catch (error) {
    console.error("Error updating player mission:", error);
    throw new Error("Failed to update player mission.");
  }
};
