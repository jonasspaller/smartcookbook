const express = require('express');
const http = require('http');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const port = 3001;

// Middleware, um JSON-Request-Bodies zu parsen
app.use(express.json());
app.use(cookieParser());

// Prüfen, ob die .env-Datei existiert, um den Modus zu bestimmen
const envPath = path.resolve(__dirname, '..', '.env');
const needsSetup = !fs.existsSync(envPath);

if (needsSetup) {
	// --- SETUP-MODUS ---
	console.log('⚠️  SETUP REQUIRED: .env file not found. Starting in setup mode.');
	const cors = require('cors');
	const setupRoutes = require('./routes/setup.routes');

	// Im Setup-Modus erlauben wir nur den Vite-Dev-Server
	app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
	app.use('/api/setup', setupRoutes);

	// Alle anderen API-Aufrufe abfangen und einen Fehler zurückgeben
	app.use('/api', (req, res) => {
		res.status(503).json({
			error: 'Application not configured. Please complete the setup.',
			needsSetup: true,
		});
	});
} else {
	// --- NORMALBETRIEB ---
	require('dotenv').config({ path: envPath });

	const cors = require('cors');
	const { Server } = require('socket.io');
	const db = require('./config/db');
	const { jwtMiddleware } = require('./middleware/auth.middleware');
	const setupRoutes = require('./routes/setup.routes');

	// Routen importieren
	const recipeRoutes = require('./routes/recipe.routes');
	const ingredientRoutes = require('./routes/ingredient.routes');
	const categoryRoutes = require('./routes/category.routes');
	const shoppingListRoutes = require('./routes/shoppingList.routes');
	const authRoutes = require('./routes/auth.routes');

	const corsOptions = {
		origin: process.env.CLIENT_URL || 'http://localhost:5173',
		methods: ['GET', 'POST', 'PUT', 'DELETE'],
		credentials: true,
	};

	const io = new Server(server, { cors: corsOptions });
	app.use(cors(corsOptions));
	app.use(express.static('public'));
	app.use((req, res, next) => {
		req.io = io;
		next();
	});

	// Routen-Setup
	app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
	app.use('/api/setup', setupRoutes); // Öffentliche Setup-Route für Status-Check
	app.use('/api/auth', authRoutes);

	const apiRouter = express.Router();
	apiRouter.use(jwtMiddleware);
	apiRouter.use('/rezepte', recipeRoutes);
	apiRouter.use('/zutaten', ingredientRoutes);
	apiRouter.use('/categories', categoryRoutes);
	apiRouter.use('/einkaufsliste', shoppingListRoutes);
	app.use('/api', apiRouter);

	// DB-Verbindungstest
	(async () => {
		try {
			const connection = await db.getConnection();
			console.log('✅ Datenbankverbindung erfolgreich hergestellt.');
			connection.release();
		} catch (error) {
			console.error('\n❌ FEHLER: Konnte keine Verbindung zur Datenbank herstellen.', error.message);
			process.exit(1);
		}
	})();

	// Socket.IO-Logik
	io.on('connection', (socket) => {
		console.log('✅ Ein Nutzer hat sich verbunden:', socket.id);
		socket.on('disconnect', () => {
			console.log('Ein Nutzer hat die Verbindung getrennt:', socket.id);
		});
	});
}

server.listen(port, () => {
	console.log(`API server listening on http://localhost:${port}`);
});