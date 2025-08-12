const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');

// Routen für Kategorien
router.get('/', categoryController.getAllCategories);
router.post('/', categoryController.createCategory);
router.put('/order', categoryController.updateCategoryOrder);
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;
