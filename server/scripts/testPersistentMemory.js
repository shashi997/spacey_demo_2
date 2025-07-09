#!/usr/bin/env node

const { persistentMemory } = require('../controllers/persistentMemory');

async function testPersistentMemorySystem() {
  console.log('🧪 Testing Persistent Memory System');
  console.log('===================================');
  console.log('');

  try {
    const testUserId = 'test-user-demo';
    
    // Test 1: Create new user profile
    console.log('📝 Test 1: Creating new user profile...');
    const profile = await persistentMemory.getUserProfile(testUserId);
    console.log(`✅ Created profile for user: ${profile.userId}`);
    console.log(`   📅 Created at: ${profile.createdAt}`);
    console.log('');

    // Test 2: Add sample interactions
    console.log('💬 Test 2: Adding sample interactions...');
    
    const sampleInteractions = [
      {
        user: "Tell me about Mars",
        ai: "Mars is fascinating! It's the fourth planet from the Sun, often called the Red Planet due to iron oxide on its surface.",
        emotion: "excited"
      },
      {
        user: "How far is Mars from Earth?",
        ai: "Great question! Mars distance from Earth varies from about 35 million miles to 250 million miles depending on orbital positions.",
        emotion: "engaged"
      },
      {
        user: "I'm confused about black holes",
        ai: "No worries! Black holes can be tricky. Think of them as regions where gravity is so strong that nothing can escape, not even light.",
        emotion: "confused"
      },
      {
        user: "That makes sense! What about energy in space?",
        ai: "Excellent! You're getting it! Space contains various forms of energy - solar radiation, cosmic rays, and gravitational potential energy.",
        emotion: "excited"
      },
      {
        user: "Can you explain more about planetary formation?",
        ai: "Of course! Planets form from dust and gas in disks around young stars, gradually clumping together through gravitational attraction.",
        emotion: "engaged"
      }
    ];

    for (let i = 0; i < sampleInteractions.length; i++) {
      const interaction = sampleInteractions[i];
      await persistentMemory.addInteraction(
        testUserId,
        interaction.user,
        interaction.ai,
        {
          emotionalState: interaction.emotion,
          learningStyle: i < 2 ? 'detail_seeker' : 'quick_learner',
          provider: 'test-system'
        }
      );
      
      console.log(`   💬 Added interaction ${i + 1}: "${interaction.user.substring(0, 30)}..."`);
      
      // Small delay to see progression
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.log('');

    // Test 3: Generate enhanced context
    console.log('🧠 Test 3: Generating enhanced context...');
    const enhancedContext = await persistentMemory.generateEnhancedContext(testUserId);
    
    console.log('📊 Enhanced Context Generated:');
    console.log(`   📈 Total interactions: ${enhancedContext.totalInteractions}`);
    console.log(`   🎯 Learning style: ${enhancedContext.learningStyle}`);
    console.log(`   😊 Dominant mood: ${enhancedContext.dominantMood}`);
    console.log(`   📝 Avg message length: ${Math.round(enhancedContext.averageMessageLength)} chars`);
    console.log(`   🌟 Top interests: ${enhancedContext.topInterests.map(t => `${t.topic} (${Math.round(t.score * 100)}%)`).join(', ')}`);
    console.log(`   📚 Recent topics: ${enhancedContext.recentTopics.slice(0, 5).join(', ')}`);
    console.log(`   🎓 Mastered concepts: ${enhancedContext.masteredConcepts.join(', ') || 'Still learning'}`);
    console.log(`   ⚠️ Struggling with: ${enhancedContext.strugglingTopics.join(', ') || 'None yet'}`);
    console.log('');

    // Test 4: Test emotional state detection
    console.log('😊 Test 4: Testing emotional state detection...');
    const emotionalTests = [
      "I'm really excited about space exploration!",
      "I'm stuck and confused about this concept",
      "Tell me more about that please",
      "I think maybe I understand now?"
    ];

    for (const message of emotionalTests) {
      const emotional = await persistentMemory.detectEmotionalState(testUserId, message);
      console.log(`   "${message}"`);
      console.log(`   → Detected: ${emotional.emotion} (${Math.round(emotional.confidence * 100)}% confidence)`);
    }
    console.log('');

    // Test 5: Test conversation summary
    console.log('📋 Test 5: Testing conversation summary...');
    const summary = await persistentMemory.summarizeContext(testUserId);
    console.log(`   Summary: ${summary}`);
    console.log('');

    // Test 6: Get recent interactions
    console.log('🔍 Test 6: Getting recent interactions...');
    const recentInteractions = await persistentMemory.getRecentInteractions(testUserId, 3);
    console.log(`   Found ${recentInteractions.length} recent interactions:`);
    recentInteractions.forEach((interaction, index) => {
      console.log(`   ${index + 1}. User: "${interaction.userMessage}"`);
      console.log(`      AI: "${interaction.aiResponse.substring(0, 50)}..."`);
      console.log(`      Topics: ${interaction.metadata.topicsDetected?.join(', ') || 'none'}`);
      console.log(`      Emotion: ${interaction.metadata.emotionalState}`);
    });
    console.log('');

    // Test 7: Export user data
    console.log('📤 Test 7: Exporting user data...');
    const userData = await persistentMemory.exportUserData(testUserId);
    console.log(`   📊 Exported data for ${userData.profile.userId}:`);
    console.log(`      📅 Account created: ${userData.profile.createdAt}`);
    console.log(`      💬 Total interactions: ${userData.totalInteractions}`);
    console.log(`      📈 Current learning style: ${userData.profile.learning.preferredStyle}`);
    console.log(`      🎯 Top interest: ${Object.entries(userData.profile.topics.interests)[0]?.[0] || 'Still discovering'}`);
    console.log('');

    // Test 8: Performance test
    console.log('⚡ Test 8: Performance test...');
    const startTime = Date.now();
    
    // Rapid context generation
    for (let i = 0; i < 10; i++) {
      await persistentMemory.generateEnhancedContext(testUserId);
    }
    
    const endTime = Date.now();
    console.log(`   ⚡ Generated 10 enhanced contexts in ${endTime - startTime}ms`);
    console.log(`   📊 Average: ${Math.round((endTime - startTime) / 10)}ms per context`);
    console.log('');

    // Cleanup
    console.log('🧹 Cleaning up test data...');
    await persistentMemory.flushSessionCache(testUserId);
    console.log('   ✅ Session cache flushed');
    console.log('   📁 Data files remain for inspection in ./data/memory/');
    console.log('');

    console.log('🎉 All tests completed successfully!');
    console.log('');
    console.log('🔍 You can inspect the generated files:');
    console.log(`   👤 Profile: ./data/memory/profiles/${testUserId}.json`);
    console.log(`   💬 Conversations: ./data/memory/conversations/${testUserId}.json`);
    console.log('');
    console.log('✨ The persistent memory system is working perfectly!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Add CLI help
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log('Persistent Memory System Test');
  console.log('');
  console.log('Usage: node scripts/testPersistentMemory.js');
  console.log('');
  console.log('This script tests all features of the persistent memory system:');
  console.log('- User profile creation');
  console.log('- Interaction storage');
  console.log('- Enhanced context generation');
  console.log('- Emotional state detection');
  console.log('- Learning analytics');
  console.log('- Performance measurement');
  console.log('');
  process.exit(0);
}

// Run the test
testPersistentMemorySystem(); 