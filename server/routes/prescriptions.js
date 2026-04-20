/**
 * /api/prescriptions route
 * Handles fetching user's prescription history
 */

import { Router } from 'express';
import auth from '../middleware/auth.js';
import Prescription from '../models/Prescription.js';

const router = Router();

// @route   GET /api/prescriptions/latest
// @desc    Get the user's most recent prescription + saved schedule
// @access  Private
router.get('/latest', auth, async (req, res) => {
  try {
    const prescription = await Prescription.findOne({ user: req.user.id })
      .sort({ createdAt: -1 }) // most recent first
      .lean();

    if (!prescription) {
      return res.status(404).json({ error: 'No prescription found' });
    }

    // Strip MongoDB internals cleanly
    const { _id, __v, user, ...data } = prescription;

    return res.json({
      _id: _id.toString(),
      ...data,
    });
  } catch (err) {
    console.error('❌ Error fetching latest prescription:', err.message);
    return res.status(500).json({ error: 'Failed to fetch prescription' });
  }
});

// @route   PATCH /api/prescriptions/:id/schedule
// @desc    Save the agent-generated schedule back to the prescription document
// @access  Private
router.patch('/:id/schedule', auth, async (req, res) => {
  try {
    const { schedule, session_id, meal_times } = req.body;

    const prescription = await Prescription.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      {
        $set: {
          saved_schedule: schedule,
          session_id,
          meal_times,
          schedule_confirmed_at: new Date(),
        }
      },
      { new: true }
    );

    if (!prescription) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    console.log(`💾 Schedule saved to prescription ${req.params.id}`);
    return res.json({ success: true });
  } catch (err) {
    console.error('❌ Error saving schedule:', err.message);
    return res.status(500).json({ error: 'Failed to save schedule' });
  }
});

export default router;
