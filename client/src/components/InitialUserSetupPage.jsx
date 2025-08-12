import React, { useState } from 'react';
import { registerInitialUser } from '../services/api';

const InitialUserSetupPage = () => {
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [message, setMessage] = useState({ type: '', text: '' });
	const [isDone, setIsDone] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		setMessage({ type: '', text: '' });
		if (!username || !password) {
			setMessage({ type: 'error', text: 'Benutzername und Passwort sind erforderlich.' });
			return;
		}

		try {
			const resp = await registerInitialUser(username, password);
			const data = await resp.json();
			if (!resp.ok) {
				throw new Error(data.error || 'Erstellung fehlgeschlagen');
			}
			setMessage({ type: 'success', text: data.message });
			setIsDone(true);
		} catch (error) {
			setMessage({ type: 'error', text: `Fehler: ${error.message}` });
		}
	};

	if (isDone) {
		return (
			<div className="setup-page">
				<div className="setup-container">
					<h1>Erster Benutzer erstellt!</h1>
					<div className="message success">{message.text}</div>
					<p>Die Anwendung ist jetzt einsatzbereit.</p>
					<button onClick={() => window.location.href = '/login'}>
						Zur Login-Seite
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="setup-page">
			<div className="setup-container">
				<h1>Ersten Benutzer anlegen</h1>
				<p>Da noch kein Benutzer existiert, muss nun der erste Administrator-Account angelegt werden. Dieser Account kann dann weitere Benutzer erstellen.</p>

				{message.text && <p className={`message ${message.type}`}>{message.text}</p>}

				<form onSubmit={handleSubmit}>
					<fieldset>
						<legend>Admin-Account</legend>
						<label>Benutzername
							<input
								type="text"
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								required
							/>
						</label>
						<label>Passwort
							<input
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
							/>
						</label>
					</fieldset>
					<button type="submit">Benutzer erstellen</button>
				</form>
			</div>
		</div>
	);
};

export default InitialUserSetupPage;