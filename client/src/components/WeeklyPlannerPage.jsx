import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchRecipes, generateShoppingList } from '../services/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShoppingCart, faMinus } from '@fortawesome/free-solid-svg-icons';

const WeeklyPlannerPage = () => {
	const navigate = useNavigate();
	const [recipes, setRecipes] = useState([]);
	const [selectedRecipes, setSelectedRecipes] = useState([]); // Use an array to allow duplicates
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [isGenerating, setIsGenerating] = useState(false);

	useEffect(() => {
		const loadRecipes = async () => {
			try {
				setLoading(true);
				const data = await fetchRecipes();
				setRecipes(data);
			} catch (err) {
				setError('Fehler beim Laden der Rezepte.');
			} finally {
				setLoading(false);
			}
		};
		loadRecipes();
	}, []);

	const handleAddRecipe = (recipeId) => {
		setSelectedRecipes([...selectedRecipes, recipeId]);
	};

	const handleRemoveRecipe = (e, recipeId) => {
		e.stopPropagation(); // Verhindert, dass handleAddRecipe durch das Klicken auf den Button ausgelöst wird
		const index = selectedRecipes.lastIndexOf(recipeId); // Finde den letzten Eintrag dieser ID
		if (index > -1) {
			const newSelection = [...selectedRecipes];
			newSelection.splice(index, 1);
			setSelectedRecipes(newSelection);
		}
	};

	const handleGenerateList = async () => {
		setIsGenerating(true);
		try {
			// Das selectedRecipes-Array kann direkt übergeben werden
			await generateShoppingList(selectedRecipes);
			setSelectedRecipes([]); // Auswahl nach erfolgreicher Generierung zurücksetzen
			navigate('/einkaufsliste');
		} catch (err) {
			setError('Einkaufsliste konnte nicht erstellt werden.');
		} finally {
			setIsGenerating(false);
		}
	};

	if (loading) return <div>Lade Rezepte...</div>;
	if (error) return <div style={{ color: 'red' }}>{error}</div>;

	return (
		<div className="weekly-planner">
			<h1>Wochenplaner</h1>
			<p>Wähle die Rezepte aus, für die du einkaufen möchtest.</p>
			<ul className="recipe-grid">
				{recipes.map((recipe) => {
					const count = selectedRecipes.filter(id => id === recipe.id).length;
					const isSelected = count > 0;
					return (
						<li key={recipe.id} className={`recipe-card selectable ${isSelected ? 'selected' : ''}`} onClick={() => handleAddRecipe(recipe.id)}>
							{isSelected && (
								<>
									<div className="recipe-counter-badge">{count}</div>
									<button className="remove-recipe-btn" onClick={(e) => handleRemoveRecipe(e, recipe.id)} title="Einmal entfernen">
										<FontAwesomeIcon icon={faMinus} />
									</button>
								</>
							)}
							<img src={recipe.image_url || 'https://via.placeholder.com/300x180.png?text=Kein+Bild'} alt={recipe.name} className="recipe-card-image" />
							<div className="recipe-card-title">{recipe.name}</div>
						</li>
					);
				})}
			</ul>
			{selectedRecipes.length > 0 && (
				<div className="page-actions">
					<button onClick={handleGenerateList} disabled={isGenerating}>
						<FontAwesomeIcon icon={faShoppingCart} /> {isGenerating ? 'Generiere...' : `Einkaufsliste für ${selectedRecipes.length} Mahlzeit(en) erstellen`}
					</button>
				</div>
			)}
		</div>
	);
};

export default WeeklyPlannerPage;