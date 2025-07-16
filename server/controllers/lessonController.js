const { traitAnalyzer } = require('./traitAnalyzer');
const {generateConversationalResponse} = require('./conversationalGenerator');

/**
 * Handles and analyzes a user's interaction within a lesson.
 */
const handleLessonInteraction = async (req, res) => {
  try {
    // 1. Destructure the payload from the frontend
    const { userResponse, userTags, currentBlock, lessonData, type } = req.body;
    const isKnowledgeCheck = type === 'knowledge_check';

    // Basic validation
    if (!userResponse || !userTags || !currentBlock || !lessonData) {
      return res.status(400).json({ error: 'Missing required interaction data.' });
    }

    // 2. Select the correct text to analyze based on the interaction type.
    let messageToAnalyze;
    if (isKnowledgeCheck) {
      messageToAnalyze = userResponse.knowledge_check_answer;
      if (!messageToAnalyze) {
        return res.status(400).json({ error: 'No knowledge check answer to analyze.' });
      }
    } else {
      // For standard choices, the ai_reaction provides the best context for trait analysis.
      messageToAnalyze = userResponse.ai_reaction || userResponse.text;
      if (!messageToAnalyze) {
        return res.status(400).json({ error: 'No analyzable text in user response.' });
      }
    }

    console.log(`Analyzing interaction of type '${type}': "${messageToAnalyze}"`);

     // 3. FIRST LLM CALL: Call the trait analyzer for structured data.
    // This runs for both knowledge checks and standard choices to see how the user thinks.
    const analysis = await traitAnalyzer.analyzeTraits(
      messageToAnalyze,
      `Lesson interaction in block: ${currentBlock.block_id}`,
      userTags
    );

    console.log('Trait analysis results:', analysis);

    // 4. SECOND LLM CALL: Prepare context and generate the conversational response.
    const conversationalContext = {
      lessonData,
      currentBlock,
      userResponse,
      userTags,
      analysis,
      isKnowledgeCheck, // Pass the flag to the generator
    };

    const conversationalResponse = await generateConversationalResponse(conversationalContext);
    

    // 5. Construct the final payload for the frontend based on the interaction type.
    let responsePayload = {
      // Common properties for all response types
      added_traits: analysis.traits_to_add || [],
      removed_traits: analysis.traits_to_remove || [],
      analysis_method: analysis.method,
      confidence: analysis.confidence,
      reasoning: analysis.reasoning,
    };

    if (isKnowledgeCheck) {
      // If it was a knowledge check, the response is an object: { ai_message, is_correct }
      responsePayload.ai_message = conversationalResponse.ai_message || "Let's review that, Commander.";
      responsePayload.is_correct = conversationalResponse.is_correct; // is_correct is mandatory for checks
    } else {
      // If it was a standard choice, the response is a string.
      responsePayload.ai_message = conversationalResponse || "An interesting choice, Commander.";
    }

    console.log('Sending final payload to frontend:', responsePayload);

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
