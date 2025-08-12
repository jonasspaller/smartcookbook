const db = require('../config/db');

// GET /api/categories
exports.getAllCategories = async (req, res) => {
	try {
		const [categories] = await db.query('SELECT * FROM categories ORDER BY sort_order');
		res.json(categories);
	} catch (error) {
		res.status(500).json({ error: 'Datenbankfehler', details: error.message });
	}
};

// POST /api/categories
exports.createCategory = async (req, res) => {
	const connection = await db.getConnection();
	try {
		const { name } = req.body;
		if (!name) {
			return res.status(400).json({ error: 'Name ist ein Pflichtfeld' });
		}

		await connection.beginTransaction();
		// Finde die höchste existierende sort_order
		const [[{ max_sort_order }]] = await connection.query('SELECT MAX(sort_order) as max_sort_order FROM categories');
		const newSortOrder = (max_sort_order || 0) + 1;

		const [result] = await connection.query(
			'INSERT INTO categories (name, sort_order) VALUES (?, ?)',
			[name, newSortOrder]
		);

		await connection.commit();
		res.status(201).json({ id: result.insertId, name, sort_order: newSortOrder });
	} catch (error) {
		await connection.rollback();
		if (error.code === 'ER_DUP_ENTRY') {
			return res.status(409).json({ error: 'Eine Kategorie mit diesem Namen existiert bereits.' });
		}
		res.status(500).json({ error: 'Datenbankfehler', details: error.message });
	} finally {
		connection.release();
	}
};

// PUT /api/categories/order
exports.updateCategoryOrder = async (req, res) => {
	const { orderedIds } = req.body; // Erwartet ein Array von Kategorie-IDs
	if (!Array.isArray(orderedIds)) {
		return res.status(400).json({ error: 'Ein Array von IDs wird erwartet.' });
	}

	const connection = await db.getConnection();
	try {
		await connection.beginTransaction();

		// Erstellt eine Serie von UPDATE-Befehlen, die nacheinander ausgeführt werden
		const updatePromises = orderedIds.map((id, index) => {
			return connection.query('UPDATE categories SET sort_order = ? WHERE id = ?', [index, id]);
		});

		await Promise.all(updatePromises);

		await connection.commit();
		res.json({ message: 'Sortierreihenfolge erfolgreich aktualisiert.' });
	} catch (error) {
		await connection.rollback();
		res.status(500).json({ error: 'Datenbankfehler beim Aktualisieren der Sortierreihenfolge.', details: error.message });
	} finally {
		connection.release();
	}
};

// DELETE /api/categories/:id
exports.deleteCategory = async (req, res) => {
	const { id } = req.params;
	const connection = await db.getConnection();
	try {
		await connection.beginTransaction();

		// 1. Prüfen, ob die Kategorie noch von Zutaten verwendet wird.
		const [[{ count }]] = await connection.query('SELECT COUNT(*) as count FROM ingredients WHERE category_id = ?', [id]);

		if (count > 0) {
			// Kategorie ist noch in Gebrauch, Löschen verhindern.
			await connection.rollback();
			return res.status(409).json({
				error: `Diese Kategorie wird noch von ${count} Zutat(en) verwendet und kann nicht gelöscht werden.`,
			});
		}

		// 2. Kategorie ist nicht in Gebrauch, also löschen.
		const [result] = await connection.query('DELETE FROM categories WHERE id = ?', [id]);

		if (result.affectedRows === 0) {
			await connection.rollback();
			return res.status(404).json({ error: 'Kategorie nicht gefunden.' });
		}

		await connection.commit();
		res.status(204).send(); // Erfolgreich, kein Inhalt
	} catch (error) {
		await connection.rollback();
		res.status(500).json({ error: 'Datenbankfehler beim Löschen der Kategorie.', details: error.message });
	} finally {
		connection.release();
	}
};
