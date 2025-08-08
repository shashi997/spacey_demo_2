import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pinecone } from '@pinecone-database/pinecone';
import { Document } from 'langchain/document';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from '@langchain/openai';
import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/hf_transformers';
import { PineconeStore } from '@langchain/pinecone';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LESSONS_DIR = path.resolve(__dirname, '../../client/public/lessons');

async function loadLessons() {
  const files = await fs.readdir(LESSONS_DIR);
  const jsonFiles = files.filter(f => f.endsWith('.json'));
  const lessons = [];
  for (const f of jsonFiles) {
    const full = path.join(LESSONS_DIR, f);
    try {
      const data = JSON.parse(await fs.readFile(full, 'utf8'));
      lessons.push({ file: f, data });
    } catch (e) {
      console.warn(`Skipping invalid JSON: ${f}`, e.message);
    }
  }
  return lessons;
}

function blocksToDocuments(lesson) {
  const docs = [];
  const missionId = lesson.mission_id || lesson.id || 'unknown';
  const title = lesson.title || missionId;
  const blocks = Array.isArray(lesson.blocks) ? lesson.blocks : [];

  for (const b of blocks) {
    const content = [b.content, b.prompt, b.question, b.text]
      .filter(Boolean)
      .join('\n')
      .trim();
    if (!content) continue;

    const metadata = {
      lessonId: missionId,
      lessonTitle: title,
      blockId: b.block_id || b.id || 'unknown',
      type: b.type || 'unknown',
      learningGoal: b.learning_goal || null,
    };

    docs.push(new Document({ pageContent: content, metadata }));
  }

  return docs;
}

async function chunkDocuments(documents) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 700,
    chunkOverlap: 120,
  });
  const chunks = [];
  for (const doc of documents) {
    const splitDocs = await splitter.splitDocuments([doc]);
    chunks.push(...splitDocs);
  }
  return chunks;
}

function getEmbeddings() {
  const provider = (process.env.RAG_EMBED_PROVIDER || 'local').toLowerCase();
  if (provider === 'local') {
    return new HuggingFaceTransformersEmbeddings({
      model: process.env.RAG_EMBED_MODEL || 'Xenova/bge-large-en-v1.5',
    });
  }
  return new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.RAG_EMBED_MODEL || 'text-embedding-3-large',
  });
}

async function upsertToPinecone(documents) {
  const indexName = process.env.RAG_INDEX_NAME || process.env.PINECONE_INDEX_NAME || 'lessons-v1';
  const namespace = process.env.RAG_NAMESPACE || 'lessons';
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  // Ensure index exists (aligns with local Xenova bge-large-en-v1.5 → 1024 dims)
  const expectedDim = (process.env.RAG_EMBED_PROVIDER || 'local').toLowerCase() === 'local'
    ? 1024
    : 3072; // OpenAI text-embedding-3-large

  const existing = await pinecone.listIndexes();
  const exists = existing.indexes?.some((idx) => idx.name === indexName);
  if (!exists) {
    console.log(`🌲 Creating Pinecone index: ${indexName} (dim=${expectedDim}, cosine)`);
    await pinecone.createIndex({
      name: indexName,
      dimension: expectedDim,
      metric: 'cosine',
      spec: { serverless: { cloud: 'aws', region: 'us-east-1' } }
    });
  }
  const index = pinecone.index(indexName);
  const embeddings = getEmbeddings();

  console.log(`🔧 Upserting ${documents.length} chunks into index "${indexName}" namespace "${namespace}"...`);
  await PineconeStore.fromDocuments(documents, embeddings, {
    pineconeIndex: index,
    namespace,
    textKey: 'text',
  });
  console.log('✅ Upsert complete');
}

async function main() {
  const provider = (process.env.RAG_EMBED_PROVIDER || 'local').toLowerCase();
  if (!process.env.PINECONE_API_KEY) {
    console.error('PINECONE_API_KEY is required');
    process.exit(1);
  }
  if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is required when RAG_EMBED_PROVIDER=openai');
    process.exit(1);
  }

  console.log('📚 Loading lessons from:', LESSONS_DIR);
  const lessons = await loadLessons();
  if (lessons.length === 0) {
    console.log('No lessons found. Exiting.');
    return;
  }

  let docs = [];
  for (const { data } of lessons) {
    docs.push(...blocksToDocuments(data));
  }

  console.log(`📝 Built ${docs.length} documents from lessons. Chunking...`);
  const chunks = await chunkDocuments(docs);
  console.log(`🧩 Total chunks: ${chunks.length}`);

  await upsertToPinecone(chunks);
}

main().catch(err => {
  console.error('❌ Ingestion failed:', err);
  process.exit(1);
});
