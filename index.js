require('dotenv').config();
const express = require('express');

// Create Express app
const app = express();
app.use(express.json());

// Add CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'MCP Facebook server is running' });
});

// MCP Studio endpoint
app.post('/v1/tools', async (req, res) => {
  try {
    const { name, params } = req.body;
    
    console.log(`Executing tool: ${name} with params:`, params);
    
    // Mock response for testing
    let result;
    
    switch (name) {
      case 'get_campaigns':
        result = [
          {
            id: '123456789',
            name: 'Test Campaign 1',
            status: 'ACTIVE',
            objective: 'CONVERSIONS',
            createdTime: '2025-04-01T12:00:00Z',
            dailyBudget: 50
          },
          {
            id: '987654321',
            name: 'Test Campaign 2',
            status: 'PAUSED',
            objective: 'TRAFFIC',
            createdTime: '2025-04-02T12:00:00Z',
            dailyBudget: 30
          }
        ];
        break;
      case 'create_campaign':
        result = {
          campaignId: '123456789',
          success: true
        };
        break;
      case 'get_campaign_details':
        result = {
          id: params.campaign_id || '123456789',
          name: 'Test Campaign',
          status: 'ACTIVE',
          objective: 'CONVERSIONS',
          createdTime: '2025-04-01T12:00:00Z',
          dailyBudget: 50
        };
        break;
      default:
        result = {
          message: `Tool ${name} executed successfully with params: ${JSON.stringify(params)}`,
          mockData: true
        };
    }
    
    res.json({ result });
  } catch (error) {
    console.error('Error handling MCP request:', error);
    res.status(500).json({
      error: {
        message: error.message || 'Internal server error',
        code: error.code || 'INTERNAL_ERROR'
      }
    });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MCP Facebook server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`MCP Studio endpoint: http://localhost:${PORT}/v1/tools`);
});