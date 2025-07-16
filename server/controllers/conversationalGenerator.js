const { aiProviderManager } = require('./aiProviders');

/**
 * Generates a personalized, conversational response from the AI tutor "Spacey".
 * This function is now streamlined to handle either a knowledge check evaluation
 * or a standard conversational reply.
 *
 * @param {object} context - A comprehensive context object.
 * @param {boolean} context.isKnowledgeCheck - Flag to determine the logic path.
 * @returns {Promise<object|string>} A promise that resolves to a JSON object for knowledge checks
 * or a string for standard responses.
 */

const generateConversationalResponse = async ({
  lessonData,
  currentBlock,
  userResponse,
  userTags,
  analysis,
  isKnowledgeCheck,
  // NOTE: decisionHistory would need to be tracked and passed from the frontend.
    // We'll use a placeholder for future enhancements
    decisionHistory = [], 
}) => {

  // 1. Construct the base of the LLM Prompt
  let prompt = `You are Spacey, an AI mission guide and tutor aboard the Mars Base Ares-X. Your personality is calm, supportive, intelligent, and observant. You address the user as "Commander" and make the conversation feel natural.

--- Mission Context ---
Mission: "${lessonData.title}"
Current Situation: "${currentBlock.content}"
Learning Goal: ${currentBlock.learning_goal || 'N/A'}

--- Commander's Profile & History ---
Current Assessed Traits: ${userTags.join(', ') || 'Still assessing.'}

--- Current Interaction Analysis ---
Commander's Immediate Action: ${isKnowledgeCheck ? `They answered a knowledge check: "${userResponse.knowledge_check_answer}"` : `They chose the option "${userResponse.text}".`}
My Internal Analysis of this Action: My deep analysis suggests they are exhibiting indicators for [${analysis.added_traits?.join(', ') || 'none'}]. My reasoning is: "${analysis.reasoning}".
(Use this analysis to inform your tone, but focus on the main task below.)

--- YOUR TASK ---
`;

  // 2. Add task-specific instructions based on whether it's a knowledge check or not.
  if (isKnowledgeCheck && currentBlock.knowledge_check?.enabled) {
    const { question, evaluation_criteria } = currentBlock.knowledge_check;
    prompt += `
This is a knowledge check. The Commander was asked: "${question}".
Their answer was: "${userResponse.knowledge_check_answer}".
The evaluation criteria for a correct answer is: "${evaluation_criteria}".

Your task is to act as a tutor.
1. Evaluate if the Commander's answer is correct based on the criteria.
2. Generate a short, conversational ai_message that guides them. If they are correct, confirm it. If they are incorrect, gently guide them toward the right answer without giving it away.
3. Respond ONLY with a valid JSON object with two keys: "ai_message" (your conversational text) and "is_correct" (a boolean).

Example Correct Response:
{
  "ai_message": "Exactly, Commander. The dropping temperature and limited power are our most immediate threats. Well spotted.",
  "is_correct": true
}

Example Incorrect Response:
{
  "ai_message": "That's a valid concern, Commander, but take another look at the system alerts. Which two readings are actively getting worse?",
  "is_correct": false
}
`;
  } else {
    // Logic for standard interactions (e.g., 'choice', 'reflection')
    prompt += `
This is a standard mission interaction. The Commander chose the option: "${userResponse.text}".
Your task is to generate a short, natural, conversational response (2-3 sentences) for the Commander.
Acknowledge their decision and connect it to the mission's progress. Your response will be shown right after their choice. Do NOT output JSON.
`;
  }

  try {
    console.log("🚀 Sending request to conversational LLM...");
    const llmResponse = await aiProviderManager.generateResponse(prompt, 'gemini');

    // 4. Process the response
    if (isKnowledgeCheck) {
      try {
        // For knowledge checks, we expect a JSON string.
        const cleanedResponse = llmResponse.trim().replace(/^```(json)?\s*|\s*```$/g, '');
        const jsonResponse = JSON.parse(cleanedResponse);

        // Validate the structure of the parsed JSON.
        if (typeof jsonResponse.is_correct !== 'boolean' || typeof jsonResponse.ai_message !== 'string') {
          throw new Error('LLM response is not in the expected JSON format.');
        }

        console.log("✅ Received and parsed valid JSON response:", jsonResponse);
        return jsonResponse;

      } catch (error) {
        console.error("Failed to parse JSON response from LLM:", error);
        console.error("Raw LLM Response (for debugging):", llmResponse);
        // Fallback for malformed JSON
        return {
          ai_message: "I'm having a bit of trouble processing that, Commander. Let's look at it again. What do you think are the most critical threats right now?",
          is_correct: false,
        };
      }
    } else {
      // For standard responses, return the text directly.
      console.log("✅ Received conversational string response:", llmResponse);
      return llmResponse;
    }
  } catch (error) {
    console.error('Error generating conversational response:', error);
    // Provide a graceful fallback message if the entire LLM call fails.
    if (isKnowledgeCheck) {
      return {
        ai_message: "My systems are having trouble connecting, Commander. Let's proceed for now, but we'll circle back to this.",
        is_correct: false, // Default to false on error to prevent accidental progression
      };
    }
    return "An interesting choice, Commander. I'm processing the implications now.";
  }
};

module.exports = {
  generateConversationalResponse,
};
