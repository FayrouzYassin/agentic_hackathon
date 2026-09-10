'use strict';

const express = require('express');

const { getUser, setupUser } = require('../controllers/userController');
const { uploadPhoto } = require('../middleware/upload');
const {
  attachLanguage,
  validateObjectIdParam,
  validateUserSetup,
} = require('../middleware/validate');

const router = express.Router();

// `uploadPhoto` runs first because it parses the multipart body that
// `validateUserSetup` then checks.
router.post('/setup', uploadPhoto, validateUserSetup, setupUser);

router.get('/:id', attachLanguage, validateObjectIdParam('id'), getUser);

module.exports = router;
