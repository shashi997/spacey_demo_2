const express = require('express');
const { chatWithAI, getUserTraits, getContextSummary, saveChoice, getUserTraitCounts, getMissionHistory, saveFinalSummary, canUnlock } = require('../controllers/spaceyController');
const { handleLessonInteraction } = require('../controllers/lessonController');

const router = express.Router();

// POST route for chat functionality (handles all chat types)
router.post('/spacey', chatWithAI);

// GET route to provide helpful info when someone visits the API URL directly
router.get('/spacey', (req, res) => {
  res.json({
    message: "🚀 Spacey API Endpoint",
    info: "This endpoint accepts POST requests only. Use your frontend application to chat with Spacey!",
    usage: {
      method: "POST",
      url: "/api/chat/spacey",
      body: {
        prompt: "Your message here",
        user: { id: "user-id", email: "user@example.com" },
        type: "standard_chat | avatar_response | enhanced_chat | personalized_compliment"
      }
    },
    status: "Server is running and ready for chat requests!"
  });
});

// GET route for fetching user personality traits
router.get('/traits/:userId', getUserTraits);

// GET route for fetching conversation context and summary
router.get('/context/:userId', getContextSummary);

// POST route for lesson interactions
router.post('/interact', handleLessonInteraction);

// POST route for saving a player choice
router.post('/profile/saveChoice', saveChoice);

// GET route for user trait counts (bar chart data)
router.get('/profile/traits/:userId', getUserTraitCounts);

// GET route for mission history
router.get('/profile/missions/:userId', getMissionHistory);

// POST route for saving final summary
router.post('/profile/saveFinalSummary', saveFinalSummary);

// GET route for unlock logic
router.get('/profile/canUnlock', canUnlock);

module.exports = router;