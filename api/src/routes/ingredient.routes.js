const express = require('express');
const router = express.Router();
const ingredientController = require('../controllers/ingredient.controller');

// Definiert die CRUD-Routen für Zutaten
router.get('/', ingredientController.getAllIngredients);
router.get('/:id', ingredientController.getIngredientById); // Allgemeine Route nach der spezifischen
router.post('/', ingredientController.createIngredient);
router.put('/:id', ingredientController.updateIngredient);
router.delete('/:id', ingredientController.deleteIngredient);

module.exports = router;