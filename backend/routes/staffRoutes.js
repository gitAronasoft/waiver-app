const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const staffController = require('../controllers/staffController');
const { authenticateToken } = require('../middleware/auth');

// Configure multer for profile image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/profile/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Public routes (no authentication required)
router.post('/login', staffController.login);
router.post('/forget-password', staffController.forgetPassword);
router.post('/update-password', staffController.updatePassword);

// Protected routes (authentication required)
// Apply authentication middleware to all routes below
router.use(authenticateToken);

router.post('/change-password', staffController.changePassword);
router.get('/getstaff', staffController.getAllStaff);
router.get('/:id', staffController.getStaffById);
router.post('/addstaff', staffController.addStaff);
router.put('/update-staff/:id', staffController.updateStaff);
router.post('/update-profile', upload.single('profileImage'), staffController.updateProfile);
router.put('/update-status/:id', staffController.updateStatus);
router.delete('/delete-staff/:id', staffController.deleteStaff);

module.exports = router;
