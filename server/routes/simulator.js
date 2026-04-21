import { Router } from 'express';
import axios from 'axios';
import auth from '../middleware/auth.js';

const router = Router();

// Helper function to proxy requests to Agent API
const proxyToAgent = async (endpoint, req, res) => {
  try {
    const agentUrl = process.env.AGENT_API_URL;
    if (!agentUrl) {
      return res.status(503).json({
        error: 'Agent API is not configured. Please set AGENT_API_URL in your .env file.',
      });
    }

    console.log(`\n🤖 Forwarding to Agent API: ${endpoint}`);
    console.log(` Payload:`, JSON.stringify(req.body).slice(0, 150));

    const response = await axios.post(`${agentUrl}${endpoint}`, req.body, {
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'Accept': 'application/json',
      },
      timeout: 120000,
    });

    return res.json(response.data);

  } catch (error) {
    console.error(`❌ Error in Agent Proxy (${endpoint}):`, error.message);
    if (error.response) {
      return res.status(error.response.status).json({
        error: `Agent API error (${error.response.status}): ${error.response.data?.error || error.message}`,
      });
    }
    return res.status(500).json({ error: 'Unexpected error talking to Agent API' });
  }
};

router.post('/simulate', auth, (req, res) => proxyToAgent('/simulate', req, res));
router.post('/replan', auth, (req, res) => proxyToAgent('/replan', req, res));

// GET /state requires axios.get, so separate logic
router.get('/state', auth, async (req, res) => {
  try {
    const agentUrl = process.env.AGENT_API_URL;
    const sessionId = req.query.session_id;

    if (!agentUrl || !sessionId) {
      return res.status(400).json({ error: 'Missing AGENT_API_URL or session_id' });
    }

    const response = await axios.get(`${agentUrl}/state?session_id=${sessionId}`, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
      timeout: 30000,
    });
    return res.json(response.data);
  } catch (error) {
    console.error('❌ Error getting agent state:', error.message);
    return res.status(500).json({ error: 'Failed to retrieve demo state' });
  }
});

export default router;
