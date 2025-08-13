/**
 * Lightweight, rule-based fact extractor for conversation turns.
 * Returns structured facts with confidence, importance, and TTL suggestions.
 */

function normalize(text = '') {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractIdentityFacts(userMessage, aiMessage) {
  const combined = `${userMessage || ''}\n${aiMessage || ''}`;
  const facts = [];

  // Name
  const namePatterns = [
    /\bmy name is\s+([A-Za-z][A-Za-z\s'\-]{1,40})\b/i,
    /\bi am\s+([A-Za-z][A-Za-z\s'\-]{1,40})\b/i,
  ];
  for (const rx of namePatterns) {
    const m = combined.match(rx);
    if (m && m[1]) {
      const value = normalize(m[1]);
      facts.push({ type: 'identity', key: 'name', value, confidence: 0.95, importance: 0.9, ttlDays: 365 });
      break;
    }
  }

  // Email
  const em = combined.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  if (em) {
    facts.push({ type: 'identity', key: 'email', value: em[0], confidence: 0.98, importance: 0.9, ttlDays: 365 });
  }

  // Pronouns
  const pronouns = [
    { rx: /\bmy pronouns are\s+(he\/him)\b/i, value: 'he/him' },
    { rx: /\bmy pronouns are\s+(she\/her)\b/i, value: 'she/her' },
    { rx: /\bmy pronouns are\s+(they\/them)\b/i, value: 'they/them' },
  ];
  for (const p of pronouns) {
    if (p.rx.test(combined)) {
      facts.push({ type: 'identity', key: 'pronouns', value: p.value, confidence: 0.9, importance: 0.6, ttlDays: 365 });
      break;
    }
  }

  return facts;
}

function extractPreferenceFacts(userMessage) {
  const msg = String(userMessage || '').toLowerCase();
  const facts = [];

  // Learning style
  if (/visual( learner| explanations)?/.test(msg)) facts.push({ type: 'preference', key: 'learning_style', value: 'visual_learner', confidence: 0.8, importance: 0.7, ttlDays: 180 });
  if (/detailed|detail(ed)? explanations?/.test(msg)) facts.push({ type: 'preference', key: 'learning_style', value: 'detail_seeker', confidence: 0.7, importance: 0.5, ttlDays: 180 });
  if (/concise|short|brief explanations?/.test(msg)) facts.push({ type: 'preference', key: 'learning_style', value: 'quick_learner', confidence: 0.7, importance: 0.5, ttlDays: 180 });

  // Explanation depth
  if (/prefer (more )?examples|show me examples/.test(msg)) facts.push({ type: 'preference', key: 'explanation_depth', value: 'examples', confidence: 0.7, importance: 0.5, ttlDays: 120 });

  return facts;
}

function extractTopicSignals(userMessage, knownTopics = []) {
  const msg = String(userMessage || '').toLowerCase();
  const facts = [];

  // Simple “I like” patterns → preferred topics
  const likeMatch = msg.match(/i (really )?(like|love|enjoy) ([a-z\s\-]{3,40})/);
  if (likeMatch && likeMatch[3]) {
    const value = likeMatch[3].trim();
    facts.push({ type: 'preference', key: 'preferred_topic', value, confidence: 0.7, importance: 0.6, ttlDays: 240 });
  }

  // “I’m struggling/confused with” → struggling topics
  const struggleMatch = msg.match(/(struggling|confused|stuck) (with|on) ([a-z\s\-]{3,40})/);
  if (struggleMatch && struggleMatch[3]) {
    const value = struggleMatch[3].trim();
    facts.push({ type: 'knowledge', key: 'struggling_topic', value, confidence: 0.8, importance: 0.8, ttlDays: 90 });
  }

  // Quick map to canonical topics when known
  for (const t of knownTopics) {
    if (msg.includes(t)) {
      facts.push({ type: 'preference', key: 'preferred_topic', value: t, confidence: 0.6, importance: 0.4, ttlDays: 240 });
    }
  }

  return facts;
}

function extractEphemeralState(userMessage) {
  const msg = String(userMessage || '').toLowerCase();
  const ephemerals = [];

  const focusMatch = msg.match(/(focus on|let'?s focus on|talk about|study) ([a-z\s\-]{3,50})/);
  if (focusMatch && focusMatch[2]) {
    ephemerals.push({ key: 'current_subject', value: focusMatch[2].trim(), ttlSeconds: 2 * 24 * 3600 });
  }

  const goalMatch = msg.match(/(my|our) (goal|task) (is|for now|today) to ([a-z\s\-]{3,80})/);
  if (goalMatch && goalMatch[4]) {
    ephemerals.push({ key: 'current_task', value: goalMatch[4].trim(), ttlSeconds: 24 * 3600 });
  }

  return ephemerals;
}

function extractAndStoreFacts(userMessage, aiMessage, options = {}) {
  const knownTopics = options.knownTopics || [];
  const identity = extractIdentityFacts(userMessage, aiMessage);
  const prefs = extractPreferenceFacts(userMessage);
  const topics = extractTopicSignals(userMessage, knownTopics);
  const ephemerals = extractEphemeralState(userMessage);
  return { facts: [...identity, ...prefs, ...topics], ephemerals };
}

const { aiProviderManager } = require('./aiProviders');

async function extractWithLLM(userMessage, aiMessage, currentProfile = {}, options = {}) {
  const provider = process.env.FACTS_LLM_PROVIDER || 'gemini';
  const system = `You are an information extraction model. Extract facts and ephemeral state from a chat turn.
Return ONLY JSON with two arrays: facts and ephemerals.
Schema:
{
  "facts": [
    {"type":"identity|preference|knowledge","key":string,"value":string,"confidence":0-1,"importance":0-1,"ttlDays":integer}
  ],
  "ephemerals": [
    {"key":"current_subject|current_task","value":string,"ttlSeconds":integer}
  ]
}
Guidelines:
- Use conservative confidence unless explicit.
- Name/email/pronouns are identity; learning_style/explanation_depth/preferred_topic are preferences; struggling_topic/mastered_topic are knowledge.
- ttlDays: name/email 365, learning_style 180, preferred_topic 240, struggling_topic 90.
- ephemerals: current_subject 2 days (172800), current_task 1 day (86400).
- Also extract identity keys if present: name, email, pronouns, age, nationality, timezone, locale, language(s).
- Age should be a plain number when certain, otherwise string.
- For languages, emit separate facts with key="language" for each language detected.
- Keep arrays if none found: [].`;

  const prompt = `${system}\n\nUSER_MESSAGE: ${JSON.stringify(userMessage || '')}\nASSISTANT_MESSAGE: ${JSON.stringify(aiMessage || '')}\nPROFILE_HINT: ${JSON.stringify(currentProfile || {})}`;

  try {
    const raw = await aiProviderManager.generateResponse(prompt, provider);
    let parsed = { facts: [], ephemerals: [] };
    try {
      parsed = JSON.parse(raw);
    } catch (_) {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }
    const facts = Array.isArray(parsed.facts) ? parsed.facts.filter(f => f && f.key && f.value) : [];
    const ephemerals = Array.isArray(parsed.ephemerals) ? parsed.ephemerals.filter(e => e && e.key && e.value) : [];
    return { facts, ephemerals };
  } catch (e) {
    return { facts: [], ephemerals: [] };
  }
}

function mergeFacts(primary, secondary) {
  const out = [...primary];
  const seen = new Set(primary.map(f => `${f.type}:${f.key}:${(f.value || '').toLowerCase()}`));
  for (const f of secondary) {
    const sig = `${f.type}:${f.key}:${(f.value || '').toLowerCase()}`;
    if (!seen.has(sig)) out.push(f);
  }
  return out;
}

async function extractHybrid(userMessage, aiMessage, currentProfile = {}, options = {}) {
  const rules = extractAndStoreFacts(userMessage, aiMessage, options);
  if (process.env.FACTS_LLM_ENABLED !== 'true') {
    return rules;
  }
  // Always run LLM when enabled to capture subtle identity/preferences; merge with rules
  const llm = await extractWithLLM(userMessage, aiMessage, currentProfile, options);
  return { facts: mergeFacts(rules.facts, llm.facts), ephemerals: [...rules.ephemerals, ...llm.ephemerals] };
}

module.exports = { extractAndStoreFacts, extractWithLLM, extractHybrid };


