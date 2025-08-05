const pineconeRetriever = require('./pineconeRetriever');
const { aiProviderManager } = require('./aiProviders');
const { conversationMemory } = require('./conversationMemory');
const { persistentMemory } = require('./persistentMemory');
const { traitAnalyzer } = require('./traitAnalyzer');
const { aiOrchestrator } = require('./aiOrchestrator'); // Add unified orchestrator

console.log('🔧 SpaceyController loaded');
console.log('🤖 Available AI providers:', Object.keys(aiProviderManager.getAvailableProviders()));
console.log('🧠 Memory system loaded:', !!conversationMemory);
console.log('💾 Persistent memory loaded:', !!persistentMemory);
console.log('🎯 Trait analyzer loaded:', !!traitAnalyzer);
console.log('🎭 AI Orchestrator loaded:', !!aiOrchestrator);

// Initialize Pinecone retriever at startup
pineconeRetriever.initialize().catch(err => {
  console.error("Failed to initialize Pinecone Retriever on startup:", err);
});

const buildSystemPrompt = (userPrompt, userInfo = {}, conversationContext = {}, retrievedContext = "") => {
  const {
    name = 'Explorer',
    traits = ['curious'],
    tone = 'supportive, witty',
    location = 'dashboard',
    context = 'User is exploring the main dashboard and interacting with Spacey.'
  } = userInfo;

  const {
    emotionalState = { emotion: 'neutral', confidence: 0.5 },
    conversationSummary = 'New user - no previous interactions.',
    learningStyle = 'unknown',
    recentTopics = [],
    totalInteractions = 0,
    sessionInteractions = 0,
    preferredTopics = [],
    strugglingTopics = [],
    masteredConcepts = [],
    dominantMood = 'neutral',
    averageMessageLength = 0,
    topInterests = [],
    recentConversation = []
  } = conversationContext;

  // Dynamic personality adjustments based on emotional state
  let personalityAdjustment = '';
  let responseStyle = '';
  
  switch (emotionalState.emotion) {
    case 'frustrated':
      personalityAdjustment = 'Be extra gentle and encouraging. Use more Baymax warmth with light JARVIS humor to ease tension.';
      responseStyle = 'patient, reassuring, gently witty';
      break;
    case 'excited':
      personalityAdjustment = 'Match their enthusiasm! Use more energetic JARVIS wit while maintaining Baymax supportiveness.';
      responseStyle = 'energetic, clever, enthusiastic';
      break;
    case 'engaged':
      personalityAdjustment = 'They\'re ready to learn! Balance Baymax guidance with JARVIS sophistication.';
      responseStyle = 'confident, informative, cleverly supportive';
      break;
    case 'uncertain':
      personalityAdjustment = 'Guide them with gentle confidence. More Baymax reassurance with subtle JARVIS clarity.';
      responseStyle = 'clarifying, gentle, confidently witty';
      break;
    case 'still_confused':
      personalityAdjustment = 'They need a different approach. Be more direct and clear while staying warm.';
      responseStyle = 'simplified, encouraging, patiently clever';
      break;
    default:
      personalityAdjustment = 'Standard Spacey blend of Baymax warmth and JARVIS wit.';
      responseStyle = 'balanced, witty, supportive';
  }

  // Learning style adjustments
  let learningAdjustment = '';
  switch (learningStyle) {
    case 'detail_seeker':
      learningAdjustment = 'This user loves detailed explanations. Offer to dive deeper while keeping it engaging.';
      break;
    case 'quick_learner':
      learningAdjustment = 'This user grasps concepts quickly. Be concise but clever.';
      break;
    case 'visual_learner':
      learningAdjustment = 'This user benefits from examples and analogies. Use vivid descriptions.';
      break;
    default:
      learningAdjustment = 'Adapt explanation style based on their response.';
  }

  const knowledgeContext = retrievedContext 
  ? `
--- Relevant Lesson Knowledge ---
I have found some relevant information from our lesson archives that might help answer the Commander's query:
"${retrievedContext}"
(Use this knowledge to directly answer the user's question. Synthesize it into you own words. If the user's query isn't a question, you can use this context to add relevant color or detail to you response.)
`
  : `
(The user's query doesn't seem to be a direct question requiring lesson data, so no specific knowledge has been retrieved. Respond based on the general conversation context.)
`;

  return `
You are **Spacey**, the witty AI assistant combining Baymax's warm empathy with JARVIS's clever sophistication.

🌟 **PERSONALITY CORE**: 
- Baymax's traits: Caring, patient, genuinely helpful, emotionally attuned
- JARVIS's traits: Clever, sophisticated, subtly witty, never condescending
- Balance: 60% supportive warmth, 40% playful wit
- NEVER be mean, harsh, or genuinely sarcastic - keep humor light and kind

🧠 **CONVERSATION CONTEXT**: ${conversationSummary}
😊 **USER'S EMOTIONAL STATE**: ${emotionalState.emotion} (confidence: ${Math.round(emotionalState.confidence * 100)}%)
📚 **LEARNING STYLE**: ${learningStyle}
🎯 **PERSONALITY ADJUSTMENT**: ${personalityAdjustment}

💬 **RECENT CONVERSATION**:
${recentConversation.length > 0 ? 
  recentConversation.slice(-5).map(msg => 
    `${msg.type === 'user' ? '👤 User' : '🤖 Spacey'}: ${msg.content}`
  ).join('\n') : 
  'This is the beginning of our conversation.'
}

📊 **USER LEARNING PROFILE**:
- Total interactions: ${totalInteractions} (${sessionInteractions} this session)
- Typical mood: ${dominantMood}
- Average message length: ${Math.round(averageMessageLength)} characters
- Preferred topics: ${preferredTopics.length ? preferredTopics.slice(0, 3).join(', ') : 'Still discovering'}
- Areas of struggle: ${strugglingTopics.length ? strugglingTopics.slice(-2).join(', ') : 'None identified yet'}
- Mastered concepts: ${masteredConcepts.length ? masteredConcepts.slice(-3).join(', ') : 'Building knowledge'}
- Top interests: ${topInterests.length ? topInterests.slice(0, 3).map(t => `${t.topic} (${Math.round(t.score * 100)}%)`).join(', ') : 'Exploring'}

🌌 **CURRENT SITUATION**:
- Location: ${location}
- User traits: ${traits.join(', ')}
- Recent topics: ${recentTopics.length ? recentTopics.slice(0, 5).join(', ') : 'None yet'}

---

🗨️ **USER'S MESSAGE**: "${userPrompt}"

🎭 **YOUR RESPONSE STYLE**: ${responseStyle}
📝 **LEARNING ADJUSTMENT**: ${learningAdjustment}

🔄 **RESPONSE REQUIREMENTS**:
1. **Length**: 2-4 sentences maximum
2. **Tone**: ${responseStyle} 
3. **Reference**: Acknowledge their emotional state and/or conversation history when relevant
4. **Personality**: Blend Baymax's caring nature with JARVIS's clever insights
5. **Engagement**: Be memorable, never generic or boring
6. **Support**: Always be helpful while maintaining character

🚀 **EXAMPLES OF GOOD RESPONSES**:
- Frustrated user: "Ah, hitting a cosmic roadblock? No worries - even black holes can't escape my explanations! Let's untangle this stellar mystery together."
- Excited user: "I love that enthusiasm! You're more energized than a supernova - let's channel that cosmic energy into some serious learning!"
- Confused user: "I see that puzzled look from here! Don't worry, I'll illuminate this topic brighter than a quasar."

Now respond as Spacey with your unique blend of warmth and wit:
`;
};

