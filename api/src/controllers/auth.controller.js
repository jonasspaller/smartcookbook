const db = require('../config/db');
const {
	generateRegistrationOptions,
	verifyRegistrationResponse,
	generateAuthenticationOptions,
	verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const rpName = process.env.RP_NAME;
const rpID = process.env.RP_ID;
const origin = process.env.CLIENT_URL;

let loginChallenges = new Map(); // In-memory store for login challenges. For production, use a persistent store like Redis.

exports.getRegistrationOptions = async (req, res) => {
	const { username } = req.body;
	if (!username) {
		return res.status(400).json({ error: 'Username is required' });
	}

	// Finde einen existierenden Benutzer oder erstelle einen neuen (robuste "find or create"-Logik)
	let [[user]] = await db.query('SELECT * FROM users WHERE username = ?', [username]);

	if (!user) {
		const [userResult] = await db.query('INSERT INTO users (username) VALUES (?)', [username]);
		// Nach dem Einfügen müssen wir das vollständige Benutzerobjekt abrufen
		[[user]] = await db.query('SELECT * FROM users WHERE id = ?', [userResult.insertId]);
	}

	// Hole bereits existierende Passkeys für diesen Benutzer, um eine erneute Registrierung zu verhindern
	const [existingPasskeys] = await db.query('SELECT credential_id, transports FROM passkeys WHERE user_id = ?', [user.id]);
	const excludeCredentials = existingPasskeys.map(pk => ({
		// pk.credential_id ist ein Buffer aus der DB. Für den Browser in base64url umwandeln.
		id: pk.credential_id.toString('base64url'),
		type: 'public-key',
		transports: pk.transports ? pk.transports.split(',') : undefined,
	}));

	const options = await generateRegistrationOptions({
		rpName,
		rpID,
		userID: Buffer.from(user.id.toString()),
		userName: user.username,
		attestationType: 'none',
		excludeCredentials,
		authenticatorSelection: {
			// Bevorzuge fest verbaute Authenticators wie Touch ID oder Windows Hello
			authenticatorAttachment: 'platform',
		},
	});

	await db.query('UPDATE users SET current_challenge = ? WHERE id = ?', [options.challenge, user.id]);

	res.json(options);
};

exports.verifyRegistration = async (req, res) => {
	const { username, cred, password } = req.body;
	const [[user]] = await db.query('SELECT * FROM users WHERE username = ?', [username]);

	if (!user) return res.status(404).json({ error: 'User not found' });

	try {
		const verification = await verifyRegistrationResponse({
			response: cred,
			expectedChallenge: user.current_challenge,
			expectedOrigin: origin,
			expectedRPID: rpID,
		});

		if (verification.verified) {
			if (password) {
				const salt = await bcrypt.genSalt(10);
				const hashedPassword = await bcrypt.hash(password, salt);
				await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);
			}

			// Korrektur basierend auf deiner Analyse: Die Daten sind in einem verschachtelten `credential`-Objekt.
			const { registrationInfo } = verification;
			const { credential, transports } = registrationInfo;
			const { id: credentialID, publicKey: credentialPublicKey, counter } = credential;
			// Stelle sicher, dass ein leeres transports-Array als NULL gespeichert wird, nicht als leerer String.
			const transportsString = (transports && transports.length > 0) ? transports.join(',') : null;
			await db.query(
				'INSERT INTO passkeys (user_id, credential_id, public_key, counter, transports) VALUES (?, ?, ?, ?, ?)',
				[user.id, credentialID, Buffer.from(credentialPublicKey), counter, transportsString]
			);
			await db.query('UPDATE users SET current_challenge = NULL WHERE id = ?', [user.id]);

			// User is registered, log them in immediately
			const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1d' });
			res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
			res.json({ id: user.id, username: user.username });
		} else {
			res.status(400).json({ error: 'Verification failed' });
		}
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: 'Internal server error' });
	}
};

exports.getLoginOptions = async (req, res) => {
	// Indem wir `allowCredentials` weglassen, initiieren wir einen "passwordless" Login.
	// Der Browser wird den Nutzer auffordern, einen für diese Seite (RP ID) gespeicherten,
	// auffindbaren Passkey auszuwählen (z.B. aus dem iCloud-Schlüsselbund oder Windows Hello).
	const options = await generateAuthenticationOptions({
		rpID,
		userVerification: 'preferred',
	});

	// Store challenge temporarily.
	loginChallenges.set(options.challenge, Date.now());

	res.json(options);
};

