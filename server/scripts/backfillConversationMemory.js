require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { conversationMemory } = require('../controllers/conversationMemory');

async function readUserConversationFiles(dir) {
  try {
    const files = await fs.readdir(dir);
    return files.filter(f => f.endsWith('.json')).map(f => path.join(dir, f));
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

async function backfill() {
  const convDir = path.resolve(__dirname, '..', 'data', 'memory', 'conversations');
  console.log('📂 Backfilling conversation memory from', convDir);
  await conversationMemory.initialize();

  const files = await readUserConversationFiles(convDir);
  if (files.length === 0) {
    console.log('No conversation files found. Nothing to backfill.');
    return;
  }

  let total = 0;
  for (const file of files) {
    const userId = path.basename(file, '.json');
    try {
      const raw = await fs.readFile(file, 'utf8');
      const interactions = JSON.parse(raw);
      console.log(`👤 ${userId}: ${interactions.length} interactions`);
      for (const i of interactions) {
        await conversationMemory.upsertTurn(userId, i.userMessage || '', i.aiResponse || '', { sessionId: i.metadata?.sessionId });
        total += 1;
      }
    } catch (e) {
      console.warn(`Skipping ${file}:`, e.message);
    }
  }
  console.log(`✅ Backfill complete. Upserted ${total} turns.`);
}

backfill().catch(err => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});


