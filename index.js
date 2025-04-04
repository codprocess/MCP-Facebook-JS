require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Create Express app
const app = express();
app.use(express.json());
app.use(cors());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'MCP Facebook server is running' });
});

// SSE endpoint
app.get('/v1/tools', (req, res) => {
  console.log('SSE connection established');
  
  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  // Send initial connection message
  res.write('data: {"type":"connection_ack","status":"success"}\n\n');
  
  // Keep connection alive with heartbeat
  const heartbeatInterval = setInterval(() => {
    res.write('data: {"type":"heartbeat"}\n\n');
  }, 30000);
  
  // Handle client disconnect
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    console.log('SSE connection closed');
  });
});

// Tool execution endpoint
app.post('/v1/tools', async (req, res) => {
  try {
    const { name, params } = req.body;
    
    console.log(`Executing tool: ${name} with params:`, params);
    
    // Mock response for testing
    let result = {
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
  console.log(`SSE endpoint: http://localhost:${PORT}/v1/tools`);
});