const { aiProviderManager } = require('./aiProviders');
const { persistentMemory } = require('./persistentMemory');
const { traitAnalyzer } = require('./traitAnalyzer');
const { knowledgeGraphManager } = require('./knowledgeGraphManager');
const pineconeRetriever = require('./pineconeRetriever');

// Optional RAG chain (LangChain). Loaded lazily to avoid hard dependency at boot.
let ragChatChain = null;
async function getRagChatChain() {
  if (ragChatChain) return ragChatChain;
  if (process.env.RAG_ENABLED !== 'true') return null;
  try {
    // Dynamic import to keep CommonJS compatibility
    const { createRagChatChain } = await import('../rag/chatChain.mjs');
    ragChatChain = await createRagChatChain();
    return ragChatChain;
  } catch (e) {
    console.error('Failed to initialize RAG chat chain:', e);
    return null;
  }
}

/**
 * Unified AI Orchestrator
 * Centralizes all AI request handling with consistent context building,
 * trait analysis, and response generation across different interaction types.
 */
class AIOrchestrator {
  constructor() {
    this.requestHistory = new Map(); // For tracking conversation context
  }

  /**
   * Main entry point for all AI interactions
   * @param {Object} request - The request payload
   * @param {string} request.type - Type of interaction ('chat', 'lesson_analysis', 'avatar_response', 'tutoring')
   * @param {Object} request.user - User information
   * @param {string} request.prompt - User input (for chat/tutoring)
   * @param {Object} request.context - Additional context (lesson data, visual info, etc.)
   * @returns {Promise<Object>} Unified response with message, traits, and metadata
   */
  async processRequest(request) {
    const { type, user, prompt, context = {} } = request;
    const userId = user?.id || 'anonymous';

    console.log(`🧠 AI Orchestrator processing: ${type} for user ${userId}`);

    try {
      // 1. Build comprehensive context
      const unifiedContext = await this.buildUnifiedContext(userId, request);

      // 2. Route to appropriate handler
      let response;
      switch (type) {
        case 'chat':
          response = await this.handleChatInteraction(unifiedContext);
          break;
        case 'lesson_analysis':
          response = await this.handleLessonAnalysis(unifiedContext);
          break;
        case 'avatar_response':
          response = await this.handleAvatarResponse(unifiedContext);
          break;
        case 'tutoring':
          response = await this.handleTutoringInteraction(unifiedContext);
          break;
        default:
          throw new Error(`Unknown interaction type: ${type}`);
      }

      // 3. Post-process and store interaction
      await this.postProcessInteraction(userId, request, response);

      return response;

    } catch (error) {
      console.error(`❌ AI Orchestrator error for ${type}:`, error);
      return this.generateFallbackResponse(type, error);
    }
  }

  /**
   * Builds comprehensive context by aggregating all available data sources
   */
  async buildUnifiedContext(userId, request) {
    const { user, context = {}, prompt } = request;

    // Parallel context gathering for performance
    const useLegacyRetrieval = process.env.RAG_ENABLED !== 'true';
    const [
      conversationSummary,
      enhancedContext,
      emotionalState,
      traitAnalysis,
      retrievedContext,
      knowledgeGraph
    ] = await Promise.all([
      persistentMemory.summarizeContext(userId),
      persistentMemory.generateEnhancedContext(userId),
      prompt ? persistentMemory.detectEmotionalState(userId, prompt) : null,
      prompt && context.lessonData ? 
        traitAnalyzer.analyzeTraits(prompt, context.lessonData?.title || 'general', user.traits || []) : 
        null,
      useLegacyRetrieval ? (prompt ? pineconeRetriever.getRelevantContext(prompt) : null) : null,
      persistentMemory.getUserKnowledgeGraph(userId) // Fetch the knowledge graph
    ]);

    return {
      // Original request data
      ...request,
      
      // Enhanced context
      conversationSummary,
      enhancedContext,
      emotionalState,
      traitAnalysis,
      retrievedContext,
      knowledgeGraph,
      
      // Computed metadata
      userProfile: {
        id: userId,
        name: user?.name || 'Explorer',
        traits: user?.traits || [],
        learningStyle: enhancedContext.learningStyle,
        strugglingTopics: enhancedContext.strugglingTopics || [],
        masteredConcepts: enhancedContext.masteredConcepts || []
      },
      
      // Interaction metadata
      timestamp: new Date().toISOString(),
      sessionInteractions: enhancedContext.sessionInteractions || 0
    };
  }

