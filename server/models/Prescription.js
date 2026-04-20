import mongoose from 'mongoose';

const prescriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  patient: {
    name: String,
    info: String,
  },
  doctor: {
    type: mongoose.Schema.Types.Mixed, // Can be object or string or null
  },
  medications: [{
    drug: String,
    dosage: String,
    frequency: String,
    duration: String,
    constraint: String,
  }],
  raw_response: mongoose.Schema.Types.Mixed, // Original OCR JSON
  image_url: String,                          // Future-proofing
  // Schedule fields — populated after the user confirms the agent schedule
  saved_schedule: [mongoose.Schema.Types.Mixed],
  session_id: String,
  meal_times: mongoose.Schema.Types.Mixed,
  schedule_confirmed_at: Date,
}, {
  timestamps: true,
});

const Prescription = mongoose.model('Prescription', prescriptionSchema);
export default Prescription;
