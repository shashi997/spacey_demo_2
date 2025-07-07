#!/usr/bin/env node

const { memoryMigration } = require('../utils/migrateMemory');

async function runMigration() {
  console.log('🚀 Spacey Memory Migration Tool');
  console.log('================================');
  console.log('');

  try {
    const result = await memoryMigration.runCompleteMigration();
    
    if (result.success) {
      console.log('');
      console.log('✅ Migration completed successfully!');
      console.log('');
      console.log('📊 Summary:');
      console.log(`   👥 Users migrated: ${result.migration.migratedUsers}`);
      console.log(`   💬 Interactions migrated: ${result.migration.migratedInteractions}`);
      console.log(`   ✅ Verification: ${result.verification.verified ? 'Passed' : 'Issues found'}`);
      console.log('');
      console.log('🎯 Your persistent memory system is now ready!');
      console.log('   📁 Data will be stored in: ./data/memory/');
      console.log('   💾 User profiles: ./data/memory/profiles/');
      console.log('   💬 Conversations: ./data/memory/conversations/');
      console.log('   📊 Analytics: ./data/memory/analytics/');
      console.log('');
      console.log('🚀 You can now start your server with enhanced memory!');
      
    } else {
      console.log('');
      console.log('❌ Migration failed');
      console.log('Error:', result.error || result.migration?.error || result.verification?.error);
      console.log('');
      console.log('🔧 Please check the error above and try again.');
      process.exit(1);
    }

  } catch (error) {
    console.error('');
    console.error('💥 Unexpected error during migration:');
    console.error(error);
    console.error('');
    process.exit(1);
  }
}

// Add some CLI options
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log('Spacey Memory Migration Tool');
  console.log('');
  console.log('Usage: node scripts/migrate.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --help, -h     Show this help message');
  console.log('  --verify-only  Only run verification without migration');
  console.log('');
  console.log('This tool migrates data from the old in-memory system');
  console.log('to the new persistent JSON-based memory system.');
  process.exit(0);
}

if (args.includes('--verify-only')) {
  console.log('🔍 Running verification only...');
  memoryMigration.verifyMigration()
    .then(result => {
      if (result.success && result.verified) {
        console.log('✅ Verification passed!');
        process.exit(0);
      } else {
        console.log('❌ Verification failed');
        console.log(result);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Verification error:', error);
      process.exit(1);
    });
} else {
  runMigration();
} 