
const express = require('express');
const router = express.Router();
const setupController = require('../controllers/setup.controller');

// GET /api/setup/status - Prüft, ob ein Setup notwendig ist
router.get('/status', setupController.getStatus);

// POST /api/setup/test-db - Testet die Datenbankverbindung
router.post('/test-db', setupController.testDbConnection);

// POST /api/setup/initialize-db - Erstellt die Datenbank und Tabellen
router.post('/initialize-db', setupController.initializeDatabase);

// GET /api/setup/app-status - Prüft, ob der erste Benutzer erstellt werden muss
router.get('/app-status', setupController.getAppStatus);

// POST /api/setup/save - Speichert die Konfiguration und erstellt die .env Datei
router.post('/save', setupController.saveConfiguration);

module.exports = router;