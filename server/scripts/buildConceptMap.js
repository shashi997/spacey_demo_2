require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { Pinecone } = require('@pinecone-database/pinecone');

// --- CONFIGURATION ---
const LESSONS_DIR = path.resolve(__dirname, '../../client/public/lessons');
const PINECONE_INDEX_NAME = process.env.RAG_INDEX_NAME || 'lessons-v1';

// --- MAIN SCRIPT ---

async function main() {
    console.log("🚀 Starting Master Concept Map Builder");

    // 1. Initialize Pinecone
    const pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,        
    });

    // 2. Check if the index exists, create if not
    const indexList = await pinecone.listIndexes();
    if (!indexList.indexes?.some((index) => index.name === PINECONE_INDEX_NAME)) {
        console.log(`🌲 Creating new Pinecone index: ${PINECONE_INDEX_NAME}`);
        await pinecone.createIndex({
            name: PINECONE_INDEX_NAME,
            dimension: 1024, // Dimension for 'all-MiniLM-L6-v2' model
            metric: 'cosine',
            spec: {
                serverless: {
                    cloud: 'aws',
                    region: 'us-east-1'
                }
            }
        });
    }
    const index = pinecone.index(PINECONE_INDEX_NAME);

    // 3. Initialize the feature extraction pipeline
    console.log("🤖 Loading feature extraction model...");
    const { pipeline } = await import('@xenova/transformers');
    const extractor = await pipeline('feature-extraction', 'Xenova/bge-large-en-v1.5');

    // 4. Scan lesson files and extract concepts
    console.log(`📂 Scanning lessons in: ${LESSONS_DIR}`);
    const lessonFiles = await fs.readdir(LESSONS_DIR);
    const allConcepts = new Map();

    for (const file of lessonFiles) {
        if (file.endsWith('.json')) {
            const content = await fs.readFile(path.join(LESSONS_DIR, file), 'utf-8');
            const lesson = JSON.parse(content);
            
            // Extract concepts from lesson title and blocks
            addConcept(allConcepts, lesson.title, { lesson: lesson.id });
            lesson.blocks.forEach(block => {
                if (block.learning_goal) {
                    addConcept(allConcepts, block.learning_goal, { lesson: lesson.id, block: block.block_id });
                }
            });
        }
    }

    // 5. Generate embeddings and prepare for upsert
    console.log(`🧠 Found ${allConcepts.size} unique concepts. Generating embeddings...`);
    const vectors = [];
    for (const [conceptName, metadata] of allConcepts.entries()) {
        const embedding = await extractor(conceptName, { pooling: 'mean', normalize: true });
        vectors.push({
            id: conceptName,
            values: Array.from(embedding.data),
            metadata: {
                concept: conceptName,
                ...metadata
            }
        });
    }

    // 6. Upsert vectors to Pinecone
    console.log(`🌲 Upserting ${vectors.length} concept vectors to Pinecone...`);
    await index.upsert(vectors);

    console.log("✅ Master Concept Map build complete!");
}

function addConcept(map, text, metadata) {
    // Simple text normalization
    const normalizedText = text.trim().replace(/\s+/g, ' ');
    if (normalizedText && !map.has(normalizedText)) {
        map.set(normalizedText, metadata);
    }
}

main().catch(error => {
    console.error("❌ An error occurred during the build process:", error);
});
