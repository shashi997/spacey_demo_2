const express = require('express');
const { chatWithAI, getPlayerMemory, updatePlayerTrait, updatePlayerMission, getAIProviders } = require('../controllers/spaceyController');
const router = express.Router();

// Chat with AI
router.post('/spacey', chatWithAI);

// Get available AI providers
router.get('/providers', getAIProviders);

// Player memory management routes
router.get('/player/:playerId/memory', getPlayerMemory);
router.post('/player/:playerId/trait', updatePlayerTrait);
router.post('/player/:playerId/mission', updatePlayerMission);

module.exports = router;