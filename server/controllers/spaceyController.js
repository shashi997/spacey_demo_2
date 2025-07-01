const { GoogleGenAI  } = require("@google/genai");
const { playerMemory } = require('./playerMemoryController');
const { aiProviderManager } = require('./aiProviders');

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Enhanced Prompt Engine for Spacey's Brain
class SpaceyPromptEngine {
  constructor() {
    this.missionBlocks = {
      dashboard: {
        title: "Command Center",
        context: "Player is exploring the main dashboard and interacting with mission systems",
        objectives: ["Learn about space missions", "Review available lessons", "Chat with Spacey"],
        atmosphere: "curious, exploratory"
      },
      mars_mission_1: {
        title: "Mars Landing Preparation",
        context: "Player is preparing for a critical Mars landing sequence",
        objectives: ["Check atmospheric conditions", "Calibrate landing systems", "Review safety protocols"],
        atmosphere: "focused, high-stakes"
      },
      lesson_astronomy: {
        title: "Stellar Astronomy Lesson",
        context: "Player is learning about star formation and lifecycle",
        objectives: ["Understand stellar evolution", "Identify star types", "Complete quiz"],
        atmosphere: "educational, wonder-filled"
      },
      crisis_mode: {
        title: "Emergency Response",
        context: "Critical system failure requiring immediate attention",
        objectives: ["Diagnose problem", "Implement emergency protocols", "Maintain crew safety"],
        atmosphere: "urgent, supportive"
      }
    };

    this.toneProfiles = {
      supportive: "encouraging, warm, like a helpful mentor",
      witty: "clever, playful, with gentle humor",
      neutral: "professional, balanced, informative",
      sarcastic: "mildly sarcastic but never mean, like a witty friend",
      emergency: "calm under pressure, focused, reassuring"
    };
  }

  // Generate a structured prompt based on current context
  generatePrompt(userMessage, playerContext = {}) {
    const {
      name = 'Explorer',
      traits = ['curious'],
      currentMission = 'dashboard',
      playerChoice = null,
      emotionalState = 'neutral',
      tone = 'supportive'
    } = playerContext;

    const mission = this.missionBlocks[currentMission] || this.missionBlocks.dashboard;
    const toneDesc = this.toneProfiles[tone] || this.toneProfiles.supportive;

    // Build dynamic context
    let contextualInfo = `
🌌 **MISSION**: ${mission.title}
📍 **LOCATION**: ${mission.context}
🎯 **OBJECTIVES**: ${mission.objectives.join(', ')}
🌙 **ATMOSPHERE**: ${mission.atmosphere}`;

    if (playerChoice) {
      contextualInfo += `\n⚡ **RECENT CHOICE**: ${playerChoice}`;
    }

    // Build personality section
    const personalityContext = `
👤 **PLAYER**: ${name}
🧬 **TRAITS**: ${traits.join(', ')}
😊 **EMOTIONAL STATE**: ${emotionalState}
🎭 **DESIRED TONE**: ${toneDesc}`;

    // Main system prompt
    return `
You are **Spacey**, the AI companion for space exploration and learning. You're like Baymax + JARVIS: witty, emotionally intelligent, helpful, but never boring.

${contextualInfo}

${personalityContext}

---

🗨️ **User Message**: "${userMessage}"

🤖 **Response Guidelines**:
- Keep responses to 2-4 sentences max
- Reflect the player's traits and current emotional state
- Match the mission atmosphere and desired tone
- Be contextually aware of the current objectives
- Mix helpfulness with appropriate humor
- Show emotional intelligence and personality

**Respond as Spacey now:**`;
  }

  // Add new mission blocks dynamically
  addMissionBlock(id, missionData) {
    this.missionBlocks[id] = missionData;
  }

  // Get available mission contexts
  getAvailableMissions() {
    return Object.keys(this.missionBlocks);
  }
}

// Create global instance
const promptEngine = new SpaceyPromptEngine();

// Original simpler system for backwards compatibility
const buildSystemPrompt = (userPrompt, userInfo = {}) => {
  const {
    name = 'Explorer',
    traits = ['curious'],
    tone = 'supportive, witty',
    location = 'dashboard',
    context = 'User is exploring the main dashboard and interacting with Spacey.'
  } = userInfo;

  return `
You are **Spacey**, the sarcastic but kind AI assistant of a space learning platform.

🧠 **Context**: ${context}
🌌 **Location**: ${location}
🧬 **Player Traits**: ${traits.join(', ')}
🎭 **Tone**: ${tone}
👤 **User**: ${name}

---

🗨️ **User Message**: "${userPrompt}"

🔁 **Your Task**: Reply in **2–4 sentences max**, keeping it **clever, emotionally aware, and never boring**. 
Mix the kindness of Baymax with the wit of JARVIS. Reflect the user's traits and situation.

🎯 Example Style: short, characterful, maybe cheeky — but always helpful.

Now respond as Spacey:
`;
};

