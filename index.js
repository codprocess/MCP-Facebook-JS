require('dotenv').config();
const express = require('express');
const { FacebookAdsApi, AdAccount, Campaign } = require('facebook-nodejs-business-sdk');

// Load configuration from environment variables
const config = {
  facebookAppId: process.env.FACEBOOK_APP_ID,
  facebookAppSecret: process.env.FACEBOOK_APP_SECRET,
  facebookAccessToken: process.env.FACEBOOK_ACCESS_TOKEN,
  facebookAccountId: process.env.FACEBOOK_ACCOUNT_ID,
  port: process.env.PORT || 3000
};

// Validate configuration
function validateConfig() {
  const requiredVars = [
    'facebookAppId',
    'facebookAppSecret',
    'facebookAccessToken',
    'facebookAccountId'
  ];

  for (const key of requiredVars) {
    if (!config[key]) {
      console.error(`Missing configuration variable: ${key.toUpperCase()}`);
      return false;
    }
  }
  return true;
}

// Initialize Facebook SDK
function initFacebookSdk() {
  if (!validateConfig()) {
    throw new Error('Cannot initialize Facebook SDK: Missing configuration.');
  }
  FacebookAdsApi.init(config.facebookAccessToken);
  console.log('Facebook SDK initialized for account:', config.facebookAccountId);
}

// Get AdAccount instance
function getAdAccount() {
  if (!config.facebookAccountId) {
    throw new Error('Facebook Account ID is not configured.');
  }
  return new AdAccount(config.facebookAccountId);
}

// Initialize the Facebook SDK
initFacebookSdk();

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

// Add request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
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
    
    let result;
    
    switch (name) {
      case 'get_campaigns':
        result = await getCampaigns(params);
        break;
      case 'create_campaign':
        result = await createCampaign(params);
        break;
      case 'get_campaign_details':
        result = await getCampaignDetails(params);
        break;
      case 'update_campaign':
        result = await updateCampaign(params);
        break;
      case 'delete_campaign':
        result = await deleteCampaign(params);
        break;
      case 'get_campaign_insights':
        result = await getCampaignInsights(params);
        break;
      case 'get_account_insights':
        result = await getAccountInsights(params);
        break;
      default:
        return res.status(400).json({ 
          error: { 
            message: `Unknown tool: ${name}`,
            code: 'UNKNOWN_TOOL'
          } 
        });
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

// Tool implementations

// Get a list of campaigns
async function getCampaigns({ limit = 10 } = {}) {
  try {
    const adAccount = getAdAccount();
    const campaigns = await adAccount.getCampaigns(
      ['id', 'name', 'status', 'objective', 'created_time', 'start_time', 'stop_time', 'daily_budget', 'lifetime_budget'],
      { limit }
    );
    
    return campaigns.map(campaign => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      objective: campaign.objective,
      createdTime: campaign.created_time,
      startTime: campaign.start_time,
      stopTime: campaign.stop_time,
      dailyBudget: campaign.daily_budget ? campaign.daily_budget / 100 : null,
      lifetimeBudget: campaign.lifetime_budget ? campaign.lifetime_budget / 100 : null,
    }));
  } catch (error) {
    console.error('Error getting campaigns:', error);
    throw error;
  }
}

// Create a new campaign
async function createCampaign({ name, objective, status = 'PAUSED', daily_budget } = {}) {
  try {
    const adAccount = getAdAccount();
    const result = await adAccount.createCampaign(
      [{ 
        name, 
        objective, 
        status, 
        daily_budget: Math.round(daily_budget * 100) // Convert to cents
      }]
    );
    
    return {
      campaignId: result && result[0] ? result[0].id : null,
      success: !!(result && result[0])
    };
  } catch (error) {
    console.error('Error creating campaign:', error);
    throw error;
  }
}

