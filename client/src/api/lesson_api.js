// e:\Spacey-Intern\spacey_first_demo\spacey_demo_2\client\src\api\lesson_api.js

import axios from 'axios';

// Get the API base URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const API_ENDPOINT = `${API_BASE_URL}/api/chat/interact`;

/**
 * Sends user interaction data to the backend for analysis.
 *
 * @param {object} payload - The data to send to the backend.
 * @returns {Promise<object>} A promise that resolves with the backend's analysis.
 */

export const analyzeInteraction = async (payload) => {
  console.log("🚀 Sending interaction data to backend:", payload);

  try {
    // Use axios to make a POST request to the backend endpoint
    const response = await axios.post(API_ENDPOINT, payload);

    console.log("✅ Received analysis from backend:", response.data);
    
    // Return the data from the backend response
    return response.data;

  } catch (error) {
    // Log a more detailed error message for debugging
    console.error(
      "API call to analyze interaction failed:", 
      error.response ? error.response.data : error.message
    );

    // Return a user-friendly error message so the UI can display it gracefully
    return {
      ai_message: "There was a problem communicating with Spacey's core systems. Please try again.",
      error: true,
    };
  }
};
