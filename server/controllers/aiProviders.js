const { GoogleGenAI } = require("@google/genai");
const axios = require('axios');

class AIProviderManager {
  constructor() {
    this.providers = {
      gemini: this.setupGemini(),
      openai: this.setupOpenAI(),
      together: this.setupTogether(),
      groq: this.setupGroq(),
      huggingface: this.setupHuggingFace()
    };
    
    this.defaultProvider = process.env.DEFAULT_AI_PROVIDER || 'gemini';
  }

  setupGemini() {
    if (!process.env.GEMINI_API_KEY) return null;
    
    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    return {
      name: 'Google Gemini',
      cost: 'free',
      generate: async (prompt) => {
        const result = await genAI.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt
        });
        const response = await result.text;
        return response;
      }
    };
  }

  setupOpenAI() {
    if (!process.env.OPENAI_API_KEY) return null;
    
    return {
      name: 'OpenAI GPT-4o',
      cost: 'paid',
      generate: async (prompt) => {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 200,
          temperature: 0.8
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        
        return response.data.choices[0].message.content;
      }
    };
  }

  setupTogether() {
    if (!process.env.TOGETHER_API_KEY) return null;
    
    return {
      name: 'Together AI',
      cost: 'free_tier',
      generate: async (prompt) => {
        const response = await axios.post('https://api.together.xyz/v1/chat/completions', {
          model: 'meta-llama/Llama-2-7b-chat-hf',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 200,
          temperature: 0.8
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        
        return response.data.choices[0].message.content;
      }
    };
  }

  setupGroq() {
    if (!process.env.GROQ_API_KEY) return null;
    
    return {
      name: 'Groq',
      cost: 'free_tier',
      generate: async (prompt) => {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
          model: 'llama3-8b-8192',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 200,
          temperature: 0.8
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        
        return response.data.choices[0].message.content;
      }
    };
  }

  setupHuggingFace() {
    if (!process.env.HUGGINGFACE_API_KEY) return null;
    
    return {
      name: 'Hugging Face',
      cost: 'free',
      generate: async (prompt) => {
        const response = await axios.post(
          'https://api-inference.huggingface.co/models/microsoft/DialoGPT-large',
          { inputs: prompt },
          {
            headers: {
              'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        return response.data[0]?.generated_text || "I'm having trouble generating a response.";
      }
    };
  }

  // Get available providers
  getAvailableProviders() {
    const available = {};
    for (const [key, provider] of Object.entries(this.providers)) {
      if (provider !== null) {
        available[key] = {
          name: provider.name,
          cost: provider.cost
        };
      }
    }
    return available;
  }

  // Generate response using specified provider
  async generateResponse(prompt, providerName = null) {
    const provider = providerName ? 
      this.providers[providerName] : 
      this.providers[this.defaultProvider];
    
    if (!provider) {
      // Fallback to first available provider
      const availableProviders = Object.entries(this.providers)
        .filter(([_, p]) => p !== null);
      
      if (availableProviders.length === 0) {
        throw new Error('No AI providers are configured. Please set up API keys.');
      }
      
      const fallbackProvider = availableProviders[0][1];
      console.log(`Using fallback provider: ${fallbackProvider.name}`);
      return await fallbackProvider.generate(prompt);
    }
    
    try {
      return await provider.generate(prompt);
    } catch (error) {
      console.error(`Error with ${provider.name}:`, error.message);
      
      // Try fallback to Gemini if current provider fails
      if (providerName !== 'gemini' && this.providers.gemini) {
        console.log('Falling back to Gemini...');
        return await this.providers.gemini.generate(prompt);
      }
      
      throw error;
    }
  }

  // Get provider info
  getProviderInfo(providerName) {
    const provider = this.providers[providerName];
    if (!provider) return null;
    
    return {
      name: provider.name,
      cost: provider.cost,
      available: true
    };
  }
}

// Create global instance
const aiProviderManager = new AIProviderManager();

module.exports = {
  AIProviderManager,
  aiProviderManager
}; 