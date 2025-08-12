// Der Basis-Pfad für alle API-Anfragen.
const getApiBaseUrl = () => {
	// In der Entwicklungsumgebung (wenn `npm run dev` läuft)
	// verwenden wir die volle URL, um direkt mit dem API-Server zu sprechen.
	// Das funktioniert, weil wir im Backend CORS für http://localhost:5173 erlaubt haben.
	if (import.meta.env.DEV) {
		return 'http://localhost:3001/api';
	}

	// In der Produktionsumgebung (nach `npm run build`) wird der Client
	// vom selben Server wie die API ausgeliefert. Daher reicht ein relativer Pfad.
	return '/api';
};

const API_BASE_URL = getApiBaseUrl();

/**
 * Ein zentraler Wrapper für die fetch-API, der automatisch die Basis-URL und
 * die notwendigen Optionen für die Cookie-basierte Authentifizierung hinzufügt.
 * @param {string} endpoint Der API-Endpunkt (z.B. '/rezepte').
 * @param {object} options Zusätzliche fetch-Optionen (z.B. method, body).
 * @returns {Promise<Response>}
 */
const apiFetch = (endpoint, options = {}) => {
	// Sende Cookies bei jeder Anfrage mit, auch bei Cross-Origin-Anfragen.
	options.credentials = 'include';

	return fetch(`${API_BASE_URL}${endpoint}`, options);
};

/**
 * Ruft alle Rezepte von der API ab.
 * @returns {Promise<Array>} Ein Promise, das zu einem Array von Rezept-Objekten auflöst.
 */
export const fetchRecipes = async () => {
	const response = await apiFetch('/rezepte');
	if (!response.ok) {
		console.error("DB Response aus fetchRecipes: ", response);
		throw new Error('Netzwerkantwort war nicht in Ordnung.');
	}
	return response.json();
};

/**
 * Ruft ein einzelnes Rezept anhand seiner ID ab.
 * @param {number} id Die ID des Rezepts.
 * @returns {Promise<object>} Ein Promise, das zum Rezept-Objekt auflöst.
 */
export const fetchRecipeById = async (id) => {
	const response = await apiFetch(`/rezepte/${id}`);
	console.log("fetchRecipeById response: ", response);
	if (!response.ok) {
		throw new Error('Netzwerkantwort war nicht in Ordnung.');
	}
	return response.json();
};

/**
 * Ruft alle verfügbaren Zutaten von der API ab.
 * @returns {Promise<Array>} Ein Promise, das zu einem Array von Zutat-Objekten auflöst.
 */
export const fetchAllIngredients = async () => {
	const response = await apiFetch('/zutaten');
	if (!response.ok) {
		throw new Error('Zutaten konnten nicht geladen werden.');
	}
	return response.json();
};

/**
 * Erstellt ein neues Rezept.
 * @param {FormData} formData Die Formulardaten inklusive Bild.
 * @returns {Promise<object>} Ein Promise, das zum neu erstellten Rezept-Objekt auflöst.
 */
export const createRecipe = async (formData) => {
	// Für FormData dürfen wir den Content-Type Header nicht manuell setzen.
	// Der Browser macht das automatisch und fügt die notwendige "boundary" hinzu.
	const response = await apiFetch('/rezepte', {
		method: 'POST',
		body: formData,
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({ error: 'Rezept konnte nicht erstellt werden.' }));
		throw new Error(errorData.error);
	}
	return response.json();
};

/**
 * Erstellt eine neue Zutat.
 * @param {object} ingredientData Die Daten der neuen Zutat { name, unit, category }.
 * @returns {Promise<object>} Ein Promise, das zum neu erstellten Zutat-Objekt auflöst.
 */
export const createIngredient = async (ingredientData) => {
	const response = await apiFetch('/zutaten', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(ingredientData),
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({ error: 'Zutat konnte nicht erstellt werden.' }));
		throw new Error(errorData.error);
	}
	return response.json();
};

/**
 * Ruft alle verfügbaren Zutaten-Kategorien ab.
 * @returns {Promise<Array<string>>} Ein Promise, das zu einem Array von Kategorie-Namen auflöst.
 */
export const fetchAllCategories = async () => {
	const response = await apiFetch('/categories');
	if (!response.ok) {
		throw new Error('Kategorien konnten nicht geladen werden.');
	}
	return response.json();
};

/**
 * Erstellt eine neue Kategorie.
 * @param {string} name Der Name der neuen Kategorie.
 * @returns {Promise<object>} Ein Promise, das zum neu erstellten Kategorie-Objekt auflöst.
 */
export const createCategory = async (name) => {
	const response = await apiFetch('/categories', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ name }),
	});
	if (!response.ok) {
		const errorData = await response.json().catch(() => ({ error: 'Kategorie konnte nicht erstellt werden.' }));
		throw new Error(errorData.error);
	}
	return response.json();
};

/**
 * Aktualisiert die Sortierreihenfolge der Kategorien.
 * @param {Array<number>} orderedIds Ein Array von Kategorie-IDs in der neuen Reihenfolge.
 * @returns {Promise<object>}
 */
