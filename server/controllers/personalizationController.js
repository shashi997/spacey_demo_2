/**
 * Personalization Controller
 *
 * Upgraded from a simple fact extractor to a full personalization pipeline that:
 * - Ingests signals from chat turns, lesson events, and camera/visual modules
 * - Uses LLMs to extract identity, preferences, knowledge, and ephemeral state
 * - Persists durable identity to disk and vector DB; updates learning/emotion
 * - Produces an active personalization snapshot for prompts (chat/tutoring/RAG)
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
const { persistentMemory } = require('./persistentMemory');
const userProfileMemory = require('./userProfileMemory');
const { upsertFact } = require('./conversationMemory');

async function extractSignalsLLM(userMessage, aiMessage, visualContext = null, lessonContext = null, currentProfile = {}) {
  const provider = process.env.FACTS_LLM_PROVIDER || 'gemini';
  const system = `You are a personalization extraction model. Extract identity, preferences, knowledge, and ephemeral state from the turn and optional contexts.
Return ONLY JSON with keys: identity, preferences, knowledge, ephemerals.

Schema:
{
  "identity": {"name":string?, "email":string?, "pronouns":string?, "age":number|string?, "nationality":string?, "timezone":string?, "locale":string?, "languages": string[]?},
  "preferences": {"learning_style":string?, "explanation_depth":string?, "preferred_topics": string[]?},
  "knowledge": {"mastered_topics": string[]?, "struggling_topics": string[]?},
  "ephemerals": {"current_subject": string?, "current_task": string?}
}

Guidelines:
- Be conservative; only output when reasonably certain.
- Use visual and lesson context hints when present.
- Age numeric if confident, else string.
- Languages as array of strings. If single language detected, still use array.
`;
  const prompt = `${system}

USER_MESSAGE: ${JSON.stringify(userMessage || '')}
ASSISTANT_MESSAGE: ${JSON.stringify(aiMessage || '')}
VISUAL_CONTEXT: ${JSON.stringify(visualContext || {})}
LESSON_CONTEXT: ${JSON.stringify(lessonContext || {})}
PROFILE_HINT: ${JSON.stringify(currentProfile || {})}`;
  try {
    const raw = await aiProviderManager.generateResponse(prompt, provider);
    let parsed = {};
    try {
      parsed = JSON.parse(raw);
    } catch (_) {
      const m = raw && raw.match && raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }
    // Normalize structure
    parsed.identity = parsed.identity || {};
    parsed.preferences = parsed.preferences || {};
    parsed.knowledge = parsed.knowledge || {};
    parsed.ephemerals = parsed.ephemerals || {};
    if (parsed.identity && parsed.identity.languages && !Array.isArray(parsed.identity.languages)) {
      parsed.identity.languages = [String(parsed.identity.languages)];
    }
    return parsed;
  } catch (e) {
    return { identity: {}, preferences: {}, knowledge: {}, ephemerals: {} };
  }
}

class PersonalizationController {
  async ingestChatTurn(userId, userMessage, aiMessage, options = {}) {
    try {
      const { visualContext = null, lessonContext = null, currentTopic = null } = options;
      const profile = await persistentMemory.getUserProfile(userId);
      const signals = await extractSignalsLLM(userMessage, aiMessage, visualContext, lessonContext, profile);

      // Identity updates (vector + disk + legacy fact for name/email)
      if (signals.identity && Object.keys(signals.identity).length > 0) {
        await persistentMemory.updateUserIdentity(userId, signals.identity);
        await userProfileMemory.upsertIdentity(userId, signals.identity);
        if (signals.identity.name) {
          await upsertFact(userId, `user_name=${signals.identity.name}`, { factType: 'identity', key: 'name', ttlDays: 365 });
        }
        if (signals.identity.email) {
          await upsertFact(userId, `user_email=${signals.identity.email}`, { factType: 'identity', key: 'email', ttlDays: 365 });
        }
      }

      // Preferences → learning style/depth/topics
      const profileForBatchSave = await persistentMemory.getUserProfile(userId);

      if (signals.preferences) {
        const p = profileForBatchSave;
        if (signals.preferences.learning_style) p.learning.preferredStyle = signals.preferences.learning_style;
        if (signals.preferences.explanation_depth) p.communication.preferredExplanationDepth = signals.preferences.explanation_depth;
        if (Array.isArray(signals.preferences.preferred_topics)) {
          const set = new Set(p.learning.preferredTopics || []);
          for (const t of signals.preferences.preferred_topics) set.add(String(t));
          p.learning.preferredTopics = Array.from(set);
        }
      }

      // Knowledge updates → struggling/mastered
      if (signals.knowledge) {
        const p = profileForBatchSave;
        if (Array.isArray(signals.knowledge.struggling_topics)) {
          for (const t of signals.knowledge.struggling_topics) {
            if (!p.learning.strugglingTopics.includes(t)) p.learning.strugglingTopics.push(t);
            await persistentMemory.updateUserKnowledgeGraph(userId, String(t), -0.1, 'LLM detected struggle');
          }
        }
        if (Array.isArray(signals.knowledge.mastered_topics)) {
          for (const t of signals.knowledge.mastered_topics) {
            if (!p.learning.masteredConcepts.includes(t)) p.learning.masteredConcepts.push(t);
            await persistentMemory.updateUserKnowledgeGraph(userId, String(t), 0.1, 'LLM detected mastery');
          }
        }
      }

      // Ephemerals → session scoped subject/task with TTL
      if (signals.ephemerals && (signals.ephemerals.current_subject || signals.ephemerals.current_task)) {
        const p = profileForBatchSave;
        const now = Date.now();
        if (signals.ephemerals.current_subject) p.sessions.currentSubject = signals.ephemerals.current_subject;
        if (signals.ephemerals.current_task) p.sessions.currentTask = signals.ephemerals.current_task;
        const ttlSeconds = 172800; // 2 days max, consistent with guidelines
        p.sessions._ephemeralExpiry = now + ttlSeconds * 1000;
      }

      // Visual context → emotional + visual profile
      if (visualContext) {
        const p = profileForBatchSave;
        if (visualContext.emotionalState) {
          const mood = visualContext.emotionalState;
          p.emotional.moodHistory.push({
            emotion: mood.emotion,
            confidence: mood.confidence || 0,
            dominantEmotion: mood.dominantEmotion,
            rawEmotions: mood.rawEmotions,
            timestamp: new Date().toISOString()
          });
          if (p.emotional.moodHistory.length > 20) p.emotional.moodHistory.shift();
          // Derive dominant
          const recent = p.emotional.moodHistory.slice(-10);
          const counts = {};
          recent.forEach(m => { const k = m.dominantEmotion || m.emotion; counts[k] = (counts[k] || 0) + 1; });
          if (Object.keys(counts).length > 0) {
            p.emotional.dominantMood = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
          }
        }
        if (visualContext.age) p.visual.age = visualContext.age;
        if (visualContext.gender) p.visual.gender = visualContext.gender;
        p.visual.lastUpdated = new Date().toISOString();
      }

      // Lesson context hint → record preferred topic
      if (lessonContext && lessonContext.title) {
        const p = profileForBatchSave;
        if (!p.learning.preferredTopics.includes(lessonContext.title)) {
          p.learning.preferredTopics.push(lessonContext.title);
        }
      }

      // Batch save at the end if any non-identity updates occurred
      await persistentMemory.saveUserProfile(userId, profileForBatchSave);

      // Create a short personalization snapshot for immediate use
      const snapshot = await this.buildActiveContextSnippet(userId);
      return { ok: true, signals, snapshot };
    } catch (e) {
      console.warn('Personalization ingestion failed:', e.message);
      return { ok: false, error: e.message };
    }
  }

  async ingestLessonEvent(userId, lessonContext = {}) {
    return this.ingestChatTurn(userId, '', '', { lessonContext });
  }

  async ingestVisualData(userId, visualContext = {}) {
    return this.ingestChatTurn(userId, '', '', { visualContext });
  }

  async getActivePersonalization(userId) {
    try {
      const profile = await persistentMemory.getUserProfile(userId);
      // Merge vector identity (if available) with on-disk identity
      let vectorIdentity = {};
      try { vectorIdentity = await userProfileMemory.fetchIdentity(userId); } catch {}
      const identity = { ...(profile.identity || {}), ...(vectorIdentity || {}) };
      const preferences = {
        learning_style: profile.learning?.preferredStyle,
        explanation_depth: profile.communication?.preferredExplanationDepth,
        preferred_topics: profile.learning?.preferredTopics || []
      };
      const knowledge = {
        mastered_topics: profile.learning?.masteredConcepts || [],
        struggling_topics: profile.learning?.strugglingTopics || []
      };
      const ephemerals = {
        current_subject: profile.sessions?.currentSubject || null,
        current_task: profile.sessions?.currentTask || null
      };
      const snapshot = await this.buildActiveContextSnippet(userId);
      return { identity, preferences, knowledge, ephemerals, snapshot };
    } catch (e) {
      return { identity: {}, preferences: {}, knowledge: {}, ephemerals: {}, snapshot: '' };
    }
  }

  async buildActiveContextSnippet(userId) {
    try {
      const profile = await persistentMemory.getUserProfile(userId);
      const id = profile.identity || {};
      const lines = [];
      if (id.name) lines.push(`Name: ${id.name}`);
      if (id.email) lines.push(`Email: ${id.email}`);
      if (id.age) lines.push(`Age: ${id.age}`);
      if (id.nationality) lines.push(`Nationality: ${id.nationality}`);
      if (Array.isArray(id.languages) && id.languages.length) lines.push(`Languages: ${id.languages.join(', ')}`);
      if (profile.learning?.preferredStyle && profile.learning.preferredStyle !== 'unknown') lines.push(`Learning style: ${profile.learning.preferredStyle}`);
      if (Array.isArray(profile.learning?.preferredTopics) && profile.learning.preferredTopics.length) lines.push(`Top interests: ${profile.learning.preferredTopics.slice(0,3).join(', ')}`);
      if (Array.isArray(profile.learning?.strugglingTopics) && profile.learning.strugglingTopics.length) lines.push(`Needs help with: ${profile.learning.strugglingTopics.slice(-3).join(', ')}`);
      if (profile.emotional?.dominantMood && profile.emotional.dominantMood !== 'neutral') lines.push(`Usually ${profile.emotional.dominantMood}`);
      return lines.join(' | ');
    } catch {
      return '';
    }
  }
}

// Singleton instance
const personalizationController = new PersonalizationController();

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

// Backward-compatible exports plus new controller
module.exports = { extractAndStoreFacts, extractWithLLM, extractHybrid, personalizationController };


