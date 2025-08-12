const express = require('express');
const router = express.Router();
const multer = require('multer');
const recipeController = require('../controllers/recipe.controller');

// Multer-Konfiguration für Bild-Uploads
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, 'public/uploads/'); // Speicherort
	},
	filename: (req, file, cb) => {
		// Eindeutiger Dateiname, um Überschreibungen zu verhindern
		cb(null, Date.now() + '-' + file.originalname);
	},
});
const upload = multer({ storage: storage });

// Definiert die CRUD-Routen für Rezepte
router.get('/', recipeController.getAllRecipes);
router.get('/:id', recipeController.getRecipeById);
// Die 'upload.single('image')' Middleware verarbeitet die Datei aus dem Feld 'image'
router.post('/', upload.single('image'), recipeController.createRecipe);
router.put('/:id', recipeController.updateRecipe);
router.delete('/:id', recipeController.deleteRecipe);

module.exports = router;