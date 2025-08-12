const db = require('../config/db');

exports.getAllRecipes = async (req, res) => {
	try {
		const [recipes] = await db.query('SELECT * FROM recipes');
		res.json(recipes);
	} catch (error) {
		res.status(500).json({ error: 'Datenbankfehler', details: error.message });
	}
};

exports.getRecipeById = async (req, res) => {
	try {
		const { id } = req.params;
		const [recipe] = await db.query('SELECT * FROM recipes WHERE id = ?', [id]);
		if (recipe.length === 0) {
			return res.status(404).json({ error: 'Rezept nicht gefunden' });
		}

		const recipeData = recipe[0];

		// Lade die zugehörigen Zutaten
		const ingredientsQuery = `
            SELECT i.id, i.name, i.unit, c.name as category, ROUND(ri.amount) as amount
            FROM recipe_ingredients ri
            JOIN ingredients i ON ri.ingredient_id = i.id
            LEFT JOIN categories c ON i.category_id = c.id
            WHERE ri.recipe_id = ?
            ORDER BY c.sort_order, i.name
        `;
		const [ingredients] = await db.query(ingredientsQuery, [id]);

		recipeData.ingredients = ingredients;
		res.json(recipeData);

	} catch (error) {
		res.status(500).json({ error: 'Datenbankfehler', details: error.message });
	}
};

exports.createRecipe = async (req, res) => {
	const connection = await db.getConnection(); // Verbindung aus dem Pool holen für die Transaktion
	try {
		// Bei multipart/form-data sind die Zutaten ein JSON-String
		const { name, instructions } = req.body;
		const ingredients = JSON.parse(req.body.ingredients || '[]');
		// Der Pfad zum Bild wird von multer in req.file bereitgestellt
		const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

		if (!name) {
			return res.status(400).json({ error: 'Name ist ein Pflichtfeld' });
		}

		await connection.beginTransaction(); // Transaktion starten

		// 1. Rezept in die 'recipes' Tabelle einfügen
		const [recipeResult] = await connection.query(
			'INSERT INTO recipes (name, instructions, image_url) VALUES (?, ?, ?)',
			[name, instructions, imageUrl]
		);
		const recipeId = recipeResult.insertId;

		// 2. Zutaten in die Verknüpfungstabelle 'recipe_ingredients' einfügen
		if (ingredients && ingredients.length > 0) {
			const recipeIngredientsValues = ingredients.map(ing => [recipeId, ing.ingredient_id, ing.amount]);
			await connection.query(
				'INSERT INTO recipe_ingredients (recipe_id, ingredient_id, amount) VALUES ?',
				[recipeIngredientsValues] // Wichtig: doppelte Klammer für Bulk-Insert
			);
		}

		await connection.commit(); // Transaktion erfolgreich abschließen
		res.status(201).json({ id: recipeId, name, instructions, ingredients, image_url: imageUrl });

	} catch (error) {
		await connection.rollback(); // Bei Fehler alles zurückrollen
		res.status(500).json({ error: 'Datenbankfehler beim Erstellen des Rezepts', details: error.message });
	} finally {
		connection.release(); // Verbindung wieder freigeben
	}
};

exports.updateRecipe = async (req, res) => {
	const connection = await db.getConnection();
	try {
		await connection.beginTransaction();

		const { id } = req.params;
		const { name, instructions, ingredients } = req.body;

		if (!name) {
			return res.status(400).json({ error: 'Name ist ein Pflichtfeld' });
		}

		// 1. Rezept-Basisdaten aktualisieren
		const [result] = await connection.query('UPDATE recipes SET name = ?, instructions = ? WHERE id = ?', [name, instructions, id]);
		if (result.affectedRows === 0) {
			await connection.rollback();
			return res.status(404).json({ error: 'Rezept nicht gefunden' });
		}

		// 2. Alte Zutatenverknüpfungen löschen
		await connection.query('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [id]);

		// 3. Neue Zutatenverknüpfungen einfügen
		if (ingredients && ingredients.length > 0) {
			const recipeIngredientsValues = ingredients.map(ing => [id, ing.ingredient_id, ing.amount]);
			await connection.query('INSERT INTO recipe_ingredients (recipe_id, ingredient_id, amount) VALUES ?', [recipeIngredientsValues]);
		}

		await connection.commit();
		res.json({ id: Number(id), name, instructions, ingredients });
	} catch (error) {
		await connection.rollback();
		res.status(500).json({ error: 'Datenbankfehler beim Aktualisieren des Rezepts', details: error.message });
	} finally {
		connection.release();
	}
};

exports.deleteRecipe = async (req, res) => {
	try {
		const { id } = req.params;
		const [result] = await db.query('DELETE FROM recipes WHERE id = ?', [id]);
		if (result.affectedRows === 0) {
			return res.status(404).json({ error: 'Rezept nicht gefunden' });
		}
		res.status(204).send(); // Kein Inhalt
	} catch (error) {
		res.status(500).json({ error: 'Datenbankfehler', details: error.message });
	}
};