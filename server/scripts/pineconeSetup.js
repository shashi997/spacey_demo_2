const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Pinecone } = require('@pinecone-database/pinecone');
// const { pipline } = require('@xenova/transformers')

// --- CONFIGURATION ---
const LESSON_FILE_PATH = path.resolve(__dirname, '../../client/public/lessons/mars_energy.json');
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME; 
const EMBEDDING_MODEL = 'Xenova/bge-large-en-v1.5';

/**
 * Chunks the lesson data into smaller pieces for embedding.
 */

const chunkLessonData = (lessonData) => {
    const chunks = [];
    const lessonId = lessonData.id;
    const lessonTitle = lessonData.title;

    lessonData.blocks.forEach(block => {
        // 1. The main content of the block
        chunks.push({
            id: `${lessonId}-${block.block_id}`,
            text: `In the lesson "${lessonTitle}", during the section "${block.title}", the content is: ${block.content}. The learning goal is: ${block.learning_goal || 'to assess the situation'}.`,
            metadata: {
                lessonId,
                lessonTitle,
                blockId: block.block_id,
                blockType: block.type,
                contentType: 'block_content',
                originalText: block.content,
            },
        });

        // 2. If it's a choice block, chunk each choice individually
        if (block.type === 'choice' && block.choices) {
            block.choices.forEach((choice, index) => {
                chunks.push({
                    id: `${lessonId}-${block.block_id}-choice-${index}`,
                    text: `In the lesson "${lessonTitle}", when faced with the situation "${block.content}", one available option is: "${choice.text}". This choice relates to the trait: ${choice.tag}. The AI's internal thought is ${choice.ai_reaction}.`,
                    metadata: {
                        lessonId,
                        lessonTitle,
                        blockId: block.block_id,
                        choiceIndex: index,
                        traitTag: choice.tag,
                        contentType: 'choice_option',
                        originalText: choice.text,
                    },
                });
            });
        }   
    });

    console.log(`Created ${chunks.length} chunks for lesson "${lessonTitle}".`);
    return chunks;
};


/**
* The main function to orchestrate the entire process.
*/
const main = async () => {
    try {
        console.log("Starting Pinecone setup process...");

        // 1. Initialize the embedding pipeline from Xenova/transformers
        console.log(`\n1. Initializing embedding model: ${EMBEDDING_MODEL}`);
        const { pipeline } = await import('@xenova/transformers');
        const embedder = await pipeline('feature-extraction', EMBEDDING_MODEL);
        console.log("Model initialized successfully.");

        // 2. Load and chunk the lesson data from the JSON file
        console.log(`\n2. Loading and chunking lesson data from: ${LESSON_FILE_PATH}`);
        const lessonFileContent = fs.readFileSync(LESSON_FILE_PATH, 'utf-8');
        const lessonData = JSON.parse(lessonFileContent);
        const chunks = chunkLessonData(lessonData);

        // 3. Initialize the Pinecone client and connect to the index
        console.log(`\n3. Initializing Pinecone client...`);
        const pinecone = new Pinecone();
        const index = pinecone.index(PINECONE_INDEX_NAME);
        console.log(`Connected to Pinecone index: "${PINECONE_INDEX_NAME}"`)

        // 4. Generate embeddings and prepare vectors for upsert
        console.log("\n4. Generating embeddings for each chunk...");
        const vectors = [];
        for (const chunk of chunks) {
            const embedding = await embedder(chunk.text, { pooling: 'mean', normalize: true });
            vectors.push({
                id: chunk.id,
                values: Array.from(embedding.data),
                metadata: chunk.metadata,
            });
            process.stdout.write(`Processed chunk: ${chunk.id}\r`);
        }

        // 5. Upsert the vectors into the Pinecone index in batches
        console.log(`\n5. Upserting ${vectors.length} vectors to Pinecone...`);
        const batchSize = 100;
        for (let i = 0; i < vectors.length; i += batchSize) {
            const batch = vectors.slice(i, i += batchSize);
            await index.upsert(batch); 
        }

        console.log("Upsert complete.");
        console.log("\n Process finished successfully! lesson is indexed in Pinecone.");
    } catch (error) {
        console.error("\n An error occurred during the process:");
        console.error(error);
        if (error.code === 'ENOENT') {
            console.error("Hint: Make sure the path to your lesson file is correct and you are running the script from the 'server' directory.");
        }
    }
};

main();