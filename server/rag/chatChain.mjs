import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pinecone } from '@pinecone-database/pinecone';
import { PineconeStore } from '@langchain/pinecone';
import { GoogleGenAI } from '@google/genai';
// Using Xenova transformers directly to avoid local ONNX parse issues seen with the new HF wrapper
import { PromptTemplate } from '@langchain/core/prompts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Minimal Embeddings adapter backed by @xenova/transformers
class XenovaEmbeddings {
  constructor(modelName) {
    this.modelName = modelName || 'Xenova/bge-large-en-v1.5';
    this._pipelinePromise = null;
  }
  async _getPipeline() {
    if (!this._pipelinePromise) {
      const { pipeline } = await import('@xenova/transformers');
      this._pipelinePromise = pipeline('feature-extraction', this.modelName);
    }
    return this._pipelinePromise;
  }
  async embedQuery(text) {
    const pipe = await this._getPipeline();
    const output = await pipe(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }
  async embedDocuments(texts) {
    const pipe = await this._getPipeline();
    const vectors = [];
    for (const t of texts) {
      const output = await pipe(t, { pooling: 'mean', normalize: true });
      vectors.push(Array.from(output.data));
    }
    return vectors;
  }
}

// Build Pinecone retriever - local embeddings only (per your environment)
function getEmbeddings() {
  return new XenovaEmbeddings(process.env.RAG_EMBED_MODEL || 'Xenova/bge-large-en-v1.5');
}

async function createRetriever() {
  const indexName = process.env.RAG_INDEX_NAME || process.env.PINECONE_INDEX_NAME || 'lessons-v1';
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const index = pinecone.index(indexName);
  const embeddings = getEmbeddings();

  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex: index,
    textKey: 'text',
    namespace: process.env.RAG_NAMESPACE || 'lessons',
  });

  console.log(`🧭 RAG retriever ready → index: ${indexName}, namespace: ${process.env.RAG_NAMESPACE || 'lessons'}`);

  return vectorStore;
}

function buildSystemPrompt() {
  return PromptTemplate.fromTemplate(`
You are Spacey, a warm and witty AI tutor. Use the retrieved context to answer accurately. If unsure, say you don't know.

USER PROFILE:
- Name: {userName}
- Traits: {traits}
- Learning Style: {learningStyle}
- Emotional State: {emotion}

CONVERSATION SUMMARY:
{conversationSummary}

RETRIEVED CONTEXT:
{context}

USER FACTS (long-term memory):
{userFacts}

SEMANTIC CONVERSATION MEMORY:
{semanticMemory}

Guidelines:
- Ground your answer in the retrieved context when relevant.
- Keep 2–5 sentences unless the question needs more depth.
- Be supportive, precise, and engaging.
- Avoid hallucinations. If context is insufficient, ask a clarifying question.
`);
}

function formatDocs(docs) {
  if (!docs || docs.length === 0) return { context: 'No relevant context found.', citations: [] };
  const lines = [];
  const citations = [];
  for (const d of docs) {
    const meta = d.metadata || {};
    const lessonId = meta.lessonId || meta.mission_id || 'unknown';
    const blockId = meta.blockId || meta.block_id || 'unknown';
    const type = meta.type || 'unknown';
    const snippet = (d.pageContent || d.text || '').slice(0, 600);
    lines.push(`[${lessonId}#${blockId} | ${type}] ${snippet}`);
    citations.push({ lessonId, blockId, type, snippet: snippet.slice(0, 200) });
  }
  return { context: lines.join('\n---\n'), citations };
}

export async function createRagChatChain() {
  if (!process.env.PINECONE_API_KEY) {
    throw new Error('RAG requires PINECONE_API_KEY');
  }
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('RAG generation requires GEMINI_API_KEY');
  }

  const retrieverStore = await createRetriever();
  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const geminiModel = process.env.RAG_MODEL || 'gemini-2.0-flash-001';

  const systemPrompt = buildSystemPrompt();

  async function invoke({ input, userProfile = {}, conversationSummary = '', emotionalState = {}, filters = {}, longTermFacts = '', semanticMemory = '' }) {
    // 1) Condense question (simple heuristic using summary)
    const question = input;

    // 2) Retrieve relevant docs with optional metadata filters (robust two-pass)
    const k = Number(process.env.RAG_TOP_K || 6);
    let retrievedDocs = [];
    let vectorFilter = {};
    if (filters && filters.lessonId) {
      vectorFilter.lessonId = filters.lessonId;
      // Backward-compat: some ingests might store mission_id instead
      vectorFilter.mission_id = filters.lessonId;
    }

    if (Object.keys(vectorFilter).length > 0) {
      try {
        console.log('🔎 RAG similaritySearch with filter:', vectorFilter);
        retrievedDocs = await retrieverStore.similaritySearch(question, k, vectorFilter);
      } catch (e) {
        console.log('⚠️ RAG filtered search errored, skipping unfiltered fallback for now:', e.message);
      }
    }

    console.log(`🔎 RAG retrieved ${retrievedDocs.length} docs for: "${question}"`);
    if (retrievedDocs && retrievedDocs[0]) {
      console.log('📄 Top doc metadata:', retrievedDocs[0].metadata);
    }

    // 3) Build prompt and generate answer
    const { context, citations } = formatDocs(retrievedDocs);

    const prompt = await systemPrompt.format({
      userName: userProfile?.name || 'Explorer',
      traits: (userProfile?.traits || []).join(', '),
      learningStyle: userProfile?.learningStyle || 'unknown',
      emotion: emotionalState?.emotion || 'neutral',
      conversationSummary: conversationSummary || 'New user - no previous interactions.',
      context,
      userFacts: longTermFacts || 'No long-term user facts available.',
      semanticMemory
    });

    const fullPrompt = `${prompt}\n\nUSER QUESTION: ${question}`;
    let output = '';
    try {
      const res = await genAI.models.generateContent({
        model: geminiModel,
        contents: fullPrompt,
      });
      output = (res && res.text) ? res.text : '';
    } catch (e) {
      console.warn('Gemini generation failed in RAG chain:', e.message);
      output = '';
    }
    return { output, citations, retrievedCount: retrievedDocs.length };
  }

  return { invoke };
}
