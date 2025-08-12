import React, { useState, useEffect } from 'react';
import { testDbConnection, saveConfiguration, initializeDatabase } from '../services/api';

const SetupPage = () => {
	const [config, setConfig] = useState({
		dbHost: 'localhost',
		dbUser: '',
		dbPassword: '',
		dbDatabase: '',
		rpName: 'Smart Cookbook',
		rpId: window.location.hostname,
		clientUrl: window.location.origin,
	});
	const [message, setMessage] = useState({ type: '', text: '' });
	const [isSaved, setIsSaved] = useState(false);
	const [showInitDbButton, setShowInitDbButton] = useState(false);

	const handleChange = (e) => {
		const { name, value } = e.target;
		setConfig(prev => ({ ...prev, [name]: value }));
	};

	const handleTestConnection = async () => {
		setMessage({ type: '', text: '' });
		setShowInitDbButton(false); // Bei jedem Test zurücksetzen
		try {
			const { dbHost, dbUser, dbPassword, dbDatabase } = config;
			const resp = await testDbConnection({ host: dbHost, user: dbUser, password: dbPassword, database: dbDatabase });
			const data = await resp.json();

			// Auch bei HTTP 200 kann eine Aktion nötig sein (z.B. DB erstellen)
			if (data.needsDBCreation) {
				setMessage({ type: 'info', text: data.message }); // 'info' ist eine neutrale Farbe
				setShowInitDbButton(true);
			} else if (!resp.ok) {
				throw new Error(data.error || 'Unbekannter Fehler');
			} else {
				setMessage({ type: 'success', text: data.message });
			}
		} catch (error) {
			setMessage({ type: 'error', text: `Verbindungstest fehlgeschlagen: ${error.message}` });
		}
	};

	const handleInitDb = async () => {
		setMessage({ type: '', text: '' });
		try {
			const { dbHost, dbUser, dbPassword, dbDatabase } = config;
			const resp = await initializeDatabase({ host: dbHost, user: dbUser, password: dbPassword, database: dbDatabase });
			const data = await resp.json();
			if (!resp.ok) throw new Error(data.error || 'DB Initialisierung fehlgeschlagen');
			setMessage({ type: 'success', text: data.message + ' Bitte Verbindung erneut testen.' });
			setShowInitDbButton(false);
		} catch (error) {
			setMessage({ type: 'error', text: `Fehler bei der Initialisierung: ${error.message}` });
		}
	};

	const handleSave = async (e) => {
		e.preventDefault();
		setMessage({ type: '', text: '' });
		try {
			const resp = await saveConfiguration(config);
			const data = await resp.json();
			if (!resp.ok) {
				throw new Error(data.message || 'Speichern fehlgeschlagen');
			}
			setMessage({ type: 'success', text: data.message });
			setIsSaved(true);
		} catch (error) {
			setMessage({ type: 'error', text: `Fehler: ${error.message}` });
		}
	};

	if (isSaved) {
		return (
			<div className="setup-page">
				<div className="setup-container">
					<h1>Setup abgeschlossen!</h1>
					<div className="message success">{message.text}</div>
					<div style={{ textAlign: 'left', margin: '2rem 0' }}>
						<p><strong>Nächste Schritte:</strong></p>
						<ol>
							<li>Öffne dein Terminal.</li>
							<li>Stoppe den laufenden Backend-Server (meist mit `Ctrl + C`).</li>
							<li>Starte ihn mit dem Befehl <code>npm start</code> im <code>api</code>-Verzeichnis neu.</li>
						</ol>
					</div>
					<button onClick={() => window.location.reload()}>
						Anwendung neu laden (nach Server-Neustart)
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="setup-page">
			<div className="setup-container">
				<h1>Willkommen beim Smart Cookbook Setup</h1>
				<p>Da keine Konfiguration gefunden wurde, müssen einige Einstellungen vorgenommen werden.</p>

				{message.text && <p className={`message ${message.type}`}>{message.text}</p>}

				<form onSubmit={handleSave}>
					<fieldset>
						<legend>Datenbank-Konfiguration</legend>
						<label>Host <input type="text" name="dbHost" value={config.dbHost} onChange={handleChange} required /></label>
						<label>Benutzer <input type="text" name="dbUser" value={config.dbUser} onChange={handleChange} required /></label>
						<label>Passwort <input type="password" name="dbPassword" value={config.dbPassword} onChange={handleChange} /></label>
						<label>Datenbankname <input type="text" name="dbDatabase" value={config.dbDatabase} onChange={handleChange} required /></label>
						<button type="button" onClick={handleTestConnection} className="button-outline">Verbindung testen</button>
						{showInitDbButton && (
							<button type="button" onClick={handleInitDb} style={{ marginTop: '1rem' }}>
								Datenbank und Tabellen erstellen
							</button>
						)}
					</fieldset>

					<fieldset>
						<legend>Anwendungs-Konfiguration (Passkey)</legend>
						<label>Anwendungsname (RP Name) <input type="text" name="rpName" value={config.rpName} onChange={handleChange} required /></label>
						<label>Domain (RP ID) <input type="text" name="rpId" value={config.rpId} onChange={handleChange} required /></label>
						<label>Client URL <input type="text" name="clientUrl" value={config.clientUrl} onChange={handleChange} required /></label>
					</fieldset>

					<button type="submit">Konfiguration speichern & Setup abschließen</button>
				</form>
			</div>
		</div>
	);
};

export default SetupPage;