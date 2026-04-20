/**
 * /api/analyze route
 * 
 * Receives an uploaded prescription image from the frontend,
 * forwards it to the Google Colab API (via ngrok) as multipart/form-data,
 * and returns the structured JSON response back to the client.
 */

import { Router } from 'express';
import axios from 'axios';
import FormData from 'form-data';
import upload from '../middleware/upload.js';
import auth from '../middleware/auth.js';
import Prescription from '../models/Prescription.js';

const router = Router();

router.post('/', [auth, upload.single('image')], async (req, res) => {
  try {
    // Validate that a file was uploaded
    if (!req.file) {
      return res.status(400).json({
        error: 'No image file uploaded. Please upload a prescription image.',
      });
    }

    // Get the Colab API URL from environment variables
    const colabUrl = process.env.COLAB_API_URL;
    if (!colabUrl || colabUrl.includes('your-ngrok-url')) {
      return res.status(503).json({
        error: 'Colab API is not configured. Please set COLAB_API_URL in your .env file.',
      });
    }

    console.log(`📤 Forwarding image (${req.file.originalname}, ${(req.file.size / 1024).toFixed(1)}KB) to Colab API...`);

    // Build multipart form data with the uploaded file buffer
    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    // Forward the image to the Colab API
    // NOTE: ngrok-skip-browser-warning bypasses ngrok's HTML interstitial page
    const response = await axios.post(colabUrl, formData, {
      headers: {
        ...formData.getHeaders(),
        'ngrok-skip-browser-warning': 'true',
        'Accept': 'application/json',
      },
      timeout: 120000, // 2 minute timeout (AI processing can be slow)
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    console.log('✅ Received response from Colab API:', JSON.stringify(response.data).slice(0, 300));

    // Validate the response looks like prescription data
    if (typeof response.data !== 'object' || response.data === null) {
      console.error('❌ Colab returned non-JSON response:', String(response.data).slice(0, 500));
      return res.status(502).json({
        error: 'Colab returned an unexpected response format. Make sure the notebook is running correctly.',
      });
    }

    // Save to MongoDB
    const prescription = new Prescription({
      user: req.user.id,
      patient: response.data.patient,
      doctor: response.data.doctor,
      medications: response.data.medications,
      raw_response: response.data
    });
    
    const savedPrescription = await prescription.save();
    console.log('💾 Prescription saved to MongoDB:', savedPrescription._id);

    // Return the response along with the database ID
    return res.json({
      ...response.data,
      _id: savedPrescription._id
    });

  } catch (error) {
    console.error('❌ Error in /api/analyze:', error.message);

    // Handle specific error types
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return res.status(503).json({
        error: 'Cannot reach the Colab API. Make sure the Colab notebook is running and the ngrok URL is correct.',
      });
    }

    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return res.status(504).json({
        error: 'The Colab API took too long to respond. Please try again.',
      });
    }

    if (error.response) {
      // Log full Colab error for debugging
      console.error('❌ Colab HTTP error', error.response.status);
      console.error('   Response body:', JSON.stringify(error.response.data).slice(0, 500));
      return res.status(error.response.status).json({
        error: `Colab API error (${error.response.status}): ${error.response.data?.error || error.response.data?.message || error.response.statusText}`,
      });
    }

    // Multer file validation errors
    if (error.message.includes('Invalid file type')) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({
      error: 'An unexpected error occurred while processing the prescription.',
    });
  }
});

export default router;
