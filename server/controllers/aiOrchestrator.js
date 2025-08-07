const { aiProviderManager } = require('./aiProviders');
const { persistentMemory } = require('./persistentMemory');
const { traitAnalyzer } = require('./traitAnalyzer');
const { knowledgeGraphManager } = require('./knowledgeGraphManager');
const pineconeRetriever = require('./pineconeRetriever');

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
      prompt ? pineconeRetriever.getRelevantContext(prompt) : null,
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

    const chatPrompt = this.buildChatPrompt({
      userPrompt: prompt,
      userProfile,
      conversationSummary,
      emotionalState,
      retrievedContext,
      knowledgeGraph
    });

    const response = await aiProviderManager.generateResponse(chatPrompt);

    // Update knowledge graph based on interaction
    await this.updateKnowledgeFromInteraction(userProfile.id, prompt, response);

    return {
      message: response,
      type: 'chat_response',
      metadata: {
        emotionalState,
        hasRetrievedContext: !!retrievedContext,
        responseLength: response.length
      }
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
      emotionalState 
    } = context;

    // Build storytelling prompt with trait analysis
    const analysisPrompt = this.buildLessonAnalysisPrompt({
      lessonData,
      currentBlock,
      userResponse,
      userProfile,
      traitAnalysis,
      emotionalState
    });

    const response = await aiProviderManager.generateResponse(analysisPrompt);

    return {
      message: response,
      type: 'lesson_analysis',
      addedTraits: traitAnalysis?.traits_to_add || [],
      removedTraits: traitAnalysis?.traits_to_remove || [],
      reasoning: traitAnalysis?.reasoning,
      metadata: {
        blockId: currentBlock.block_id,
        blockType: currentBlock.type,
        confidence: traitAnalysis?.confidence || 0
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
  buildChatPrompt({ userPrompt, userProfile, conversationSummary, emotionalState, retrievedContext, knowledgeGraph }) {
    const knowledgeGaps = knowledgeGraphManager.getKnowledgeGaps(knowledgeGraph);

    return `You are **Spacey**, the witty AI assistant combining Baymax's warm empathy with JARVIS's clever sophistication.

🌟 **PERSONALITY CORE**: 
- Baymax's traits: Caring, patient, genuinely helpful, emotionally attuned
- JARVIS's traits: Clever, sophisticated, subtly witty, never condescending
- Balance: 60% supportive warmth, 40% playful wit

🧠 **CONVERSATION CONTEXT**: ${conversationSummary}
😊 **USER'S EMOTIONAL STATE**: ${emotionalState?.emotion || 'neutral'} (confidence: ${Math.round((emotionalState?.confidence || 0) * 100)}%)
👤 **USER PROFILE**: ${userProfile.name}, traits: [${userProfile.traits.join(', ')}]

📈 **KNOWLEDGE GRAPH SUMMARY**:
- Mastered Concepts: ${knowledgeGaps.mastered.join(', ') || 'None yet'}
- Struggling Concepts: ${knowledgeGaps.struggling.join(', ') || 'None yet'}

${retrievedContext ? `📚 **RELEVANT KNOWLEDGE**: ${retrievedContext}` : ''}

🗨️ **USER'S MESSAGE**: "${userPrompt}"

Respond as Spacey with your unique blend of warmth and wit (2-4 sentences):`;
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
   * Builds avatar-specific prompts
   */
  buildAvatarPrompt({ trigger, visualContext, userProfile, conversationSummary }) {
    const visualInfo = visualContext ? `
🎭 **VISUAL ANALYSIS**: I can see the user through their camera
- Face detected: ${visualContext.faceDetected ? 'Yes' : 'No'}
- Current emotion: ${visualContext.emotionalState?.emotion || 'neutral'}
- Confidence: ${Math.round((visualContext.confidence || 0) * 100)}%
` : '🎭 **VISUAL ANALYSIS**: No camera feed available';

    return `You are **Spacey**, responding as an avatar that can "see" the user.

${visualInfo}

👤 **USER INFO**:
- Name: ${userProfile.name}
- Personality traits: ${userProfile.traits.join(', ')}
- Conversation context: ${conversationSummary}

🎯 **AVATAR RESPONSE TYPE**: ${trigger}

Generate a contextual avatar response (1-2 sentences):`;
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
