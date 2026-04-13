/**
 * Multer middleware configuration for handling image uploads.
 * Uses memory storage to keep the file in a buffer (no disk writes).
 * Validates file type and enforces a 10MB size limit.
 */

import multer from 'multer';

// Store files in memory as Buffer objects (no temp files on disk)
const storage = multer.memoryStorage();

// Only allow common image formats
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PNG, JPG, JPEG, and WebP are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
});

export default upload;
