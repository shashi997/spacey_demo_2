const { traitAnalyzer } = require('./traitAnalyzer');

/**
 * Handles and analyzes a user's interaction within a lesson.
 */
const handleLessonInteraction = async (req, res) => {
  try {
    // 1. Destructure the payload from the frontend
    const { userResponse, userTags, currentBlock } = req.body;

    // Basic validation
    if (!userResponse || !userTags || !currentBlock) {
      return res.status(400).json({ error: 'Missing required interaction data.' });
    }

    // 2. Select the best text to analyze. The `ai_reaction` is ideal.
    const messageToAnalyze = userResponse.ai_reaction || userResponse.text;
    if (!messageToAnalyze) {
      return res.status(400).json({ error: 'No analyzable text in user response.' });
    }

    console.log(`Analyzing interaction: "${messageToAnalyze}" with tags: [${userTags.join(', ')}]`);

    // 3. Call the trait analyzer with the message and current context
    const analysis = await traitAnalyzer.analyzeTraits(
      messageToAnalyze,
      `Lesson Choice in block: ${currentBlock.block_id}`,
      userTags
    );

    // 4. Format a clear response for the frontend
    // The frontend's `ReflectionBlock` is expecting a field named `ai_message`.
    // The `reasoning` from our analysis is the perfect content for it.
    const responsePayload = {
      ai_message: analysis.reasoning || "Your action has been noted and is being processed.",
      added_traits: analysis.traits_to_add,
      removed_traits: analysis.traits_to_remove,
      analysis_method: analysis.method,
      confidence: analysis.confidence
    };

    console.log('Sending analysis to frontend:', responsePayload);
    
    // 5. Send the response
    res.status(200).json(responsePayload);

  } catch (error) {
    console.error('Error in handleLessonInteraction:', error);
    res.status(500).json({ error: 'An error occurred during interaction analysis.' });
  }
};

module.exports = {
  handleLessonInteraction,
};
