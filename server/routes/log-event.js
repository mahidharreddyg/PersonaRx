import { Router } from 'express';
import axios from 'axios';
import auth from '../middleware/auth.js';
import DoseEvent from '../models/DoseEvent.js';

const router = Router();

router.post('/', auth, async (req, res) => {
  try {
    const agentUrl = process.env.AGENT_API_URL;
    if (!agentUrl) {
      return res.status(503).json({
        error: 'Agent API is not configured.',
      });
    }

    console.log(`📥 Logging dose event to Agent API:`, JSON.stringify(req.body).slice(0, 200));

    const response = await axios.post(`${agentUrl}/log-event`, req.body, {
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'Accept': 'application/json',
      },
      timeout: 15000,
    });

    console.log('✅ Agent logged event:', JSON.stringify(response.data).slice(0, 200));

    // Save to our MongoDB for persistent user history
    try {
      const doseEvent = new DoseEvent({
        user: req.user.id,
        ...req.body
      });
      await doseEvent.save();
      console.log('💾 Dose event saved to MongoDB');
    } catch (dbErr) {
      console.error('⚠️ Failed to save dose event to DB:', dbErr.message);
      // We don't fail the request if DB save fails, as the agent already got it
    }

    return res.json(response.data);

  } catch (error) {
    console.error('❌ Error in /api/log-event:', error.message);

    if (error.response) {
      return res.status(error.response.status).json({
        error: `Agent API error (${error.response.status}): ${error.response.data?.error || error.response.statusText}`,
      });
    }

    return res.status(500).json({ error: 'Failed to log dose event.' });
  }
});

export default router;
