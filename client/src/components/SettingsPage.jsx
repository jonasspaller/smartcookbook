import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { startRegistration } from '@simplewebauthn/browser';
import {
	DndContext,
	closestCenter,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from '@dnd-kit/core';
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import CreatableSelect from 'react-select/creatable';
import { fetchAllCategories, createCategory, updateCategoryOrder, deleteCategory, fetchAllIngredients, createIngredient, updateIngredient, deleteIngredient, getRegistrationOptions, verifyRegistration, createUser, getPasskeys } from '../services/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faGripVertical, faTrash, faPlus, faPenToSquare, faSave, faTimes } from '@fortawesome/free-solid-svg-icons';

const SortableItem = ({ category, onDelete }) => {
	const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: category.id });
	const style = { transform: CSS.Transform.toString(transform), transition };

	const handleDeleteClick = (e) => {
		e.stopPropagation(); // Verhindert, dass das Drag-Event ausgelöst wird
		onDelete(category.id);
	};

	return (
		<li ref={setNodeRef} style={style} {...attributes}>
			<div className="drag-area" {...listeners}>
				<FontAwesomeIcon icon={faGripVertical} className="drag-handle" />
				<span className="category-name">{category.name}</span>
			</div>
			<button onClick={handleDeleteClick} className="delete-category-btn" title="Kategorie löschen">
				<FontAwesomeIcon icon={faTrash} />
			</button>
		</li>
	);
};

const IngredientItem = ({ ingredient, categories, onUpdate, onDelete, onCreateCategory }) => {
	const [isEditing, setIsEditing] = useState(false);
	const [editData, setEditData] = useState({
		name: ingredient.name,
		unit: ingredient.unit,
		category_id: ingredient.category_id,
	});
	const categoryOptions = categories.map(cat => ({ value: cat.id, label: cat.name }));

	const handleSave = async () => {
		try {
			await onUpdate(ingredient.id, editData);
			setIsEditing(false);
		} catch (err) {
			// Fehlerbehandlung könnte hier erfolgen, z.B. eine Benachrichtigung
			console.error("Fehler beim Speichern der Zutat:", err);
		}
	};

	const handleDelete = () => {
		if (window.confirm(`Möchtest du "${ingredient.name}" wirklich löschen? Dies ist nur möglich, wenn die Zutat in keinem Rezept verwendet wird.`)) {
			onDelete(ingredient.id);
		}
	};

	const handleCreateForEdit = async (inputValue) => {
		// Ruft die zentrale Erstellungsfunktion in der Elternkomponente auf
		const newCategory = await onCreateCategory(inputValue);
		if (newCategory) {
			// Aktualisiert den lokalen Zustand, um die neue Kategorie auszuwählen
			setEditData({ ...editData, category_id: newCategory.id });
		}
	};

	if (isEditing) {
		return (
			<li className="ingredient-item editing">
				<input
					type="text"
					value={editData.name}
					onChange={(e) => setEditData({ ...editData, name: e.target.value })}
					className="edit-ingredient-name"
				/>
				<input
					type="text"
					value={editData.unit}
					onChange={(e) => setEditData({ ...editData, unit: e.target.value })}
					className="edit-ingredient-unit"
					placeholder="Einheit"
				/>
				<CreatableSelect
					className="edit-ingredient-category"
					options={categoryOptions}
					value={categoryOptions.find(c => c.value === editData.category_id)}
					onChange={(option) => setEditData({ ...editData, category_id: option ? option.value : null })}
					onCreateOption={handleCreateForEdit}
					placeholder="Kategorie wählen/erstellen"
					formatCreateLabel={(inputValue) => `"${inputValue}" erstellen`}
					isClearable
				/>
				<div className="ingredient-item-actions">
					<button onClick={handleSave} className="action-btn save-btn" title="Speichern"><FontAwesomeIcon icon={faSave} /></button>
					<button onClick={() => setIsEditing(false)} className="action-btn cancel-btn" title="Abbrechen"><FontAwesomeIcon icon={faTimes} /></button>
				</div>
			</li>
		);
	}

	return (
		<li className="ingredient-item">
			<div className="ingredient-item-info">
				<span className="ingredient-name">{ingredient.name}</span>
				<span className="ingredient-details">({ingredient.unit || 'N/A'}, {ingredient.category || 'Ohne Kategorie'})</span>
			</div>
			<div className="ingredient-item-actions">
				<button onClick={() => setIsEditing(true)} className="action-btn edit-btn" title="Bearbeiten"><FontAwesomeIcon icon={faPenToSquare} /></button>
				<button onClick={handleDelete} className="action-btn delete-btn" title="Löschen"><FontAwesomeIcon icon={faTrash} /></button>
			</div>
		</li>
	);
};

