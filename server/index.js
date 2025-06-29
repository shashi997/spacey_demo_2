const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const chatRoutes = require('./routes/chatRoutes');


const app = express();

// Middleware
app.use(express.json());
app.use(cors());

app.get('/', (req, res) => {
  res.send('Hello from the server!');
});

// Routes
app.use('/api/chat', chatRoutes);

// Start Server
const PORT = process.env.PORT || 5000; // Use PORT from .env or default to 5000
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});