const express = require('express');
const { chatWithAI } = require('../controllers/spaceyController');
const { handleLessonInteraction } = require('../controllers/lessonController');

const router = express.Router();

router.post('/spacey', chatWithAI);

router.post('/interact', handleLessonInteraction);


module.exports = router;