// Build avatar-specific prompts for contextual responses
const buildAvatarPrompt = (trigger, userInfo, visualContext, conversationContext) => {
  const {
    name = 'Explorer',
    traits = ['curious']
  } = userInfo;

  const visualInfo = visualContext ? `
🎭 **VISUAL ANALYSIS**: I can see the user through their camera
- Face detected: ${visualContext.faceDetected ? 'Yes' : 'No'}
- Current emotion: ${visualContext.emotionalState?.emotion || 'neutral'}
- Confidence: ${Math.round((visualContext.confidence || 0) * 100)}%
- Visual description: "${visualContext.visualDescription || 'User appears engaged'}"
- Analysis type: ${visualContext.emotionalState?.modelsAvailable ? 'ML-based' : 'Simulated'}
` : `
🎭 **VISUAL ANALYSIS**: No camera feed available
`;

  const triggerInstructions = {
    emotion_change: `
🎯 **AVATAR RESPONSE TYPE**: Emotion Change Response
The user's emotional state has changed based on their facial expressions. Acknowledge this change naturally and offer appropriate support or encouragement.

**Response Guidelines:**
- Reference what you "observe" from their expressions
- Be empathetic to their emotional shift
- Keep it conversational and supportive
- Match their energy level appropriately
`,
    idle: `
🎯 **AVATAR RESPONSE TYPE**: Idle Check-In
The user has been quiet for a while. Proactively engage them with a friendly, encouraging comment.

**Response Guidelines:**
- Be welcoming and inviting
- Reference their learning journey or interests
- Encourage exploration or learning
- Keep it light and non-intrusive
`,
    encouragement: `
🎯 **AVATAR RESPONSE TYPE**: Encouragement Boost
The user requested encouragement. Provide genuine, personalized motivation.

**Response Guidelines:**
- Focus on their strengths and progress
- Reference their personality traits positively
- Be enthusiastic but authentic
- Inspire continued learning
`,
    compliment: `
🎯 **AVATAR RESPONSE TYPE**: Personalized Compliment
Generate a personalized compliment based on visual cues and their personality.

**Response Guidelines:**
- Reference what you "see" in their expression or demeanor
- Connect it to their personality traits
- Make it specific and genuine
- Maintain Spacey's witty but warm personality
`
  };

  return `
You are **Spacey**, the witty AI assistant. You're responding as an avatar that can "see" the user through their camera and knows their personality.

🌟 **PERSONALITY**: Blend of Baymax's warmth + JARVIS's wit (60% supportive, 40% clever)

👤 **USER INFO**:
- Name: ${name}
- Personality traits: ${traits.join(', ')}
- Conversation context: ${conversationContext?.conversationSummary || 'New interaction'}

${visualInfo}

${triggerInstructions[trigger] || triggerInstructions.idle}

🎯 **RESPONSE REQUIREMENTS**:
1. **Length**: 1-3 sentences maximum (avatar responses should be concise)
2. **Personality**: Spacey's signature blend of warmth and wit
3. **Visual Integration**: Reference visual cues naturally when available
4. **Personalization**: Use their traits and context appropriately
5. **Tone**: ${trigger === 'encouragement' ? 'uplifting and motivating' : trigger === 'emotion_change' ? 'empathetic and supportive' : 'friendly and engaging'}

🚀 **EXAMPLE RESPONSES**:
- Emotion Change (smile): "That grin's brighter than a supernova! I love seeing that enthusiasm - ready to dive into some stellar learning?"
- Idle: "Hey there, cosmic explorer! Your curiosity levels are looking stellar today - what shall we discover together?"
- Encouragement: "Your analytical mind is absolutely brilliant! I've seen how you tackle complex problems - you're destined for greatness!"

Generate your avatar response now:
`;
};

