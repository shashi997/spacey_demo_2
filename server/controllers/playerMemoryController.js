const fs = require('fs').promises;
const path = require('path');

// Player Memory System 
class PlayerMemorySystem {
  constructor(dataDir = './data') {
    this.dataDir = dataDir;
    this.ensureDataDirectory();
  }

  // Ensure data directory exists
  async ensureDataDirectory() {
    try {
      await fs.access(this.dataDir);
    } catch {
      await fs.mkdir(this.dataDir, { recursive: true });
    }
  }

  // Get file path for a specific player
  getPlayerFilePath(playerId) {
    return path.join(this.dataDir, `player_${playerId}.json`);
  }

  // Load player memory (traits, choices, progress)
  async loadPlayerMemory(playerId) {
    try {
      const filePath = this.getPlayerFilePath(playerId);
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      // Return default player profile if file doesn't exist
      return this.createDefaultPlayerProfile(playerId);
    }
  }

  // Save player memory
  async savePlayerMemory(playerId, memoryData) {
    try {
      const filePath = this.getPlayerFilePath(playerId);
      memoryData.lastUpdated = new Date().toISOString();
      await fs.writeFile(filePath, JSON.stringify(memoryData, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving player memory:', error);
      return false;
    }
  }

  // Create default player profile
  createDefaultPlayerProfile(playerId) {
    return {
      playerId,
      name: 'Explorer',
      traits: ['curious', 'beginner'],
      emotionalState: 'neutral',
      preferredTone: 'supportive',
      missions: {
        completed: [],
        current: 'dashboard',
        progress: {}
      },
      choices: [],
      statistics: {
        totalInteractions: 0,
        sessionsCompleted: 0,
        favoriteTopics: [],
        riskLevel: 'moderate'
      },
      traitHistory: [
        {
          timestamp: new Date().toISOString(),
          action: 'profile_created',
          traitsAdded: ['curious', 'beginner'],
          traitsRemoved: []
        }
      ],
      created: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
  }

  // Add trait to player
  async addTrait(playerId, trait, reason = 'user_action') {
    const memory = await this.loadPlayerMemory(playerId);
    
    if (!memory.traits.includes(trait)) {
      memory.traits.push(trait);
      memory.traitHistory.push({
        timestamp: new Date().toISOString(),
        action: 'trait_added',
        trait,
        reason,
        traitsAdded: [trait],
        traitsRemoved: []
      });
      
      await this.savePlayerMemory(playerId, memory);
    }
    
    return memory;
  }

  // Remove trait from player
  async removeTrait(playerId, trait, reason = 'user_action') {
    const memory = await this.loadPlayerMemory(playerId);
    
    const traitIndex = memory.traits.indexOf(trait);
    if (traitIndex > -1) {
      memory.traits.splice(traitIndex, 1);
      memory.traitHistory.push({
        timestamp: new Date().toISOString(),
        action: 'trait_removed',
        trait,
        reason,
        traitsAdded: [],
        traitsRemoved: [trait]
      });
      
      await this.savePlayerMemory(playerId, memory);
    }
    
    return memory;
  }

  // Update traits based on player choice/interaction using intelligent analysis
  async updateTraitsFromInteraction(playerId, interaction) {
    const memory = await this.loadPlayerMemory(playerId);
    let traitsChanged = false;

    // Analyze interaction and update traits
    const { choice, context, sentiment } = interaction;

    // Record the choice
    memory.choices.push({
      timestamp: new Date().toISOString(),
      choice,
      context: context || 'general_chat',
      sentiment: sentiment || 'neutral'
    });

    try {
      // Use intelligent trait analyzer (LLM + enhanced keywords)
      const { traitAnalyzer } = require('./traitAnalyzer');
      const analysis = await traitAnalyzer.analyzeTraits(choice, context, memory.traits);

      console.log(`Trait analysis result:`, analysis);

      // Process trait additions
      for (const trait of analysis.traits_to_add) {
        if (!memory.traits.includes(trait)) {
          await this.addTrait(playerId, trait, `${analysis.method}: ${analysis.reasoning}`);
          traitsChanged = true;
        }
      }

      // Process trait removals
      for (const trait of analysis.traits_to_remove) {
        if (memory.traits.includes(trait)) {
          await this.removeTrait(playerId, trait, `${analysis.method}: ${analysis.reasoning}`);
          traitsChanged = true;
        }
      }

      // Store analysis metadata for debugging
      if (analysis.confidence > 0) {
        memory.lastAnalysis = {
          timestamp: new Date().toISOString(),
          method: analysis.method,
          confidence: analysis.confidence,
          reasoning: analysis.reasoning,
          message: choice.substring(0, 100) // Store first 100 chars for reference
        };
      }

    } catch (error) {
      console.error('Trait analysis failed, using fallback logic:', error);
      
      // Fallback to basic detection if analyzer fails completely
      traitsChanged = await this.fallbackTraitDetection(playerId, choice, context);
    }

    // Update statistics
    memory.statistics.totalInteractions++;
    
    // Track favorite topics
    if (context && context !== 'general_chat') {
      const topicIndex = memory.statistics.favoriteTopics.findIndex(t => t.topic === context);
      if (topicIndex > -1) {
        memory.statistics.favoriteTopics[topicIndex].count++;
      } else {
        memory.statistics.favoriteTopics.push({ topic: context, count: 1 });
      }
    }

    await this.savePlayerMemory(playerId, memory);
    return { memory, traitsChanged };
  }

  // Fallback trait detection (simplified version of old logic)
  async fallbackTraitDetection(playerId, choice, context) {
    let traitsChanged = false;
    const choiceText = choice.toLowerCase();
    const memory = await this.loadPlayerMemory(playerId);

    // Basic context-based traits
    if (context === 'lesson_astronomy' || context === 'technical_discussion') {
      if (!memory.traits.includes('science_minded')) {
        await this.addTrait(playerId, 'science_minded', 'fallback: showed_interest_in_science');
        traitsChanged = true;
      }
    }

    // Basic keyword detection
    if (choiceText.includes('risky') || choiceText.includes('dangerous')) {
      if (!memory.traits.includes('risk_taker')) {
        await this.addTrait(playerId, 'risk_taker', 'fallback: chose_risky_option');
        traitsChanged = true;
      }
    }

    if (choiceText.includes('safe') || choiceText.includes('careful')) {
      if (!memory.traits.includes('cautious')) {
        await this.addTrait(playerId, 'cautious', 'fallback: chose_safe_option');
        traitsChanged = true;
      }
    }

    return traitsChanged;
  }

  // Get player traits for prompt generation
  async getPlayerTraitsForPrompt(playerId) {
    const memory = await this.loadPlayerMemory(playerId);
    return {
      name: memory.name,
      traits: memory.traits,
      emotionalState: memory.emotionalState,
      currentMission: memory.missions.current,
      preferredTone: memory.preferredTone,
      recentChoices: memory.choices.slice(-3) // Last 3 choices for context
    };
  }

  // Update player's current mission
  async updateCurrentMission(playerId, missionId, progress = {}) {
    const memory = await this.loadPlayerMemory(playerId);
    memory.missions.current = missionId;
    memory.missions.progress[missionId] = {
      ...memory.missions.progress[missionId],
      ...progress,
      lastUpdated: new Date().toISOString()
    };
    
    await this.savePlayerMemory(playerId, memory);
    return memory;
  }

  // Complete a mission
  async completeMission(playerId, missionId) {
    const memory = await this.loadPlayerMemory(playerId);
    
    if (!memory.missions.completed.includes(missionId)) {
      memory.missions.completed.push(missionId);
      memory.statistics.sessionsCompleted++;
      
      // Remove beginner trait after first mission
      if (memory.missions.completed.length === 1 && memory.traits.includes('beginner')) {
        await this.removeTrait(playerId, 'beginner', 'completed_first_mission');
        await this.addTrait(playerId, 'experienced', 'completed_first_mission');
      }
    }
    
    await this.savePlayerMemory(playerId, memory);
    return memory;
  }

  // Get all player IDs (for admin/debug)
  async getAllPlayerIds() {
    try {
      const files = await fs.readdir(this.dataDir);
      return files
        .filter(file => file.startsWith('player_') && file.endsWith('.json'))
        .map(file => file.replace('player_', '').replace('.json', ''));
    } catch {
      return [];
    }
  }

  // Clear player data (for testing/reset)
  async clearPlayerData(playerId) {
    try {
      const filePath = this.getPlayerFilePath(playerId);
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// Create global instance
const playerMemory = new PlayerMemorySystem();

module.exports = {
  PlayerMemorySystem,
  playerMemory
}; 