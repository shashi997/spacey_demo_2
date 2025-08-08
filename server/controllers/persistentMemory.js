const fs = require('fs').promises;
const path = require('path');
const { knowledgeGraphManager } = require('./knowledgeGraphManager');

class PersistentMemoryManager {
  constructor(dataDir = './data/memory') {
    this.dataDir = dataDir;
    this.userProfilesDir = path.join(dataDir, 'profiles');
    this.conversationsDir = path.join(dataDir, 'conversations');
    this.analyticsDir = path.join(dataDir, 'analytics');
    
    // Memory cache for performance
    this.userProfiles = new Map(); // userId -> profile data
    this.sessionCache = new Map(); // userId -> recent interactions
    
    // Configuration
    this.maxSessionInteractions = 20; // Keep more in session
    this.maxStoredInteractions = 500; // Store much more long-term
    this.profileUpdateInterval = 5; // Update profile every 5 interactions
    
    this.ensureDirectories();

    //Initialize immediatedly
    this.init();
  }

  async init() {
    await this.ensureDirectories();
    console.log('🚀 Persistent Memory System initialized')
    return true;
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.mkdir(this.userProfilesDir, { recursive: true });
      await fs.mkdir(this.conversationsDir, { recursive: true });
      await fs.mkdir(this.analyticsDir, { recursive: true });
      console.log('📁 Memory directories created/verified');
    } catch (error) {
      console.error('❌ Error creating memory directories:', error);
    }
  }

  // === USER PROFILE MANAGEMENT ===

  async getUserProfile(userId) {
    // Check cache first
    if (this.userProfiles.has(userId)) {
      return this.userProfiles.get(userId);
    }

    // Load from disk
    try {
      const profilePath = path.join(this.userProfilesDir, `${userId}.json`);
      const data = await fs.readFile(profilePath, 'utf8');
      const profile = JSON.parse(data);
      
      // Update cache
      this.userProfiles.set(userId, profile);
      return profile;
    } catch (error) {
      // Create new profile if doesn't exist
      if (error.code === 'ENOENT') {
        const newProfile = this.createNewUserProfile(userId);
        // Initialize the knowledge graph for the new user
        newProfile.knowledgeGraph = knowledgeGraphManager.initializeGraph(userId);
        await this.saveUserProfile(userId, newProfile);
        return newProfile;
      }
      console.error(`❌ Error loading profile for ${userId}:`, error);
      return this.createNewUserProfile(userId);
    }
  }

  createNewUserProfile(userId) {
    return {
      userId,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      
      // Interaction statistics
      stats: {
        totalInteractions: 0,
        totalSessions: 0,
        averageSessionLength: 0,
        lastSessionStart: null,
        currentSessionInteractions: 0
      },

      // Learning analytics
      learning: {
        preferredStyle: 'unknown', // detail_seeker, quick_learner, visual_learner, balanced
        comprehensionLevel: 'beginner', // beginner, intermediate, advanced
        engagementPattern: 'neutral', // high, medium, low
        preferredTopics: [], // topics they engage with most
        strugglingTopics: [], // topics they ask for help with
        masteredConcepts: [] // concepts they demonstrate understanding of
      },

      // Emotional patterns
      emotional: {
        dominantMood: 'neutral',
        moodHistory: [], // last 10 mood assessments
        frustrationsTriggered: [], // what makes them frustrated
        excitementTriggers: [], // what excites them
        supportNeeds: [] // when they typically need encouragement
      },

      // Communication patterns
      communication: {
        averageMessageLength: 0,
        vocabularyLevel: 'standard',
        questionTypes: [], // what kinds of questions they ask
        responseSpeed: 'normal', // quick, normal, slow
        preferredExplanationDepth: 'medium' // brief, medium, detailed
      },

      // Topic interests and knowledge
      topics: {
        interests: {}, // topic -> interest score (0-1)
        knowledge: {}, // topic -> knowledge level (0-1)
        recentTopics: [], // last 20 topics discussed
        topicProgression: [] // how their knowledge has grown
      },

      // Session management
      sessions: {
        currentSessionId: null,
        recentSessions: [] // last 10 session summaries
      },

      // Visual profile data
      visual: {
        age: null,
        gender: null,
        lastUpdated: null
      },

      // --- NEW: Knowledge Graph ---
      knowledgeGraph: null, // Will be initialized on first use

      // --- NEW: Missions and Traits ---
      missions_completed: [], // Array of { mission_id, completed_at, choices, final_summary }
      traits: {}, // { cautious: 2, bold: 1, creative: 0, ... }
    };
  }

  async saveUserProfile(userId, profile) {
    try {
      profile.lastActive = new Date().toISOString();
      
      // Update cache
      this.userProfiles.set(userId, profile);
      
      // Save to disk
      const profilePath = path.join(this.userProfilesDir, `${userId}.json`);
      await fs.writeFile(profilePath, JSON.stringify(profile, null, 2), 'utf8');
      
      console.log(`💾 Profile saved for user ${userId}`);
    } catch (error) {
      console.error(`❌ Error saving profile for ${userId}:`, error);
    }
  }

  async getUserMissions(userId) {
    try {
      const profile = await this.getUserProfile(userId);
      return profile.missions_completed.map(mission => ({
        id: mission.mission_id,
        name: `Mission ${mission.mission_id}`,
        completed_at: mission.completed_at,
        score: this.calculateMissionScore(mission),
        traits_demonstrated: mission.traits_demonstrated || [],
        final_summary: mission.final_summary || null
      }));
    } catch (error) {
      console.error('Error in getUserMissions:', error);
      return [];
    }
  }
  
  calculateMissionScore(mission) {
    let score = 0;
    if (mission.completed_at) score += 50;
    if (mission.choices?.length) score += mission.choices.length * 10;
    if (mission.traits_demonstrated?.length) score += mission.traits_demonstrated.length * 5;
    return Math.min(score, 100);
  }
  async getUserTraits(userId) {
    try {
      const profile = await this.getUserProfile(userId);
      return {
        cautious: profile.traits?.cautious || 0,
        bold: profile.traits?.bold || 0,
        creative: profile.traits?.creative || 0,
        confidence: profile.traits?.confidence || 0,
        lastUpdated: profile.traits?.lastUpdated || new Date().toISOString()
      };
    } catch (error) {
      console.error('Error in getUserTraits:', error);
      return null;
    }
  }
  // === CONVERSATION MANAGEMENT ===

  async addInteraction(userId, userMessage, aiResponse, metadata = {}) {
    try {
      const interaction = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        userMessage,
        aiResponse,
        metadata: {
          ...metadata,
          messageLength: userMessage.length,
          responseLength: aiResponse.length,
          emotionalState: metadata.emotionalState || 'neutral',
          learningStyle: metadata.learningStyle || 'unknown',
          topicsDetected: this.extractTopics(userMessage),
          sessionId: await this.getCurrentSessionId(userId)
        }
      };

      // Add to session cache
      if (!this.sessionCache.has(userId)) {
        this.sessionCache.set(userId, []);
      }
      const userCache = this.sessionCache.get(userId);
      userCache.push(interaction);

      // Maintain cache size
      if (userCache.length > this.maxSessionInteractions) {
        userCache.shift();
      }

      // Save to persistent storage
      await this.saveInteractionToDisk(userId, interaction);

      // Update user profile with analytics
      await this.updateUserAnalytics(userId, interaction);

      console.log(`💬 Interaction saved for user ${userId}`);
      return interaction;

    } catch (error) {
      console.error(`❌ Error saving interaction for ${userId}:`, error);
    }
  }

  async saveInteractionToDisk(userId, interaction) {
    try {
      const conversationFile = path.join(this.conversationsDir, `${userId}.json`);
      
      let conversations = [];
      try {
        const data = await fs.readFile(conversationFile, 'utf8');
        conversations = JSON.parse(data);
      } catch (error) {
        // File doesn't exist, start with empty array
        if (error.code !== 'ENOENT') {
          console.error('Error reading conversation file:', error);
        }
      }

      conversations.push(interaction);

      // Maintain storage limit
      if (conversations.length > this.maxStoredInteractions) {
        conversations.splice(0, conversations.length - this.maxStoredInteractions);
      }

      await fs.writeFile(conversationFile, JSON.stringify(conversations, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving interaction to disk:', error);
    }
  }

  async getRecentInteractions(userId, count = 10) {
    // First check session cache
    const cachedInteractions = this.sessionCache.get(userId) || [];
    
    if (cachedInteractions.length >= count) {
      return cachedInteractions.slice(-count);
    }

    // Load more from disk if needed
    try {
      const conversationFile = path.join(this.conversationsDir, `${userId}.json`);
      const data = await fs.readFile(conversationFile, 'utf8');
      const allInteractions = JSON.parse(data);
      
      // Combine with cache and return recent
      const combined = [...allInteractions, ...cachedInteractions];
      return combined.slice(-count);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error loading interactions:', error);
      }
      return cachedInteractions;
    }
  }

  // === ANALYTICS & PROFILE UPDATES ===

  async updateUserAnalytics(userId, interaction) {
    try {
      const profile = await this.getUserProfile(userId);
      
      // Update basic stats
      profile.stats.totalInteractions++;
      profile.stats.currentSessionInteractions++;
      
      // Update communication patterns
      this.updateCommunicationPatterns(profile, interaction);
      
      // Update emotional patterns
      this.updateEmotionalPatterns(profile, interaction);
      
      // Update learning analytics
      this.updateLearningAnalytics(profile, interaction);
      
      // Update topic interests
      this.updateTopicAnalytics(profile, interaction);

      // Save updated profile periodically
      if (profile.stats.totalInteractions % this.profileUpdateInterval === 0) {
        await this.saveUserProfile(userId, profile);
      }

    } catch (error) {
      console.error('Error updating user analytics:', error);
    }
  }

  updateCommunicationPatterns(profile, interaction) {
    const msgLength = interaction.userMessage.length;
    const total = profile.stats.totalInteractions;
    
    // Update average message length
    profile.communication.averageMessageLength = 
      ((profile.communication.averageMessageLength * (total - 1)) + msgLength) / total;

    // Analyze question types
    const message = interaction.userMessage.toLowerCase();
    if (message.includes('how')) profile.communication.questionTypes.push('how');
    if (message.includes('why')) profile.communication.questionTypes.push('why');
    if (message.includes('what')) profile.communication.questionTypes.push('what');
    if (message.includes('when')) profile.communication.questionTypes.push('when');
    if (message.includes('where')) profile.communication.questionTypes.push('where');

    // Keep only recent question types
    if (profile.communication.questionTypes.length > 20) {
      profile.communication.questionTypes.splice(0, 10);
    }
  }

  updateEmotionalPatterns(profile, interaction) {
    const { emotionalState, visualInfo } = interaction.metadata;
    
    if (emotionalState && emotionalState.emotion) {
      // Add to mood history, now storing the raw emotion object
      profile.emotional.moodHistory.push({
        emotion: emotionalState.emotion,
        confidence: emotionalState.confidence || 0,
        dominantEmotion: emotionalState.dominantEmotion,
        rawEmotions: emotionalState.rawEmotions,
        timestamp: interaction.timestamp
      });

      // Keep only recent moods
      if (profile.emotional.moodHistory.length > 20) { // Increased for better analysis
        profile.emotional.moodHistory.shift();
      }

      // Update dominant mood based on more robust data
      const recentMoods = profile.emotional.moodHistory.slice(-10);
      const moodCounts = {};
      recentMoods.forEach(mood => {
        const emotionToCount = mood.dominantEmotion || mood.emotion;
        moodCounts[emotionToCount] = (moodCounts[emotionToCount] || 0) + 1;
      });
      
      if (Object.keys(moodCounts).length > 0) {
        profile.emotional.dominantMood = Object.keys(moodCounts).reduce((a, b) => 
          moodCounts[a] > moodCounts[b] ? a : b
        );
      }
    }

    if (visualInfo && visualInfo.age) {
      profile.visual.age = visualInfo.age;
      profile.visual.gender = visualInfo.gender;
    }
  }

  updateLearningAnalytics(profile, interaction) {
    const learningStyle = interaction.metadata.learningStyle;
    if (learningStyle && learningStyle !== 'unknown') {
      profile.learning.preferredStyle = learningStyle;
    }

    // Analyze comprehension signals
    const message = interaction.userMessage.toLowerCase();
    if (message.includes('understand') || message.includes('got it') || message.includes('clear')) {
      // Positive comprehension signal
      const topics = interaction.metadata.topicsDetected || [];
      topics.forEach(topic => {
        if (!profile.learning.masteredConcepts.includes(topic)) {
          profile.learning.masteredConcepts.push(topic);
        }
      });
    }

    if (message.includes('confused') || message.includes('stuck') || message.includes('help')) {
      // Struggling signal
      const topics = interaction.metadata.topicsDetected || [];
      topics.forEach(topic => {
        if (!profile.learning.strugglingTopics.includes(topic)) {
          profile.learning.strugglingTopics.push(topic);
        }
      });
    }
  }

  updateTopicAnalytics(profile, interaction) {
    const topics = interaction.metadata.topicsDetected || [];
    
    topics.forEach(topic => {
      // Increase interest score
      const currentInterest = profile.topics.interests[topic] || 0;
      profile.topics.interests[topic] = Math.min(currentInterest + 0.1, 1.0);
      
      // Track recent topics
      profile.topics.recentTopics.unshift(topic);
      if (profile.topics.recentTopics.length > 20) {
        profile.topics.recentTopics.pop();
      }
    });
  }

  // === CONTEXT GENERATION FOR AI ===

  async generateEnhancedContext(userId) {
    try {
      const profile = await this.getUserProfile(userId);
      const recentInteractions = await this.getRecentInteractions(userId, 5);
      
      return {
        // Basic context
        totalInteractions: profile.stats.totalInteractions,
        sessionInteractions: profile.stats.currentSessionInteractions,
        lastActive: profile.lastActive,
        
        // Learning profile
        learningStyle: profile.learning.preferredStyle,
        comprehensionLevel: profile.learning.comprehensionLevel,
        preferredTopics: profile.learning.preferredTopics,
        strugglingTopics: profile.learning.strugglingTopics,
        masteredConcepts: profile.learning.masteredConcepts,
        
        // Emotional context
        dominantMood: profile.emotional.dominantMood,
        recentMoods: profile.emotional.moodHistory.slice(-3),
        
        // Communication preferences
        averageMessageLength: profile.communication.averageMessageLength,
        preferredDepth: profile.communication.preferredExplanationDepth,
        commonQuestionTypes: this.getTopItems(profile.communication.questionTypes, 3),
        
        // Topic interests
        topInterests: this.getTopInterests(profile.topics.interests, 5),
        recentTopics: profile.topics.recentTopics.slice(0, 10),
        
        // Recent conversation summary
        recentInteractions: recentInteractions.map(interaction => ({
          userMessage: interaction.userMessage,
          emotion: interaction.metadata.emotionalState,
          topics: interaction.metadata.topicsDetected,
          timestamp: interaction.timestamp
        }))
      };
    } catch (error) {
      console.error('Error generating enhanced context:', error);
      return {
        totalInteractions: 0,
        learningStyle: 'unknown',
        dominantMood: 'neutral',
        recentInteractions: []
      };
    }
  }

  // === UTILITY METHODS ===

  extractTopics(message) {
    const topics = [];
    const lowerMsg = message.toLowerCase();
    
    // Science topics
    if (lowerMsg.includes('mars') || lowerMsg.includes('red planet')) topics.push('mars');
    if (lowerMsg.includes('black hole') || lowerMsg.includes('blackhole')) topics.push('black_holes');
    if (lowerMsg.includes('planet') || lowerMsg.includes('planetary')) topics.push('planets');
    if (lowerMsg.includes('space') || lowerMsg.includes('cosmos') || lowerMsg.includes('universe')) topics.push('space_science');
    if (lowerMsg.includes('star') || lowerMsg.includes('stellar')) topics.push('stars');
    if (lowerMsg.includes('galaxy') || lowerMsg.includes('galaxies')) topics.push('galaxies');
    if (lowerMsg.includes('energy') || lowerMsg.includes('power')) topics.push('energy');
    if (lowerMsg.includes('gravity') || lowerMsg.includes('gravitational')) topics.push('gravity');
    if (lowerMsg.includes('light') || lowerMsg.includes('electromagnetic')) topics.push('light');
    if (lowerMsg.includes('atom') || lowerMsg.includes('molecular')) topics.push('atomic_science');
    
    return topics;
  }

  getTopItems(array, count) {
    const counts = {};
    array.forEach(item => {
      counts[item] = (counts[item] || 0) + 1;
    });
    
    return Object.entries(counts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, count)
      .map(([item, count]) => ({ item, count }));
  }

  getTopInterests(interests, count) {
    return Object.entries(interests)
      .sort(([,a], [,b]) => b - a)
      .slice(0, count)
      .map(([topic, score]) => ({ topic, score }));
  }

  async getCurrentSessionId(userId) {
    const profile = await this.getUserProfile(userId);
    if (!profile.sessions.currentSessionId) {
      profile.sessions.currentSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      // Reset session interaction count
      profile.stats.currentSessionInteractions = 0;
      profile.stats.lastSessionStart = new Date().toISOString();
    }
    return profile.sessions.currentSessionId;
  }

  // === LEGACY COMPATIBILITY ===

  async summarizeContext(userId) {
    try {
      const context = await this.generateEnhancedContext(userId);
      if (context.totalInteractions === 0) {
        return "New user - no previous interactions.";
      }

      let summary = `${context.totalInteractions} total interactions (${context.sessionInteractions} this session). `;
      
      if (context.topInterests.length > 0) {
        const topics = context.topInterests.map(t => t.topic).join(', ');
        summary += `Interests: ${topics}. `;
      }
      
      if (context.dominantMood !== 'neutral') {
        summary += `Usually ${context.dominantMood}. `;
      }
      
      if (context.learningStyle !== 'unknown') {
        summary += `Learning style: ${context.learningStyle}. `;
      }

      if (context.strugglingTopics.length > 0) {
        summary += `Needs help with: ${context.strugglingTopics.slice(-3).join(', ')}. `;
      }

      if (context.masteredConcepts.length > 0) {
        summary += `Understands: ${context.masteredConcepts.slice(-3).join(', ')}.`;
      }

      // Add visual info to summary
      try {
        const profile = await this.getUserProfile(userId);
        if (profile.visual && profile.visual.age && profile.visual.gender) {
          summary += `Appears to be a ${profile.visual.gender} around ${profile.visual.age} years old. `;
        }
      } catch (visualError) {
        // Visual data is optional, don't break if it fails
        console.log('Visual profile data not available for summary');
      }
      
      return summary;
    } catch (error) {
      console.error('Error generating context summary:', error);
      return "Unable to load user context.";
    }
  }

  detectEmotionalState(userId, currentMessage) {
    // Deprecated: This logic is now handled client-side with face-api.js
    // Returning a neutral state to maintain compatibility with older code.
    return Promise.resolve({ emotion: 'neutral', confidence: 0.5 });
  }

  getUserLearningStyle(userId) {
    return this.getUserProfile(userId)
      .then(profile => profile.learning.preferredStyle)
      .catch(error => {
        console.error('Error getting learning style:', error);
        return 'unknown';
      });
  }

  // === PLAYER PROGRESS & TRAITS API ===
  async saveChoice(userId, missionId, blockId, choiceText, tag) {
    console.log('📝 saveChoice called with:', { userId, missionId, blockId, choiceText, tag });
    
    try {
        const profile = await this.getUserProfile(userId);
        
        // Initialize traits if they don't exist
        if (!profile.traits) {
            console.log('🔧 Initializing traits for user:', userId);
            profile.traits = {
                cautious: 0,
                bold: 0,
                creative: 0,
                confidence: 0.5,
                lastUpdated: new Date().toISOString()
            };
        }
   
      // Map tags to trait categories
      const traitMap = {
        cautious: ['cautious', 'careful', 'safe', 'passive', 'collaborative'],
        bold: ['bold', 'risk', 'brave', 'active', 'assertive', 'mission_continuity', 'external_help'],
        creative: ['creative', 'innovative', 'unique'], 
      }
      
      // Find trait category and update count
      if (tag) {
          console.log('🏷️ Processing tag:', tag);
          let tagMapped = false;
          
          for (const [category, tags] of Object.entries(traitMap)) {
              if (tags && Array.isArray(tags) && tags.includes(tag)) {
                  console.log(`✅ Tag '${tag}' mapped to category '${category}'`);
                  profile.traits[category] = (profile.traits[category] || 0) + 1;
                  profile.traits.lastUpdated = new Date().toISOString();
                  tagMapped = true;
                  break;
              }
          }
          
          if (!tagMapped) {
              console.log(`⚠️ Tag '${tag}' not found in any trait category`);
          }
      } else {
          console.log('⚠️ No tag provided with choice');
      }

      // Map all tags to only 'cautious', 'bold', or 'creative'
      // const tagMap = {
      //   cautious: 'cautious', safe: 'cautious', passive: 'cautious', collaborative: 'cautious',
      //   bold: 'bold', risk: 'bold', active: 'bold', assertive: 'bold', mission_continuity: 'bold', external_help: 'bold',
      //   creative: 'creative'
      // };
      // const mappedTag = tagMap[tag] || (tag === 'creative' ? 'creative' : (tag ? 'creative' : null));
      // const profile = await this.getUserProfile(userId);
          
      // Initialize missions_completed if it doesn't exist
      if (!profile.missions_completed) {
          console.log('🔧 Initializing missions_completed for user:', userId);
          profile.missions_completed = [];
      }
      
      // Handle mission progress
      let mission = profile.missions_completed.find(m => m && m.mission_id === missionId);
      if (!mission) {
        console.log('🆕 Creating new mission record for:', missionId);
        mission = {
          mission_id: missionId,
          completed_at: null,
          choices: [],
          traits_demonstrated: []
        };
        profile.missions_completed.push(mission);
      }

      // Add choice 
      const choiceRecord = { block_id: blockId, choice: choiceText, tag, timestamp: new Date().toISOString() };
      mission.choices.push(choiceRecord);
      console.log('📌 Choice recorded:', choiceRecord);
      
      if (tag && mission.traits_demonstrated && !mission.traits_demonstrated.includes(tag)) {
        mission.traits_demonstrated.push(tag);
        console.log('🎯 Trait demonstrated:', tag);
      }

      // Save profile
      await this.saveUserProfile(userId, profile);
      console.log(`💾 Choice saved successfully for user ${userId} in mission ${missionId}`);
      console.log('📊 Updated traits:', profile.traits);
      return mission;
    } catch (error) {
      console.error('❌ Error in saveChoice:', error);
      console.error('Stack trace:', error.stack);
      throw error; // Re-throw to ensure proper error handling in the controller
    }
  }

  async getUserTraits(userId) {
    const profile = await this.getUserProfile(userId);
    return profile.traits || {};
  }

  async getMissionHistory(userId) {
    const profile = await this.getUserProfile(userId);
    return profile.missions_completed || [];
  }

  async saveFinalSummary(userId, missionId, summary) {
    const profile = await this.getUserProfile(userId);
    let mission = profile.missions_completed.find(m => m.mission_id === missionId);
    if (!mission) {
      mission = {
        mission_id: missionId,
        completed_at: new Date().toISOString(),
        choices: [],
        final_summary: summary
      };
      profile.missions_completed.push(mission);
    } else {
      mission.final_summary = summary;
      mission.completed_at = new Date().toISOString();
    }
    await this.saveUserProfile(userId, profile);
    return mission;
  }

  async canUnlock(userId, missionId, requiredMissionId) {
    // Returns true if requiredMissionId is completed
    const profile = await this.getUserProfile(userId);
    return profile.missions_completed.some(m => m.mission_id === requiredMissionId && m.completed_at);
  }

  // === KNOWLEDGE GRAPH API ===

  async getUserKnowledgeGraph(userId) {
    const profile = await this.getUserProfile(userId);
    if (!profile.knowledgeGraph) {
      // If a user exists but has no graph, initialize it.
      profile.knowledgeGraph = knowledgeGraphManager.initializeGraph(userId);
      await this.saveUserProfile(userId, profile);
    }
    return profile.knowledgeGraph;
  }

  async updateUserKnowledgeGraph(userId, conceptName, masteryChange, reason) {
    const graph = await this.getUserKnowledgeGraph(userId);
    const currentNode = graph.nodes[conceptName] || { mastery: 0 };
    const newMastery = currentNode.mastery + masteryChange;
    
    knowledgeGraphManager.updateMastery(graph, conceptName, newMastery, reason);
    
    const profile = await this.getUserProfile(userId);
    profile.knowledgeGraph = graph;
    await this.saveUserProfile(userId, profile);
  }

  async addKnowledgeGraphRelationship(userId, sourceConcept, targetConcept, relationshipType) {
    const graph = await this.getUserKnowledgeGraph(userId);
    knowledgeGraphManager.addRelationship(graph, sourceConcept, targetConcept, relationshipType);

    const profile = await this.getUserProfile(userId);
    profile.knowledgeGraph = graph;
    await this.saveUserProfile(userId, profile);
  }
}

// Create global instance
const persistentMemory = new PersistentMemoryManager();

module.exports = {
  PersistentMemoryManager,
  persistentMemory
}; 