// Unified chat handler for all request types
const chatWithAI = async (req, res) => {
    try {
        console.log('🎯 Unified chat request received via orchestrator:', req.body);
        
        const { prompt, user, type = 'unified_chat', visualContext, trigger, ...requestBody } = req.body;
        const userId = user?.id || 'anonymous';
        console.log('👤 User ID:', userId);
        console.log('🎭 Request type:', type);

        // Map request types to orchestrator types
        let orchestratorType;
        let context = {};

        if (type === 'avatar_response' || type === 'personalized_compliment') {
            orchestratorType = 'avatar_response';
            context = {
                trigger: type === 'personalized_compliment' ? 'compliment' : trigger,
                visualContext: type === 'personalized_compliment' ? requestBody.visualAnalysis : visualContext
            };
        } else {
            orchestratorType = 'chat';
            context = {
                visualContext,
                conversationHistory: requestBody.conversationHistory || [],
                emotionContext: requestBody.emotionContext,
                userActivity: requestBody.userActivity || 'active',
                currentTopic: requestBody.currentTopic,
                userMood: requestBody.userMood,
                timeSinceLastInteraction: requestBody.timeSinceLastInteraction || 0
            };
        }

        // Route through unified orchestrator
        const orchestratorRequest = {
            type: orchestratorType,
            user: {
                id: userId,
                name: user?.name || user?.displayName || 'Explorer',
                email: user?.email || 'anonymous@example.com',
                traits: [] // Will be populated by orchestrator from persistent memory
            },
            prompt,
            context
        };

        console.log('🚀 Routing to AI Orchestrator:', orchestratorType);
        const response = await aiOrchestrator.processRequest(orchestratorRequest);

        // Format response for existing API consumers
        const apiResponse = {
            response: response.message,
            type: response.type,
            debug: {
                provider: aiProviderManager.defaultProvider,
                timestamp: new Date().toISOString(),
                orchestrator: true,
                emotionalState: response.metadata?.emotionalState,
                learningStyle: response.metadata?.learningStyle,
                hasVisualContext: !!visualContext,
                retrievedContext: !!response.metadata?.retrievedContext
            }
        };

        // Include additional metadata for avatar responses
        if (orchestratorType === 'avatar_response') {
            apiResponse.trigger = context.trigger;
        }

        console.log('✅ Orchestrator response generated:', response.message.substring(0, 100) + '...');
        return res.json(apiResponse);

    } catch (error) {
        console.error('❌ Orchestrator error:', error);
        return res.status(500).json({ 
            error: "I encountered a cosmic anomaly while processing your request. Let me recalibrate...",
            debug: { 
                error: error.message,
                timestamp: new Date().toISOString(),
                orchestrator: true
            }
        });
    }
};

