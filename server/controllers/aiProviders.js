const { GoogleGenAI } = require("@google/genai");
const axios = require('axios');

class AIProviderManager {
  constructor() {
    this.providers = {
      gemini: this.setupGemini(),
      openai: this.setupOpenAI(),
      together: this.setupTogether(),
      groq: this.setupGroq(),
      huggingface: this.setupHuggingFace(),
    };
    
    // Get the default provider from environment, no fallbacks
    this.defaultProvider = process.env.DEFAULT_AI_PROVIDER || 'gemini';
    
    console.log('🔧 AI Providers initialized:');
    Object.entries(this.providers).forEach(([key, provider]) => {
      if (provider) {
        console.log(`   ✅ ${provider.name} (${provider.cost})`);
      } else {
        console.log(`   ❌ ${key} - Not configured`);
      }
    });
  }

  setupGemini() {
    if (!process.env.GEMINI_API_KEY) {
      console.log('❌ Gemini API key not found');
      return null;
    }
    
    try {
      const genAI = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
      });
      
      return {
        name: 'Google Gemini',
        cost: 'free',
        generate: async (prompt) => {
          try {
            console.log('🤖 Calling Gemini API...');
            
            const response = await genAI.models.generateContent({
              model: 'gemini-2.0-flash-001',
              contents: prompt,
            });
            
            if (response && response.text) {
              console.log('✅ Gemini API response received');
              return response.text;
            }
            
            throw new Error('No valid response from Gemini API');
          } catch (error) {
            console.error('❌ Gemini API Error:', error.message);
            throw error;
          }
        }
      };
    } catch (error) {
      console.log('⚠️ Gemini setup failed:', error.message);
      return null;
    }
  }

  setupOpenAI() {
    if (!process.env.OPENAI_API_KEY) {
      console.log('❌ OpenAI API key not found');
      return null;
    }
    
    return {
      name: 'OpenAI GPT-4',
      cost: 'paid',
      generate: async (prompt) => {
        try {
          console.log('🤖 Calling OpenAI API...');
          
          const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 500,
            temperature: 0.8
          }, {
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log('✅ OpenAI API response received');
          return response.data.choices[0].message.content;
        } catch (error) {
          console.error('❌ OpenAI API Error:', error.message);
          throw error;
        }
      }
    };
  }

  setupTogether() {
    if (!process.env.TOGETHER_API_KEY) {
      console.log('❌ Together API key not found');
      return null;
    }
    
    return {
      name: 'Together AI',
      cost: 'free_tier',
      generate: async (prompt) => {
        try {
          console.log('🤖 Calling Together API...');
          
          const response = await axios.post('https://api.together.xyz/v1/chat/completions', {
            model: 'meta-llama/Llama-3.2-3B-Instruct-Turbo',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 500,
            temperature: 0.8
          }, {
            headers: {
              'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log('✅ Together API response received');
          return response.data.choices[0].message.content;
        } catch (error) {
          console.error('❌ Together API Error:', error.message);
          throw error;
        }
      }
    };
  }

  setupGroq() {
    if (!process.env.GROQ_API_KEY) {
      console.log('❌ Groq API key not found');
      return null;
    }
    
    return {
      name: 'Groq',
      cost: 'free_tier',
      generate: async (prompt) => {
        try {
          console.log('🤖 Calling Groq API...');
          
          const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: 'llama3-8b-8192',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 500,
            temperature: 0.8
          }, {
            headers: {
              'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log('✅ Groq API response received');
          return response.data.choices[0].message.content;
        } catch (error) {
          console.error('❌ Groq API Error:', error.message);
          throw error;
        }
      }
    };
  }

  setupHuggingFace() {
    if (!process.env.HUGGINGFACE_API_KEY) {
      console.log('❌ HuggingFace API key not found');
      return null;
    }
    
    return {
      name: 'Hugging Face',
      cost: 'free',
      generate: async (prompt) => {
        try {
          console.log('🤖 Calling HuggingFace API...');
          
          const response = await axios.post(
            'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium',
            { inputs: prompt },
            {
              headers: {
                'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          console.log('✅ HuggingFace API response received');
          return response.data[0]?.generated_text || "Response received but couldn't extract text.";
        } catch (error) {
          console.error('❌ HuggingFace API Error:', error.message);
          throw error;
        }
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

  // Generate response using specified provider - NO FALLBACKS
  async generateResponse(prompt, providerName = null) {
    console.log(`🎯 Attempting to generate response with ${providerName || this.defaultProvider}`);
    
    const targetProvider = providerName ? 
      this.providers[providerName] : 
      this.providers[this.defaultProvider];
    
    if (!targetProvider) {
      const availableProviders = Object.keys(this.providers).filter(key => this.providers[key] !== null);
      throw new Error(`Provider '${providerName || this.defaultProvider}' not available. Available providers: ${availableProviders.join(', ')}`);
    }
    
    try {
      console.log(`🚀 Using ${targetProvider.name} to generate response`);
      const response = await targetProvider.generate(prompt);
      console.log(`✅ Successfully generated response using ${targetProvider.name}`);
      return response;
    } catch (error) {
      console.error(`❌ ${targetProvider.name} failed:`, error.message);
      throw new Error(`AI generation failed: ${error.message}`);
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