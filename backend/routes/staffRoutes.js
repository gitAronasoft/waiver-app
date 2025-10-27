const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const { authenticateToken } = require('../middleware/auth');

router.post('/login', staffController.login);
router.post('/forget-password', staffController.forgetPassword);
router.post('/update-password', staffController.updatePassword);
router.post('/change-password', staffController.changePassword);
router.get('/getstaff', staffController.getAllStaff);
router.get('/:id', staffController.getStaffById);
router.post('/addstaff', staffController.addStaff);
router.put('/update-staff/:id', staffController.updateStaff);
router.put('/update-profile', staffController.updateProfile);
router.put('/update-status/:id', staffController.updateStatus);
router.delete('/delete-staff/:id', staffController.deleteStaff);

module.exports = router;
