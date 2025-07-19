const { traitAnalyzer } = require('./traitAnalyzer');
const {generateConversationalResponse} = require('./conversationalGenerator');

/**
 * Handles and analyzes a user's interaction within a lesson.
 */
const handleLessonInteraction = async (req, res) => {
  try {
    // 1. Destructure the payload from the frontend
    const { userResponse, userTags, currentBlock, lessonData } = req.body;

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

    // 3. FIRST LLM CALL: Call the trait analyzer for structured data
    const analysis = await traitAnalyzer.analyzeTraits(
      messageToAnalyze,
      `Lesson Choice in block: ${currentBlock.block_id}`,
      userTags
    );

      console.log('Trait analysis results:', analysis);

    // 4. SECOND LLM CALL: Prepare context and generate the conversational response.
    const conversationalContext = {
      lessonData,
      currentBlock,
      userResponse,
      userTags,
      analysis, // Pass the results of the first analysis as context
    };

    const conversationalMessage = await generateConversationalResponse(conversationalContext);

 // 5. Construct the final payload for the frontend based on the interaction type.
    // The frontend's `ReflectionBlock` is expecting a field named `ai_message`.
    // The `reasoning` from our analysis is the perfect content for it.
    const responsePayload = {
      ai_message: conversationalMessage || "Your action has been noted and is being processed.",
      added_traits: analysis.traits_to_add,
      removed_traits: analysis.traits_to_remove,
      analysis_method: analysis.method,
      confidence: analysis.confidence,
      reasoning: analysis.reasoning,
    };

    console.log('Sending analysis to frontend:', responsePayload);
    
    // 6. Send the successful response
    res.status(200).json(responsePayload);

  } catch (error) {
    console.error('Error in handleLessonInteraction:', error);
    res.status(500).json({ error: 'An error occurred during interaction analysis.' });
  }
};

module.exports = {
  handleLessonInteraction,
};