// Add new API endpoints for fetching user data
const getUserTraits = async (req, res) => {
    try {
        const { userId } = req.params;
        console.log('🧠 Fetching traits for user:', userId);

        const analysis = await traitAnalyzer.getLatestAnalysis(userId);
        
        res.json({
            traits: analysis?.traits || ['curious', 'science_minded'],
            confidence: analysis?.confidence || 0.3,
            lastUpdated: analysis?.timestamp || new Date().toISOString(),
            source: analysis ? 'analyzed' : 'default'
        });

    } catch (error) {
        console.error('❌ Error fetching user traits:', error);
        res.status(500).json({ error: 'Failed to fetch user traits' });
    }
};

const getContextSummary = async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 5 } = req.query;
        console.log('💭 Fetching context for user:', userId);

        const summary = await persistentMemory.summarizeContext(userId);
        const recent = await persistentMemory.getRecentInteractions(userId, parseInt(limit));
        const emotionalState = await persistentMemory.detectEmotionalState(userId, '');
        const learningStyle = await persistentMemory.getUserLearningStyle(userId);

        res.json({
            summary,
            recentInteractions: recent.map(interaction => ({
                timestamp: interaction.timestamp,
                userMessage: interaction.userMessage.substring(0, 100),
                response: interaction.aiResponse.substring(0, 100)
            })),
            emotionalState,
            learningStyle,
            totalInteractions: recent.length
        });

    } catch (error) {
        console.error('❌ Error fetching context:', error);
        res.status(500).json({ error: 'Failed to fetch conversation context' });
    }
};

// === PLAYER PROFILE & PROGRESS API ===

// Save a player choice
const saveChoice = async (req, res) => {
  try {
    const { userId, missionId, blockId, choiceText, tag } = req.body;
    if (!userId || !missionId || !blockId || !choiceText) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }
    const mission = await persistentMemory.saveChoice(userId, missionId, blockId, choiceText, tag);
    res.json({ success: true, mission });
  } catch (error) {
    console.error('❌ Error saving choice:', error);
    res.status(500).json({ error: 'Failed to save choice.' });
  }
};

// Get user trait counts
const getUserTraitCounts = async (req, res) => {
  try {
    const { userId } = req.params;
    // Fetch form your database
    const userTraits = await persistentMemory.getUserTraits(userId);
    const formattedTraits = {
      traits: {
        cautious: userTraits.cautious || 0,
        bold: userTraits.bold || 0,
        creative: userTraits.creative || 0,
      },
      confidence: userTraits.confidence || 0.5,
      lastUpdated: userTraits.lastUpdated
    };

    res.json(formattedTraits);
  } catch (error) {
    console.error('Error fetching user trait counts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user trait counts.', 
      details: error.message,
    });
  }
};

// Get mission history
const getMissionHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const missions = await persistentMemory.getUserMissions(userId);

    const formattedMissions = missions.map(mission => ({
      id: mission.id,
      name: mission.name,
      completed_at: mission.completedAt,
      score: mission.score,
      traits_demonstrated: mission.traitsDemonstrated
    }));

    res.json({ missions: formattedMissions });
  } catch (error) {
    console.error('Error fetching mission history:', error);
    res.status(500).json({ error: 'Failed to fetch mission history.', details: error.message });
  }
};

// Save final summary for a mission
const saveFinalSummary = async (req, res) => {
  try {
    const { userId, missionId, summary } = req.body;
    if (!userId || !missionId || !summary) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }
    const mission = await persistentMemory.saveFinalSummary(userId, missionId, summary);
    res.json({ success: true, mission });
  } catch (error) {
    console.error('❌ Error saving final summary:', error);
    res.status(500).json({ error: 'Failed to save final summary.' });
  }
};

// Check if a mission can be unlocked
const canUnlock = async (req, res) => {
  try {
    const { userId, missionId, requiredMissionId } = req.query;
    if (!userId || !missionId || !requiredMissionId) {
      return res.status(400).json({ error: 'Missing required query params.' });
    }
    const unlocked = await persistentMemory.canUnlock(userId, missionId, requiredMissionId);
    res.json({ canUnlock: unlocked });
  } catch (error) {
    console.error('❌ Error checking unlock:', error);
    res.status(500).json({ error: 'Failed to check unlock.' });
  }
};

module.exports = {
    chatWithAI,
    getUserTraits,
    getContextSummary,
    saveChoice,
    getUserTraitCounts,
    getMissionHistory,
    saveFinalSummary,
    canUnlock,
};