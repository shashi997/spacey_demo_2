const { conversationMemory } = require('../controllers/conversationMemory');
const { persistentMemory } = require('../controllers/persistentMemory');

class MemoryMigrationUtility {
  constructor() {
    this.migrationComplete = false;
  }

  async migrateExistingData() {
    console.log('🔄 Starting memory migration from in-memory to persistent storage...');
    
    try {
      // Get all user data from the old memory system
      const userIds = Array.from(conversationMemory.conversations.keys());
      
      if (userIds.length === 0) {
        console.log('📭 No existing data to migrate');
        this.migrationComplete = true;
        return { success: true, migratedUsers: 0, migratedInteractions: 0 };
      }

      let totalMigratedUsers = 0;
      let totalMigratedInteractions = 0;

      for (const userId of userIds) {
        console.log(`👤 Migrating data for user: ${userId}`);
        
        // Get all interactions for this user from old system
        const oldInteractions = conversationMemory.conversations.get(userId) || [];
        
        if (oldInteractions.length === 0) {
          console.log(`  📭 No interactions found for user ${userId}`);
          continue;
        }

        // Transform old interactions to new format
        for (const oldInteraction of oldInteractions) {
          const migratedInteraction = this.transformOldInteraction(oldInteraction, userId);
          
          // Add to new persistent memory system
          await persistentMemory.addInteraction(
            userId,
            migratedInteraction.userMessage,
            migratedInteraction.aiResponse,
            migratedInteraction.metadata
          );
          
          totalMigratedInteractions++;
        }

        // Generate initial analytics for migrated user
        await this.generateInitialAnalytics(userId, oldInteractions);
        
        totalMigratedUsers++;
        console.log(`  ✅ Migrated ${oldInteractions.length} interactions for user ${userId}`);
      }

      // Create backup of old system data
      await this.createBackup(conversationMemory.conversations);

      this.migrationComplete = true;
      
      console.log(`🎉 Migration completed successfully!`);
      console.log(`   👥 Users migrated: ${totalMigratedUsers}`);
      console.log(`   💬 Interactions migrated: ${totalMigratedInteractions}`);
      
      return {
        success: true,
        migratedUsers: totalMigratedUsers,
        migratedInteractions: totalMigratedInteractions
      };

    } catch (error) {
      console.error('❌ Migration failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  transformOldInteraction(oldInteraction, userId) {
    // Transform old interaction format to new format
    return {
      userMessage: oldInteraction.userMessage,
      aiResponse: oldInteraction.aiResponse,
      metadata: {
        // Preserve existing metadata
        ...oldInteraction.metadata,
        
        // Add new required fields
        messageLength: oldInteraction.userMessage.length,
        responseLength: oldInteraction.aiResponse.length,
        emotionalState: oldInteraction.metadata?.emotionalState || 'neutral',
        learningStyle: oldInteraction.metadata?.learningStyle || 'unknown',
        topicsDetected: this.extractTopicsFromMessage(oldInteraction.userMessage),
        
        // Migration metadata
        migratedFrom: 'conversationMemory',
        migrationTimestamp: new Date().toISOString(),
        originalTimestamp: oldInteraction.timestamp
      }
    };
  }

  extractTopicsFromMessage(message) {
    // Use the same topic extraction logic as the new system
    const topics = [];
    const lowerMsg = message.toLowerCase();
    
    if (lowerMsg.includes('mars') || lowerMsg.includes('red planet')) topics.push('mars');
    if (lowerMsg.includes('black hole') || lowerMsg.includes('blackhole')) topics.push('black_holes');
    if (lowerMsg.includes('planet') || lowerMsg.includes('planetary')) topics.push('planets');
    if (lowerMsg.includes('space') || lowerMsg.includes('cosmos') || lowerMsg.includes('universe')) topics.push('space_science');
    if (lowerMsg.includes('star') || lowerMsg.includes('stellar')) topics.push('stars');
    if (lowerMsg.includes('galaxy') || lowerMsg.includes('galaxies')) topics.push('galaxies');
    if (lowerMsg.includes('energy') || lowerMsg.includes('power')) topics.push('energy');
    if (lowerMsg.includes('gravity') || lowerMsg.includes('gravitational')) topics.push('gravity');
    if (lowerMsg.includes('light') || lowerMsg.includes('electromagnetic')) topics.push('light');
    if (lowerMsg.includes('atom') || lowerMsg.includes('molecular')) topics.push('atomic_science');
    
    return topics;
  }

  async generateInitialAnalytics(userId, oldInteractions) {
    // Analyze old interactions to create initial user profile
    const profile = await persistentMemory.getUserProfile(userId);
    
    // Calculate basic stats
    profile.stats.totalInteractions = oldInteractions.length;
    
    // Analyze emotional patterns
    const emotions = oldInteractions
      .map(i => i.metadata?.emotionalState)
      .filter(e => e && e !== 'neutral');
    
    if (emotions.length > 0) {
      const emotionCounts = {};
      emotions.forEach(emotion => {
        emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
      });
      
      profile.emotional.dominantMood = Object.keys(emotionCounts).reduce((a, b) => 
        emotionCounts[a] > emotionCounts[b] ? a : b
      );
    }

    // Analyze communication patterns
    const messageLengths = oldInteractions.map(i => i.userMessage.length);
    profile.communication.averageMessageLength = 
      messageLengths.reduce((sum, len) => sum + len, 0) / messageLengths.length;

    // Extract topics and interests
    const allTopics = oldInteractions
      .flatMap(i => this.extractTopicsFromMessage(i.userMessage))
      .filter(topic => topic);

    const topicCounts = {};
    allTopics.forEach(topic => {
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    });

    // Convert to interest scores (0-1 based on frequency)
    const maxCount = Math.max(...Object.values(topicCounts));
    Object.entries(topicCounts).forEach(([topic, count]) => {
      profile.topics.interests[topic] = count / maxCount;
      profile.topics.recentTopics.push(topic);
    });

    // Save the enhanced profile
    await persistentMemory.saveUserProfile(userId, profile);
    
    console.log(`  📊 Generated analytics for user ${userId}: ${emotions.length} emotions, ${allTopics.length} topics`);
  }

  async createBackup(conversationsMap) {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      
      const backupDir = './data/backup';
      await fs.mkdir(backupDir, { recursive: true });
      
      const backupFile = path.join(backupDir, `memory_backup_${Date.now()}.json`);
      const backupData = {
        timestamp: new Date().toISOString(),
        source: 'conversationMemory',
        userData: Object.fromEntries(conversationsMap),
        totalUsers: conversationsMap.size,
        totalInteractions: Array.from(conversationsMap.values())
          .reduce((sum, interactions) => sum + interactions.length, 0)
      };

      await fs.writeFile(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
      console.log(`💾 Backup created: ${backupFile}`);
      
    } catch (error) {
      console.error('⚠️ Failed to create backup:', error);
    }
  }

  async verifyMigration() {
    console.log('🔍 Verifying migration...');
    
    try {
      const oldUserIds = Array.from(conversationMemory.conversations.keys());
      
      if (oldUserIds.length === 0) {
        console.log('✅ No original data to verify against');
        return { success: true, verified: true };
      }

      let verificationResults = {
        totalOldUsers: oldUserIds.length,
        totalOldInteractions: 0,
        verifiedUsers: 0,
        verifiedInteractions: 0,
        issues: []
      };

      for (const userId of oldUserIds) {
        const oldInteractions = conversationMemory.conversations.get(userId);
        const newInteractions = await persistentMemory.getRecentInteractions(userId, 1000);
        
        verificationResults.totalOldInteractions += oldInteractions.length;
        
        // Check if user profile was created
        const profile = await persistentMemory.getUserProfile(userId);
        if (profile.userId === userId) {
          verificationResults.verifiedUsers++;
        } else {
          verificationResults.issues.push(`Profile not found for user ${userId}`);
        }

        // Check interaction count
        const migratedCount = newInteractions.filter(i => 
          i.metadata?.migratedFrom === 'conversationMemory'
        ).length;
        
        verificationResults.verifiedInteractions += migratedCount;
        
        if (migratedCount !== oldInteractions.length) {
          verificationResults.issues.push(
            `User ${userId}: Expected ${oldInteractions.length} interactions, found ${migratedCount}`
          );
        }
      }

      console.log('📋 Verification Results:');
      console.log(`   👥 Users: ${verificationResults.verifiedUsers}/${verificationResults.totalOldUsers}`);
      console.log(`   💬 Interactions: ${verificationResults.verifiedInteractions}/${verificationResults.totalOldInteractions}`);
      
      if (verificationResults.issues.length > 0) {
        console.log(`   ⚠️ Issues found:`);
        verificationResults.issues.forEach(issue => console.log(`     - ${issue}`));
      } else {
        console.log('   ✅ All data verified successfully');
      }

      return {
        success: true,
        verified: verificationResults.issues.length === 0,
        results: verificationResults
      };

    } catch (error) {
      console.error('❌ Verification failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async runCompleteMigration() {
    console.log('🚀 Starting complete memory system migration...');
    
    // Step 1: Migrate data
    const migrationResult = await this.migrateExistingData();
    if (!migrationResult.success) {
      return migrationResult;
    }

    // Step 2: Verify migration
    const verificationResult = await this.verifyMigration();
    
    return {
      success: migrationResult.success && verificationResult.success,
      migration: migrationResult,
      verification: verificationResult,
      timestamp: new Date().toISOString()
    };
  }
}

// Create global instance
const memoryMigration = new MemoryMigrationUtility();

module.exports = {
  MemoryMigrationUtility,
  memoryMigration
}; 