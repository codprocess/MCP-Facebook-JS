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

// Simple SSE test endpoint
app.get('/test-sse', (req, res) => {
  console.log('Test SSE connection established');
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  res.write('data: {"message":"SSE is working"}\n\n');
  
  const interval = setInterval(() => {
    res.write('data: {"time":"' + new Date().toISOString() + '"}\n\n');
  }, 5000);
  
  req.on('close', () => {
    clearInterval(interval);
    console.log('Test SSE connection closed');
  });
});

// MCP SSE endpoint
app.get('/v1/tools', (req, res) => {
  console.log('MCP SSE connection established');
  
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Send initial connection message
  res.write('data: {"type":"connection_ack","status":"success"}\n\n');
  
  // Keep connection alive with heartbeat
  const heartbeatInterval = setInterval(() => {
    res.write('data: {"type":"heartbeat"}\n\n');
  }, 30000);
  
  // Handle client disconnect
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    console.log('MCP SSE connection closed');
  });
});

// MCP tool execution endpoint
app.post('/v1/tools', async (req, res) => {
  try {
    const { name, params } = req.body;
    
    console.log(`Executing tool: ${name} with params:`, params);
    
    // Mock response for testing
    const result = {
      message: `Tool ${name} executed successfully with params: ${JSON.stringify(params)}`,
      mockData: true
    };
    
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
  console.log(`SSE test endpoint: http://localhost:${PORT}/test-sse`);
  console.log(`MCP SSE endpoint: http://localhost:${PORT}/v1/tools`);
});