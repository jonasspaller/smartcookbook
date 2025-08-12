const express = require('express');
const router = express.Router();
const shoppingListController = require('../controllers/shoppingList.controller');

// Routen für die Einkaufsliste
router.get('/', shoppingListController.getAllItems);
router.post('/from-recipes', shoppingListController.generateFromRecipes);
router.post('/', shoppingListController.addItem);
router.put('/:id', shoppingListController.updateItem);

// Spezifische Route muss vor der allgemeinen :id Route stehen
router.delete('/checked', shoppingListController.deleteCheckedItems);
router.delete('/:id', shoppingListController.deleteItem);

module.exports = router;