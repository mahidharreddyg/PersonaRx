/**
 * /api/prescriptions route
 * Handles fetching user's prescription history
 */

import { Router } from 'express';
import auth from '../middleware/auth.js';
import Prescription from '../models/Prescription.js';

const router = Router();

// @route   GET /api/prescriptions/latest
// @desc    Get the user's most recent prescription + saved schedule + dose events
// @access  Private
router.get('/latest', auth, async (req, res) => {
  try {
    const prescription = await Prescription.findOne({ user: req.user.id })
      .sort({ createdAt: -1 }) // most recent first
      .lean();

    if (!prescription) {
      return res.status(404).json({ error: 'No prescription found' });
    }

    // Attempt to grab any associated dose events using the session ID
    let doseEvents = [];
    if (prescription.session_id) {
      // Need to import DoseEvent at the top of the file if not already imported
      const { default: DoseEvent } = await import('../models/DoseEvent.js');
      doseEvents = await DoseEvent.find({ session_id: prescription.session_id }).sort({ timestamp: -1 }).lean();
    }

    // Strip MongoDB internals cleanly
    const { _id, __v, user, ...data } = prescription;

    return res.json({
      _id: _id.toString(),
      dose_events: doseEvents,
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

// @route   DELETE /api/prescriptions/:id/schedule
// @desc    Remove the saved schedule from a prescription (reset / delete)
// @access  Private
router.delete('/:id/schedule', auth, async (req, res) => {
  try {
    const prescription = await Prescription.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      {
        $unset: {
          saved_schedule: '',
          session_id: '',
          meal_times: '',
          schedule_confirmed_at: '',
        }
      },
      { new: true }
    );

    if (!prescription) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    console.log(`🗑️  Schedule deleted from prescription ${req.params.id}`);
    return res.json({ success: true });
  } catch (err) {
    console.error('❌ Error deleting schedule:', err.message);
    return res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

export default router;
