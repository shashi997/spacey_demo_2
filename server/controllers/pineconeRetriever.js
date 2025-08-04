const { Pinecone } = require('@pinecone-database/pinecone');

// CONFIGURATION
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME;
const EMBEDDING_MODEL = 'Xenova/bge-large-en-v1.5';

let embedder;
let index;

/**
 * Initializes the Pinecone client, index, and the embedding model.
 */
const initialize = async () => {
    if (embedder && index) {
        console.log("Pinecone and embedder already initialized.");
        return;
    }

    // Check if Pinecone is configured
    if (!PINECONE_INDEX_NAME) {
        console.log('Pinecone not configured, skipping initialization');
        return;
    }
    
    try {
        console.log('Initializing Pinecone retriever...');

        // Initialize Pinecone client
        const pinecone = new Pinecone();
        index = pinecone.index(PINECONE_INDEX_NAME);

        // Initialize the embedding model
        const { pipeline } = await import('@xenova/transformers');
        embedder = await pipeline('feature-extraction', EMBEDDING_MODEL);

        console.log("Pinecone retriever initialized successfully.");
    } catch (error) {
        console.error("Error initializing Pinecone retriever:", error);
        throw error;
    }
};

/**
 * Queries the Pinecone index to find the most relevant lesson context for a given user query.
 */
const getRelevantContext = async (userQuery, topK = 3) => {
    // Check if Pinecone is configured
    if (!PINECONE_INDEX_NAME) {
        console.log('Pinecone not configured, skipping context retrieval');
        return "";
    }

    if (!embedder || !index) {
        await initialize();
    }

    try {
        console.log(`Generating embedding for query: "${userQuery}"`);
        const queryEmbedding = await embedder(userQuery, { pooling: 'mean', normalize: true });

        console.log(`Querying Pinecone index "${PINECONE_INDEX_NAME}"...`);
        const queryResponse = await index.query({
            vector: Array.from(queryEmbedding.data),
            topK,
            includeMetadata: true,
        });

        if (queryResponse.matches && queryResponse.matches.length > 0) {
            const context = queryResponse.matches
                .map(match => {
                    const metadata = match.metadata;
                    // Reconstruct the context from metadata for clarity
                    if (metadata.contentType === 'choice_option') {
                        return `Regarding the choice "${metadata.originalText}", the AI noted: "${metadata.ai_reaction}".`;
                    }
                    return metadata.originalText;
                })
                .join('\n\n---\n\n'); // Separate contexts for clarity

            console.log(`Found ${queryResponse.matches.length} relevant contexts.`);
            return context;
        } else {
            console.log("No relevant context found in Pinecone.");
            return "";
        }
    } catch (error) {
        console.error("Error querying Pinecone:", error);
        return "";
    }
};

module.exports = {
    initialize, 
    getRelevantContext,
};