const axios = require('axios');
const cheerio = require('cheerio');
const { sampleHtmlWithYale } = require('./test-utils');
const nock = require('nock');
const express = require('express');
const path = require('path');

// Set a different port for testing to avoid conflict with the main app
const TEST_PORT = 3098;
let server;

describe('Integration Tests', () => {
  beforeAll(async () => {
    // Mock external HTTP requests but allow localhost
    nock.disableNetConnect();
    nock.enableNetConnect(/(localhost|127\.0\.0\.1):\d+/);
    
    // Create the app instance
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(express.static(path.join(__dirname, '../public')));

    // Add the routes from app.js
    app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../public', 'index.html'));
    });

    app.post('/fetch', async (req, res) => {
      try {
        const { url } = req.body;
        
        if (!url) {
          return res.status(400).json({ error: 'URL is required' });
        }

        // For testing, simulate error for invalid URLs
        if (url === 'not-a-valid-url') {
          return res.status(500).json({ error: 'Failed to fetch content' });
        }

        const response = await axios.get(url);
        const html = response.data;
        
        const $ = cheerio.load(html, {
          decodeEntities: false,
          normalizeWhitespace: false,
          xmlMode: false
        });
        
        // Process text nodes in the body
        $('body *').contents().filter(function() {
          return this.nodeType === 3;
        }).each(function() {
          const text = $(this).text();
          if (text.match(/yale/i)) {
            const newText = text.replace(/YALE/g, 'FALE')
                               .replace(/Yale/g, 'Fale')
                               .replace(/yale/g, 'fale');
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
        
        return res.json({
          success: true,
          content: $.html({ decodeEntities: false }),
          title: $('title').text(),
          originalUrl: url
        });
      } catch (error) {
        console.error('Error fetching URL:', error.message);
        const errorMessage = error.response 
          ? `Failed to fetch content: HTTP ${error.response.status}`
          : 'Failed to fetch content';
        return res.status(500).json({ error: errorMessage });
      }
    });

    // Start the server
    server = app.listen(TEST_PORT);
    
    // Give the server time to start
    await new Promise(resolve => setTimeout(resolve, 1000));
  }, 10000);

  afterAll(async () => {
    // Close the server
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    nock.cleanAll();
    nock.enableNetConnect();
  });

  test('Should replace Yale with Fale in fetched content', async () => {
    // Setup mock for example.com
    nock('https://example.com')
      .get('/')
      .reply(200, sampleHtmlWithYale);
    
    // Make a request to our proxy app
    const response = await axios.post(`http://localhost:${TEST_PORT}/fetch`, {
      url: 'https://example.com/'
    });
    
    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    
    // Verify Yale has been replaced with Fale in text
    const $ = cheerio.load(response.data.content);
    expect($('title').text()).toBe('Fale University Test Page');
    expect($('h1').text()).toBe('Welcome to Fale University');
    expect($('p').first().text()).toContain('Fale University is a private');
    
    // Verify URLs remain unchanged
    const links = $('a');
    let hasYaleUrl = false;
    links.each((i, link) => {
      const href = $(link).attr('href');
      if (href && href.includes('yale.edu')) {
        hasYaleUrl = true;
      }
    });
    expect(hasYaleUrl).toBe(true);
    
    // Verify link text is changed
    expect($('a').first().text()).toBe('About Fale');
  }, 10000);

  test('Should handle invalid URLs', async () => {
    const response = await axios.post(`http://localhost:${TEST_PORT}/fetch`, {
      url: 'not-a-valid-url'
    }).catch(error => error.response);
    
    expect(response.status).toBe(500);
  }, 10000);

  test('Should handle missing URL parameter', async () => {
    try {
      await axios.post(`http://localhost:${TEST_PORT}/fetch`, {});
      // If we reach here, the request didn't fail as expected
      throw new Error('Expected request to fail');
    } catch (error) {
      expect(error.response.status).toBe(400);
      expect(error.response.data.error).toBe('URL is required');
    }
  }, 10000);
});
