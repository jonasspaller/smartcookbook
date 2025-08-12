import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { fetchRecipes } from '../services/api';

const RecipeList = () => {
	const [recipes, setRecipes] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		const loadRecipes = async () => {
			try {
				setLoading(true);
				const data = await fetchRecipes();
				setRecipes(data);
				setError(null);
			} catch (err) {
				setError('Fehler beim Laden der Rezepte. Läuft der API-Server?');
				console.error(err);
			} finally {
				setLoading(false);
			}
		};

		loadRecipes();
	}, []); // Der leere Array sorgt dafür, dass der Effekt nur einmal beim Mounten ausgeführt wird.

	if (loading) {
		return <div>Lade Rezepte...</div>;
	}

	if (error) {
		return <div style={{ color: 'red' }}>{error}</div>;
	}

	return (
		<div className="recipe-list-container">
			<h1>Alle Rezepte</h1>
			<div className="list-header-actions">
				<Link to="/rezepte/neu" className="button" role="button">
					<FontAwesomeIcon icon={faPlus} /> Neues Rezept hinzufügen
				</Link>
			</div>
			<ul className="recipe-grid">
				{recipes.map((recipe) => (
					<li key={recipe.id} className="recipe-card">
						<Link to={`/rezepte/${recipe.id}`}>
							<img src={recipe.image_url || 'https://via.placeholder.com/300x180.png?text=Kein+Bild'} alt={recipe.name} className="recipe-card-image" />
							<div className="recipe-card-title">
								{recipe.name}
							</div>
						</Link>
					</li>
				))}
			</ul>
		</div>
	);
};

export default RecipeList;