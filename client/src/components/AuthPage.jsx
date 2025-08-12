import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { startAuthentication } from '@simplewebauthn/browser';
import { getLoginOptions, verifyLogin, loginWithPassword } from '../services/api';
import { useAuth } from '../context/AuthContext';

const AuthPage = () => {
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const navigate = useNavigate();
	const { setUser } = useAuth();

	const handlePasskeyLogin = async () => {
		setError('');
		try {
			// 1. Get options from server
			const resp = await getLoginOptions();
			const options = await resp.json();

			// 2. Start WebAuthn authentication
			const assertion = await startAuthentication(options);

			// 3. Send response to server
			const verificationResp = await verifyLogin(assertion);
			if (!verificationResp.ok) {
				const err = await verificationResp.json();
				throw new Error(err.error);
			}
			const user = await verificationResp.json();
			setUser(user);
			navigate('/');
		} catch (err) {
			setError(`Anmeldung fehlgeschlagen: ${err.message}`);
		}
	};

	const handlePasswordLogin = async (e) => {
		e.preventDefault();
		setError('');
		if (!username || !password) {
			setError('Bitte Benutzername und Passwort eingeben.');
			return;
		}
		try {
			const resp = await loginWithPassword(username, password);
			if (!resp.ok) {
				const err = await resp.json();
				throw new Error(err.error);
			}
			const user = await resp.json();
			setUser(user);
			navigate('/');
		} catch (err) {
			setError(`Anmeldung fehlgeschlagen: ${err.message}`);
		}
	};

	return (
		<>
			<div className="auth-page">
				<div className="auth-container">
					<div className="passkey-auth">
						<button onClick={handlePasskeyLogin}>Mit Passkey anmelden</button>
					</div>

					<form onSubmit={handlePasswordLogin} className="classic-auth">
						<input
							type="text"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							placeholder="Benutzername"
							required
						/>
						<input
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="Passwort"
							required
						/>
						<button type="submit">Anmelden</button>
					</form>
				</div>
			</div>

			{error && <div className="floating-message-box error">{error}</div>}
		</>
	);
};

export default AuthPage;