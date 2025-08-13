const { Pinecone } = require('@pinecone-database/pinecone');

// Environment configuration
const CONVERSATIONS_INDEX_NAME = process.env.CONVERSATIONS_INDEX_NAME || 'conversations-v1';
const CONVERSATIONS_NAMESPACE = process.env.CONVERSATIONS_NAMESPACE || 'conversations';
const EMBEDDING_MODEL = process.env.CONVERSATIONS_EMBED_MODEL || 'Xenova/bge-large-en-v1.5';

let embedder;
let index;

function scrubMetadata(metadata) {
  const cleaned = {};
  for (const [key, value] of Object.entries(metadata || {})) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      cleaned[key] = value;
    } else if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
      cleaned[key] = value;
    } else {
      // Fallback: coerce to string to satisfy Pinecone metadata type constraints
      cleaned[key] = String(value);
    }
  }
  return cleaned;
}

async function initialize() {
  if (embedder && index) return;
  if (!CONVERSATIONS_INDEX_NAME) {
    console.log('Conversation memory: Pinecone not configured, skipping initialization');
    return;
  }
  try {
    const { pipeline } = await import('@xenova/transformers');
    embedder = await pipeline('feature-extraction', EMBEDDING_MODEL);
    // Probe embedding dimension
    const probe = await embedder('dimension_probe', { pooling: 'mean', normalize: true });
    const dimension = Array.isArray(probe?.data) ? probe.data.length : (probe?.data?.length || 1024);

    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    // Ensure index exists
    const list = await pinecone.listIndexes();
    const exists = list.indexes?.some((i) => i.name === CONVERSATIONS_INDEX_NAME);
    if (!exists) {
      console.log(`🌲 Creating Pinecone index for conversation memory: ${CONVERSATIONS_INDEX_NAME} (dim=${dimension})`);
      await pinecone.createIndex({
        name: CONVERSATIONS_INDEX_NAME,
        dimension,
        metric: 'cosine',
        spec: { serverless: { cloud: 'aws', region: 'us-east-1' } }
      });
    }
    index = pinecone.index(CONVERSATIONS_INDEX_NAME);
    console.log(`🧠 Conversation memory ready → index: ${CONVERSATIONS_INDEX_NAME}, ns: ${CONVERSATIONS_NAMESPACE}`);
  } catch (err) {
    console.error('Failed to initialize conversation memory:', err);
  }
}

function buildTurnText(userMessage, aiResponse) {
  const user = (userMessage || '').trim();
  const ai = (aiResponse || '').trim();
  if (!user && !ai) return '';
  return `USER: ${user}\nASSISTANT: ${ai}`.slice(0, 2000); // limit stored text size
}

async function upsertTurn(userId, userMessage, aiResponse, metadata = {}) {
  try {
    if (!CONVERSATIONS_INDEX_NAME) return;
    if (!embedder || !index) await initialize();
    const text = buildTurnText(userMessage, aiResponse);
    if (!text) return;

    const vector = await embedder(text, { pooling: 'mean', normalize: true });
    const id = `${userId}:${Date.now()}`;
    const values = Array.from(vector.data);
    const meta = scrubMetadata({
      userId,
      type: 'turn',
      originalText: text,
      timestamp: new Date().toISOString(),
      sessionId: metadata.sessionId,
    });

    await index
      .namespace(CONVERSATIONS_NAMESPACE)
      .upsert([
        { id, values, metadata: meta }
      ]);
  } catch (err) {
    console.warn('Conversation memory upsert failed:', err.message);
  }
}

async function searchRelevant(userId, query, topK = 5, extraFilter = {}) {
  try {
    if (!CONVERSATIONS_INDEX_NAME) return '';
    if (!embedder || !index) await initialize();
    if (!query) return '';
    const vector = await embedder(query, { pooling: 'mean', normalize: true });
    const res = await index
      .namespace(CONVERSATIONS_NAMESPACE)
      .query({
        vector: Array.from(vector.data),
        topK,
        includeMetadata: true,
        filter: { userId, ...(extraFilter || {}) }
      });
    if (!res?.matches?.length) return '';
    const lines = res.matches.map(m => m.metadata?.originalText || '').filter(Boolean);
    return lines.slice(0, topK).join('\n\n—\n\n');
  } catch (err) {
    console.warn('Conversation memory search failed:', err.message);
    return '';
  }
}

module.exports = {
  initialize,
  upsertTurn,
  searchRelevant,
  async upsertFact(userId, text, { factType = 'identity', key = 'unknown', ttlDays, confidence, importance } = {}) {
    try {
      if (!CONVERSATIONS_INDEX_NAME) return;
      if (!embedder || !index) await initialize();
      const clean = (text || '').trim();
      if (!clean) return;
      const vector = await embedder(clean, { pooling: 'mean', normalize: true });
      const id = `${userId}:fact:${key}:${Date.now()}`;
      const values = Array.from(vector.data);
      const metadata = scrubMetadata({ userId, type: 'fact', factType, key, originalText: clean, timestamp: new Date().toISOString(), ttlDays, confidence, importance });
      await index
        .namespace(CONVERSATIONS_NAMESPACE)
        .upsert([{ id, values, metadata }]);
    } catch (err) {
      console.warn('Conversation memory upsertFact failed:', err.message);
    }
  },
  conversationMemory: { initialize, upsertTurn, searchRelevant, upsertFact: async (userId, text, opts) => module.exports.upsertFact(userId, text, opts) }
};


