class ConversationMemory {
  constructor() {
    // In-memory storage for demo purposes (in production, use Redis/database)
    this.conversations = new Map(); // userId -> array of interactions
    this.maxMemorySize = 10; // Keep last 10 interactions per user
  }

  addInteraction(userId, userMessage, aiResponse, metadata = {}) {
    if (!this.conversations.has(userId)) {
      this.conversations.set(userId, []);
    }

    const interaction = {
      timestamp: new Date().toISOString(),
      userMessage,
      aiResponse,
      metadata, // Can include traits, emotions, etc.
    };

    const userHistory = this.conversations.get(userId);
    userHistory.push(interaction);

    // Keep only the most recent interactions
    if (userHistory.length > this.maxMemorySize) {
      userHistory.shift();
    }

    this.conversations.set(userId, userHistory);
  }

  getRecentInteractions(userId, count = 5) {
    const userHistory = this.conversations.get(userId) || [];
    return userHistory.slice(-count); // Get last 'count' interactions
  }

  summarizeContext(userId) {
    const recent = this.getRecentInteractions(userId, 5);
    if (recent.length === 0) {
      return "New user - no previous interactions.";
    }

    // Analyze conversation patterns
    const topics = [];
    const emotions = [];
    const userPatterns = [];

    recent.forEach(interaction => {
      const msg = interaction.userMessage.toLowerCase();
      
      // Extract topics
      if (msg.includes('mars') || msg.includes('planet')) topics.push('planetary science');
      if (msg.includes('black hole') || msg.includes('space')) topics.push('astrophysics');
      if (msg.includes('study') || msg.includes('learn')) topics.push('learning focused');
      if (msg.includes('help') || msg.includes('stuck')) topics.push('needs assistance');
      
      // Extract emotional patterns
      if (msg.includes('confused') || msg.includes('stuck') || msg.includes('?')) emotions.push('confused');
      if (msg.includes('exciting') || msg.includes('amazing') || msg.includes('!')) emotions.push('excited');
      if (msg.includes('yes') || msg.includes('ready')) emotions.push('engaged');
      
      // Extract user patterns
      if (msg.length < 10) userPatterns.push('brief responses');
      if (msg.includes('teach me') || msg.includes('explain')) userPatterns.push('wants detailed explanations');
    });

    // Build context summary
    let summary = `Recent ${recent.length} interactions. `;
    
    if (topics.length > 0) {
      const uniqueTopics = [...new Set(topics)];
      summary += `Topics: ${uniqueTopics.join(', ')}. `;
    }
    
    if (emotions.length > 0) {
      const dominantEmotion = emotions[emotions.length - 1]; // Most recent emotion
      summary += `User seems ${dominantEmotion}. `;
    }
    
    if (userPatterns.length > 0) {
      const uniquePatterns = [...new Set(userPatterns)];
      summary += `Communication style: ${uniquePatterns.join(', ')}.`;
    }

    return summary;
  }

  detectEmotionalState(userId, currentMessage) {
    const recent = this.getRecentInteractions(userId, 3);
    const msg = currentMessage.toLowerCase();
    
    // Analyze current message for emotional cues
    let emotion = 'neutral';
    let confidence = 0.5;

    // Frustration indicators
    if (msg.includes('stuck') || msg.includes('confused') || msg.includes('help') || 
        msg.includes("don't understand") || msg.includes('why')) {
      emotion = 'frustrated';
      confidence = 0.8;
    }
    
    // Excitement indicators  
    else if (msg.includes('amazing') || msg.includes('exciting') || msg.includes('wow') ||
             msg.includes('cool') || msg.match(/!{2,}/)) {
      emotion = 'excited';
      confidence = 0.9;
    }
    
    // Engagement indicators
    else if (msg.includes('yes') || msg.includes('ready') || msg.includes('more') ||
             msg.includes('teach me') || msg.includes('tell me')) {
      emotion = 'engaged';
      confidence = 0.7;
    }
    
    // Uncertainty indicators
    else if (msg.includes('maybe') || msg.includes('not sure') || msg.includes('think') ||
             msg.match(/\?{2,}/)) {
      emotion = 'uncertain';
      confidence = 0.6;
    }

    // Consider conversation history for context
    if (recent.length > 0) {
      const lastInteraction = recent[recent.length - 1];
      if (lastInteraction.userMessage.includes('help') && msg.length < 10) {
        emotion = 'still_confused';
        confidence = 0.8;
      }
    }

    return { emotion, confidence };
  }

  getUserLearningStyle(userId) {
    const recent = this.getRecentInteractions(userId, 8);
    if (recent.length < 3) return 'unknown';

    let detailSeeker = 0;
    let quickLearner = 0;
    let visualLearner = 0;

    recent.forEach(interaction => {
      const msg = interaction.userMessage.toLowerCase();
      
      if (msg.includes('explain') || msg.includes('how') || msg.includes('why') || 
          msg.includes('detail') || msg.includes('more about')) {
        detailSeeker++;
      }
      
      if (msg.length < 15 && (msg.includes('yes') || msg.includes('ok') || msg.includes('got it'))) {
        quickLearner++;
      }
      
      if (msg.includes('show') || msg.includes('picture') || msg.includes('example') ||
          msg.includes('diagram')) {
        visualLearner++;
      }
    });

    if (detailSeeker >= quickLearner && detailSeeker >= visualLearner) return 'detail_seeker';
    if (quickLearner >= detailSeeker && quickLearner >= visualLearner) return 'quick_learner';
    if (visualLearner > 0) return 'visual_learner';
    
    return 'balanced';
  }
}

// Create global instance
const conversationMemory = new ConversationMemory();

module.exports = {
  ConversationMemory,
  conversationMemory
}; 