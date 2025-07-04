import axios from 'axios';
// You might need to import your firebase auth instance if you implement token-based auth
// import { auth } from '../firebaseConfig'; 

// Get the API base URL from environment variables with fallback
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Create an Axios instance with a base URL.
// This is good practice so you don't have to type the full URL everywhere.
const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/chat`,
  headers: {
    'Content-Type': 'application/json',
  }
});

/**
 * Sends a chat message to the AI backend.
 * 
 * @param {string} message - The user's message text.
 * @param {object} userInfo - An object containing user data (e.g., from Firebase Auth).
 * @returns {Promise<object>} The AI's response from the backend.
 */
export const sendChatMessageToAI = async (message, userInfo) => {
  try {
    // In a real application, you would get the user's auth token from Firebase
    // and include it in the headers for secure, authenticated requests.
    // Example:
    // const token = await auth.currentUser.getIdToken();
    // apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    console.log("🔗 API Base URL:", API_BASE_URL);
    console.log("📡 Full API URL:", `${API_BASE_URL}/api/chat/spacey`);
    console.log("📤 Sending to backend:", { message, userInfo });

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
      // For a conversational AI, you might also include chat history
      // history: chatHistory, 
    };

    // Make the POST request to the '/chat' endpoint
    const response = await apiClient.post('/spacey', payload);
    
    // Return the full response data
    return response.data;

  } catch (error) {
    console.error("Error calling AI backend:", error);
    console.error("Error details:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        baseURL: error.config?.baseURL
      }
    });
    // Re-throw a more specific error or return a default error message.
    throw new Error("Failed to get a response from the AI. Please try again.");
  }
};
