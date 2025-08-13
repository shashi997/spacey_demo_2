// Removed direct pinecone init and unused provider import to keep controller lean
const { persistentMemory } = require('./persistentMemory');
const { traitAnalyzer } = require('./traitAnalyzer');
const { aiOrchestrator } = require('./aiOrchestrator'); // Add unified orchestrator

console.log('🔧 SpaceyController loaded');
console.log('💾 Persistent memory loaded:', !!persistentMemory);
console.log('🎯 Trait analyzer loaded:', !!traitAnalyzer);
console.log('🎭 AI Orchestrator loaded:', !!aiOrchestrator);

// Controller should not perform startup side-effects. Pinecone initializes lazily in retriever.

// Removed legacy prompt builders; prompts are unified in aiOrchestrator

// Build avatar-specific prompts for contextual responses
// Removed legacy avatar prompt; handled by aiOrchestrator

// Unified chat handler for all request types
const chatWithAI = async (req, res) => {
    try {
        console.log('🎯 Unified chat request received via orchestrator:', req.body);
        
        const { prompt, user, type = 'unified_chat', visualContext, trigger, ...requestBody } = req.body;
        // Canonicalize user id to avoid fragmentation (anonymous vs real)
        const parseCookies = (cookieHeader = '') => {
            try {
                const entries = cookieHeader.split(';').map(c => c.trim()).filter(Boolean).map(kv => {
                    const idx = kv.indexOf('=');
                    if (idx === -1) return [kv, ''];
                    return [decodeURIComponent(kv.slice(0, idx)), decodeURIComponent(kv.slice(idx + 1))];
                });
                return Object.fromEntries(entries);
            } catch { return {}; }
        };

        const cookieHeader = req.headers['cookie'] || '';
        const cookies = parseCookies(cookieHeader);
        const cookieUserId = cookies['spacey_uid'];

        const headerUserId = req.headers['x-user-id'];
        const headerEmail = req.headers['x-user-email'] || user?.email;
        const bodyUserId = user?.id;

        let userId = 'anonymous';
        if (headerUserId && typeof headerUserId === 'string') {
            userId = headerUserId;
        } else if (bodyUserId && !String(bodyUserId).startsWith('anonymous')) {
            userId = bodyUserId;
        } else if (cookieUserId && typeof cookieUserId === 'string') {
            userId = cookieUserId;
        } else if (headerEmail && typeof headerEmail === 'string' && headerEmail.toLowerCase() !== 'anonymous@example.com') {
            userId = `email:${headerEmail.toLowerCase()}`;
        }

        // Persist canonical id in cookie for cross-request continuity
        if (userId && !String(userId).startsWith('anonymous')) {
            res.setHeader('Set-Cookie', `spacey_uid=${encodeURIComponent(userId)}; Path=/; HttpOnly; SameSite=Lax`);
        }
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
        } else if (type === 'tutoring') {
            orchestratorType = 'tutoring';
            context = {
                visualContext,
                conversationHistory: requestBody.conversationHistory || [],
                emotionContext: requestBody.emotionContext,
                userActivity: requestBody.userActivity || 'active',
                currentTopic: requestBody.currentTopic,
                userMood: requestBody.userMood,
                timeSinceLastInteraction: requestBody.timeSinceLastInteraction || 0,
                // Pass through lesson context if provided by client
                lessonContext: requestBody.lessonContext || null
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
                provider: 'orchestrator',
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

        const userTraits = await persistentMemory.getUserTraits(userId);
        if (!userTraits) {
          return res.status(404).json({ error: 'User traits not found' });
        }

        res.json({ traits: userTraits });

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