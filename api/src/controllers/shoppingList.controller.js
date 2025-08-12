const db = require('../config/db');

// GET /api/einkaufsliste
// Holt alle Einträge und verbindet sie mit den Zutaten-Namen und Einheiten.
exports.getAllItems = async (req, res) => {
	try {
		const query = `
      SELECT 
        sli.id, 
        ROUND(sli.amount) as amount, 
        sli.is_checked, 
        i.name, 
        c.name as category,
        COALESCE(sli.unit, i.unit) as unit,
        sli.ingredient_id
      FROM shopping_list_items sli
      JOIN ingredients i ON sli.ingredient_id = i.id
      LEFT JOIN categories c ON i.category_id = c.id
      ORDER BY c.sort_order, i.name
    `;
		const [items] = await db.query(query);
		res.json(items);
	} catch (error) {
		res.status(500).json({ error: 'Datenbankfehler', details: error.message });
	}
};

// POST /api/einkaufsliste
// Fügt einen neuen Eintrag hinzu oder aktualisiert den Betrag, wenn die Zutat bereits existiert.
exports.addItem = async (req, res) => {
	try {
		const { ingredient_id, amount, unit } = req.body;
		if (!ingredient_id || amount === undefined) {
			return res.status(400).json({ error: 'ingredient_id und amount sind Pflichtfelder' });
		}

		// Prüfen, ob die Zutat bereits auf der Liste ist
		const [existingItems] = await db.query('SELECT * FROM shopping_list_items WHERE ingredient_id = ?', [ingredient_id]);

		if (existingItems.length > 0) {
			// Zutat existiert, Betrag aktualisieren und Haken entfernen
			const existingItem = existingItems[0];
			const newAmount = Number(existingItem.amount) + Number(amount);
			await db.query('UPDATE shopping_list_items SET amount = ?, is_checked = FALSE WHERE id = ?', [newAmount, existingItem.id]);
			res.json({ id: existingItem.id, ingredient_id, amount: newAmount, unit });
		} else {
			// Zutat ist neu, einfügen
			const [result] = await db.query(
				'INSERT INTO shopping_list_items (ingredient_id, amount, unit) VALUES (?, ?, ?)',
				[ingredient_id, amount, unit]
			);
			res.status(201).json({ id: result.insertId, ingredient_id, amount, unit });
		}
	} catch (error) {
		res.status(500).json({ error: 'Datenbankfehler', details: error.message });
	}
};

// PUT /api/einkaufsliste/:id
// Aktualisiert einen Eintrag (z.B. Betrag ändern oder abhaken)
exports.updateItem = async (req, res) => {
	try {
		const { id } = req.params;
		const { amount, is_checked } = req.body;

		if (amount === undefined && is_checked === undefined) {
			return res.status(400).json({ error: 'Es muss entweder "amount" oder "is_checked" angegeben werden.' });
		}

		// Dynamischer Aufbau der Query, um nur die übergebenen Felder zu aktualisieren.
		// Das verhindert, dass z.B. der Betrag auf NULL gesetzt wird, wenn nur "is_checked" übergeben wird.
		const updateFields = [];
		const queryParams = [];

		if (amount !== undefined) {
			updateFields.push('amount = ?');
			queryParams.push(amount);
		}
		if (is_checked !== undefined) {
			updateFields.push('is_checked = ?');
			queryParams.push(is_checked);
		}

		if (updateFields.length === 0) {
			// Sollte durch die Prüfung oben nicht passieren, aber als Sicherheitsnetz.
			return res.status(400).json({ error: 'Keine gültigen Felder zum Aktualisieren angegeben.' });
		}

		queryParams.push(id); // ID für die WHERE-Klausel hinzufügen

		const query = `UPDATE shopping_list_items SET ${updateFields.join(', ')} WHERE id = ?`;

		const [result] = await db.query(query, queryParams);
		if (result.affectedRows === 0) {
			return res.status(404).json({ error: 'Eintrag nicht gefunden' });
		}
		req.io.emit('shopping_list_updated'); // Event an alle Clients senden
		res.json({ message: 'Eintrag aktualisiert' });
	} catch (error) {
		res.status(500).json({ error: 'Datenbankfehler', details: error.message });
	}
};

