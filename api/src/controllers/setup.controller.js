const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const crypto = require('crypto');

exports.getStatus = (req, res) => {
	const envPath = path.resolve(__dirname, '..', '..', '.env');
	const needsSetup = !fs.existsSync(envPath);
	res.json({ needsSetup });
};

exports.testDbConnection = async (req, res) => {
	const { host, user, password, database } = req.body;

	// Sicherheitsprüfung: Nur im Setup-Modus erlauben
	const envPath = path.resolve(__dirname, '..', '..', '.env');
	if (fs.existsSync(envPath)) {
		return res.status(403).json({ success: false, message: 'Application is already configured.' });
	}
	try {
		const connection = await mysql.createConnection({ host, user, password, database });
		// Check for a key table
		const [tables] = await connection.query("SHOW TABLES LIKE 'users'");
		await connection.end();

		if (tables.length === 0) {
			// Connection is good, but app is not initialized
			return res.json({ success: true, message: 'Verbindung zur Datenbank erfolgreich, aber die Tabellen fehlen.', needsDBCreation: true });
		}
		
		res.json({ success: true, message: 'Datenbankverbindung erfolgreich!' });
	} catch (error) {
		if (error.code === 'ER_BAD_DB_ERROR') {
			return res.json({ success: false, message: 'Die angegebene Datenbank existiert nicht.', needsDBCreation: true });
		}
		res.status(400).json({ success: false, message: 'Datenbankverbindung fehlgeschlagen.', error: error.message });
	}
};

exports.saveConfiguration = async (req, res) => {
	const { dbHost, dbUser, dbPassword, dbDatabase, clientUrl, rpName, rpId } = req.body;

	// Sicherheitsprüfung: Nur im Setup-Modus erlauben
	const envPath = path.resolve(__dirname, '..', '..', '.env');
	if (fs.existsSync(envPath)) {
		return res.status(403).json({ success: false, message: 'Application is already configured.' });
	}

	// Basic validation
	if (!dbHost || !dbUser || !dbDatabase || !clientUrl || !rpName || !rpId) {
		return res.status(400).json({ error: 'Alle Felder sind erforderlich.' });
	}

	// Generate a secure JWT secret
	const jwtSecret = crypto.randomBytes(32).toString('hex');

	const envContent = `
# Database Configuration
DB_HOST=${dbHost}
DB_USER=${dbUser}
DB_PASSWORD=${dbPassword || ''}
DB_DATABASE=${dbDatabase}

# JWT Configuration
JWT_SECRET=${jwtSecret}

# WebAuthn (Passkey) Configuration
RP_NAME="${rpName}"
RP_ID=${rpId}
CLIENT_URL=${clientUrl}
`;

	try {
		// .trim() entfernt führende/nachfolgende Leerzeichen, was bei der Vorlage hilft
		fs.writeFileSync(envPath, envContent.trim());
		res.json({ success: true, message: 'Konfiguration erfolgreich gespeichert. Bitte starte den Server neu.' });
	} catch (error) {
		if (error.code === 'EACCES') {
			return res.status(500).json({
				success: false,
				message: 'Berechtigungsfehler: Der Server konnte die .env-Datei nicht schreiben. Mögliche Ursachen: 1) Der Webserver-Benutzer (oft \'www-data\') hat keine Schreibrechte für das api-Verzeichnis. 2) Eine Sicherheitsrichtlinie wie SELinux oder AppArmor blockiert den Zugriff.'
			});
		}
		res.status(500).json({ success: false, message: 'Fehler beim Schreiben der .env-Datei.', error: error.message });
	}
};

exports.initializeDatabase = async (req, res) => {
	// Sicherheitsprüfung: Nur im Setup-Modus erlauben
	const envPath = path.resolve(__dirname, '..', '..', '.env');
	if (fs.existsSync(envPath)) {
		return res.status(403).json({ success: false, message: 'Application is already configured.' });
	}

	const { host, user, password, database } = req.body;
	let connection;
	try {
		// 1. Verbindung ohne Angabe einer Datenbank herstellen, aber mit der Option für mehrere Anweisungen
		connection = await mysql.createConnection({ host, user, password, multipleStatements: true });

		// 2. Datenbank erstellen, falls sie nicht existiert
		await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
		
		// 3. Zur neuen Datenbank wechseln
		await connection.query(`USE \`${database}\`;`);

		// 4. Alle Tabellen erstellen
		const createTablesSql = `
			CREATE TABLE categories (
				id INT AUTO_INCREMENT PRIMARY KEY,
				name VARCHAR(255) NOT NULL UNIQUE,
				sort_order INT NOT NULL DEFAULT 0
			);

			CREATE TABLE ingredients (
				id INT AUTO_INCREMENT PRIMARY KEY,
				name VARCHAR(255) NOT NULL UNIQUE,
				unit VARCHAR(50),
				category_id INT,
				FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
			);

			CREATE TABLE recipes (
				id INT AUTO_INCREMENT PRIMARY KEY,
				name VARCHAR(255) NOT NULL,
				instructions TEXT,
				image_url VARCHAR(255)
			);

			CREATE TABLE recipe_ingredients (
				recipe_id INT,
				ingredient_id INT,
				amount DECIMAL(10, 2) NOT NULL,
				PRIMARY KEY (recipe_id, ingredient_id),
				FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
				FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
			);

			CREATE TABLE shopping_list_items (
				id INT AUTO_INCREMENT PRIMARY KEY,
				ingredient_id INT NOT NULL UNIQUE,
				amount DECIMAL(10, 2) NOT NULL,
				is_checked BOOLEAN NOT NULL DEFAULT FALSE,
				unit VARCHAR(50),
				FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
			);

			CREATE TABLE users (
				id INT AUTO_INCREMENT PRIMARY KEY,
				username VARCHAR(255) NOT NULL UNIQUE,
				password VARCHAR(255),
				current_challenge VARCHAR(255)
			);

			CREATE TABLE passkeys (
				id INT AUTO_INCREMENT PRIMARY KEY,
				user_id INT NOT NULL,
				credential_id VARBINARY(255) NOT NULL UNIQUE,
				public_key BLOB NOT NULL,
				counter BIGINT UNSIGNED NOT NULL,
				transports VARCHAR(255),
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
			);
		`;
		// Führe den gesamten SQL-Block auf einmal aus, da `multipleStatements: true` gesetzt ist.
		await connection.query(createTablesSql);
		res.json({ success: true, message: 'Datenbank und Tabellen erfolgreich erstellt!' });

	} catch (error) {
		res.status(500).json({ success: false, message: 'Fehler beim Erstellen der Datenbank.', error: error.message });
	} finally {
		if (connection) await connection.end();
	}
};

exports.getAppStatus = async (req, res) => {
	try {
		// Diese Funktion wird nur im Normalbetrieb aufgerufen, daher ist `db` verfügbar.
		const db = require('../config/db');
		const [[{ count }]] = await db.query('SELECT COUNT(*) as count FROM users');
		res.json({ needsInitialUser: count === 0 });
	} catch (error) {
		// Dies kann passieren, wenn die Tabellen gerade erst erstellt wurden.
		if (error.code === 'ER_NO_SUCH_TABLE') {
			return res.json({ needsInitialUser: true });
		}
		res.status(500).json({ error: 'Could not determine app status.', details: error.message });
	}
};
