const { aiProviderManager } = require('./aiProviders');

// In-memory throttle per process
const userStrategyState = new Map(); // userId -> { lastAt: number, lastAction: string }

function shouldConsiderStrategy(userId, emotionalState = {}, rawContext = {}, enhancedContext = {}) {
  const now = Date.now();
  const state = userStrategyState.get(userId) || { lastAt: 0 };
  const since = now - (state.lastAt || 0);

  const mood = (emotionalState?.emotion || '').toLowerCase();
  const userMood = (rawContext?.userMood || '').toLowerCase();
  const isNegativeMood = ['frustrated', 'confused', 'anxious', 'sad', 'tired'].some((m) => mood.includes(m) || userMood.includes(m));

  // Time-based throttle (min 30s between strategy calls)
  const timeOk = since > 30000;

  // Activity-based signal: long inactivity
  const timeSinceLastInteraction = rawContext?.timeSinceLastInteraction ?? 0;
  const inactivity = timeSinceLastInteraction > 60000;

  // Learning hints: struggling topics present
  const struggling = Array.isArray(enhancedContext?.strugglingTopics) && enhancedContext.strugglingTopics.length > 0;

  return timeOk && (isNegativeMood || inactivity || struggling);
}

async function decideTutoringStrategy(userId, { prompt, userProfile = {}, emotionalState = {}, rawContext = {}, enhancedContext = {}, identity = {} } = {}) {
  try {
    if (!shouldConsiderStrategy(userId, emotionalState, rawContext, enhancedContext)) {
      return { action: 'none' };
    }

    const signals = {
      prompt: String(prompt || ''),
      emotional: emotionalState || {},
      profile: {
        learningStyle: userProfile.learningStyle,
        traits: userProfile.traits,
        interests: Array.isArray(userProfile.preferredTopics) ? userProfile.preferredTopics.slice(0, 5) : []
      },
      context: {
        inactivitySec: rawContext?.timeSinceLastInteraction ?? 0,
        currentTopic: rawContext?.currentTopic || 'general'
      },
      struggling: Array.isArray(enhancedContext?.strugglingTopics) ? enhancedContext.strugglingTopics.slice(-3) : []
    };

    const strategyPrompt = `You are a tutoring strategy planner. Given a short snapshot of the learner and their recent state, output a JSON with an immediate coaching strategy to improve learning flow.\n\nReturn ONLY compact JSON with fields: {\"action\":\"none|hint|analogy|encourage|checkpoint|scaffold\",\"topicHint\":string?,\"interestWeave\":string?,\"tone\":\"supportive|energetic|reassuring|clarifying\",\"why\":string}\n\nSignals:\n${JSON.stringify(signals)}\n\nGuidelines:\n- If the learner shows confusion/frustration, prefer scaffold or analogy with a gentle tone.\n- If inactive/hesitant, consider a small hint or an inviting checkpoint question.\n- Use interestWeave when relevant (pick one interest to connect).\n- Keep it minimal and actionable.`;

    const raw = await aiProviderManager.generateResponse(strategyPrompt, 'gemini');
    let parsed = { action: 'none' };
    try { parsed = JSON.parse(raw); } catch (_) {
      const m = raw && raw.match && raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }

    const allowed = new Set(['none','hint','analogy','encourage','checkpoint','scaffold']);
    const action = allowed.has(parsed.action) ? parsed.action : 'none';
    const out = {
      action,
      topicHint: parsed.topicHint || '',
      interestWeave: parsed.interestWeave || '',
      tone: parsed.tone || 'supportive'
    };

    userStrategyState.set(userId, { lastAt: Date.now(), lastAction: out.action });
    return out;
  } catch {
    return { action: 'none' };
  }
}

module.exports = { decideTutoringStrategy };



