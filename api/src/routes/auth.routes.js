const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { jwtMiddleware } = require('../middleware/auth.middleware');

// Diese Route muss öffentlich sein und funktioniert nur einmal, um den ersten Benutzer zu erstellen.
router.post('/register-initial-user', authController.registerInitialUser);

// Öffentliche Routen für Registrierung und Login
router.post('/register-options', authController.getRegistrationOptions);
router.post('/register-verify', authController.verifyRegistration);
router.get('/login-options', authController.getLoginOptions);
router.post('/login-verify', authController.verifyLogin);
router.post('/login-password', authController.loginWithPassword);
router.post('/logout', authController.logout);

// Geschützte Routen (benötigen einen gültigen JWT)
router.get('/me', jwtMiddleware, authController.getCurrentUser);
router.post('/create-user', jwtMiddleware, authController.createUser);
router.get('/passkeys', jwtMiddleware, authController.getPasskeysForUser);

module.exports = router;