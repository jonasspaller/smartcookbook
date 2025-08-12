const mysql = require('mysql2/promise');

// Die Umgebungsvariablen werden in `src/index.js` geladen, BEVOR dieses Modul importiert wird.
// Daher können wir hier sicher auf `process.env` zugreifen.
const pool = mysql.createPool({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_DATABASE, // Der entscheidende Parameter
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0
});

module.exports = pool;