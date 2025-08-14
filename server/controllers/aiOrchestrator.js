const { aiProviderManager } = require('./aiProviders');
const { persistentMemory } = require('./persistentMemory');
const { traitAnalyzer } = require('./traitAnalyzer');
const { knowledgeGraphManager } = require('./knowledgeGraphManager');
const pineconeRetriever = require('./pineconeRetriever');
const { conversationMemory } = require('./conversationMemory');
const { extractAndStoreFacts, extractHybrid, personalizationController } = require('./personalizationController');
const prompts = require('../prompts');
const userProfileMemory = require('./userProfileMemory');

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
      knowledgeGraph,
      latestSummary,
      semanticMemory
    ] = await Promise.all([
      persistentMemory.summarizeContext(userId),
      persistentMemory.generateEnhancedContext(userId),
      prompt ? persistentMemory.detectEmotionalState(userId, prompt) : null,
      prompt && context.lessonData ? 
        traitAnalyzer.analyzeTraits(prompt, context.lessonData?.title || 'general', user.traits || []) : 
        null,
      useLegacyRetrieval ? (prompt ? pineconeRetriever.getRelevantContext(prompt) : null) : null,
      persistentMemory.getUserKnowledgeGraph(userId), // Fetch the knowledge graph
      persistentMemory.loadLatestSummary(userId),
      (async () => {
        if (!prompt) return '';
        const main = await conversationMemory.searchRelevant(userId, prompt, Number(process.env.CONVERSATIONS_TOP_K || 4));
        // Try identity recall as a second pass if name/email asked
        let identity = '';
        const identityHints = /(my name|what.*my name|who am i|my email)/i.test(prompt || '')
          ? await conversationMemory.searchRelevant(userId, 'user_name OR user_email', 2)
          : '';
        identity = identityHints || '';
        // Include brief Context Header from profile & sessions
        let header = '';
        try {
          const profile = await persistentMemory.getUserProfile(userId);
          const now = Date.now();
          const notExpired = !profile.sessions._ephemeralExpiry || profile.sessions._ephemeralExpiry > now;
          const currentSubject = notExpired ? profile.sessions.currentSubject : null;
          const currentTask = notExpired ? profile.sessions.currentTask : null;
          const headerLines = [];
          if (profile?.userId) headerLines.push(`user_id=${profile.userId}`);
          // Prefer identity facts
          const nameFact = await conversationMemory.searchRelevant(userId, 'user_name=', 1, { type: 'fact', factType: 'identity', key: 'name' });
          if (nameFact) headerLines.push(`name_hint=${nameFact.split('=')[1] || ''}`);
          if (currentSubject) headerLines.push(`current_subject=${currentSubject}`);
          if (currentTask) headerLines.push(`current_task=${currentTask}`);
          const prefs = (profile.learning?.preferredTopics || []).slice(0, 3);
          if (prefs.length) headerLines.push(`preferred_topics=${prefs.join(',')}`);
          const struggling = (profile.learning?.strugglingTopics || []).slice(-3);
          if (struggling.length) headerLines.push(`struggling_topics=${struggling.join(',')}`);
          header = headerLines.join('\n');
        } catch {}
        return [header, main, identity].filter(Boolean).join('\n\n—\n\n');
      })()
    ]);

    // Pull durable identity to use as active context (name, email, etc.)
    let identity = {};
    try {
      identity = await userProfileMemory.fetchIdentity(userId);
      if (!identity?.name) {
        const prof = await persistentMemory.getUserProfile(userId);
        identity = { ...identity, ...(prof.identity || {}) };
      }
    } catch (_) {}

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
      rollingSummary: latestSummary,
      semanticMemory,
      
      // Computed metadata
      userProfile: {
        id: userId,
        name: identity?.name || user?.name || 'Explorer',
        traits: user?.traits || [],
        learningStyle: enhancedContext.learningStyle,
        strugglingTopics: enhancedContext.strugglingTopics || [],
        masteredConcepts: enhancedContext.masteredConcepts || []
      },
      identity,
      
      // Interaction metadata
      timestamp: new Date().toISOString(),
      sessionInteractions: enhancedContext.sessionInteractions || 0
    };
  }

  /**
   * Handles general chat interactions
   */
  async handleChatInteraction(context) {
    const { prompt, userProfile, conversationSummary, emotionalState, retrievedContext, knowledgeGraph, semanticMemory } = context;
    const hasHistory = Array.isArray(context?.context?.conversationHistory) && context.context.conversationHistory.length > 0;

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

        // Build long-term facts string from persistent profile + durable identity
        let longTermFacts = '';
        try {
          const profile = await persistentMemory.getUserProfile(userProfile.id);
          const facts = [];
          if (profile?.userId) facts.push(`User ID: ${profile.userId}`);
          if (profile?.learning?.preferredStyle && profile.learning.preferredStyle !== 'unknown') facts.push(`Prefers ${profile.learning.preferredStyle} explanations`);
          if (Array.isArray(profile?.learning?.preferredTopics) && profile.learning.preferredTopics.length > 0) facts.push(`Interested in: ${profile.learning.preferredTopics.slice(0,5).join(', ')}`);
          if (Array.isArray(profile?.learning?.strugglingTopics) && profile.learning.strugglingTopics.length > 0) facts.push(`Needs help with: ${profile.learning.strugglingTopics.slice(-5).join(', ')}`);
          if (Array.isArray(profile?.learning?.masteredConcepts) && profile.learning.masteredConcepts.length > 0) facts.push(`Understands: ${profile.learning.masteredConcepts.slice(-5).join(', ')}`);
          if (profile?.visual?.age) facts.push(`Approx. age: ${profile.visual.age}`);
          if (profile?.visual?.gender) facts.push(`Gender: ${profile.visual.gender}`);
          const ident = context.identity || profile.identity || {};
          if (ident?.name) facts.push(`Name: ${ident.name}`);
          if (ident?.email) facts.push(`Email: ${ident.email}`);
          if (ident?.nationality) facts.push(`Nationality: ${ident.nationality}`);
          if (ident?.age) facts.push(`Age: ${ident.age}`);
          if (ident?.timezone) facts.push(`Timezone: ${ident.timezone}`);
          if (Array.isArray(ident?.languages) && ident.languages.length) facts.push(`Languages: ${ident.languages.join(', ')}`);
          longTermFacts = facts.join('\n');
        } catch (_) {}

        const ragResult = await chain.invoke({
          input: prompt,
          userProfile,
          conversationSummary,
          emotionalState,
          filters,
          longTermFacts,
          semanticMemory
        });

        if ((ragResult?.retrievedCount || 0) === 0) {
          // Skip generation path entirely; fall back to non-RAG prompt once
          throw new Error('RAG_EMPTY');
        }

        let message = ragResult?.output || ragResult?.text || ragResult;
        message = this.stripGreeting(message, hasHistory);
        const citations = ragResult?.citations || [];

        await this.updateKnowledgeFromInteraction(userProfile.id, prompt, message);

        // If RAG found no documents, fall back to general Spacey prompt for broad Q&A
        // if we reached here, we had docs and produced a RAG answer

        return {
          message,
          type: 'chat_response',
          metadata: { emotionalState, hasRetrievedContext: true, citations }
        };
      } catch (err) {
        if (err && err.message === 'RAG_EMPTY') {
          console.log('ℹ️ RAG returned 0 docs — skipping generation and falling back');
        } else {
          console.error('RAG chain failed, falling back to legacy prompt:', err.message);
        }
      }
    }

    // Legacy non-RAG path
    let strategy = null;
    try {
      const { decideTutoringStrategy } = require('./tutoringStrategy');
      strategy = await decideTutoringStrategy(userProfile.id, {
        prompt,
        userProfile: {
          learningStyle: userProfile.learningStyle,
          traits: userProfile.traits,
          preferredTopics: context?.enhancedContext?.preferredTopics || []
        },
        emotionalState,
        rawContext: context.context,
        enhancedContext: context.enhancedContext || {},
        identity: context.identity || {}
      });
    } catch {}

    const chatPrompt = prompts.composeChatPrompt({
      userPrompt: prompt,
      userProfile,
      conversationSummary,
      emotionalState,
      retrievedContext,
      knowledgeGraph,
      rawContext: context.context,
      semanticMemory,
      identity: context.identity || {},
      strategy
    });

    const responseRaw = await aiProviderManager.generateResponse(chatPrompt);
    const response = this.stripGreeting(responseRaw, hasHistory);
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
    const conversationalPrompt = prompts.composeConversationalLessonPrompt({
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

    const avatarPrompt = prompts.composeAvatarPrompt({
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

    const tutoringPrompt = prompts.composeTutoringPrompt({
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
  // buildChatPrompt now centralized in promptComposer

  stripGreeting(text, hasHistory) {
    try {
      if (!text) return text;
      let out = String(text).trim();
      if (!hasHistory) return out;
      // Remove common greeting openers once, case-insensitive
      out = out.replace(/^\s*(?:\*\*\s*)?(?:Greetings|Hello|Hi|Hey)[,!\.]\s*(?:[A-Z][a-zA-Z]+)?[,!\.]*\s*/i, '');
      return out.trim();
    } catch { return text; }
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

      // Upsert to semantic conversation memory and ingest personalization
      try {
        const sessionId = await persistentMemory.getCurrentSessionId(userId);
        await conversationMemory.upsertTurn(userId, request.prompt || '', response.message || '', { sessionId });
        await personalizationController.ingestChatTurn(
          userId,
          request.prompt || '',
          response.message || '',
          {
            visualContext: request?.context?.visualContext || null,
            lessonContext: request?.context?.lessonContext || null,
            currentTopic: request?.context?.currentTopic || null
          }
        );
      } catch (e) {
        console.warn('Conversation memory upsert skipped:', e.message);
      }

      // Keep a rolling summary to prevent memory bloat (throttled)
      try {
        const recent = await persistentMemory.getRecentInteractions(userId, 25);
        const profile = await persistentMemory.getUserProfile(userId);
        const totalInteractions = profile?.stats?.totalInteractions || 0;
        if (recent.length >= 20 && totalInteractions % 25 === 0) {
          // Generate/update a short summary with the provider LLM every 25 interactions
          const transcript = recent.map(r => `USER: ${r.userMessage}\nAI: ${r.aiResponse}`).join('\n');
          const summaryPrompt = `Summarize the following chat into 5-8 concise bullet points of durable facts and preferences about the user and ongoing tasks. Keep neutral tone.\n\n${transcript}`;
          const summaryText = await aiProviderManager.generateResponse(summaryPrompt);
          await persistentMemory.saveRollingSummary(userId, summaryText);
        }
      } catch (e) {
        console.warn('Summary maintenance skipped:', e.message);
      }
      
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
