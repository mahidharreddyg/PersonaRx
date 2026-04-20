import { Router } from 'express';
import axios from 'axios';
import auth from '../middleware/auth.js';

const router = Router();

router.post('/', auth, async (req, res) => {
  try {
    const agentUrl = process.env.AGENT_API_URL;
    if (!agentUrl) {
      return res.status(503).json({
        error: 'Agent API is not configured. Please set AGENT_API_URL in your .env file.',
      });
    }

    console.log(`📤 Forwarding data to Agent API schedule endpoint...`);

    const response = await axios.post(`${agentUrl}/schedule`, req.body, {
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'Accept': 'application/json',
      },
      timeout: 120000, // 2-minute timeout as agents can take time
    });

    console.log('✅ Received response from Agent API:', JSON.stringify(response.data).slice(0, 300));
    
    return res.json(response.data);

  } catch (error) {
    console.error('❌ Error in /api/schedule:', error.message);

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return res.status(503).json({
        error: 'Cannot reach the Agent API. Make sure the agent backend is running.',
      });
    }

    if (error.response) {
      console.error('❌ Agent HTTP error', error.response.status);
      console.error('   Response body:', JSON.stringify(error.response.data).slice(0, 500));
      return res.status(error.response.status).json({
        error: `Agent API error (${error.response.status}): ${error.response.data?.error || error.response.data?.message || 'Failed'}`,
      });
    }

    return res.status(500).json({
      error: 'An unexpected error occurred while communicating with the agent.',
    });
  }
});

export default router;
