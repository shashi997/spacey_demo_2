const { GoogleGenAI  } = require("@google/genai");

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const buildSystemPrompt = (userPrompt, userInfo = {}) => {
  const {
    name = 'Explorer',
    traits = ['curious'],         // Future: tags like 'risk_taker', 'cautious'
    tone = 'supportive, witty',   // Could be 'neutral', 'sarcastic', etc.
    location = 'dashboard',       // In future: 'mars_mission_2', 'lesson_1', etc.
    context = 'User is exploring the main dashboard and interacting with Spacey.'
  } = userInfo;

  return `
You are **Spacey**, the sarcastic but kind AI assistant of a space learning platform.

🧠 **Context**: ${context}
🌌 **Location**: ${location}
🧬 **Player Traits**: ${traits.join(', ')}
🎭 **Tone**: ${tone}
👤 **User**: ${name}

---

🗨️ **User Message**: "${userPrompt}"

🔁 **Your Task**: Reply in **2–4 sentences max**, keeping it **clever, emotionally aware, and never boring**. 
Mix the kindness of Baymax with the wit of JARVIS. Reflect the user's traits and situation.

🎯 Example Style: short, characterful, maybe cheeky — but always helpful.

Now respond as Spacey:
`;
};

const chatWithAI = async (req, res) => {
    try {
        // Get the user's prompt from the request body
        const { prompt, user } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: "A prompt is required." });
        }

        // Build the full, contextual prompt using our helper function
        const fullPrompt = buildSystemPrompt(prompt, user);

        const result = await genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: fullPrompt
        })

        const response = await result.text
        const text = response;

        // Send the AI's response back to the client
        res.json({ message: text });

    } catch (error) {
        console.error("Error communicating with Google AI:", error);
        res.status(500).json({ error: "Failed to get a response from the AI. The mission was aborted." });
    }
}

module.exports = {
    chatWithAI
}