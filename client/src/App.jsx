import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { getSetupStatus, getAppStatus } from './services/api';
import RecipeList from './components/RecipeList';
import RecipeDetail from './components/RecipeDetail';
import NewRecipeForm from './components/NewRecipeForm';
import SettingsPage from './components/SettingsPage';
import Navbar from './components/Navbar';
import WeeklyPlannerPage from './components/WeeklyPlannerPage';
import ShoppingListPage from './components/ShoppingListPage';
import AuthPage from './components/AuthPage';
import ProtectedRoute from './components/ProtectedRoute';
import SetupPage from './components/SetupPage';
import InitialUserSetupPage from './components/InitialUserSetupPage';
import './App.css';

const AppContent = () => {
	const [needsSetup, setNeedsSetup] = useState(null); // null = loading, true/false
	const [needsInitialUser, setNeedsInitialUser] = useState(null);
	const [error, setError] = useState('');
	const [loadingState, setLoadingState] = useState('Lade Konfiguration...');

	useEffect(() => {
		const checkStatus = async () => {
			try {
				// 1. Check for server configuration (.env)
				const setupRes = await getSetupStatus();
				const setupData = await setupRes.json();
				if (!setupRes.ok) {
					throw new Error(setupData.error || 'Failed to check setup status');
				}

				if (setupData.needsSetup) {
					setNeedsSetup(true);
					return;
				}
				setNeedsSetup(false);

				// 2. If server is configured, check for application setup (initial user)
				setLoadingState('Prüfe Anwendungsstatus...');
				const appStatusRes = await getAppStatus();
				const appStatusData = await appStatusRes.json();
				if (!appStatusRes.ok) {
					throw new Error(appStatusData.error || 'Failed to check app status');
				}
				setNeedsInitialUser(appStatusData.needsInitialUser);
			} catch (err) {
				setError('Verbindung zum Backend fehlgeschlagen. Läuft der Server?');
				console.error(err);
			}
		};
		checkStatus();
	}, []);

	if (needsSetup === null || (needsSetup === false && needsInitialUser === null)) {
		return <div className="loading-screen">{loadingState}</div>;
	}
	if (error) {
		return <div className="loading-screen error-screen">{error}</div>;
	}
	if (needsSetup) {
		return <SetupPage />;
	}
	if (needsInitialUser) {
		return <InitialUserSetupPage />;
	}

	return (
		<AuthProvider>
			<Navbar />
			<div className="main-content">
				<main>
					<Routes>
						<Route path="/login" element={<AuthPage />} />
						<Route path="/" element={<ProtectedRoute><RecipeList /></ProtectedRoute>} />
						<Route path="/wochenplaner" element={<ProtectedRoute><WeeklyPlannerPage /></ProtectedRoute>} />
						<Route path="/einkaufsliste" element={<ProtectedRoute><ShoppingListPage /></ProtectedRoute>} />
						<Route path="/rezepte/neu" element={<ProtectedRoute><NewRecipeForm /></ProtectedRoute>} />
						<Route path="/rezepte/:id" element={<ProtectedRoute><RecipeDetail /></ProtectedRoute>} />
						<Route path="/einstellungen" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
						<Route path="*" element={<ProtectedRoute><RecipeList /></ProtectedRoute>} />
					</Routes>
				</main>
			</div>
		</AuthProvider>
	);
};

export default function App() {
	return (
		<BrowserRouter>
			<AppContent />
		</BrowserRouter>
	);
}