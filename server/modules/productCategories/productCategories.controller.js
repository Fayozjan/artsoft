import { ProductCategoriesService } from "./productCategories.service.js";

export const ProductCategoriesController = {
  getAll: async (req, res) => {
    try {
      const filters =
        typeof req.query.filters === "string"
          ? JSON.parse(req.query.filters)
          : req.query.filters || {};

      const result = await ProductCategoriesService.getProductCategories({
        page: req.query.page,
        pageSize: req.query.pageSize,
        filters,
      });

      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при получении категорий товаров:", err);
      res.status(500).json({ error: "Ошибка при получении категорий товаров" });
    }
  },

  getActive: async (req, res) => {
    try {
      const result = await ProductCategoriesService.getActiveProductCategories();
      res.json({ success: true, data: result });
    } catch (err) {
      console.error("Ошибка при получении активных категорий товаров:", err);
      res.status(500).json({ error: "Ошибка при получении категорий товаров" });
    }
  },

  getById: async (req, res) => {
    try {
      const data = await ProductCategoriesService.getProductCategoryById(req.params.id);
      if (!data) return res.status(404).json({ error: "Категория не найдена" });
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при получении категории товара:", err);
      res.status(500).json({ error: "Ошибка при получении категории товара" });
    }
  },

  create: async (req, res) => {
    try {
      const result = await ProductCategoriesService.addProductCategory(req.body, req.user?.id);
      res.status(201).json({ success: true, result });
    } catch (err) {
      console.error("Ошибка при добавлении категории товара:", err);
      res.status(500).json({ error: err.message || "Ошибка при добавлении категории товара" });
    }
  },

  update: async (req, res) => {
    try {
      const result = await ProductCategoriesService.editProductCategoryById(req.params.id, req.body, req.user?.id);
      res.json({ success: true, result });
    } catch (err) {
      console.error("Ошибка при обновлении категории товара:", err);
      if (err.code === "P2025")
        return res.status(404).json({ error: "Категория не найдена" });
      res.status(500).json({ error: err.message || "Ошибка при обновлении категории товара" });
    }
  },

  remove: async (req, res) => {
    try {
      const deleted = await ProductCategoriesService.deleteProductCategoryById(req.params.id, req.user?.id);
      if (!deleted) return res.status(404).json({ error: "Категория не найдена" });
      res.json({ success: true, data: deleted });
    } catch (err) {
      console.error("Ошибка при удалении категории товара:", err);
      if (err.code === "P2003")
        return res.status(409).json({ error: "Категория используется товарами или подкатегориями" });
      res.status(500).json({ error: "Ошибка при удалении категории товара" });
    }
  },
};
