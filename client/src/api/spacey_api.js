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
 * Sends a chat message to the AI backend with enhanced context support.
 * 
 * @param {string} message - The user's message text.
 * @param {object} userInfo - An object containing user data (e.g., from Firebase Auth).
 * @param {object} options - Additional context and options for enhanced responses.
 * @returns {Promise<object>} The AI's response from the backend.
 */
export const sendChatMessageToAI = async (message, userInfo, options = {}) => {
  try {
    // In a real application, you would get the user's auth token from Firebase
    // and include it in the headers for secure, authenticated requests.
    // Example:
    // const token = await auth.currentUser.getIdToken();
    // apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    console.log("🔗 API Base URL:", API_BASE_URL);
    console.log("📡 Full API URL:", `${API_BASE_URL}/api/chat/spacey`);
    console.log("📤 Sending to backend:", { message, userInfo, options });

    const { 
      conversationContext = null, 
      includeEmotionContext = false,
      responseType = 'standard_chat'
    } = options;

    // The payload sent to your backend API with enhanced context.
    const payload = {
      prompt: message,
      type: responseType,
      user: {
        id: userInfo?.uid || 'anonymous-user', // User's Firebase UID
        email: userInfo?.email || 'anonymous@example.com',
        name: userInfo?.displayName || 'Explorer'
      },
      // Enhanced context for unified conversation management
      conversationHistory: conversationContext?.conversationHistory || [],
      emotionContext: includeEmotionContext ? conversationContext?.emotionContext : null,
      userActivity: conversationContext?.userActivity || 'active',
      currentTopic: conversationContext?.currentTopic || null,
      userMood: conversationContext?.userMood || 'neutral',
      timeSinceLastInteraction: conversationContext?.timeSinceLastInteraction || 0,
    };

    // Make the POST request to the '/spacey' endpoint
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

/**
 * Generate a personalized compliment/response based on visual analysis and user traits
 * 
 * @param {object} visualData - Object containing emotion analysis data
 * @param {object} userInfo - User information
 * @returns {Promise<object>} Personalized compliment response
 */
export const generatePersonalizedCompliment = async (visualData, userInfo) => {
  try {
    console.log("🎭 Generating personalized compliment:", { visualData, userInfo });

    const payload = {
      type: 'personalized_compliment',
      visualAnalysis: visualData,
      user: {
        id: userInfo?.uid || 'anonymous-user',
        email: userInfo?.email || 'anonymous@example.com',
        name: userInfo?.displayName || 'Explorer'
      }
    };

    const response = await apiClient.post('/spacey', payload);
    return response.data;

  } catch (error) {
    console.error("Error generating personalized compliment:", error);
    // Return a fallback compliment
    return {
      response: "You're doing great! Keep up that stellar enthusiasm!",
      type: 'fallback_compliment'
    };
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

    const response = await apiClient.get(`/traits/${userId}`);
    return response.data;

  } catch (error) {
    console.error("Error fetching user traits:", error);
    // Return default traits if fetch fails
    return {
      traits: ['curious', 'science_minded'],
      confidence: 0.3,
      source: 'default'
    };
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

/**
 * Enhanced chat message that includes visual analysis context
 * 
 * @param {string} message - The user's message text
 * @param {object} userInfo - User information
 * @param {object} visualContext - Visual analysis data from camera
 * @returns {Promise<object>} Enhanced AI response
 */
export const sendEnhancedChatMessage = async (message, userInfo, visualContext = null) => {
  try {
    console.log("🚀 Sending enhanced chat message with visual context");

    const payload = {
      prompt: message,
      user: {
        id: userInfo?.uid || 'anonymous-user',
        email: userInfo?.email || 'anonymous@example.com',
        name: userInfo?.displayName || 'Explorer'
      },
      visualContext: visualContext ? {
        emotionalState: visualContext.emotionalState,
        visualDescription: visualContext.visualDescription,
        faceDetected: visualContext.faceDetected,
        timestamp: visualContext.timestamp,
        confidence: visualContext.confidence
      } : null,
      type: 'enhanced_chat'
    };

    const response = await apiClient.post('/spacey', payload);
    return response.data;

  } catch (error) {
    console.error("Error sending enhanced chat message:", error);
    // Fallback to regular chat
    return sendChatMessageToAI(message, userInfo);
  }
};

/**
 * Generate contextual avatar responses based on user state
 * 
 * @param {object} userInfo - User information
 * @param {object} visualContext - Current visual analysis
 * @param {string} trigger - What triggered the avatar response ('emotion_change', 'idle', 'encouragement')
 * @returns {Promise<object>} Avatar response
 */
export const generateAvatarResponse = async (userInfo, visualContext, trigger = 'idle') => {
  try {
    console.log("🤖 Generating avatar response for trigger:", trigger);

    const payload = {
      type: 'avatar_response',
      trigger,
      user: {
        id: userInfo?.uid || 'anonymous-user',
        email: userInfo?.email || 'anonymous@example.com',
        name: userInfo?.displayName || 'Explorer'
      },
      visualContext: visualContext ? {
        emotionalState: visualContext.emotionalState,
        visualDescription: visualContext.visualDescription,
        faceDetected: visualContext.faceDetected,
        confidence: visualContext.confidence
      } : null
    };

    const response = await apiClient.post('/spacey', payload);
    return response.data;

  } catch (error) {
    console.error("Error generating avatar response:", error);
    
    // Fallback responses based on trigger type
    const fallbackResponses = {
      emotion_change: "I can see something's shifted - how are you feeling about this?",
      idle: "Ready to explore the cosmos together?",
      encouragement: "You're doing fantastic! Your curiosity is stellar!"
    };

    return {
      response: fallbackResponses[trigger] || fallbackResponses.idle,
      type: 'fallback_avatar_response'
    };
  }
};
