const { aiProviderManager } = require('./aiProviders');

class TraitAnalyzer {
  constructor() {
    this.enhancedKeywords = {
      risk_taker: {
        positive: [
          // Direct risk words
          'risky', 'dangerous', 'bold', 'daring', 'adventurous', 
          'exciting', 'thrilling', 'challenge', 'gamble',
          
          // Action phrases
          'take a chance', 'go for it', 'push the limits', 
          'live dangerously', 'throw caution', 'full speed',
          'jump in', 'dive in', 'leap of faith', 'all in',
          
          // Personality expressions
          'feeling brave', 'ready for adventure', 'love excitement',
          'embrace uncertainty', 'explore unknown', 'push boundaries',
          'test limits', 'break rules', 'think outside'
        ],
        negative: [
          'too risky', 'avoid risk', 'not worth the risk',
          'play it safe instead', 'too dangerous for me'
        ]
      },

      cautious: {
        positive: [
          // Direct caution words
          'safe', 'careful', 'cautious', 'prudent', 'conservative',
          'secure', 'protected', 'stable', 'reliable',
          
          // Planning phrases  
          'think it through', 'plan ahead', 'consider options',
          'weigh pros and cons', 'double check', 'be sure',
          'take time', 'analyze first', 'research more',
          
          // Safety expressions
          'better safe than sorry', 'play it safe', 'err on side of caution',
          'minimize risk', 'avoid danger', 'stick to plan',
          'follow protocol', 'by the book', 'tested approach'
        ],
        negative: [
          'tired of being careful', 'enough planning', 'overthinking'
        ]
      },

      science_minded: {
        positive: [
          // Science terms
          'experiment', 'hypothesis', 'theory', 'research', 'data',
          'evidence', 'scientific', 'analyze', 'study', 'investigate',
          'discover', 'physics', 'chemistry', 'biology', 'astronomy',
          
          // Learning expressions
          'how does it work', 'why does that happen', 'interesting phenomenon',
          'scientific method', 'peer review', 'reproducible results',
          'correlation', 'causation', 'statistical', 'empirical',
          
          // Curiosity phrases
          'want to understand', 'fascinating science', 'love learning',
          'explore the mechanism', 'dig deeper', 'research this',
          'scientific explanation', 'evidence-based', 'fact-check'
        ],
        negative: []
      },

      collaborative: {
        positive: [
          // Teamwork words
          'team', 'together', 'help', 'assist', 'support',
          'collaborate', 'cooperate', 'work with', 'join forces',
          
          // Social phrases
          'we should', 'let\'s work together', 'help each other',
          'share resources', 'combine efforts', 'group project',
          'team effort', 'collective', 'community', 'partnership',
          
          // Helping expressions
          'can I help', 'need assistance', 'happy to help',
          'work as a team', 'stronger together', 'support crew',
          'help out', 'lend a hand', 'pitch in'
        ],
        negative: [
          'work alone', 'solo mission', 'don\'t need help',
          'prefer independence', 'by myself'
        ]
      },

      curious: {
        positive: [
          // Question words
          'what', 'why', 'how', 'when', 'where', 'wonder',
          'curious', 'interested', 'fascinating', 'intriguing',
          
          // Learning phrases
          'want to know', 'tell me more', 'explain', 'learn about',
          'find out', 'discover', 'explore', 'investigate',
          'dig deeper', 'more details', 'elaborate',
          
          // Interest expressions
          'sounds interesting', 'never heard of', 'how does that work',
          'can you show me', 'would love to learn', 'teach me'
        ],
        negative: []
      },

      analytical: {
        positive: [
          // Analysis terms
          'analyze', 'calculate', 'measure', 'compare', 'evaluate',
          'assess', 'examine', 'review', 'breakdown', 'systematic',
          
          // Logic phrases
          'logical approach', 'step by step', 'methodical',
          'think through', 'pros and cons', 'cost benefit',
          'data driven', 'evidence based', 'objective view'
        ],
        negative: []
      }
    };
  }

  // Enhanced keyword-based trait detection
  analyzeWithKeywords(message, context = 'general_chat') {
    const messageText = message.toLowerCase();
    const detectedTraits = {
      traits_to_add: [],
      traits_to_remove: [],
      confidence: 0.6, // Lower confidence for keyword matching
      reasoning: [],
      method: 'keyword_analysis'
    };

    // Analyze each trait category
    for (const [trait, patterns] of Object.entries(this.enhancedKeywords)) {
      let positiveMatches = 0;
      let negativeMatches = 0;
      let matchedPhrases = [];

      // Check positive indicators
      patterns.positive.forEach(keyword => {
        if (messageText.includes(keyword.toLowerCase())) {
          positiveMatches++;
          matchedPhrases.push(keyword);
        }
      });

      // Check negative indicators
      patterns.negative.forEach(keyword => {
        if (messageText.includes(keyword.toLowerCase())) {
          negativeMatches++;
        }
      });

      // Determine trait changes
      if (positiveMatches > negativeMatches && positiveMatches > 0) {
        detectedTraits.traits_to_add.push(trait);
        detectedTraits.reasoning.push(`Detected "${trait}" from phrases: ${matchedPhrases.slice(0, 3).join(', ')}`);
      } else if (negativeMatches > positiveMatches && negativeMatches > 0) {
        detectedTraits.traits_to_remove.push(trait);
        detectedTraits.reasoning.push(`Removing "${trait}" due to negative indicators`);
      }
    }

    // Adjust confidence based on number of matches
    if (detectedTraits.traits_to_add.length > 0 || detectedTraits.traits_to_remove.length > 0) {
      detectedTraits.confidence = Math.min(0.8, 0.4 + (detectedTraits.traits_to_add.length * 0.1));
    }

    return detectedTraits;
  }

