const { Pinecone } = require('@pinecone-database/pinecone');

// Configuration
const USER_PROFILE_INDEX_NAME = process.env.USER_PROFILE_INDEX_NAME || process.env.PINECONE_PROFILE_INDEX || 'user-profiles-v1';
const USER_PROFILE_NAMESPACE = process.env.USER_PROFILE_NAMESPACE || 'user_profiles';
const EMBEDDING_MODEL = process.env.USER_PROFILE_EMBED_MODEL || 'Xenova/bge-large-en-v1.5';

let embedder;
let index;
let dimension;

const ALLOWED_KEYS = ['name', 'email', 'pronouns', 'age', 'nationality', 'timezone', 'locale', 'language', 'languages'];

async function initialize() {
  if (embedder && index) return;
  if (!process.env.PINECONE_API_KEY || !USER_PROFILE_INDEX_NAME) {
    console.log('UserProfileMemory: Pinecone not configured, skipping initialization');
    return;
  }
  try {
    const { pipeline } = await import('@xenova/transformers');
    embedder = await pipeline('feature-extraction', EMBEDDING_MODEL);
    const probe = await embedder('dimension_probe', { pooling: 'mean', normalize: true });
    dimension = Array.isArray(probe?.data) ? probe.data.length : (probe?.data?.length || 1024);

    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const list = await pinecone.listIndexes();
    const exists = list.indexes?.some((i) => i.name === USER_PROFILE_INDEX_NAME);
    if (!exists) {
      console.log(`🌲 Creating Pinecone index for user profiles: ${USER_PROFILE_INDEX_NAME} (dim=${dimension})`);
      await pinecone.createIndex({
        name: USER_PROFILE_INDEX_NAME,
        dimension,
        metric: 'cosine',
        spec: { serverless: { cloud: 'aws', region: 'us-east-1' } }
      });
    }
    index = pinecone.index(USER_PROFILE_INDEX_NAME);
    console.log(`🪪 User profile memory ready → index: ${USER_PROFILE_INDEX_NAME}, ns: ${USER_PROFILE_NAMESPACE}`);
  } catch (err) {
    console.error('Failed to initialize user profile memory:', err);
  }
}

function buildId(userId, key) {
  return `${userId}:identity:${key}`;
}

async function upsertIdentity(userId, updates = {}) {
  try {
    if (!USER_PROFILE_INDEX_NAME || !process.env.PINECONE_API_KEY) return;
    if (!embedder || !index) await initialize();
    const items = [];
    for (const [keyRaw, valueRaw] of Object.entries(updates)) {
      const key = String(keyRaw).toLowerCase();
      if (!ALLOWED_KEYS.includes(key)) continue;
      if (key === 'languages' && Array.isArray(valueRaw)) {
        for (const lang of valueRaw) {
          const text = `language=${String(lang)}`;
          const vec = await embedder(text, { pooling: 'mean', normalize: true });
          items.push({ id: buildId(userId, `language:${String(lang).toLowerCase()}`), values: Array.from(vec.data), metadata: { userId, type: 'identity', key: 'language', value: String(lang) } });
        }
        continue;
      }
      const value = Array.isArray(valueRaw) ? valueRaw.join(',') : String(valueRaw);
      const text = `${key}=${value}`;
      const vec = await embedder(text, { pooling: 'mean', normalize: true });
      items.push({ id: buildId(userId, key), values: Array.from(vec.data), metadata: { userId, type: 'identity', key, value } });
    }
    if (items.length === 0) return;
    await index.namespace(USER_PROFILE_NAMESPACE).upsert(items);
  } catch (err) {
    console.warn('UserProfileMemory upsertIdentity failed:', err.message);
  }
}

async function fetchIdentity(userId) {
  try {
    if (!USER_PROFILE_INDEX_NAME || !process.env.PINECONE_API_KEY) return {};
    if (!index) await initialize();
    const ids = ['name', 'email', 'pronouns', 'age', 'nationality', 'timezone', 'locale'].map((k) => buildId(userId, k));
    // fetch supports up to 100 ids per call
    const res = await index.namespace(USER_PROFILE_NAMESPACE).fetch(ids);
    const out = {};
    const vectors = res?.records || res?.vectors || {};
    for (const [id, record] of Object.entries(vectors)) {
      const key = record?.metadata?.key;
      const value = record?.metadata?.value;
      if (!key) continue;
      out[key] = value;
    }
    // Languages use per-language ids with prefix
    // Pinecone fetch does not support wildcards; approximate by querying topK=5 for 'language='
    try {
      const probe = await embedder('language=', { pooling: 'mean', normalize: true });
      const query = await index.namespace(USER_PROFILE_NAMESPACE).query({
        vector: Array.from(probe.data),
        topK: 16,
        includeMetadata: true,
        filter: { userId, type: 'identity', key: 'language' }
      });
      const langs = (query?.matches || []).map(m => m?.metadata?.value).filter(Boolean);
      if (langs.length) out.languages = Array.from(new Set(langs));
    } catch (_) {}
    return out;
  } catch (err) {
    console.warn('UserProfileMemory fetchIdentity failed:', err.message);
    return {};
  }
}

module.exports = { initialize, upsertIdentity, fetchIdentity };


