/**
 * reset-medical-data.js
 * 
 * RUN: node scripts/reset-medical-data.js
 * 
 * Clears Prescriptions and DoseEvents collections in MongoDB Atlas,
 * but LEAVES the Users collection intact so you stay logged in.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from root
dotenv.config({ path: path.join(__dirname, '../../.env') });

const resetData = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI not found in .env');
    process.exit(1);
  }

  try {
    console.log('⏳ Connecting to MongoDB...');
    await mongoose.connect(uri);
    console.log('✅ Connected.');

    // We don't import the models to keep the script standalone/simple
    // We just drop the collections directly by name
    const db = mongoose.connection.db;
    
    console.log('🧹 Wiping medical data...');
    
    // Check if collections exist before dropping
    const collections = await db.listCollections().toArray();
    const names = collections.map(c => c.name);

    if (names.includes('prescriptions')) {
      await db.collection('prescriptions').deleteMany({});
      console.log('   - Cleared: prescriptions');
    }

    if (names.includes('doseevents')) {
      await db.collection('doseevents').deleteMany({});
      console.log('   - Cleared: doseevents');
    }

    console.log('\n✨ Done! Prescription data cleared. User accounts preserved.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during reset:', error.message);
    process.exit(1);
  }
};

resetData();
