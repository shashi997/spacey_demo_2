import axios from 'axios';
// You might need to import your firebase auth instance if you implement token-based auth
// import { auth } from '../firebaseConfig'; 

// Get the API base URL from environment variables with fallback
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Create an Axios instance with a base URL.
const apiClient = axios.create({
  // baseURL: `${API_BASE_URL}/api/chat`,
  baseURL: '/api/chat',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000 // 1 minute
});

apiClient.interceptors.request.use(config => {
  console.log(`🌐 Making ${config.method.toUpperCase()} request to: ${config.url}`);
  return config;
})

/**
 * Sends a chat message or a contextual request to the AI backend.
 * This is the unified function for all interactions with the /spacey endpoint.
 *
 * @param {object} userInfo - An object containing user data (e.g., from Firebase Auth).
 * @param {object} options - Additional context and options for the request.
 * @param {string} [options.prompt=null] - The user's message. Required for chat, null for trigger-based responses.
 * @param {string} [options.type='unified_chat'] - The type of request ('unified_chat', 'avatar_response', 'personalized_compliment').
 * @param {string} [options.trigger=null] - The trigger for avatar responses ('idle', 'emotion_change', etc.).
 * @param {object} [options.visualContext=null] - Visual analysis data from the camera.
 * @param {object} [options.conversationContext=null] - Context from the conversation manager.
 * @returns {Promise<object>} The AI's response from the backend.
 */
export const sendAIRequest = async (userInfo, options = {}) => {
  try {
    console.log("📡 Sending unified AI request to backend:", { userInfo, options });

    const {
      prompt = null,
      type = 'unified_chat',
      trigger = null,
      visualContext = null,
      conversationContext = null,
    } = options;

    // The payload sent to your backend API.
    const payload = {
      prompt,
      type,
      trigger,
      user: {
        id: userInfo?.uid || 'anonymous-user',
        email: userInfo?.email || 'anonymous@example.com',
        name: userInfo?.displayName || 'Explorer',
      },
      visualContext,
      // Context for unified conversation management
      conversationHistory: conversationContext?.conversationHistory || [],
      emotionContext: conversationContext?.emotionContext || null,
      userActivity: conversationContext?.userActivity || 'active',
      currentTopic: conversationContext?.currentTopic || null,
      userMood: conversationContext?.userMood || 'neutral',
      timeSinceLastInteraction: conversationContext?.timeSinceLastInteraction || 0,
    };
    
    // Backend expects `visualAnalysis` for compliments, not `visualContext`
    if (type === 'personalized_compliment') {
      payload.visualAnalysis = visualContext;
      delete payload.visualContext;
    }

    const response = await apiClient.post('/spacey', payload);
    return response.data;

  } catch (error) {
    console.error("Error calling unified AI backend:", error);
    console.error("Error details:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });

    // Fallback for trigger-based responses to prevent UI silence
    if (options.type === 'avatar_response' && options.trigger) {
        const fallbackResponses = {
            emotion_change: "I can see something's shifted - how are you feeling about this?",
            idle: "Ready to explore the cosmos together?",
            encouragement: "You're doing fantastic! Your curiosity is stellar!"
        };
        return {
            response: fallbackResponses[options.trigger] || fallbackResponses.idle,
            type: 'fallback_avatar_response'
        };
    }
    
    if (options.type === 'personalized_compliment') {
        return {
            response: "You're doing great! Keep up that stellar enthusiasm!",
            type: 'fallback_compliment'
        };
    }

    // For chat, re-throw a more specific error.
    throw new Error("Failed to get a response from the AI. Please try again.");
  }
};

/**
 * Fetch user personality traits from the backend
 * 
 * @param {string} userId - User ID
 * @returns {Promise<object>} User personality traits
 */
export const fetchUserTraits = async (userId) => {
  try {
    console.log("🧠 Fetching user traits for:", userId);

    const response = await apiClient.get(`/profile/traits/${userId}`);
    return {
      cautious: response.data.traits?.cautious || 0,
      bold: response.data.traits?.bold || 0,
      creative: response.data.traits?.creative || 0,
    }

  } catch (error) {
    console.error("Error fetching user traits:", error);
    // Return default traits if fetch fails
    return {
      cautious: 0,
      bold: 0,
      creative: 0
    };
  }
};

export const getMissionHistory = async (userId) => {
  try {
    const response = await apiClient.get(`/profile/missions/${userId}`);
    return response.data.missions.map(mission => ({
      ...mission,
      completed_at: mission.completed_at || null,
      traits_demonstrated: mission.traits_demonstrated || []
    })); 
  } catch (error) {
    console.error("Error fetching mission history:", error);
    return [];
  }
};

/**
 * Get conversation summary and context for personalized responses
 * 
 * @param {string} userId - User ID  
 * @param {number} limit - Number of recent interactions to include
 * @returns {Promise<object>} Conversation context
 */
export const getConversationContext = async (userId, limit = 5) => {
  try {
    console.log("💭 Fetching conversation context for:", userId);

    const response = await apiClient.get(`/context/${userId}?limit=${limit}`);
    return response.data;

  } catch (error) {
    console.error("Error fetching conversation context:", error);
    return {
      summary: "New user - no previous interactions.",
      recentTopics: [],
      emotionalState: { emotion: 'neutral', confidence: 0.5 },
      learningStyle: 'unknown'
    };
  }
};