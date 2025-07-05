const { aiProviderManager } = require('./aiProviders');
const { conversationMemory } = require('./conversationMemory');
const { traitAnalyzer } = require('./traitAnalyzer');

console.log('🔧 SpaceyController loaded');
console.log('🤖 Available AI providers:', Object.keys(aiProviderManager.getAvailableProviders()));
console.log('🧠 Memory system loaded:', !!conversationMemory);
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
    recentTopics = []
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

🌌 **CURRENT SITUATION**:
- Location: ${location}
- User traits: ${traits.join(', ')}
- Recent topics: ${recentTopics.length ? recentTopics.join(', ') : 'None yet'}

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

const chatWithAI = async (req, res) => {
    try {
        console.log('🎯 Spacey chat request received:', req.body);
        
        // Get the user's prompt from the request body
        const { prompt, user } = req.body;

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

        const userId = user?.id || 'anonymous';

        // Get conversation context and emotional analysis
        const emotionalState = conversationMemory.detectEmotionalState(userId, prompt);
        const conversationSummary = conversationMemory.summarizeContext(userId);
        const learningStyle = conversationMemory.getUserLearningStyle(userId);
        const recentInteractions = conversationMemory.getRecentInteractions(userId, 3);
        
        // Extract recent topics for context
        const recentTopics = [];
        recentInteractions.forEach(interaction => {
            const msg = interaction.userMessage.toLowerCase();
            if (msg.includes('mars')) recentTopics.push('Mars');
            if (msg.includes('black hole')) recentTopics.push('black holes');
            if (msg.includes('space')) recentTopics.push('space science');
            if (msg.includes('planet')) recentTopics.push('planets');
        });
        
        const conversationContext = {
            emotionalState,
            conversationSummary,
            learningStyle,
            recentTopics: [...new Set(recentTopics)]
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
            
            // Store the interaction in memory
            conversationMemory.addInteraction(userId, prompt, response, {
                emotionalState,
                learningStyle,
                timestamp: new Date().toISOString(),
                provider: aiProviderManager.defaultProvider
            });
            
            console.log('💾 Interaction saved to memory');
            
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
}

module.exports = {
    chatWithAI
}