// Get details of a specific campaign
async function getCampaignDetails({ campaign_id } = {}) {
  try {
    const campaign = new Campaign(campaign_id);
    const campaignDetails = await campaign.get([
      'id', 'name', 'objective', 'status', 'created_time', 'start_time', 'stop_time',
      'daily_budget', 'lifetime_budget', 'spend_cap', 'budget_remaining', 'buying_type',
      'special_ad_categories'
    ]);
    
    return {
      id: campaignDetails.id,
      name: campaignDetails.name,
      objective: campaignDetails.objective,
      status: campaignDetails.status,
      createdTime: campaignDetails.created_time,
      startTime: campaignDetails.start_time,
      stopTime: campaignDetails.stop_time,
      dailyBudget: campaignDetails.daily_budget ? campaignDetails.daily_budget / 100 : null,
      lifetimeBudget: campaignDetails.lifetime_budget ? campaignDetails.lifetime_budget / 100 : null,
      spendCap: campaignDetails.spend_cap ? campaignDetails.spend_cap / 100 : null,
      budgetRemaining: campaignDetails.budget_remaining ? campaignDetails.budget_remaining / 100 : null,
      buyingType: campaignDetails.buying_type,
      specialAdCategories: campaignDetails.special_ad_categories
    };
  } catch (error) {
    console.error('Error getting campaign details:', error);
    throw error;
  }
}

// Update an existing campaign
async function updateCampaign({ campaign_id, name, status, daily_budget } = {}) {
  try {
    const campaign = new Campaign(campaign_id);
    
    const updateData = {};
    if (name) updateData.name = name;
    if (status) updateData.status = status;
    if (daily_budget) updateData.daily_budget = Math.round(daily_budget * 100);
    
    await campaign.update([], updateData);
    
    return {
      campaignId: campaign_id,
      success: true,
      updatedFields: Object.keys(updateData)
    };
  } catch (error) {
    console.error('Error updating campaign:', error);
    throw error;
  }
}

// Delete a campaign
async function deleteCampaign({ campaign_id } = {}) {
  try {
    const campaign = new Campaign(campaign_id);
    await campaign.delete(['id']);
    
    return {
      campaignId: campaign_id,
      success: true
    };
  } catch (error) {
    console.error('Error deleting campaign:', error);
    throw error;
  }
}

// Get insights for a specific campaign
async function getCampaignInsights({ campaign_id, date_preset = 'last_30_days', fields = ['impressions', 'clicks', 'spend', 'cpc', 'ctr'] } = {}) {
  try {
    const campaign = new Campaign(campaign_id);
    const insights = await campaign.getInsights(
      fields,
      { date_preset }
    );
    
    // Format the insights data
    const formattedInsights = insights.map(insight => {
      const result = {
        date_start: insight.date_start,
        date_stop: insight.date_stop
      };
      
      // Add all requested fields
      fields.forEach(field => {
        if (field === 'spend') {
          // Convert spend from string to number
          result[field] = insight[field] ? parseFloat(insight[field]) : 0;
        } else {
          result[field] = insight[field];
        }
      });
      
      return result;
    });
    
    return {
      campaign_id,
      date_preset,
      insights: formattedInsights
    };
  } catch (error) {
    console.error('Error getting campaign insights:', error);
    throw error;
  }
}

// Get insights for the entire ad account
async function getAccountInsights({ date_preset = 'last_30_days', fields = ['impressions', 'clicks', 'spend', 'cpc', 'ctr'] } = {}) {
  try {
    const adAccount = getAdAccount();
    const insights = await adAccount.getInsights(
      fields,
      { date_preset }
    );
    
    // Format the insights data
    const formattedInsights = insights.map(insight => {
      const result = {
        date_start: insight.date_start,
        date_stop: insight.date_stop
      };
      
      // Add all requested fields
      fields.forEach(field => {
        if (field === 'spend') {
          // Convert spend from string to number
          result[field] = insight[field] ? parseFloat(insight[field]) : 0;
        } else {
          result[field] = insight[field];
        }
      });
      
      return result;
    });
    
    return {
      date_preset,
      insights: formattedInsights
    };
  } catch (error) {
    console.error('Error getting account insights:', error);
    throw error;
  }
}

// Start the server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`MCP Facebook server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`SSE test endpoint: http://localhost:${PORT}/test-sse`);
  console.log(`MCP SSE endpoint: http://localhost:${PORT}/v1/tools`);
});