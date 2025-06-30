const { GoogleGenAI  } = require("@google/genai");

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Prompt Engine for Spacey's Brain (enh)
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
  // used emoji for better parsing by the LLM
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

    // Build personality 
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

// global instance
const promptEngine = new SpaceyPromptEngine();

// simpler system for backwards compatibility (org)
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

        // Use enhanced prompt engine if context is provided
        let fullPrompt;
        if (context && context.useEnhancedEngine) {
            fullPrompt = promptEngine.generatePrompt(prompt, context);
        } else {
            // Fallback to original system
            fullPrompt = buildSystemPrompt(prompt, user);
        }

        const result = await genAI.models.generateContent({
            model: "gemini-2.5-flash",
            contents: fullPrompt
        });

        const response = await result.text;
        const text = response;

        // Send enhanced response with metadata
        res.json({ 
            message: text,
            context: context || {},
            promptUsed: context?.debug ? fullPrompt : undefined
        });

    } catch (error) {
        console.error("Error communicating with Google AI:", error);
        res.status(500).json({ error: "Failed to get a response from the AI. The mission was aborted." });
    }
}

// Prompt engine export
module.exports = {
    chatWithAI,
    promptEngine
}