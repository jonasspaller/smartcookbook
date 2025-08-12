import React, { createContext, useState, useContext, useEffect } from 'react';
import { getCurrentUser, logout as apiLogout } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
	const [user, setUser] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const checkUser = async () => {
			try {
				const currentUser = await getCurrentUser();
				setUser(currentUser);
			} catch (error) {
				setUser(null);
			} finally {
				setLoading(false);
			}
		};
		checkUser();
	}, []);

	const logout = async () => {
		await apiLogout();
		setUser(null);
	};

	const value = { user, setUser, loading, logout };

	return (
		<AuthContext.Provider value={value}>
			{!loading && children}
		</AuthContext.Provider>
	);
};
