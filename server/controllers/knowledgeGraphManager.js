
/**
 * Knowledge Graph Manager
 * 
 * This module is responsible for creating, managing, and querying a user-specific
 * knowledge graph. The graph tracks concepts (nodes) and their relationships (edges),
 * along with a mastery score for each concept.
 * 
 * This allows the AI tutor to build a long-term, evolving model of a user's knowledge.
 */
class KnowledgeGraphManager {
    constructor() {
        // this should be initialized with a connection
        // to a persistent database (e.g., Firestore, a graph database).
        // For now, we'll manage it in memory and save it to the user's profile.
        console.log("🧠 Knowledge Graph Manager initialized.");
    }

    /**
     * Initializes a new knowledge graph for a user.
     * @param {string} userId The ID of the user.
     * @returns {object} A new, empty knowledge graph structure.
     */
    initializeGraph(userId) {
        console.log(`🌱 Creating new knowledge graph for user: ${userId}`);
        return {
            userId,
            nodes: {}, // Concepts will be stored here
            edges: [], // Relationships between concepts
            lastUpdated: new Date().toISOString(),
        };
    }

    /**
     * Adds a new concept (node) to the user's knowledge graph.
     * @param {object} graph The user's knowledge graph.
     * @param {string} conceptName The name of the concept (e.g., "Black Holes").
     * @param {number} initialMastery The initial mastery score (0-1).
     * @returns {object} The updated knowledge graph.
     */
    addConcept(graph, conceptName, initialMastery = 0.1) {
        if (!graph.nodes[conceptName]) {
            graph.nodes[conceptName] = {
                id: conceptName,
                mastery: initialMastery,
                history: [{
                    timestamp: new Date().toISOString(),
                    change: `Concept introduced with mastery ${initialMastery}`
                }],
            };
            graph.lastUpdated = new Date().toISOString();
            console.log(`🔵 Added concept "${conceptName}" to graph for user ${graph.userId}`);
        }
        return graph;
    }

    /**
     * Updates the mastery score of a concept in the graph.
     * @param {object} graph The user's knowledge graph.
     * @param {string} conceptName The name of the concept to update.
     * @param {number} newMastery The new mastery score (0-1).
     * @param {string} reason A description of why the mastery changed.
     * @returns {object} The updated knowledge graph.
     */
    updateMastery(graph, conceptName, newMastery, reason) {
        if (graph.nodes[conceptName]) {
            const clampedMastery = Math.max(0, Math.min(1, newMastery));
            graph.nodes[conceptName].mastery = clampedMastery;
            graph.nodes[conceptName].history.push({
                timestamp: new Date().toISOString(),
                change: `Mastery updated to ${clampedMastery}. Reason: ${reason}`,
            });
            graph.lastUpdated = new Date().toISOString();
            console.log(`📈 Updated mastery for "${conceptName}" to ${clampedMastery}`);
        } else {
            // If the concept doesn't exist, add it.
            this.addConcept(graph, conceptName, newMastery);
        }
        return graph;
    }

    /**
     * Adds a relationship (edge) between two concepts.
     * @param {object} graph The user's knowledge graph.
     * @param {string} sourceConcept The source concept.
     * @param {string} targetConcept The target concept.
     * @param {string} relationshipType The type of relationship (e.g., "builds_upon", "is_related_to").
     * @returns {object} The updated knowledge graph.
     */
    addRelationship(graph, sourceConcept, targetConcept, relationshipType) {
        const edge = {
            source: sourceConcept,
            target: targetConcept,
            type: relationshipType,
        };

        // Avoid duplicate edges
        if (!graph.edges.some(e => e.source === sourceConcept && e.target === targetConcept && e.type === relationshipType)) {
            graph.edges.push(edge);
            graph.lastUpdated = new Date().toISOString();
            console.log(`🔗 Added relationship: ${sourceConcept} -> ${targetConcept} (${relationshipType})`);
        }
        return graph;
    }

    /**
     * Queries the graph to find concepts related to a given concept.
     * @param {object} graph The user's knowledge graph.
     * @param {string} conceptName The concept to find relationships for.
     * @returns {object} An object containing related concepts, prerequisites, and follow-ups.
     */
    getRelatedConcepts(graph, conceptName) {
        const related = {
            prerequisites: [],
            followUps: [],
            similar: [],
        };

        graph.edges.forEach(edge => {
            if (edge.target === conceptName && edge.type === 'builds_upon') {
                related.prerequisites.push(edge.source);
            }
            if (edge.source === conceptName && edge.type === 'builds_upon') {
                related.followUps.push(edge.target);
            }
            if (edge.type === 'is_related_to' && (edge.source === conceptName || edge.target === conceptName)) {
                const otherConcept = edge.source === conceptName ? edge.target : edge.source;
                if (!related.similar.includes(otherConcept)) {
                    related.similar.push(otherConcept);
                }
            }
        });

        return related;
    }

    /**
     * Identifies areas of struggle and strength based on mastery scores.
     * @param {object} graph The user's knowledge graph.
     * @returns {object} An object containing mastered and struggling concepts.
     */
    getKnowledgeGaps(graph) {
        const mastered = [];
        const struggling = [];

        for (const conceptName in graph.nodes) {
            const node = graph.nodes[conceptName];
            if (node.mastery > 0.8) {
                mastered.push(conceptName);
            } else if (node.mastery < 0.3) {
                struggling.push(conceptName);
            }
        }

        return { mastered, struggling };
    }
}

// Create a singleton instance
const knowledgeGraphManager = new KnowledgeGraphManager();

module.exports = { knowledgeGraphManager };