export const updateCategoryOrder = async (orderedIds) => {
	const response = await apiFetch('/categories/order', {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ orderedIds }),
	});
	if (!response.ok) {
		throw new Error('Sortierreihenfolge konnte nicht gespeichert werden.');
	}
	return response.json();
};

/**
 * Generiert eine neue Einkaufsliste aus einer Auswahl von Rezepten.
 * @param {Array<number>} recipeIds Ein Array von Rezept-IDs.
 * @returns {Promise<object>}
 */
export const generateShoppingList = async (recipeIds) => {
	const response = await apiFetch('/einkaufsliste/from-recipes', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ recipeIds }),
	});
	if (!response.ok) {
		throw new Error('Einkaufsliste konnte nicht generiert werden.');
	}
	return response.json();
};

/**
 * Löscht eine Kategorie anhand ihrer ID.
 * @param {number} id Die ID der zu löschenden Kategorie.
 * @returns {Promise<void>}
 */
export const deleteCategory = async (id) => {
	const response = await apiFetch(`/categories/${id}`, {
		method: 'DELETE',
	});
	if (!response.ok) {
		const errorData = await response.json().catch(() => ({ error: 'Kategorie konnte nicht gelöscht werden.' }));
		throw new Error(errorData.error);
	}
};

/**
 * Aktualisiert eine bestehende Zutat.
 * @param {number} id Die ID der Zutat.
 * @param {object} ingredientData Die neuen Daten der Zutat { name, unit, category_id }.
 * @returns {Promise<object>}
 */
export const updateIngredient = async (id, ingredientData) => {
	const response = await apiFetch(`/zutaten/${id}`, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(ingredientData),
	});
	if (!response.ok) {
		const errorData = await response.json().catch(() => ({ error: 'Zutat konnte nicht aktualisiert werden.' }));
		throw new Error(errorData.error);
	}
	return response.json();
};

/**
 * Löscht eine Zutat anhand ihrer ID.
 * @param {number} id Die ID der zu löschenden Zutat.
 * @returns {Promise<void>}
 */
export const deleteIngredient = async (id) => {
	const response = await apiFetch(`/zutaten/${id}`, {
		method: 'DELETE',
	});
	if (!response.ok) {
		const errorData = await response.json().catch(() => ({ error: 'Zutat konnte nicht gelöscht werden.' }));
		throw new Error(errorData.error);
	}
};

/**
 * Ruft die komplette Einkaufsliste ab.
 * @returns {Promise<Array>}
 */
export const fetchShoppingList = async () => {
	const response = await apiFetch('/einkaufsliste');
	if (!response.ok) {
		throw new Error('Einkaufsliste konnte nicht geladen werden.');
	}
	return response.json();
};

/**
 * Aktualisiert einen Eintrag auf der Einkaufsliste (z.B. abhaken).
 * @param {number} id Die ID des Eintrags.
 * @param {object} data Die zu aktualisierenden Daten, z.B. { is_checked: true }.
 * @returns {Promise<object>}
 */
export const updateShoppingListItem = async (id, data) => {
	const response = await apiFetch(`/einkaufsliste/${id}`, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(data),
	});
	if (!response.ok) {
		throw new Error('Eintrag konnte nicht aktualisiert werden.');
	}
	return response.json();
};

/**
 * Löscht alle abgehakten Einträge von der Einkaufsliste.
 * @returns {Promise<void>}
 */
export const deleteCheckedItems = async () => {
	const response = await apiFetch('/einkaufsliste/checked', {
		method: 'DELETE',
	});
	if (!response.ok) {
		throw new Error('Abgehakte Einträge konnten nicht gelöscht werden.');
	}
};

// --- Auth API Functions ---

export const getRegistrationOptions = (username) => apiFetch('/auth/register-options', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({ username }),
});

export const verifyRegistration = (username, password, cred) => apiFetch('/auth/register-verify', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({ username, password, cred }),
});

export const getLoginOptions = () => apiFetch('/auth/login-options');

export const verifyLogin = (cred) => apiFetch('/auth/login-verify', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({ cred }),
});

export const loginWithPassword = (username, password) => apiFetch('/auth/login-password', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({ username, password }),
});

export const getCurrentUser = async () => {
	const response = await apiFetch('/auth/me');
	if (response.status === 401) {
		return null; // Kein Benutzer angemeldet
	}
	if (!response.ok) {
		throw new Error('Could not fetch user');
	}
	return response.json();
};

export const logout = async () => {
	const response = await apiFetch('/auth/logout', { method: 'POST' });
	if (!response.ok) {
		throw new Error('Logout failed');
	}
};

export const createUser = (username, password) => apiFetch('/auth/create-user', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({ username, password }),
});

export const getPasskeys = () => apiFetch('/auth/passkeys');

// --- Setup API Functions ---

export const getSetupStatus = () => apiFetch('/setup/status');

export const getAppStatus = () => apiFetch('/setup/app-status');

export const registerInitialUser = (username, password) => apiFetch('/auth/register-initial-user', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({ username, password }),
});

export const testDbConnection = (dbConfig) => apiFetch('/setup/test-db', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify(dbConfig),
});

export const saveConfiguration = (config) => apiFetch('/setup/save', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify(config),
});

export const initializeDatabase = (dbConfig) => apiFetch('/setup/initialize-db', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify(dbConfig),
});