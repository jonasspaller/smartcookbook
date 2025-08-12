import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { fetchRecipeById } from '../services/api';

const RecipeDetail = () => {
	const { id } = useParams(); // Holt die ID aus der URL (z.B. von /rezepte/1)
	const [recipe, setRecipe] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		const loadRecipe = async () => {
			try {
				setLoading(true);
				const data = await fetchRecipeById(id);
				setRecipe(data);
				setError(null);
			} catch (err) {
				setError('Fehler beim Laden des Rezepts.');
				console.error(err);
			} finally {
				setLoading(false);
			}
		};

		loadRecipe();
	}, [id]); // Effekt erneut ausführen, wenn sich die ID in der URL ändert

	if (loading) {
		return <div>Lade Rezept...</div>;
	}

	if (error) {
		return <div style={{ color: 'red' }}>{error}</div>;
	}

	if (!recipe) {
		return null; // Oder eine "Nicht gefunden"-Nachricht
	}

	return (
		<article className="recipe-detail">
			<div className="recipe-header">
				<Link to="/" className="back-button" role="button">
					<FontAwesomeIcon icon={faArrowLeft} /> Zurück
				</Link>

				{recipe.image_url && (
					<img src={recipe.image_url} alt={recipe.name} className="recipe-image" />
				)}

				<h1>{recipe.name}</h1>
			</div>

			<div className="recipe-content">
				<section>
					<h2>Zutaten</h2>
					<ul>
						{recipe.ingredients.map((ingredient) => (
							<li key={ingredient.id}>
								{ingredient.amount} {ingredient.unit} {ingredient.name}
							</li>
						))}
					</ul>
				</section>

				<section>
					<h2>Zubereitung</h2>
					<p style={{ whiteSpace: 'pre-wrap' }}>{recipe.instructions}</p>
				</section>
			</div>
		</article>
	);
};

export default RecipeDetail;