const SettingsPage = () => {
	const { user } = useAuth();
	const [categories, setCategories] = useState([]);
	const [allIngredients, setAllIngredients] = useState([]);
	const [newCategoryName, setNewCategoryName] = useState('');
	const [newUsername, setNewUsername] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [newIngredientName, setNewIngredientName] = useState('');
	const [newIngredientUnit, setNewIngredientUnit] = useState('');
	const [newIngredientCategory, setNewIngredientCategory] = useState(null);
	const [userPasskeys, setUserPasskeys] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		const loadData = async () => {
			try {
				setLoading(true);
				const [categoriesData, ingredientsData, passkeysResp] = await Promise.all([
					fetchAllCategories(),
					fetchAllIngredients(),
					getPasskeys(),
				]);
				setCategories(categoriesData);
				setAllIngredients(ingredientsData);
				setUserPasskeys(await passkeysResp.json());
				setError(null);
			} catch (err) {
				setError('Fehler beim Laden der Daten.');
				console.error(err);
			} finally {
				setLoading(false);
			}
		};

		loadData();
	}, []);

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	const handleDragEnd = async (event) => {
		const { active, over } = event;

		if (active.id !== over.id) {
			const oldIndex = categories.findIndex((cat) => cat.id === active.id);
			const newIndex = categories.findIndex((cat) => cat.id === over.id);
			const newOrder = arrayMove(categories, oldIndex, newIndex);

			setCategories(newOrder);

			try {
				const orderedIds = newOrder.map((cat) => cat.id);
				await updateCategoryOrder(orderedIds);
			} catch (err) {
				setError('Fehler beim Speichern der neuen Reihenfolge.');
				// Bei Fehler alten Zustand wiederherstellen
				setCategories(categories);
			}
		}
	};

	const handleCreateNewCategory = async (inputValue) => {
		const trimmedName = inputValue.trim();
		if (!trimmedName) return null;

		try {
			const newCategory = await createCategory(trimmedName);
			// Füge die neue Kategorie hinzu und sortiere die Liste alphabetisch
			setCategories(prev => [...prev, newCategory].sort((a, b) => a.name.localeCompare(b.name)));
			setError(null);
			return newCategory; // Wichtig: Gibt das neue Kategorie-Objekt zurück
		} catch (err) {
			setError(`Fehler beim Erstellen der Kategorie: ${err.message}`);
			return null;
		}
	};

	const handleCreateCategoryFromInput = async () => {
		const created = await handleCreateNewCategory(newCategoryName);
		if (created) {
			setNewCategoryName('');
		}
	};
	const handleDeleteCategory = async (id) => {
		if (window.confirm('Möchtest du diese Kategorie wirklich löschen? Dies ist nur möglich, wenn die Kategorie von keiner Zutat mehr verwendet wird.')) {
			try {
				await deleteCategory(id);
				setCategories(categories.filter((cat) => cat.id !== id));
				setError(null);
			} catch (err) {
				setError(err.message);
			}
		}
	};

	const handleUpdateIngredient = async (id, data) => {
		try {
			const updatedIngredient = await updateIngredient(id, data);
			setAllIngredients(allIngredients.map(ing => (ing.id === id ? { ...ing, ...updatedIngredient, category: categories.find(c => c.id === updatedIngredient.category_id)?.name } : ing)));
			setError(null);
		} catch (err) {
			setError(`Fehler beim Aktualisieren: ${err.message}`);
		}
	};

	const handleDeleteIngredient = async (id) => {
		try {
			await deleteIngredient(id);
			setAllIngredients(allIngredients.filter(ing => ing.id !== id));
			setError(null);
		} catch (err) {
			setError(err.message);
		}
	};

	const handleCreateIngredient = async () => {
		const trimmedName = newIngredientName.trim();
		if (!trimmedName) {
			setError('Der Name der Zutat darf nicht leer sein.');
			return;
		}
		setError('');

		try {
			const newIngredientData = {
				name: trimmedName,
				unit: newIngredientUnit.trim(),
				category_id: newIngredientCategory ? newIngredientCategory.value : null,
			};
			const created = await createIngredient(newIngredientData);

			// Füge den Kategorienamen zum erstellten Objekt hinzu, damit die Liste korrekt angezeigt wird.
			const category = categories.find(c => c.id === created.category_id);
			const ingredientWithCategory = { ...created, category: category ? category.name : null };

			setAllIngredients(prev => [...prev, ingredientWithCategory].sort((a, b) => a.name.localeCompare(b.name)));

			// Formular zurücksetzen
			setNewIngredientName('');
			setNewIngredientUnit('');
			setNewIngredientCategory(null);
		} catch (err) {
			setError(`Fehler beim Erstellen der Zutat: ${err.message}`);
		}
	};

	const handleRegisterNewUser = async () => {
		if (!newUsername || !newPassword) {
			setError('Benutzername und Passwort sind erforderlich.');
			return;
		}
		setError('');

		try {
			const resp = await createUser(newUsername, newPassword);
			if (!resp.ok) {
				const err = await resp.json();
				throw new Error(err.error);
			}
			const data = await resp.json();
			alert(data.message);
			setNewUsername('');
			setNewPassword('');
		} catch (err) {
			setError(`Registrierung fehlgeschlagen: ${err.message}`);
		}
	};

	const handleAddPasskey = async () => {
		setError('');
		if (!user) {
			setError('Nicht angemeldet.');
			return;
		}
		try {
			// Bestehenden Registrierungs-Flow für den eingeloggten Benutzer nutzen
			const resp = await getRegistrationOptions(user.username);
			if (!resp.ok) {
				const err = await resp.json();
				throw new Error(err.error);
			}
			const options = await resp.json();
			const attestation = await startRegistration(options);
			// Passwort ist hier nicht nötig, da der Benutzer bereits existiert
			const verificationResp = await verifyRegistration(user.username, null, attestation);

			if (!verificationResp.ok) {
				const err = await verificationResp.json();
				throw new Error(err.error);
			}
			alert(`Passkey erfolgreich für ${user.username} hinzugefügt!`);
			// Passkey-Liste neu laden
			const updatedPasskeysResp = await getPasskeys();
			setUserPasskeys(await updatedPasskeysResp.json());
		} catch (err) {
			setError(`Hinzufügen des Passkeys fehlgeschlagen: ${err.message}`);
		}
	};

	if (loading) return <div>Lade Kategorien...</div>;

	return (
		<>
			<div className="settings-page">
				<Link to="/" className="button" role="button">
					<FontAwesomeIcon icon={faArrowLeft} /> Zurück zur Startseite
				</Link>

				<div className="settings-section">
					<h2>Meine Passkeys</h2>
					<p>Hier siehst du alle Geräte, mit denen du dich anmelden kannst, und kannst neue hinzufügen.</p>
					<ul className="passkey-list">
						{userPasskeys.map((pk) => (
							<li key={pk.id}>Passkey (erstellt am {pk.created_at})</li>
						))}
						{userPasskeys.length === 0 && (
							<p className="empty-list-info">Noch keine Passkeys für diesen Account registriert.</p>
						)}
					</ul>
					<button onClick={handleAddPasskey}>
						<FontAwesomeIcon icon={faPlus} /> Neues Gerät/Passkey hinzufügen
					</button>
				</div>

				<div className="settings-section">
					<h2>Neuen Benutzer erstellen</h2>
					<p>Hiermit kann ein komplett neuer Benutzer mit einem Passwort angelegt werden.</p>
					<div className="add-category-form">
						<input
							type="text"
							value={newUsername}
							onChange={(e) => setNewUsername(e.target.value)}
							placeholder="Benutzername des neuen Nutzers"
						/>
						<input
							type="password"
							value={newPassword}
							onChange={(e) => setNewPassword(e.target.value)}
							placeholder="Passwort des neuen Nutzers"
						/>
						<button onClick={handleRegisterNewUser}>
							<FontAwesomeIcon icon={faPlus} /> Benutzer erstellen
						</button>
					</div>
				</div>

				<div className="settings-section">
					<h2>Kategorien verwalten</h2>
					<div className="add-category-form">
						<input
							type="text"
							value={newCategoryName}
							onChange={(e) => setNewCategoryName(e.target.value)}
							placeholder="Neue Kategorie hinzufügen..."
						/>
						<button onClick={handleCreateCategoryFromInput}><FontAwesomeIcon icon={faPlus} /></button>
					</div>
					<p>Ändere die Reihenfolge per Drag & Drop, um deine Einkaufsliste zu sortieren.</p>
					<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
						<SortableContext items={categories} strategy={verticalListSortingStrategy}>
							<ul className="category-list">
								{categories.map((category) => (
									<SortableItem key={category.id} category={category} onDelete={handleDeleteCategory} />
								))}
							</ul>
						</SortableContext>
					</DndContext>
				</div>

				<div className="settings-section">
					<h2>Zutaten verwalten</h2>
					<div className="add-ingredient-form">
						<input
							type="text"
							placeholder="Name der neuen Zutat"
							value={newIngredientName}
							onChange={(e) => setNewIngredientName(e.target.value)}
						/>
						<input
							type="text"
							placeholder="Einheit (z.B. g)"
							value={newIngredientUnit}
							onChange={(e) => setNewIngredientUnit(e.target.value)}
						/>
						<div className="select-container">
							<CreatableSelect
								options={categories.map(cat => ({ value: cat.id, label: cat.name }))}
								value={newIngredientCategory}
								onChange={setNewIngredientCategory}
								onCreateOption={handleCreateNewCategory}
								placeholder="Kategorie wählen/erstellen"
								isClearable
								formatCreateLabel={(inputValue) => `"${inputValue}" erstellen`}
							/>
						</div>
						<button onClick={handleCreateIngredient}>
							<FontAwesomeIcon icon={faPlus} /> Hinzufügen
						</button>
					</div>
					<p>Hier kannst du alle deine Zutaten bearbeiten oder löschen.</p>
					<ul className="ingredient-management-list">
						{allIngredients
							.map(ing => (
								<IngredientItem key={ing.id} ingredient={ing} categories={categories} onUpdate={handleUpdateIngredient} onDelete={handleDeleteIngredient} onCreateCategory={handleCreateNewCategory} />
							))}
					</ul>
				</div>
			</div>

			{error && <div className="floating-message-box error">{error}</div>}

		</>
	);
};

export default SettingsPage;