// DELETE /api/einkaufsliste/:id
// Löscht einen einzelnen Eintrag
exports.deleteItem = async (req, res) => {
	try {
		const { id } = req.params;
		const [result] = await db.query('DELETE FROM shopping_list_items WHERE id = ?', [id]);
		if (result.affectedRows === 0) {
			return res.status(404).json({ error: 'Eintrag nicht gefunden' });
		}
		res.status(204).send();
	} catch (error) {
		res.status(500).json({ error: 'Datenbankfehler', details: error.message });
	}
};

// DELETE /api/einkaufsliste/checked
// Löscht alle abgehakten Einträge
exports.deleteCheckedItems = async (req, res) => {
	try {
		await db.query('DELETE FROM shopping_list_items WHERE is_checked = TRUE');
		req.io.emit('shopping_list_updated'); // Event an alle Clients senden
		res.status(204).send();
	} catch (error) {
		res.status(500).json({ error: 'Datenbankfehler', details: error.message });
	}
};

// POST /api/einkaufsliste/from-recipes
// Erstellt eine neue Einkaufsliste basierend auf ausgewählten Rezepten.
exports.generateFromRecipes = async (req, res) => {
	const { recipeIds } = req.body;
	if (!Array.isArray(recipeIds) || recipeIds.length === 0) {
		return res.status(400).json({ error: 'Ein Array von recipeIds wird erwartet.' });
	}

	const connection = await db.getConnection();
	try {
		// 1. Zähle, wie oft jedes Rezept ausgewählt wurde.
		const recipeCounts = recipeIds.reduce((acc, id) => {
			acc[id] = (acc[id] || 0) + 1;
			return acc;
		}, {}); // Ergibt z.B. { '1': 2, '5': 1 }

		const uniqueRecipeIds = Object.keys(recipeCounts);

		await connection.beginTransaction();

		// 2. Hole die Zutaten für die (einzigartigen) ausgewählten Rezepte.
		const [recipeIngredients] = await connection.query(
			`SELECT recipe_id, ingredient_id, amount 
             FROM recipe_ingredients
             WHERE recipe_id IN (?)`,
			[uniqueRecipeIds]
		);

		// 3. Berechne die Gesamtmenge für jede Zutat in JavaScript.
		const totalIngredients = recipeIngredients.reduce((acc, ing) => {
			const count = recipeCounts[ing.recipe_id]; // Wie oft wurde das Rezept gewählt?
			const totalAmount = ing.amount * count; // Gesamtmenge berechnen
			acc[ing.ingredient_id] = (acc[ing.ingredient_id] || 0) + totalAmount;
			return acc;
		}, {}); // Ergibt z.B. { '101': 200, '102': 50 }

		// 4. Bestehende Einträge aktualisieren oder neue hinzufügen (Upsert).
		// WICHTIG: Dies erfordert einen UNIQUE Index auf der `ingredient_id` Spalte in `shopping_list_items`.
		if (Object.keys(totalIngredients).length > 0) {
			const upsertPromises = Object.entries(totalIngredients).map(([ingredient_id, amount_to_add]) => {
				const query = `
                    INSERT INTO shopping_list_items (ingredient_id, amount, is_checked)
                    VALUES (?, ?, FALSE)
                    ON DUPLICATE KEY UPDATE amount = amount + VALUES(amount), is_checked = FALSE
                `;
				return connection.query(query, [ingredient_id, amount_to_add]);
			});
			await Promise.all(upsertPromises);
		}

		await connection.commit();
		req.io.emit('shopping_list_updated'); // Event an alle Clients senden
		res.status(201).json({ message: 'Einkaufsliste erfolgreich aktualisiert.' });
	} catch (error) {
		await connection.rollback();
		res.status(500).json({ error: 'Datenbankfehler beim Erstellen der Einkaufsliste.', details: error.message });
	} finally {
		connection.release();
	}
};