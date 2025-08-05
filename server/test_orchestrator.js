console.log('Starting orchestrator test...');

try {
    const { aiOrchestrator } = require('./controllers/aiOrchestrator');
    console.log('✅ Orchestrator loaded successfully');
} catch (error) {
    console.error('❌ Failed to load orchestrator:', error.message);
    process.exit(1);
}

async function testOrchestrator() {
    console.log('🧪 Testing AI Orchestrator Integration...\n');

    // Test 1: Basic chat request
    try {
        console.log('📝 Test 1: Basic Chat Request');
        const chatRequest = {
            type: 'chat',
            user: {
                id: 'test-user-123',
                name: 'Test Explorer',
                email: 'test@example.com'
            },
            prompt: 'Hello Spacey! Tell me about Mars exploration.',
            context: {
                userActivity: 'active',
                conversationHistory: [],
                emotionContext: { emotion: 'excited', confidence: 0.8 }
            }
        };

        const chatResponse = await aiOrchestrator.processRequest(chatRequest);
        console.log('✅ Chat Response:', chatResponse.message.substring(0, 200) + '...');
        console.log('📊 Metadata:', JSON.stringify(chatResponse.metadata, null, 2));
        console.log('');

    } catch (error) {
        console.error('❌ Chat test failed:', error.message);
    }

    // Test 2: Avatar response
    try {
        console.log('📝 Test 2: Avatar Response');
        const avatarRequest = {
            type: 'avatar_response',
            user: {
                id: 'test-user-123',
                name: 'Test Explorer',
                email: 'test@example.com'
            },
            prompt: '',
            context: {
                trigger: 'greeting',
                visualContext: {
                    faceDetected: true,
                    emotionalState: { emotion: 'happy', confidence: 0.9 },
                    visualDescription: 'User appears engaged and smiling'
                }
            }
        };

        const avatarResponse = await aiOrchestrator.processRequest(avatarRequest);
        console.log('✅ Avatar Response:', avatarResponse.message.substring(0, 200) + '...');
        console.log('📊 Type:', avatarResponse.type);
        console.log('');

    } catch (error) {
        console.error('❌ Avatar test failed:', error.message);
    }

    // Test 3: Lesson analysis
    try {
        console.log('📝 Test 3: Lesson Analysis');
        const lessonRequest = {
            type: 'lesson_analysis',
            user: {
                id: 'test-user-123',
                name: 'Test Explorer',
                email: 'test@example.com'
            },
            prompt: 'I chose to analyze the soil sample because it might contain microbial life.',
            context: {
                lessonData: { title: 'Mars Exploration Mission' },
                currentBlock: { block_id: 'soil_analysis', type: 'choice' },
                userTags: ['analytical', 'scientific'],
                interactionContext: 'Lesson Choice in block: soil_analysis'
            }
        };

        const lessonResponse = await aiOrchestrator.processRequest(lessonRequest);
        console.log('✅ Lesson Analysis:', lessonResponse.message.substring(0, 200) + '...');
        console.log('📊 Analysis:', JSON.stringify(lessonResponse.metadata?.analysis, null, 2));
        console.log('');

    } catch (error) {
        console.error('❌ Lesson test failed:', error.message);
    }

    console.log('🎯 Orchestrator testing complete!');
}

// Run the test
testOrchestrator().catch(console.error);