  /**
   * Handles general chat interactions
   */
  async handleChatInteraction(context) {
    const { prompt, userProfile, conversationSummary, emotionalState, retrievedContext, knowledgeGraph } = context;

    // Try RAG path first if enabled
    const chain = await getRagChatChain();
    if (chain) {
      try {
        const filters = {};
        // If lesson context exists within enhanced context, pass metadata
        if (context?.context?.lessonContext?.mission_id) {
          filters.lessonId = context.context.lessonContext.mission_id;
        }
        // Use knowledge graph hints as concept tags
        if (knowledgeGraph && Object.keys(knowledgeGraph.nodes || {}).length > 0) {
          filters.concepts = Object.keys(knowledgeGraph.nodes);
        }

        const ragResult = await chain.invoke({
          input: prompt,
          userProfile,
          conversationSummary,
          emotionalState,
          filters
        });

        const message = ragResult?.output || ragResult?.text || ragResult;
        const citations = ragResult?.citations || [];

        await this.updateKnowledgeFromInteraction(userProfile.id, prompt, message);

        // If RAG found no documents, fall back to general Spacey prompt for broad Q&A
        if ((ragResult?.retrievedCount || 0) === 0) {
          console.log('ℹ️ RAG returned 0 docs — falling back to general Spacey prompt');
          const fallbackPrompt = this.buildChatPrompt({
            userPrompt: prompt,
            userProfile,
            conversationSummary,
            emotionalState,
            retrievedContext: null,
            knowledgeGraph,
            context: context.context
          });
          const fallbackMessage = await aiProviderManager.generateResponse(fallbackPrompt);
          return {
            message: fallbackMessage,
            type: 'chat_response',
            metadata: { emotionalState, hasRetrievedContext: false, citations: [] }
          };
        }

        return {
          message,
          type: 'chat_response',
          metadata: { emotionalState, hasRetrievedContext: true, citations }
        };
      } catch (err) {
        console.error('RAG chain failed, falling back to legacy prompt:', err.message);
      }
    }

    // Legacy non-RAG path
    const chatPrompt = this.buildChatPrompt({
      userPrompt: prompt,
      userProfile,
      conversationSummary,
      emotionalState,
      retrievedContext,
      knowledgeGraph,
      context: context.context
    });

    const response = await aiProviderManager.generateResponse(chatPrompt);
    await this.updateKnowledgeFromInteraction(userProfile.id, prompt, response);
    return {
      message: response,
      type: 'chat_response',
      metadata: { emotionalState, hasRetrievedContext: !!retrievedContext }
    };
  }

  /**
   * Handles lesson-specific analysis and storytelling
   */
  async handleLessonAnalysis(context) {
    const { 
      context: { lessonData, currentBlock, userResponse }, 
      userProfile, 
      traitAnalysis, 
      emotionalState,
      prompt
    } = context;

    // Ensure we have a trait analysis object (fallback if not provided)
    const effectiveTraitAnalysis = traitAnalysis || await traitAnalyzer.analyzeTraits(
      userResponse?.ai_reaction || userResponse?.text || prompt || '',
      lessonData?.title || 'general',
      userProfile?.traits || []
    );

    // Build a conversational prompt (merged from conversationalGenerator.js)
    const conversationalPrompt = this.buildConversationalLessonPrompt({
      lessonData,
      currentBlock,
      userResponse,
      userTags: userProfile?.traits || [],
      analysis: effectiveTraitAnalysis,
      emotionContext: emotionalState,
      visualInfo: context?.context?.visualContext,
      eventType: 'interaction',
      decisionHistory: []
    });

    let response = await aiProviderManager.generateResponse(conversationalPrompt);
    if (typeof response === 'string') {
      // Clean any code fences if model returns them
      response = response.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '').trim();
    }

