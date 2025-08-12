import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { fetchShoppingList, updateShoppingListItem, deleteCheckedItems } from '../services/api';
import { socket } from '../services/socket';

const ShoppingListPage = () => {
	const [items, setItems] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	const loadItems = useCallback(async () => {
		try {
			const data = await fetchShoppingList();
			setItems(data);
			setError(null);
		} catch (err) {
			setError('Fehler beim Laden der Einkaufsliste.');
			console.error(err);
		}
	}, []);

	useEffect(() => {
		// Initiales Laden der Daten mit Ladeanzeige
		setLoading(true);
		loadItems().finally(() => setLoading(false));

		// Socket.IO-Verbindung aufbauen und auf Events lauschen
		socket.connect();

		const onShoppingListUpdated = () => {
			console.log('Event "shopping_list_updated" empfangen. Lade Liste neu...');
			loadItems(); // Liste im Hintergrund neu laden
		};

		socket.on('shopping_list_updated', onShoppingListUpdated);

		// Aufräumfunktion: Beim Verlassen der Komponente die Verbindung trennen
		return () => {
			console.log('Effekt-Cleanup für ShoppingListPage. Trenne Socket-Verbindung.');
			socket.off('shopping_list_updated', onShoppingListUpdated);
			socket.disconnect();
		};
	}, [loadItems]);

	const handleToggleItem = async (itemToToggle) => {
		const originalItems = [...items];
		// Optimistic update
		const updatedItems = items.map(item =>
			item.id === itemToToggle.id ? { ...item, is_checked: !item.is_checked } : item
		);
		setItems(updatedItems);

		try {
			await updateShoppingListItem(itemToToggle.id, { is_checked: !itemToToggle.is_checked });
		} catch (err) {
			setError('Fehler beim Aktualisieren des Eintrags.');
			setItems(originalItems); // Revert on error
		}
	};

	const handleDeleteChecked = async () => {
		const originalItems = [...items];
		const itemsToKeep = items.filter(item => !item.is_checked);
		setItems(itemsToKeep); // Optimistic update

		try {
			await deleteCheckedItems();
		} catch (err) {
			setError('Fehler beim Löschen der abgehakten Einträge.');
			setItems(originalItems); // Revert on error
		}
	};

	const groupedItems = useMemo(() => {
		return items.reduce((acc, item) => {
			const category = item.category || 'Sonstiges';
			if (!acc[category]) {
				acc[category] = [];
			}
			acc[category].push(item);
			return acc;
		}, {});
	}, [items]);

	if (loading) return <div>Lade Einkaufsliste...</div>;
	if (error) return <div style={{ color: 'red' }}>{error}</div>;

	return (
		<div className="shopping-list-page">
			<h1>Einkaufsliste</h1>
			{items.length === 0 ? (
				<p className="empty-list-info">Deine Einkaufsliste ist leer. Erstelle eine im Wochenplaner!</p>
			) : (
				<>
					<div className="shopping-list">
						{Object.entries(groupedItems).map(([category, categoryItems]) => (
							<div key={category} className="shopping-list-category">
								<h2>{category}</h2>
								<ul>
									{categoryItems.map(item => (
										<li key={item.id} className={`shopping-list-item ${item.is_checked ? 'checked' : ''}`} onClick={() => handleToggleItem(item)}>
											<input type="checkbox" checked={item.is_checked} readOnly />
											<span className="item-details">
												<span className="item-amount">{item.amount} {item.unit}</span>
												<span className="item-name">{item.name}</span>
											</span>
										</li>
									))}
								</ul>
							</div>
						))}
					</div>
					<div className="page-actions">
						<button onClick={handleDeleteChecked} className="button-outline">
							<FontAwesomeIcon icon={faTrash} /> Abgehakte löschen
						</button>
					</div>
				</>
			)}
		</div>
	);
};

export default ShoppingListPage;