exports.verifyLogin = async (req, res) => {
	const { cred } = req.body;
	// Die `cred.id` vom Browser ist ein base64url-String.
	// Der mysql2-Treiber kann diesen Vergleich mit einer binären Spalte direkt durchführen.

	const [[passkey]] = await db.query('SELECT * FROM passkeys WHERE credential_id = ?', [cred.id]);
	if (!passkey) return res.status(404).json({ error: 'Credential not found' });

	const [[user]] = await db.query('SELECT * FROM users WHERE id = ?', [passkey.user_id]);
	if (!user) return res.status(404).json({ error: 'User not found' });

	// cred.response.clientDataJSON ist ein base64url-String. Wir müssen ihn dekodieren.
	const clientDataJSON = cred.response.clientDataJSON
		? Buffer.from(cred.response.clientDataJSON, 'base64url').toString()
		: null;
	const challenge = clientDataJSON ? JSON.parse(clientDataJSON).challenge : null;

	if (!challenge || !loginChallenges.has(challenge)) {
		return res.status(400).json({ error: 'Invalid or expired challenge' });
	}

	try {
		const verification = await verifyAuthenticationResponse({
			response: cred,
			expectedChallenge: challenge,
			expectedOrigin: origin,
			expectedRPID: rpID,
			credential: {
				// passkey.credential_id ist bereits ein Buffer aus der DB, was die Bibliothek erwartet.
				credentialID: passkey.credential_id,
				publicKey: passkey.public_key,
				counter: Number(passkey.counter),
				transports: passkey.transports ? passkey.transports.split(',') : undefined,
			},
		});

		loginChallenges.delete(challenge);

		if (verification.verified) {
			await db.query('UPDATE passkeys SET counter = ? WHERE id = ?', [verification.authenticationInfo.newCounter, passkey.id]);

			const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1d' });
			res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
			res.json({ id: user.id, username: user.username });
		} else {
			res.status(400).json({ error: 'Verification failed' });
		}
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: 'Internal server error' });
	}
};

exports.getCurrentUser = (req, res) => {
	// req.user wird von der jwtMiddleware bereitgestellt
	res.json(req.user);
};

exports.logout = (req, res) => {
	res.clearCookie('token');
	res.status(200).json({ message: 'Logout successful' });
};

exports.loginWithPassword = async (req, res) => {
	const { username, password } = req.body;
	if (!username || !password) {
		return res.status(400).json({ error: 'Username and password are required' });
	}

	try {
		const [[user]] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
		if (!user) {
			return res.status(401).json({ error: 'Invalid credentials' });
		}

		if (!user.password) {
			return res.status(401).json({ error: 'This account is set up for passkey login only.' });
		}

		const isMatch = await bcrypt.compare(password, user.password);
		if (!isMatch) {
			return res.status(401).json({ error: 'Invalid credentials' });
		}

		// Passwords match, create and send token
		const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1d' });
		res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
		res.json({ id: user.id, username: user.username });

	} catch (error) {
		console.error(error);
		res.status(500).json({ error: 'Internal server error' });
	}
};

exports.createUser = async (req, res) => {
	const { username, password } = req.body;
	if (!username || !password) {
		return res.status(400).json({ error: 'Username and password are required' });
	}

	try {
		const [[existingUser]] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
		if (existingUser) {
			return res.status(409).json({ error: 'Username already exists.' });
		}

		const salt = await bcrypt.genSalt(10);
		const hashedPassword = await bcrypt.hash(password, salt);
		await db.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);

		res.status(201).json({ message: `User "${username}" created successfully.` });
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: 'Internal server error' });
	}
};

exports.getPasskeysForUser = async (req, res) => {
	const user = req.user; // from jwtMiddleware
	try {
		// Wir geben nicht die volle credential_id zurück, nur einen Spitznamen oder das Erstellungsdatum.
		// Vereinfacht hier als "Passkey vom [Datum]".
		const [passkeys] = await db.query("SELECT id, DATE_FORMAT(created_at, '%d.%m.%Y %H:%i') as created_at FROM passkeys WHERE user_id = ?", [user.id]);
		res.json(passkeys);
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: 'Could not fetch passkeys' });
	}
};

exports.registerInitialUser = async (req, res) => {
	const { username, password } = req.body;
	if (!username || !password) {
		return res.status(400).json({ error: 'Username and password are required' });
	}

	const connection = await db.getConnection();
	try {
		await connection.beginTransaction();

		// Security check: This should only work if there are NO users.
		const [[{ count }]] = await connection.query('SELECT COUNT(*) as count FROM users');
		if (count > 0) {
			await connection.rollback();
			return res.status(403).json({ error: 'Initial user already exists.' });
		}

		// Create user with hashed password
		const salt = await bcrypt.genSalt(10);
		const hashedPassword = await bcrypt.hash(password, salt);
		await connection.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);

		await connection.commit();
		res.status(201).json({ message: 'Initial user created successfully. You can now log in.' });

	} catch (error) {
		await connection.rollback();
		console.error(error);
		res.status(500).json({ error: 'Internal server error' });
	} finally {
		connection.release();
	}
};