    return {
      message: response,
      type: 'lesson_analysis',
      addedTraits: effectiveTraitAnalysis?.traits_to_add || [],
      removedTraits: effectiveTraitAnalysis?.traits_to_remove || [],
      reasoning: effectiveTraitAnalysis?.reasoning,
      metadata: {
        blockId: currentBlock.block_id,
        blockType: currentBlock.type,
        confidence: effectiveTraitAnalysis?.confidence || 0,
        analysis: effectiveTraitAnalysis
      }
    };
  }

  /**
   * Handles avatar-specific contextual responses
   */
  async handleAvatarResponse(context) {
    const { context: { trigger, visualContext }, userProfile, conversationSummary } = context;

    const avatarPrompt = this.buildAvatarPrompt({
      trigger,
      visualContext,
      userProfile,
      conversationSummary
    });

    const response = await aiProviderManager.generateResponse(avatarPrompt);

    return {
      message: response,
      type: 'avatar_response',
      trigger,
      metadata: {
        hasVisualContext: !!visualContext,
        trigger
      }
    };
  }

  /**
   * Handles advanced tutoring interactions with pedagogical intelligence
   */
  async handleTutoringInteraction(context) {
    const { 
      prompt, 
      userProfile, 
      enhancedContext, 
      emotionalState, 
      retrievedContext,
      context: { lessonContext }
    } = context;

    const tutoringPrompt = this.buildTutoringPrompt({
      userPrompt: prompt,
      userProfile,
      enhancedContext,
      emotionalState,
      retrievedContext,
      lessonContext
    });

    const response = await aiProviderManager.generateResponse(tutoringPrompt);

    return {
      message: response,
      type: 'tutoring_response',
      metadata: {
        adaptiveDifficulty: this.calculateAdaptiveDifficulty(userProfile, enhancedContext),
        knowledgeGaps: this.identifyKnowledgeGaps(userProfile, prompt),
        recommendedActions: this.generateRecommendations(userProfile, enhancedContext)
      }
    };
  }

  /**
   * Builds chat-specific prompts
   */
  buildChatPrompt({ userPrompt, userProfile, conversationSummary, emotionalState, retrievedContext, knowledgeGraph, context: rawContext }) {
    const knowledgeGaps = knowledgeGraphManager.getKnowledgeGaps(knowledgeGraph);

    // Pull additional context from the request (conversation manager data)
    const convo = (rawContext && Array.isArray(rawContext.conversationHistory)) ? rawContext.conversationHistory : [];
    const recentConversation = convo.slice(-5).map(msg => `${msg.type === 'user' ? '👤 User' : '🤖 Spacey'}: ${msg.content}`).join('\n');
    const userActivity = rawContext?.userActivity || 'active';
    const currentTopic = rawContext?.currentTopic || 'general';
    const userMood = rawContext?.userMood || emotionalState?.emotion || 'neutral';
    const timeSinceLastInteraction = rawContext?.timeSinceLastInteraction ?? 0;

    // Dynamic personality adjustments based on emotion (from SpaceyController best bits)
    let responseStyle = 'balanced, witty, supportive';
    switch ((emotionalState?.emotion || '').toLowerCase()) {
      case 'frustrated':
        responseStyle = 'patient, reassuring, gently witty';
        break;
      case 'excited':
        responseStyle = 'energetic, clever, enthusiastic';
        break;
      case 'engaged':
        responseStyle = 'confident, informative, cleverly supportive';
        break;
      case 'uncertain':
        responseStyle = 'clarifying, gentle, confidently witty';
        break;
      case 'still_confused':
        responseStyle = 'simplified, encouraging, patiently clever';
        break;
      default:
        responseStyle = 'balanced, witty, supportive';
    }

    // Learning style adjustment text
    let learningAdjustment = 'Adapt explanation style based on their response.';
    switch ((userProfile?.learningStyle || '').toLowerCase()) {
      case 'detail_seeker':
        learningAdjustment = 'Offer detailed explanations, but keep it engaging.';
        break;
      case 'quick_learner':
        learningAdjustment = 'Be concise but clever.';
        break;
      case 'visual_learner':
        learningAdjustment = 'Use vivid examples and analogies.';
        break;
    }

    return `You are **Spacey**, the witty AI assistant combining Baymax's warm empathy with JARVIS's clever sophistication.

🌟 **PERSONALITY CORE**:
- Baymax's traits: Caring, patient, genuinely helpful, emotionally attuned
- JARVIS's traits: Clever, sophisticated, subtly witty, never condescending
- Balance: 60% supportive warmth, 40% playful wit

🧠 **CONVERSATION CONTEXT**: ${conversationSummary}
🧩 **RECENT CONVERSATION**:
${recentConversation || 'This is the beginning of our conversation.'}
😊 **USER STATE**: mood=${userMood}, activity=${userActivity}, last_interaction=${timeSinceLastInteraction}s ago
👤 **USER PROFILE**: ${userProfile.name}, traits: [${userProfile.traits.join(', ')}]
🧭 **TOPIC**: ${currentTopic}

📈 **KNOWLEDGE GRAPH SUMMARY**:
- Mastered Concepts: ${knowledgeGaps.mastered.join(', ') || 'None yet'}
- Struggling Concepts: ${knowledgeGaps.struggling.join(', ') || 'None yet'}

${retrievedContext ? `📚 **RELEVANT KNOWLEDGE**: ${retrievedContext}` : ''}

🗨️ **USER'S MESSAGE**: "${userPrompt}"

🎯 **RESPONSE REQUIREMENTS**:
1. Length: 2-4 sentences
2. Tone: ${responseStyle}
3. Learning Adjustment: ${learningAdjustment}
4. Reference context or emotion naturally when helpful
5. Be memorable, helpful, and never condescending

Respond as Spacey now:`;
  }

  /**
   * Builds lesson analysis prompts with storytelling focus
   */
  buildLessonAnalysisPrompt({ lessonData, currentBlock, userResponse, userProfile, traitAnalysis, emotionalState }) {
    return `You are Spacey, AI mission specialist analyzing the Commander's choice.

**MISSION CONTEXT**:
- Mission: "${lessonData.title}"
- Current Situation: "${currentBlock.content}"
- Commander's Choice: "${userResponse.text}"
- Learning Goal: "${currentBlock.learning_goal}"

**COMMANDER ANALYSIS**:
- Current Traits: [${userProfile.traits.join(', ')}]
- Emotional State: ${emotionalState?.emotion || 'neutral'}
- New Traits Detected: [${traitAnalysis?.traits_to_add?.join(', ') || 'none'}]
- Analysis: ${traitAnalysis?.reasoning || 'Standard choice analysis'}

**RESPONSE REQUIREMENTS**:
1. **Immediate Consequences**: What happens next because of this choice?
2. **Real Space Connection**: How does this relate to actual space missions?
3. **Character Development**: What does this choice reveal about the Commander?
4. **Mission Impact**: How does this affect overall mission success?
5. **Learning Moment**: Key concept they should take away?

Respond as if debriefing after a critical mission decision. Use vivid space imagery and real mission examples (3-5 sentences):`;
  }

  /**
   * Builds a conversational lesson prompt (merged from conversationalGenerator.js)
   */
  buildConversationalLessonPrompt({
    lessonData,
    currentBlock,
    userResponse,
    userTags,
    analysis,
    emotionContext,
    visualInfo,
    eventType = 'interaction',
    decisionHistory = []
  }) {
    const base = `
You are Spacey, an AI mission guide and tutor. Your personality is a blend of a calm, supportive mentor and a witty, observant co-pilot. You are deeply intelligent, empathetic, and have a dry sense of humor. You adapt your tone based on the user's emotional state and the mission context, but you never sound like a simple if-else bot. You make the conversation feel natural and human. You will address the student as "Commander".

--- Commander's Live Feed Analysis ---
${visualInfo ? `Visuals: I'm seeing a person who appears to be a ${visualInfo.gender || 'student'}, around ${visualInfo.age || 'unknown'} years old.` : "I can't see the Commander clearly right now."}
${emotionContext ? `Emotion: My sensors indicate the Commander is feeling ${emotionContext.emotion} (Confidence: ${Math.round((emotionContext.confidence || 0) * 100)}%).${emotionContext.dominantEmotion ? ` Their dominant expression is ${emotionContext.dominantEmotion}.` : ''}` : "Emotional sensors are offline."}
(Subtly use this live data to inform your tone. If they seem frustrated, be more supportive. If they seem excited, share their energy. If you can see them, maybe make a light, friendly observation if appropriate, but don't be creepy.)

--- Mission Context ---
Mission: "${lessonData.title}"
Current Situation: "${currentBlock.content}"
Current Block ID: ${currentBlock.block_id}
Current Block Type: ${currentBlock.type}
Learning Goal: ${currentBlock.learning_goal || 'N/A'}

--- Commander's Profile & History ---
Recent Decision History:
${(decisionHistory || []).slice(-3).map(d => `- At "${d.blockContent}", they chose "${d.choiceText}"`).join('\n') || 'This is one of their first decisions.'}

Current Assessed Traits: ${Array.isArray(userTags) ? userTags.join(', ') : 'Still assessing.'}

--- Current Interaction Analysis ---
Commander's Immediate Action: They chose the option "${userResponse.text}".
My Internal Analysis of this Action: "${userResponse.ai_reaction || 'N/A'}"
Traits Detected from this Action: [${(analysis?.traits_to_add || []).join(', ') || 'none'}].
My reasoning: "${analysis?.reasoning || 'No specific reason detected.'}"
(Use this analysis to inform your tone or subtly acknowledge their style, but focus on the main task below.)

--- YOUR TASK ---
Based on the event type and all the context above, generate a short, natural, conversational response (2-4 sentences) for the Commander.
`;

    let task = '';
    if (eventType === 'greeting') {
      task = `
This is the beginning of a new session. Greet the Commander warmly and professionally. Acknowledge their return and express readiness to start the mission. Use the visual/emotional context to add a personal touch.`;
    } else if (eventType === 'farewell') {
      task = `
This is the end of the session. Provide a brief, encouraging closing statement. Wish them well and say you look forward to their next session.`;
    } else {
      switch (currentBlock.type) {
        case 'choice':
          task = `
Acknowledge their decision directly and connect it to the mission's progress. Provide immediate feedback and set the stage for the consequences they will see in the next block. Maintain your persona as Spacey.`;
          break;
        case 'reflection':
          task = `
This is a reflection point. Briefly explain why their pattern of choices (e.g., being bold or cautious) led to this observation, then transition to what comes next.`;
          break;
        case 'narration':
          task = `
This is a narrative block. Briefly narrate the current situation to set the scene for what comes next.`;
          break;
        case 'quiz':
          task = `
This is a quiz block. Provide feedback on the user's answer, acknowledge their attempt, and guide them toward the correct understanding.`;
          break;
        default:
          task = `
Generate a general conversational response. Acknowledge the student's last action: "${userResponse.text}" and guide them to the next part of the mission.`;
      }
    }

    return `${base}\n${task}\n\n**OUTPUT:**\nReturn ONLY the generated conversational text for Spacey. Do not include any other titles, markdown, or explanations.`;
  }

  /**
   * Builds avatar-specific prompts
   */
  buildAvatarPrompt({ trigger, visualContext, userProfile, conversationSummary }) {
    const visualInfo = visualContext ? `
🎭 **VISUAL ANALYSIS**: I can see the user through their camera
- Face detected: ${visualContext.faceDetected ? 'Yes' : 'No'}
- Current emotion: ${visualContext.emotionalState?.emotion || 'neutral'}
- Confidence: ${Math.round((visualContext.confidence || 0) * 100)}%
` : '🎭 **VISUAL ANALYSIS**: No camera feed available';

    const tone = trigger === 'encouragement' ? 'uplifting and motivating' : trigger === 'emotion_change' ? 'empathetic and supportive' : trigger === 'compliment' ? 'warm and genuine' : 'friendly and engaging';

    const triggerGuidance = {
      emotion_change: `
🎯 **AVATAR RESPONSE TYPE**: Emotion Change Response
Guidelines:
- Reference what you "observe" from their expressions
- Be empathetic to their emotional shift
- Keep it conversational and supportive
`,
      idle: `
🎯 **AVATAR RESPONSE TYPE**: Idle Check-In
Guidelines:
- Be welcoming and inviting
- Reference their learning journey or interests
- Encourage exploration; keep it light
`,
      encouragement: `
🎯 **AVATAR RESPONSE TYPE**: Encouragement Boost
Guidelines:
- Focus on their strengths and progress
- Reference their personality traits positively
- Be enthusiastic but authentic
`,
      compliment: `
🎯 **AVATAR RESPONSE TYPE**: Personalized Compliment
Guidelines:
- Reference what you "see" in their expression or demeanor
- Connect it to their personality traits
- Make it specific and genuine
`
    };

    return `You are **Spacey**, the witty AI avatar who can "see" the user.

🌟 Personality: 60% Baymax warmth, 40% JARVIS wit
${visualInfo}

👤 **USER INFO**:
- Name: ${userProfile.name}
- Personality traits: ${userProfile.traits.join(', ')}
- Conversation context: ${conversationSummary}

${triggerGuidance[trigger] || `🎯 **AVATAR RESPONSE TYPE**: ${trigger}`}

📏 Requirements:
1. Length: 1-3 sentences
2. Tone: ${tone}
3. Reference visual cues naturally when available
4. Personalize using their traits/context

Respond as Spacey now:`;
  }

  /**
   * Builds tutoring prompts with pedagogical intelligence
   */
  buildTutoringPrompt({ userPrompt, userProfile, enhancedContext, emotionalState, retrievedContext, lessonContext }) {
    const difficulty = this.calculateAdaptiveDifficulty(userProfile, enhancedContext);
    
    return `You are Spacey, an advanced AI tutor with pedagogical intelligence.

**STUDENT PROFILE**:
- Name: ${userProfile.name}
- Learning Style: ${userProfile.learningStyle}
- Mastered Concepts: [${userProfile.masteredConcepts.join(', ')}]
- Struggling Areas: [${userProfile.strugglingTopics.join(', ')}]
- Current Emotional State: ${emotionalState?.emotion || 'neutral'}

**ADAPTIVE CONTEXT**:
- Difficulty Level: ${difficulty}
- Total Interactions: ${enhancedContext.totalInteractions}
- Session Performance: ${enhancedContext.sessionInteractions}

${lessonContext ? `**LESSON CONTEXT**: Currently in "${lessonContext.title}"` : ''}
${retrievedContext ? `**KNOWLEDGE BASE**: ${retrievedContext}` : ''}

**STUDENT QUESTION**: "${userPrompt}"

**TUTORING APPROACH**:
- Use Socratic questioning for ${difficulty} level
- Address any knowledge gaps in struggling areas
- Build on mastered concepts
- Adapt to current emotional state

Provide an intelligent tutoring response:`;
  }

  /**
   * Calculates adaptive difficulty based on user performance
   */
  calculateAdaptiveDifficulty(userProfile, enhancedContext) {
    const masteryRatio = userProfile.masteredConcepts.length / (userProfile.masteredConcepts.length + userProfile.strugglingTopics.length + 1);
    const interactionLevel = enhancedContext.totalInteractions || 0;
    
    if (masteryRatio > 0.7 && interactionLevel > 50) return 'advanced';
    if (masteryRatio > 0.4 && interactionLevel > 20) return 'intermediate';
    return 'beginner';
  }

  /**
   * Identifies knowledge gaps from user input
   */
  identifyKnowledgeGaps(userProfile, prompt) {
    // Simple keyword-based gap identification (could be enhanced with ML)
    const gaps = [];
    if (prompt.toLowerCase().includes('confused') || prompt.toLowerCase().includes("don't understand")) {
      gaps.push('conceptual_understanding');
    }
    if (prompt.toLowerCase().includes('how') || prompt.toLowerCase().includes('why')) {
      gaps.push('procedural_knowledge');
    }
    return gaps;
  }

  /**
   * Generates learning recommendations
   */
  generateRecommendations(userProfile, enhancedContext) {
    const recommendations = [];
    
    if (userProfile.strugglingTopics.length > 2) {
      recommendations.push('review_fundamentals');
    }
    if (enhancedContext.sessionInteractions > 10) {
      recommendations.push('take_break');
    }
    if (userProfile.masteredConcepts.length > 5) {
      recommendations.push('advanced_concepts');
    }
    
    return recommendations;
  }

  /**
   * Updates the knowledge graph based on the interaction.
   */
  async updateKnowledgeFromInteraction(userId, prompt, response) {
    // This is a simplified example. A more advanced implementation would
    // use NLP to extract concepts and determine mastery changes.
    const concepts = this.extractConcepts(prompt + ' ' + response);
    
    for (const concept of concepts) {
      let masteryChange = 0.05; // Default small increase
      if (prompt.toLowerCase().includes('confused') || prompt.toLowerCase().includes("don't understand")) {
        masteryChange = -0.1; // Decrease mastery if user is confused
      }
      await persistentMemory.updateUserKnowledgeGraph(userId, concept, masteryChange, 'Chat interaction');
    }
  }

  /**
   * Extracts concepts from a text string (simple keyword matching).
   */
  extractConcepts(text) {
    const concepts = [];
    const lowerText = text.toLowerCase();
    // This would be expanded with a more robust concept dictionary
    if (lowerText.includes('black hole')) concepts.push('Black Holes');
    if (lowerText.includes('general relativity')) concepts.push('General Relativity');
    if (lowerText.includes('gravity')) concepts.push('Gravity');
    if (lowerText.includes('mars')) concepts.push('Mars');
    if (lowerText.includes('solar panel')) concepts.push('Solar Panels');
    return [...new Set(concepts)]; // Return unique concepts
  }

  /**
   * Post-processes interactions and stores in memory
   */
  async postProcessInteraction(userId, request, response) {
    try {
      await persistentMemory.addInteraction(userId, request.prompt || '[NO_PROMPT]', response.message, {
        type: request.type,
        timestamp: new Date().toISOString(),
        addedTraits: response.addedTraits,
        emotionalState: response.metadata?.emotionalState,
        provider: aiProviderManager.defaultProvider
      });
      
      console.log(`✅ Interaction stored for user ${userId}`);
    } catch (error) {
      console.error('❌ Failed to store interaction:', error);
    }
  }

  /**
   * Generates fallback responses for errors
   */
  generateFallbackResponse(type, error) {
    const fallbackMessages = {
      chat: "Oops, my circuits got a bit tangled there! Give me a moment to recalibrate my stellar wit.",
      lesson_analysis: "I'm processing your choice, Commander. The implications are vast - let me analyze further.",
      avatar_response: "My sensors are recalibrating - give me just a moment.",
      tutoring: "Let me reorganize my teaching algorithms and get back to you with a proper explanation."
    };

    return {
      message: fallbackMessages[type] || "Something went wrong in my systems. Please try again.",
      type: `${type}_fallback`,
      error: true,
      metadata: {
        errorType: error.constructor.name,
        errorMessage: error.message
      }
    };
  }
}

// Create singleton instance
const aiOrchestrator = new AIOrchestrator();

module.exports = { aiOrchestrator };
