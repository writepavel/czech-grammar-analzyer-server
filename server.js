const express = require('express');
const path = require('path');
const analyzeHandler = require('./api/analyze');

const app = express();
const port = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, '.')));

// API route
app.get('/api/analyze', (req, res) => {
    analyzeHandler(req, res);
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});