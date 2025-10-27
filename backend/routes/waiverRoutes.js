const express = require('express');
const router = express.Router();
const waiverController = require('../controllers/waiverController');

router.post('/', waiverController.createWaiver);
router.get('/customer-info', waiverController.getCustomerInfo);
router.post('/update-customer', waiverController.updateCustomer);
router.post('/save-signature', waiverController.saveSignature);
router.post('/accept-rules', waiverController.acceptRules);
router.get('/getminors', waiverController.getMinors);
router.get('/getAllCustomers', waiverController.getAllCustomers);
router.post('/verify/:id', waiverController.verifyWaiver);
router.get('/waiver-details/:id', waiverController.getWaiverDetails);
router.get('/user-history/:phone', waiverController.getUserHistory);

module.exports = router;
