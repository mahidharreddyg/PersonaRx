/**
 * Express server entry point for AI Prescription Analyzer.
 * 
 * This server acts as a proxy between the React frontend and the
 * Google Colab AI pipeline. It accepts image uploads, forwards them
 * to the Colab API, and returns the structured JSON response.
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import analyzeRouter from './routes/analyze.js';
import scheduleRouter from './routes/schedule.js';
import logEventRouter from './routes/log-event.js';
import authRouter from './routes/auth.js';
import prescriptionsRouter from './routes/prescriptions.js';
import simulatorRouter from './routes/simulator.js';
import connectDB from './config/db.js';
// Load environment variables from .env file
dotenv.config({ path: '../.env' });

// Connect to Database
connectDB();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/schedule', scheduleRouter);
app.use('/api/log-event', logEventRouter);
app.use('/api/prescriptions', prescriptionsRouter);
app.use('/api/simulator', simulatorRouter);
// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    colabConfigured: !!(process.env.COLAB_API_URL && !process.env.COLAB_API_URL.includes('your-ngrok-url')),
  });
});

// Global error handler for multer and other middleware errors
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'File too large. Maximum allowed size is 10MB.',
    });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🏥 PersonaRx Backend`);
  console.log(`   Server running on http://localhost:${PORT}`);
  console.log(`   Colab API: ${process.env.COLAB_API_URL || '⚠️  NOT CONFIGURED'}`);
  console.log(`   Agent API: ${process.env.AGENT_API_URL || '⚠️  NOT CONFIGURED'}\n`);
});
