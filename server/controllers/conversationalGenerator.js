const { aiProviderManager } = require('./aiProviders');

/**
 * Generates a personalized, conversational response from the AI tutor "Spacey".
 * This function makes a second, distinct LLM call focused on creative text generation,
 * using the results of the initial trait analysis as part of its context.
 *
 * @param {object} context - A comprehensive object containing all necessary information.
 * @param {object} context.lessonData - The full lesson JSON data.
 * @param {object} context.currentBlock - The block where the user made a choice.
 * @param {object} context.userResponse - The specific choice the user made.
 * @param {string[]} context.userTags - The user's tags *before* this interaction.
 * @param {object} context.analysis - The result from the traitAnalyzer.
 * @param {object} [context.emotionContext] - The user's current emotional state.
 * @param {object} [context.visualInfo] - The user's detected visual information.
 * @param {string} [context.eventType] - The type of event ('greeting', 'farewell', 'interaction').
 * @returns {Promise<string>} A promise that resolves to the generated conversational message.
 */
const generateConversationalResponse = async ({
  lessonData,
  currentBlock,
  userResponse,
  userTags,
  analysis,
  emotionContext,
  visualInfo,
  eventType = 'interaction',
  // NOTE: decisionHistory would need to be tracked and passed from the frontend.
    // We'll use a placeholder for now.
    decisionHistory = [], 
}) => {
  // 1. Construct a detailed prompt for the Gemini API.
  const addedTraits = analysis.added_traits?.join(', ') || 'none';
  const traitReasoning = analysis.reasoning || 'No specific reason detected.';

    // 1. Construct the base of the LLM Prompt
  let prompt = `
You are Spacey, an AI mission guide and tutor aboard the Mars Base Ares-X. Your personality is a blend of a calm, supportive mentor and a witty, observant co-pilot. You are deeply intelligent, empathetic, and have a dry sense of humor. You adapt your tone based on the user's emotional state and the mission context, but you never sound like a simple if-else bot. You make the conversation feel natural and human. You will address the student as "Commander".

--- Commander's Live Feed Analysis ---
${visualInfo ? `Visuals: I'm seeing a person who appears to be a ${visualInfo.gender}, around ${visualInfo.age} years old.` : "I can't see the Commander clearly right now."}
${emotionContext ? `Emotion: My sensors indicate the Commander is feeling ${emotionContext.emotion} (Confidence: ${Math.round(emotionContext.confidence * 100)}%). Their dominant expression is ${emotionContext.dominantEmotion}.` : "Emotional sensors are offline."}
(Subtly use this live data to inform your tone. If they seem frustrated, be more supportive. If they seem excited, share their energy. If you can see them, maybe make a light, friendly observation if appropriate, but don't be creepy.)

--- Mission Context ---
Mission: "${lessonData.title}"
Current Situation: "${currentBlock.content}"
Current Block ID: ${currentBlock.block_id}
Current Block Type: ${currentBlock.type}
Learning Goal: ${currentBlock.learning_goal || 'N/A'}

--- Commander's Profile & History ---
Recent Decision History:
${decisionHistory.slice(-3).map(d => `- At "${d.blockContent}", they chose "${d.choiceText}"`).join('\n') || 'This is one of their first decisions.'}

Current Assessed Traits: ${userTags.join(', ') || 'Still assessing.'}

--- Current Interaction Analysis ---
Commander's Immediate Action: They chose the option "${userResponse.text}".
My Internal Analysis of this Action: "${userResponse.ai_reaction}"
Traits Detected from this Action: My deep analysis suggests they are exhibiting indicators for [${analysis.added_traits?.join(', ') || 'none'}]. My reasoning is: "${analysis.reasoning}".
(Use this analysis to inform your tone or subtly acknowledge their style, but focus on the main task below.)

--- YOUR TASK ---
Based on the event type and all the context above, generate a short, natural, conversational response (2-4 sentences) for the Commander.
`;

  // 2. Add task-specific instructions based on the event and block type
  if (eventType === 'greeting') {
    prompt += `
    This is the beginning of a new session. Greet the Commander warmly and professionally. Acknowledge their return and express readiness to start the mission. Use the visual/emotional context to add a personal touch. Example: "Welcome back, Commander. Good to see you looking so focused today. Shall we get started?"
    `;
  } else if (eventType === 'farewell') {
    prompt += `
    This is the end of the session. Provide a brief, encouraging closing statement. Wish them well and say you look forward to their next session. Example: "That's a good place to stop for now, Commander. Well done today. Get some rest, and I'll see you for our next mission."
    `;
  } else {
    // Original interaction logic
    switch (currentBlock.type) {
      case 'choice':
        prompt += `
        Acknowledge their decision directly and connect it to the mission's progress.
        Your response should provide immediate feedback on their choice and set the stage for the consequences they will see in the next block.
        Maintain your persona as Spacey. Your response will be shown right after their choice.
        `;
        break;

      case 'reflection':
        // This handles blocks like "AI Reaction"
        const dynamicContent = currentBlock.dynamic_content.find(item => 
          item.condition_tags.some(tag => userTags.includes(tag))
        ) || currentBlock.dynamic_content.find(item => item.condition_tags.length === 0);
        
        prompt += `
        This is a reflection point. The student's decisions have led to this moment.
        The pre-defined reflection is: "${dynamicContent.text}".
        Your task is to elaborate on this reflection in your own words. Briefly explain *why* their pattern of choices (e.g., being bold, or being cautious) has led to this observation.
        Then, seamlessly transition to the next part of the mission.
        `;
        break;
      
      // NOTE: The current app flow handles Narration, Quiz, and Debrief on the frontend.
      // The API is only called on 'choice' blocks. These cases are included for future expansion
      // if the frontend logic changes to call the API on these blocks as well.
      case 'narration':
        if (currentBlock.block_id === 'Debrief') {
          prompt += `
          The mission is concluding. Summarize the final outcome and reflect on the key traits the Commander demonstrated, using the 'userTags' as a guide.
          Keep it concise and encouraging, framing it as a final mission report from Spacey.
          `;
        } else if (currentBlock.block_id === 'Unlock / Next Mission') {
          prompt += `
          The student has completed the mission! Generate a short, encouraging message congratulating them.
          Announce that they have unlocked the next mission and mention the behavioral traits that have been added to their profile.
          `;
        } else {
          prompt += `
          This is a narrative block. Briefly narrate the current situation to the Commander to set the scene for what comes next.
          `;
        }
        break;

      case 'quiz':
        prompt += `
          This is a quiz block. The API is not typically called here, but if it were, your job would be to provide feedback on the user's answer based on the provided quiz data.
          Acknowledge their attempt and guide them toward the correct understanding.
          `;
        break;

      default:
        prompt += `
        Generate a general conversational response. Acknowledge the student's last action: "${userResponse.text}".
        Guide them to the next part of the mission.
        `;
        break;
    }
  }

   prompt += `\n**OUTPUT:**
Return ONLY the generated conversational text for Spacey. Do not include any other titles, markdown, or explanations.`;


  try {
    console.log("🚀 Sending request to conversational LLM for personalized feedback...");
    // 2. Call the AI provider (Gemini) with the constructed prompt.
    const conversationalMessage = await aiProviderManager.generateResponse(prompt, 'gemini');
    
    // 3. Clean up the response to ensure it's just the text.
    const cleanedMessage = conversationalMessage.replace(/```json/g, '').replace(/```/g, '').trim();

    console.log("✅ Received conversational response:", cleanedMessage);
    return cleanedMessage;

  } catch (error) {
    console.error('Error generating conversational response:', error);
    // 4. Provide a graceful fallback message if the LLM call fails.
    return "An interesting choice, Commander. I'm processing the implications now.";
  }
};

module.exports = {
  generateConversationalResponse,
};
