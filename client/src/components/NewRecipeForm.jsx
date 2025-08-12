import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faFloppyDisk, faPenToSquare, faCheck, faPlus } from '@fortawesome/free-solid-svg-icons';
import CreatableSelect from 'react-select/creatable';
import { createRecipe, fetchAllIngredients, createIngredient, fetchAllCategories, createCategory } from '../services/api';

const NewRecipeForm = () => {
	const navigate = useNavigate();
	const [name, setName] = useState('');
	const [instructions, setInstructions] = useState('');
	const [image, setImage] = useState(null);
	const [allIngredients, setAllIngredients] = useState([]);
	const [allCategories, setAllCategories] = useState([]);
	const [recipeIngredients, setRecipeIngredients] = useState([]);

	// State für das Zutaten-Auswahl-Modal
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [modalSelection, setModalSelection] = useState([]);
	const [searchTerm, setSearchTerm] = useState('');

	// State für das Modal zum Erstellen neuer Zutaten
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [newIngredient, setNewIngredient] = useState({ name: '', unit: '', category: '' });
	const [createModalError, setCreateModalError] = useState('');

	const [error, setError] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		const loadInitialData = async () => {
			try {
				// Lade Zutaten und Kategorien parallel für bessere Performance
				const [ingredientsData, categoriesData] = await Promise.all([
					fetchAllIngredients(),
					fetchAllCategories(),
				]);
				setAllIngredients(ingredientsData);
				// Transformiere die Kategorien in das von react-select benötigte Format
				setAllCategories(categoriesData.map(cat => ({ value: cat.id, label: cat.name })));
			} catch (err) {
				setError('Fehler beim Laden der initialen Daten.');
			}
		};
		loadInitialData();
	}, []);

	const openIngredientModal = () => {
		// Beim Öffnen des Modals wird die aktuelle Auswahl übernommen
		setModalSelection(recipeIngredients);
		setSearchTerm('');
		setIsModalOpen(true);
	};

	const handleModalToggleIngredient = (ingredient) => {
		const isSelected = modalSelection.some(sel => sel.ingredient_id === ingredient.id);
		if (isSelected) {
			setModalSelection(modalSelection.filter(sel => sel.ingredient_id !== ingredient.id));
		} else {
			setModalSelection([...modalSelection, {
				ingredient_id: ingredient.id,
				name: ingredient.name,
				amount: '', // Menge wird vom Nutzer im Modal eingetragen
				unit: ingredient.unit
			}]);
		}
	};

	const handleModalAmountChange = (ingredientId, newAmount) => {
		setModalSelection(
			modalSelection.map(sel =>
				sel.ingredient_id === ingredientId ? { ...sel, amount: newAmount } : sel
			)
		);
	};

	const handleIngredientSelectionSave = () => {
		// Übernehme nur Zutaten, für die eine Menge angegeben wurde
		const finalSelection = modalSelection.filter(ing => ing.amount && Number(ing.amount) > 0);
		setRecipeIngredients(finalSelection);
		setIsModalOpen(false);
	};

	const handleOpenCreateModal = () => {
		setNewIngredient({ name: searchTerm, unit: '', category: '' });
		setCreateModalError('');
		setIsCreateModalOpen(true);
	};

	const handleCategoryChange = (selectedOption) => {
		// `selectedOption.value` ist hier die category.id
		setNewIngredient({ ...newIngredient, category_id: selectedOption ? selectedOption.value : null });
	};

	const handleCreateCategory = async (inputValue) => {
		const newCategoryName = inputValue.trim();
		try {
			const newCategory = await createCategory(newCategoryName);
			const newOption = { value: newCategory.id, label: newCategory.name };
			setAllCategories((prev) => [...prev, newOption]);
			setNewIngredient({ ...newIngredient, category_id: newCategory.id });
		} catch (err) {
			setCreateModalError(`Konnte Kategorie nicht erstellen: ${err.message}`);
		}
	};

	const handleSaveNewIngredient = async () => {
		if (!newIngredient.name) {
			setCreateModalError('Der Name der Zutat darf nicht leer sein.');
			return;
		}
		setCreateModalError('');

		try {
			const created = await createIngredient({ name: newIngredient.name, unit: newIngredient.unit, category_id: newIngredient.category_id });
			// Füge die neue Zutat zur Hauptliste hinzu und sortiere sie neu
			setAllIngredients([...allIngredients, created].sort((a, b) => a.name.localeCompare(b.name)));
			// Füge die neue Zutat direkt zur Auswahl im Hintergrund hinzu
			handleModalToggleIngredient(created);
			// Schließe das Erstellen-Modal und setze die Suche zurück
			setIsCreateModalOpen(false);
			setSearchTerm('');
		} catch (err) {
			setCreateModalError(err.message);
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!name) {
			setError('Bitte gib einen Rezeptnamen an.');
			return;
		}
		setIsSubmitting(true);
		setError('');

		const formData = new FormData();
		formData.append('name', name);
		formData.append('instructions', instructions);
		if (image) {
			formData.append('image', image);
		}
		// Die Zutatenliste muss als JSON-String gesendet werden
		formData.append('ingredients', JSON.stringify(
			recipeIngredients.map(({ ingredient_id, amount }) => ({ ingredient_id, amount }))
		));

		try {
			const newRecipe = await createRecipe(formData);
			alert('Rezept erfolgreich erstellt!');
			navigate(`/rezepte/${newRecipe.id}`);
		} catch (err) {
			setError(err.message);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="recipe-form">
			<h1>Neues Rezept erstellen</h1>

			<label htmlFor="name">Rezeptname</label>
			<input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} required />

			<label htmlFor="image">Bild hochladen</label>
			<input type="file" id="image" accept="image/*" onChange={(e) => setImage(e.target.files[0])} />

			<label htmlFor="instructions">Zubereitung</label>
			<textarea id="instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows="10"></textarea>

			<h2>Zutaten</h2>
			<button type="button" onClick={openIngredientModal}>
				<FontAwesomeIcon icon={faPenToSquare} /> Zutaten auswählen
			</button>

			<ul className="ingredient-list">
				{recipeIngredients.length === 0 && (
					<p className="empty-list-info">Noch keine Zutaten ausgewählt.</p>
				)}
				{recipeIngredients.map(ing => (
					<li key={ing.ingredient_id}>
						<span>{ing.amount} {ing.unit} {ing.name}</span>
						<button type="button" className="remove-btn" onClick={() => handleRemoveIngredient(ing.ingredient_id)}>
							<FontAwesomeIcon icon={faTrash} />
						</button>
					</li>
				))}
			</ul>

			{error && <p className="error-message">{error}</p>}

			<button type="submit" disabled={isSubmitting}>
				<FontAwesomeIcon icon={faFloppyDisk} /> {isSubmitting ? 'Speichert...' : 'Rezept speichern'}
			</button>

			{isModalOpen && (
				<div className="modal-overlay">
					<div className="modal ingredient-modal">
						<h2>Zutaten auswählen</h2>
						<div className="modal-search-bar">
							<input
								type="text"
								placeholder="Zutat suchen..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
							/>
						</div>
						<ul className="modal-ingredient-list">
							{allIngredients
								.filter(ing => ing.name.toLowerCase().includes(searchTerm.toLowerCase()))
								.map(ingredient => {
								const selection = modalSelection.find(sel => sel.ingredient_id === ingredient.id);
								const isSelected = !!selection;
								return (
									<li key={ingredient.id} className={isSelected ? 'selected' : ''} onClick={() => handleModalToggleIngredient(ingredient)}>
										<div className="selection-indicator">
											{isSelected && <FontAwesomeIcon icon={faCheck} />}
										</div>
										<span>{ingredient.name} ({ingredient.unit || 'Stück'})</span>
										{isSelected && (
											<input
												type="number"
												className="amount-input"
												value={selection.amount}
												onChange={(e) => handleModalAmountChange(ingredient.id, e.target.value)}
												onClick={(e) => e.stopPropagation()}
												placeholder="Menge"
											/>
										)}
									</li>
								);
							})}
							{searchTerm && allIngredients.filter(ing => ing.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
								<li className="create-new-prompt" onClick={handleOpenCreateModal}>
									<FontAwesomeIcon icon={faPlus} />
									"{searchTerm}" als neue Zutat erstellen
								</li>
							)}
						</ul>

						<div className="modal-actions">
							<button type="button" onClick={handleIngredientSelectionSave}>Speichern</button>
							<button type="button" className="button-outline" onClick={() => setIsModalOpen(false)}>Abbrechen</button>
						</div>
					</div>
				</div>
			)}

			{isCreateModalOpen && (
				<div className="modal-overlay">
					<div className="modal">
						<h2>Neue Zutat erstellen</h2>

						<label htmlFor="new-ing-name">Name</label>
						<input type="text" id="new-ing-name" value={newIngredient.name} onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })} />

						<label htmlFor="new-ing-unit">Einheit (z.B. g, ml, Stück)</label>
						<input type="text" id="new-ing-unit" value={newIngredient.unit} onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })} />

						<label htmlFor="new-ing-category">Kategorie</label>
						<CreatableSelect
							isClearable
							id="new-ing-category"
							options={allCategories}
							value={allCategories.find(c => c.value === newIngredient.category_id) || null}
							onChange={handleCategoryChange}
							onCreateOption={handleCreateCategory}
							placeholder="Tippen, um zu suchen oder zu erstellen..."
							formatCreateLabel={(inputValue) => `"${inputValue}" erstellen`}
							noOptionsMessage={({ inputValue }) => `"${inputValue}" als neue Kategorie erstellen`}
						/>

						{createModalError && <p className="error-message">{createModalError}</p>}

						<div className="modal-actions">
							<button type="button" onClick={handleSaveNewIngredient}>Speichern</button>
							<button type="button" className="button-outline" onClick={() => setIsCreateModalOpen(false)}>Abbrechen</button>
						</div>
					</div>
				</div>
			)}
		</form>
	);
};

export default NewRecipeForm;