  // LLM-based personality analysis
  async analyzeWithLLM(message, context = 'general_chat', currentTraits = []) {
    try {
      const analysisPrompt = `
You are a personality analyst. Analyze this message for personality traits.

Message: "${message}"
Context: ${context}
Current Traits: ${currentTraits.join(', ') || 'none'}

Available personality traits:
- risk_taker: Shows willingness to take risks, be adventurous, try bold approaches
- cautious: Prefers safe, careful, well-planned approaches
- science_minded: Shows interest in science, learning, technical details, how things work
- collaborative: Likes teamwork, helping others, working together
- curious: Asks questions, wants to learn, shows interest in new things
- analytical: Uses logic, systematic thinking, data-driven approaches

Instructions:
1. Analyze the message for personality indicators
2. Consider context and current traits
3. Only suggest changes if there's clear evidence
4. Be conservative - don't over-interpret

Return ONLY a JSON object:
{
  "traits_to_add": ["trait1", "trait2"],
  "traits_to_remove": ["trait3"],
  "confidence": 0.85,
  "reasoning": "Clear explanation of why these traits were detected"
}

Example responses:
- Message: "I love figuring out how rockets work" → {"traits_to_add": ["science_minded", "curious"], "confidence": 0.9, "reasoning": "Shows scientific interest and curiosity about mechanisms"}
- Message: "Let's be extra careful here" → {"traits_to_add": ["cautious"], "confidence": 0.8, "reasoning": "Explicitly advocates for careful approach"}
- Message: "Hello there" → {"traits_to_add": [], "traits_to_remove": [], "confidence": 0.0, "reasoning": "Generic greeting with no personality indicators"}
`;

      // Use AI provider to analyze
      const response = await aiProviderManager.generateResponse(analysisPrompt, 'gemini');
      
      // Try to parse JSON response
      try {
        // Extract JSON from response (in case AI adds extra text)
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0]);
          analysis.method = 'llm_analysis';
          
          // Validate the response structure
          if (analysis.traits_to_add && analysis.traits_to_remove && typeof analysis.confidence === 'number') {
            return analysis;
          }
        }
      } catch (parseError) {
        console.log('LLM response parsing failed:', parseError.message);
      }

      // If parsing fails, return empty analysis
      return {
        traits_to_add: [],
        traits_to_remove: [],
        confidence: 0,
        reasoning: "LLM analysis failed to parse",
        method: 'llm_failed'
      };

    } catch (error) {
      console.error('LLM trait analysis error:', error.message);
      // Return empty analysis if LLM fails
      return {
        traits_to_add: [],
        traits_to_remove: [],
        confidence: 0,
        reasoning: `LLM analysis failed: ${error.message}`,
        method: 'llm_error'
      };
    }
  }

  // Hybrid analysis: LLM first, keywords as fallback
  async analyzeTraits(message, context = 'general_chat', currentTraits = []) {
    try {
      console.log(`Starting trait analysis for: "${message.substring(0, 50)}..."`);
      
      // Try LLM analysis first
      const llmAnalysis = await this.analyzeWithLLM(message, context, currentTraits);
      
      // If LLM analysis is successful and confident, use it
      if (llmAnalysis.confidence > 0.3 && llmAnalysis.method === 'llm_analysis') {
        console.log(`Using LLM analysis (confidence: ${llmAnalysis.confidence})`);
        return llmAnalysis;
      }

      // Fall back to keyword analysis
      console.log('Falling back to keyword analysis');
      const keywordAnalysis = this.analyzeWithKeywords(message, context);
      
      // If keyword analysis found something, use it
      if (keywordAnalysis.traits_to_add.length > 0 || keywordAnalysis.traits_to_remove.length > 0) {
        console.log(`Using keyword analysis (found ${keywordAnalysis.traits_to_add.length} traits to add)`);
        return keywordAnalysis;
      }

      // If both failed, return the LLM attempt (even if failed) for debugging
      console.log('Both analyses returned empty results');
      return llmAnalysis.confidence > 0 ? llmAnalysis : keywordAnalysis;

    } catch (error) {
      console.error('Trait analysis error:', error);
      
      // Emergency fallback to keyword analysis
      return this.analyzeWithKeywords(message, context);
    }
  }

  // Get trait suggestions for debugging
  getTraitSuggestions() {
    return Object.keys(this.enhancedKeywords);
  }

  // Get keyword patterns for a specific trait (for debugging)
  getKeywordPatterns(trait) {
    return this.enhancedKeywords[trait] || null;
  }
}

// Create global instance
const traitAnalyzer = new TraitAnalyzer();

module.exports = {
  TraitAnalyzer,
  traitAnalyzer
}; 