const chatWithAI = async (req, res) => {
    try {
        const { prompt, user, context } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: "A prompt is required." });
        }

        // Get player ID (from user object or context)
        const playerId = user?.id || user?.uid || context?.playerId || 'anonymous';

        // Load player memory and traits
        const playerTraits = await playerMemory.getPlayerTraitsForPrompt(playerId);

        // Use enhanced prompt engine if context is provided or if using memory system
        let fullPrompt;
        let finalContext = context || {};

        if (context && context.useEnhancedEngine) {
            // Merge player traits with provided context
            finalContext = {
                ...context,
                ...playerTraits,
                // Override with any explicitly provided context values
                ...context
            };
            fullPrompt = promptEngine.generatePrompt(prompt, finalContext);
        } else if (playerTraits.traits.length > 2) { // Use enhanced if player has evolved beyond defaults
            // Auto-use enhanced engine for evolved players
            finalContext = {
                useEnhancedEngine: true,
                ...playerTraits,
                currentMission: playerTraits.currentMission || 'dashboard',
                tone: playerTraits.preferredTone || 'supportive'
            };
            fullPrompt = promptEngine.generatePrompt(prompt, finalContext);
        } else {
            // Fallback to original system but with player data
            const userWithTraits = {
                ...user,
                name: playerTraits.name,
                traits: playerTraits.traits,
                tone: playerTraits.preferredTone || 'supportive, witty',
                location: playerTraits.currentMission || 'dashboard'
            };
            fullPrompt = buildSystemPrompt(prompt, userWithTraits);
        }

        // Use AI Provider Manager to generate response
        const aiProvider = finalContext.aiProvider || process.env.DEFAULT_AI_PROVIDER || 'gemini';
        let text;
        
        try {
            text = await aiProviderManager.generateResponse(fullPrompt, aiProvider);
        } catch (providerError) {
            console.error(`AI Provider Error:`, providerError);
            // Fallback to original Gemini implementation
            const result = await genAI.models.generateContent({
                model: "gemini-2.5-flash",
                contents: fullPrompt
            });
            const response = await result.text;
            text = response;
        }

        // Update player memory based on interaction
        await playerMemory.updateTraitsFromInteraction(playerId, {
            choice: prompt,
            context: finalContext.currentMission || 'general_chat',
            sentiment: 'neutral' // Could be enhanced with sentiment analysis
        });

        // Send enhanced response with metadata
        res.json({ 
            message: text,
            context: finalContext,
            playerTraits: playerTraits,
            aiProvider: aiProvider,
            promptUsed: finalContext?.debug ? fullPrompt : undefined
        });

    } catch (error) {
        console.error("Error communicating with AI:", error);
        res.status(500).json({ error: "Failed to get a response from the AI. The mission was aborted." });
    }
}

// New endpoint for player memory management
const getPlayerMemory = async (req, res) => {
    try {
        const { playerId } = req.params;
        const memory = await playerMemory.loadPlayerMemory(playerId);
        res.json(memory);
    } catch (error) {
        console.error("Error loading player memory:", error);
        res.status(500).json({ error: "Failed to load player memory." });
    }
}

const updatePlayerTrait = async (req, res) => {
    try {
        const { playerId } = req.params;
        const { trait, action, reason } = req.body; // action: 'add' or 'remove'

        let memory;
        if (action === 'add') {
            memory = await playerMemory.addTrait(playerId, trait, reason);
        } else if (action === 'remove') {
            memory = await playerMemory.removeTrait(playerId, trait, reason);
        } else {
            return res.status(400).json({ error: "Action must be 'add' or 'remove'" });
        }

        res.json({ success: true, memory });
    } catch (error) {
        console.error("Error updating player trait:", error);
        res.status(500).json({ error: "Failed to update player trait." });
    }
}

const updatePlayerMission = async (req, res) => {
    try {
        const { playerId } = req.params;
        const { missionId, progress } = req.body;

        const memory = await playerMemory.updateCurrentMission(playerId, missionId, progress);
        res.json({ success: true, memory });
    } catch (error) {
        console.error("Error updating player mission:", error);
        res.status(500).json({ error: "Failed to update player mission." });
    }
}

// New endpoint to get available AI providers
const getAIProviders = async (req, res) => {
    try {
        const providers = aiProviderManager.getAvailableProviders();
        res.json({ providers });
    } catch (error) {
        console.error("Error getting AI providers:", error);
        res.status(500).json({ error: "Failed to get AI providers." });
    }
}

// Export the prompt engine for potential use in other modules
module.exports = {
    chatWithAI,
    promptEngine,
    getPlayerMemory,
    updatePlayerTrait,
    updatePlayerMission,
    getAIProviders
}