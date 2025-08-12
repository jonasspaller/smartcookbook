const db = require('../config/db');

// GET /api/zutaten
exports.getAllIngredients = async (req, res) => {
	try {
		const query = `
			SELECT i.id, i.name, i.unit, c.name as category, i.category_id
			FROM ingredients i
			LEFT JOIN categories c ON i.category_id = c.id
			ORDER BY c.sort_order, i.name
		`;
		const [ingredients] = await db.query(query);
		res.json(ingredients);
	} catch (error) {
		res.status(500).json({ error: 'Datenbankfehler', details: error.message });
	}
};

// GET /api/zutaten/:id
exports.getIngredientById = async (req, res) => {
	try {
		const { id } = req.params;
		const query = `
			SELECT i.id, i.name, i.unit, c.name as category, i.category_id
			FROM ingredients i
			LEFT JOIN categories c ON i.category_id = c.id
			WHERE i.id = ?
		`;
		const [ingredient] = await db.query(query, [id]);
		if (ingredient.length === 0) {
			return res.status(404).json({ error: 'Zutat nicht gefunden' });
		}
		res.json(ingredient[0]);
	} catch (error) {
		res.status(500).json({ error: 'Datenbankfehler', details: error.message });
	}
};

// POST /api/zutaten
exports.createIngredient = async (req, res) => {
	try {
		const { name, unit, category_id } = req.body;
		if (!name) {
			return res.status(400).json({ error: 'Name ist ein Pflichtfeld' });
		}
		const [result] = await db.query('INSERT INTO ingredients (name, unit, category_id) VALUES (?, ?, ?)', [name, unit, category_id]);
		res.status(201).json({ id: result.insertId, name, unit, category_id });
	} catch (error) {
		if (error.code === 'ER_DUP_ENTRY') {
			return res.status(409).json({ error: 'Eine Zutat mit diesem Namen existiert bereits.' });
		}
		res.status(500).json({ error: 'Datenbankfehler', details: error.message });
	}
};

// PUT /api/zutaten/:id
exports.updateIngredient = async (req, res) => {
	try {
		const { id } = req.params;
		const { name, unit, category_id } = req.body;
		if (!name) {
			return res.status(400).json({ error: 'Name ist ein Pflichtfeld' });
		}
		const [result] = await db.query('UPDATE ingredients SET name = ?, unit = ?, category_id = ? WHERE id = ?', [name, unit, category_id, id]);
		if (result.affectedRows === 0) {
			return res.status(404).json({ error: 'Zutat nicht gefunden' });
		}
		res.json({ id: Number(id), name, unit, category_id });
	} catch (error) {
		if (error.code === 'ER_DUP_ENTRY') {
			return res.status(409).json({ error: 'Eine andere Zutat mit diesem Namen existiert bereits.' });
		}
		res.status(500).json({ error: 'Datenbankfehler', details: error.message });
	}
};

// DELETE /api/zutaten/:id
exports.deleteIngredient = async (req, res) => {
	const connection = await db.getConnection();
	try {
		const { id } = req.params;

		// 1. Prüfen, ob die Zutat in Rezepten verwendet wird
		const [[{ count }]] = await connection.query('SELECT COUNT(*) as count FROM recipe_ingredients WHERE ingredient_id = ?', [id]);

		if (count > 0) {
			return res.status(409).json({
				error: `Diese Zutat wird noch in ${count} Rezept(en) verwendet und kann nicht gelöscht werden.`,
			});
		}

		// 2. Zutat löschen
		const [result] = await connection.query('DELETE FROM ingredients WHERE id = ?', [id]);
		if (result.affectedRows === 0) {
			return res.status(404).json({ error: 'Zutat nicht gefunden' });
		}
		res.status(204).send(); // Kein Inhalt
	} catch (error) {
		res.status(500).json({ error: 'Datenbankfehler beim Löschen der Zutat.', details: error.message });
	} finally {
		if (connection) connection.release();
	}
};