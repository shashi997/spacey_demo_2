const { traitAnalyzer } = require('./traitAnalyzer');
const { aiOrchestrator } = require('./aiOrchestrator');

/**
 * Handles and analyzes a user's interaction within a lesson.
 */
const handleLessonInteraction = async (req, res) => {
  try {
    // 1. Destructure the payload from the frontend
    const { userResponse, userTags, currentBlock, lessonData, user } = req.body;

    // Basic validation
    if (!userResponse || !userTags || !currentBlock) {
      return res.status(400).json({ error: 'Missing required interaction data.' });
    }

    // 2. Select the best text to analyze. The `ai_reaction` is ideal.
    const messageToAnalyze = userResponse.ai_reaction || userResponse.text;
    if (!messageToAnalyze) {
      return res.status(400).json({ error: 'No analyzable text in user response.' });
    }

    console.log(`📚 Analyzing lesson interaction via orchestrator: "${messageToAnalyze}" with tags: [${userTags.join(', ')}]`);

    // 3. Route through AI Orchestrator for lesson analysis
    const orchestratorRequest = {
      type: 'lesson_analysis',
      user: {
        id: user?.id || 'anonymous',
        name: user?.name || user?.displayName || 'Explorer',
        email: user?.email || 'anonymous@example.com',
        traits: [] // Will be populated by orchestrator
      },
      prompt: messageToAnalyze,
      context: {
        lessonData,
        currentBlock,
        userResponse,
        userTags,
        interactionContext: `Lesson Choice in block: ${currentBlock.block_id}`
      }
    };

    console.log('🚀 Routing lesson analysis to AI Orchestrator');
    const orchestratorResponse = await aiOrchestrator.processRequest(orchestratorRequest);

    // 4. Extract the analysis results from orchestrator metadata
    const analysis = orchestratorResponse.metadata?.analysis || {
      traits_to_add: [],
      traits_to_remove: [],
      confidence: 0.5,
      reasoning: "Analysis completed via orchestrator",
      method: "orchestrator_integrated"
    };

    console.log('🧠 Orchestrator analysis results:', analysis);

    // 5. Construct the final payload for the frontend
    const responsePayload = {
      ai_message: orchestratorResponse.message || "Your action has been noted and is being processed.",
      added_traits: analysis.traits_to_add,
      removed_traits: analysis.traits_to_remove,
      analysis_method: analysis.method,
      confidence: analysis.confidence,
      reasoning: analysis.reasoning,
      orchestrator: true
    };

    console.log('📤 Sending orchestrated analysis to frontend:', responsePayload);
    
    // 6. Send the successful response
    res.status(200).json(responsePayload);

  } catch (error) {
    console.error('❌ Error in orchestrated lesson interaction:', error);
    res.status(500).json({ 
      error: 'An error occurred during interaction analysis.',
      debug: { orchestrator: true, errorMessage: error.message }
    });
  }
};

module.exports = {
  handleLessonInteraction,
};
