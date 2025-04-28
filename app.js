const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware to parse request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Route to serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to fetch and modify content
app.post('/fetch', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Fetch the content from the provided URL
    const response = await axios.get(url);
    const html = response.data;

    // Load HTML with original whitespace
    const $ = cheerio.load(html, {
      decodeEntities: false,
      normalizeWhitespace: false,
      xmlMode: false
    });
    
    // Process text nodes in the body
    $('body *').contents().filter(function() {
      return this.nodeType === 3; // Text nodes only
    }).each(function() {
      const text = $(this).text();
      // Only replace if text contains Yale (case insensitive)
      if (text.match(/yale/i)) {
        const newText = text.replace(/YALE/g, 'FALE')  // Replace uppercase first
                           .replace(/Yale/g, 'Fale')    // Then title case
                           .replace(/yale/g, 'fale');   // Then lowercase
        $(this).replaceWith(newText);
      }
    });
    
    // Process title separately
    const titleText = $('title').text();
    if (titleText.match(/yale/i)) {
      const newTitle = titleText.replace(/YALE/g, 'FALE')
                               .replace(/Yale/g, 'Fale')
                               .replace(/yale/g, 'fale');
      $('title').text(newTitle);
    }
    
    // Return the modified content with success flag and title
    return res.json({
      success: true,
      content: $.html({ decodeEntities: false }),
      title: $('title').text(),
      originalUrl: url
    });
  } catch (error) {
    // Enhanced error handling to ensure consistent error format
    console.error('Error fetching URL:', error.message);
    const errorMessage = error.response 
      ? `Failed to fetch content: HTTP ${error.response.status}`
      : 'Failed to fetch content';
    return res.status(500).json({ error: errorMessage });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Faleproxy server running at http://localhost:${PORT}`);
});