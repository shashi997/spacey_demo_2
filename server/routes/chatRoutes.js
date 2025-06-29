const express = require('express');
const { chatWithAI } = require('../controllers/spaceyController');
const router = express.Router();

router.post('/spacey', chatWithAI);


module.exports = router;