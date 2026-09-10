'use strict';

const express = require('express');

const { triggerEmergency } = require('../controllers/emergencyController');
const { attachLanguage, validateEmergencyTrigger } = require('../middleware/validate');

const router = express.Router();

router.post('/trigger', attachLanguage, validateEmergencyTrigger, triggerEmergency);

module.exports = router;
