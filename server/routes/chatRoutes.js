const express = require('express');
const { chatWithAI } = require('../controllers/spaceyController');
const { handleLessonInteraction } = require('../controllers/lessonController');

const router = express.Router();

// POST route for chat functionality
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
        user: { id: "user-id", email: "user@example.com" }
      }
    },
    status: "Server is running and ready for chat requests!"
  });
});

router.post('/interact', handleLessonInteraction);

module.exports = router;