const { aiProviderManager } = require('./aiProviders');
const { conversationMemory } = require('./conversationMemory');
const { persistentMemory } = require('./persistentMemory');
const { traitAnalyzer } = require('./traitAnalyzer');

console.log('🔧 SpaceyController loaded');
console.log('🤖 Available AI providers:', Object.keys(aiProviderManager.getAvailableProviders()));
console.log('🧠 Memory system loaded:', !!conversationMemory);
console.log('💾 Persistent memory loaded:', !!persistentMemory);
console.log('🎯 Trait analyzer loaded:', !!traitAnalyzer);

const buildSystemPrompt = (userPrompt, userInfo = {}, conversationContext = {}) => {
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

// Handle different request types
const chatWithAI = async (req, res) => {
    try {
        console.log('🎯 Spacey chat request received:', req.body);
        
        // Get request data
        const { prompt, user, type, visualContext, trigger, visualAnalysis } = req.body;
        
        const userId = user?.id || 'anonymous';
        console.log('👤 User ID:', userId);
        console.log('🎭 Request type:', type || 'standard_chat');

        // Handle different request types
        switch (type) {
            case 'avatar_response':
                return await handleAvatarResponse(req, res, userId, user, visualContext, trigger);
            
            case 'personalized_compliment':
                return await handlePersonalizedCompliment(req, res, userId, user, visualAnalysis);
            
            case 'enhanced_chat':
                return await handleEnhancedChat(req, res, userId, user, prompt, visualContext);
            
            case 'standard_chat':
                return await handleUnifiedChat(req, res, userId, user, prompt, req.body);
            
            default:
                return await handleUnifiedChat(req, res, userId, user, prompt, req.body);
        }

    } catch (error) {
        console.error("❌ Error in chatWithAI:", error);
        res.status(500).json({ 
            error: "Internal server error occurred.",
            debug: {
                errorMessage: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
                timestamp: new Date().toISOString()
            }
        });
    }
};

// Handle avatar contextual responses
const handleAvatarResponse = async (req, res, userId, user, visualContext, trigger) => {
    try {
        console.log('🤖 Generating avatar response for trigger:', trigger);
        
        // Get conversation context
        const conversationSummary = await persistentMemory.summarizeContext(userId);
        const enhancedContext = await persistentMemory.generateEnhancedContext(userId);
        
        const conversationContext = {
            conversationSummary,
            ...enhancedContext
        };

        // Build avatar-specific prompt
        const avatarPrompt = buildAvatarPrompt(trigger, user, visualContext, conversationContext);
        
        // Generate response
        const response = await aiProviderManager.generateResponse(avatarPrompt);
        console.log('✅ Avatar response generated:', response.substring(0, 100) + '...');

        // Store interaction with avatar context
        await persistentMemory.addInteraction(userId, `[AVATAR_${trigger.toUpperCase()}]`, response, {
            type: 'avatar_response',
            trigger,
            visualContext,
            timestamp: new Date().toISOString()
        });

        res.json({ 
            response,
            type: 'avatar_response',
            trigger,
            debug: {
                provider: aiProviderManager.defaultProvider,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Avatar response error:', error);
        res.status(500).json({ error: 'Failed to generate avatar response' });
    }
};

// Handle personalized compliments
const handlePersonalizedCompliment = async (req, res, userId, user, visualAnalysis) => {
    try {
        console.log('🎭 Generating personalized compliment');
        
        // Use avatar response handler with compliment trigger
        return await handleAvatarResponse(req, res, userId, user, visualAnalysis, 'compliment');

    } catch (error) {
        console.error('❌ Compliment generation error:', error);
        res.status(500).json({ error: 'Failed to generate personalized compliment' });
    }
};

// Handle enhanced chat with visual context
const handleEnhancedChat = async (req, res, userId, user, prompt, visualContext) => {
    try {
        console.log('🚀 Processing enhanced chat with visual context');
        
        // Get conversation context
        let emotionalState = await persistentMemory.detectEmotionalState(userId, prompt);
        
        // Merge visual emotion data if available
        if (visualContext?.emotionalState?.visual) {
            console.log('🎭 Merging visual emotion data with text analysis');
            emotionalState = {
                emotion: visualContext.emotionalState.emotion,
                confidence: Math.max(emotionalState.confidence, visualContext.emotionalState.confidence),
                visual: true,
                textBased: emotionalState.emotion,
                visualBased: visualContext.emotionalState.emotion
            };
        }

        const conversationSummary = await persistentMemory.summarizeContext(userId);
        const learningStyle = await persistentMemory.getUserLearningStyle(userId);
        const enhancedContext = await persistentMemory.generateEnhancedContext(userId);
        
        const conversationContext = {
            emotionalState,
            conversationSummary,
            learningStyle,
            recentTopics: enhancedContext.recentTopics,
            totalInteractions: enhancedContext.totalInteractions,
            sessionInteractions: enhancedContext.sessionInteractions,
            preferredTopics: enhancedContext.preferredTopics || [],
            strugglingTopics: enhancedContext.strugglingTopics || [],
            masteredConcepts: enhancedContext.masteredConcepts || [],
            dominantMood: enhancedContext.dominantMood,
            averageMessageLength: enhancedContext.averageMessageLength,
            topInterests: enhancedContext.topInterests || []
        };

        // Add visual context to the prompt
        let enhancedPrompt = prompt;
        if (visualContext?.visualDescription) {
            enhancedPrompt = `${prompt}

[VISUAL CONTEXT: I can see that ${visualContext.visualDescription}. The user appears ${visualContext.emotionalState.emotion} with ${Math.round(visualContext.confidence * 100)}% confidence.]`;
        }

        // Build enhanced system prompt
        const fullPrompt = buildSystemPrompt(enhancedPrompt, user, conversationContext);
        
        // Generate response
        const response = await aiProviderManager.generateResponse(fullPrompt);
        console.log('✅ Enhanced chat response generated:', response.substring(0, 100) + '...');

        // Store interaction with visual context
        await persistentMemory.addInteraction(userId, prompt, response, {
            emotionalState,
            learningStyle,
            visualContext,
            timestamp: new Date().toISOString(),
            type: 'enhanced_chat'
        });

        res.json({ 
            message: response,
            type: 'enhanced_chat',
            debug: {
                provider: aiProviderManager.defaultProvider,
                emotionalState,
                learningStyle,
                visualContext: visualContext ? 'included' : 'none',
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Enhanced chat error:', error);
        res.status(500).json({ error: 'Failed to generate enhanced response' });
    }
};

// Handle unified chat with enhanced context and personality consistency
const handleUnifiedChat = async (req, res, userId, user, prompt, requestBody = {}) => {
    if (!prompt) {
        console.log('❌ No prompt provided');
        return res.status(400).json({ 
            error: "A prompt is required.",
            debug: {
                received: requestBody,
                missing: "prompt field"
            }
        });
    }

    console.log('💭 Unified chat request:', prompt);
    console.log('👤 User info:', user);
    console.log('📦 Request context:', {
        conversationHistory: requestBody.conversationHistory?.length || 0,
        emotionContext: !!requestBody.emotionContext,
        userActivity: requestBody.userActivity,
        currentTopic: requestBody.currentTopic
    });

    try {
        // Get enhanced conversation context
        let emotionalState = await persistentMemory.detectEmotionalState(userId, prompt);
        
        // Use provided emotion context if available (from conversation manager)
        if (requestBody.emotionContext && requestBody.emotionContext.confidence > emotionalState.confidence) {
            console.log('🎭 Using enhanced emotion context from conversation manager');
            emotionalState = {
                emotion: requestBody.emotionContext.emotion,
                confidence: requestBody.emotionContext.confidence,
                visual: true,
                textBased: emotionalState.emotion,
                visualBased: requestBody.emotionContext.emotion,
                visualDescription: requestBody.emotionContext.visualDescription
            };
        }

        const conversationSummary = await persistentMemory.summarizeContext(userId);
        const learningStyle = await persistentMemory.getUserLearningStyle(userId);
        const enhancedContext = await persistentMemory.generateEnhancedContext(userId);
        
        // Merge conversation manager context with persistent memory
        const conversationContext = {
            emotionalState,
            conversationSummary,
            learningStyle,
            recentTopics: enhancedContext.recentTopics,
            totalInteractions: enhancedContext.totalInteractions,
            sessionInteractions: enhancedContext.sessionInteractions,
            preferredTopics: enhancedContext.preferredTopics || [],
            strugglingTopics: enhancedContext.strugglingTopics || [],
            masteredConcepts: enhancedContext.masteredConcepts || [],
            dominantMood: requestBody.userMood || enhancedContext.dominantMood,
            averageMessageLength: enhancedContext.averageMessageLength,
            topInterests: enhancedContext.topInterests || [],
            // Add conversation manager context
            userActivity: requestBody.userActivity || 'active',
            currentTopic: requestBody.currentTopic,
            timeSinceLastInteraction: requestBody.timeSinceLastInteraction || 0,
            // Include recent conversation history for immediate context
            recentConversation: requestBody.conversationHistory || []
        };

        // Enhance prompt with visual context if available
        let enhancedPrompt = prompt;
        if (requestBody.emotionContext?.visualDescription) {
            enhancedPrompt = `${prompt}\n\n[VISUAL CONTEXT: I can see that ${requestBody.emotionContext.visualDescription}. The user appears ${requestBody.emotionContext.emotion} with ${Math.round(requestBody.emotionContext.confidence * 100)}% confidence.]`;
        }

        console.log('🧠 Unified emotional state:', emotionalState);
        console.log('📚 Learning style:', learningStyle);
        console.log('💭 Enhanced conversation context with visual data');

        // Build the enhanced prompt with unified personality
        const fullPrompt = buildSystemPrompt(enhancedPrompt, user, conversationContext);
        console.log('📝 Unified prompt built with complete context');

        // Generate response with unified Spacey personality
        console.log('🤖 Generating unified Spacey response...');
        const response = await aiProviderManager.generateResponse(fullPrompt);
        console.log('✅ Unified response generated:', response.substring(0, 100) + '...');
        
        // Store the interaction with enhanced context
        await persistentMemory.addInteraction(userId, prompt, response, {
            emotionalState,
            learningStyle,
            timestamp: new Date().toISOString(),
            provider: aiProviderManager.defaultProvider,
            emotionalConfidence: emotionalState.confidence,
            hasVisualContext: !!requestBody.emotionContext?.visualDescription,
            conversationManagerContext: {
                userActivity: requestBody.userActivity,
                currentTopic: requestBody.currentTopic,
                userMood: requestBody.userMood
            },
            type: 'unified_chat'
        });
        
        console.log('💾 Unified interaction saved to persistent memory');
        
        // Send unified response
        res.json({ 
            message: response,
            type: 'unified_chat',
            debug: {
                provider: aiProviderManager.defaultProvider,
                emotionalState,
                learningStyle,
                hasVisualContext: !!requestBody.emotionContext?.visualDescription,
                conversationManagerIntegration: true,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Unified chat error:', error);
        res.status(500).json({ 
            error: "Failed to generate unified response",
            message: "Sorry, my circuits got a bit tangled! Give me a moment to recalibrate my stellar wit.",
            debug: {
                error: error.message,
                timestamp: new Date().toISOString()
            }
        });
    }
};

// Handle standard chat (original functionality) - DEPRECATED, use handleUnifiedChat
const handleStandardChat = async (req, res, userId, user, prompt) => {
    if (!prompt) {
        console.log('❌ No prompt provided');
        return res.status(400).json({ 
            error: "A prompt is required.",
            debug: {
                received: req.body,
                missing: "prompt field"
            }
        });
    }

    console.log('💭 User prompt:', prompt);
    console.log('👤 User info:', user);

    // Get enhanced conversation context and emotional analysis
    const emotionalState = await persistentMemory.detectEmotionalState(userId, prompt);
    const conversationSummary = await persistentMemory.summarizeContext(userId);
    const learningStyle = await persistentMemory.getUserLearningStyle(userId);
    const enhancedContext = await persistentMemory.generateEnhancedContext(userId);
    
    // Build comprehensive conversation context
    const conversationContext = {
        emotionalState,
        conversationSummary,
        learningStyle,
        recentTopics: enhancedContext.recentTopics,
        // Enhanced context from persistent memory
        totalInteractions: enhancedContext.totalInteractions,
        sessionInteractions: enhancedContext.sessionInteractions,
        preferredTopics: enhancedContext.preferredTopics || [],
        strugglingTopics: enhancedContext.strugglingTopics || [],
        masteredConcepts: enhancedContext.masteredConcepts || [],
        dominantMood: enhancedContext.dominantMood,
        averageMessageLength: enhancedContext.averageMessageLength,
        topInterests: enhancedContext.topInterests || []
    };
    
    console.log('🧠 Emotional state detected:', emotionalState);
    console.log('📚 Learning style:', learningStyle);
    console.log('💭 Conversation context:', conversationSummary);

    // Build the enhanced prompt with personality and context
    const fullPrompt = buildSystemPrompt(prompt, user, conversationContext);
    console.log('📝 Enhanced prompt built with context');

    // Use the AI provider manager - NO FALLBACKS
    console.log('🤖 Generating AI response from real LLM...');
    let response;
    
    try {
        response = await aiProviderManager.generateResponse(fullPrompt);
        console.log('✅ Real LLM response generated:', response.substring(0, 100) + '...');
        
        // Store the interaction in persistent memory
        await persistentMemory.addInteraction(userId, prompt, response, {
            emotionalState,
            learningStyle,
            timestamp: new Date().toISOString(),
            provider: aiProviderManager.defaultProvider,
            emotionalConfidence: emotionalState.confidence
        });
        
        console.log('💾 Interaction saved to persistent memory');
        
    } catch (aiError) {
        console.error('❌ AI generation failed completely:', aiError.message);
        
        // NO FALLBACKS - Return proper error
        return res.status(503).json({ 
            error: "AI service temporarily unavailable",
            message: "Unable to generate AI response at this time. Please try again in a moment.",
            debug: {
                aiError: aiError.message,
                availableProviders: Object.keys(aiProviderManager.getAvailableProviders()),
                defaultProvider: aiProviderManager.defaultProvider,
                userPrompt: prompt,
                timestamp: new Date().toISOString()
            }
        });
    }

    // Send the AI's response back to the client
    res.json({ 
        message: response,
        debug: {
            provider: aiProviderManager.defaultProvider,
            emotionalState,
            learningStyle,
            timestamp: new Date().toISOString()
        }
    });
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
    const traits = await persistentMemory.getUserTraits(userId);
    res.json({ traits });
  } catch (error) {
    console.error('❌ Error fetching user trait counts:', error);
    res.status(500).json({ error: 'Failed to fetch user trait counts.' });
  }
};

// Get mission history
const getMissionHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const missions = await persistentMemory.getMissionHistory(userId);
    res.json({ missions });
  } catch (error) {
    console.error('❌ Error fetching mission history:', error);
    res.status(500).json({ error: 'Failed to fetch mission history.' });
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