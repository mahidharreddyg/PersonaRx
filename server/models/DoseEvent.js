import mongoose from 'mongoose';

const doseEventSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  prescription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription',
  },
  session_id: {
    type: String,
    required: true,
  },
  dose_id: {
    type: String,
    required: true,
  },
  drug_name: {
    type: String,
    required: true,
  },
  day: Number,
  slot: String,
  scheduled_time: String,
  status: {
    type: String,
    enum: ['taken', 'missed', 'delayed', 'pending'],
    default: 'pending',
  },
  actual_time: String,
  delay_minutes: Number,
  source: {
    type: String,
    enum: ['user', 'simulation'],
    default: 'user',
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

const DoseEvent = mongoose.model('DoseEvent', doseEventSchema);
export default DoseEvent;
