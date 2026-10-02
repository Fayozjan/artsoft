import { ProductsService } from "./products.service.js";

export const ProductsController = {
  getAll: async (req, res) => {
    try {
      const filters =
        typeof req.query.filters === "string"
          ? JSON.parse(req.query.filters)
          : req.query.filters || {};

      const result = await ProductsService.getProducts({
        page: req.query.page,
        pageSize: req.query.pageSize,
        filters,
      });

      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при получении товаров:", err);
      res.status(500).json({ error: "Ошибка при получении товаров" });
    }
  },

  getActive: async (req, res) => {
    try {
      const result = await ProductsService.getActiveProducts();
      res.json({ success: true, data: result });
    } catch (err) {
      console.error("Ошибка при получении активных товаров:", err);
      res.status(500).json({ error: "Ошибка при получении товаров" });
    }
  },

  getById: async (req, res) => {
    try {
      const data = await ProductsService.getProductById(req.params.id);
      if (!data) return res.status(404).json({ error: "Товар не найден" });
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при получении товара:", err);
      res.status(500).json({ error: "Ошибка при получении товара" });
    }
  },

  create: async (req, res) => {
    try {
      const result = await ProductsService.addProduct(req.body, req.user?.id);
      res.status(201).json({ success: true, result });
    } catch (err) {
      console.error("Ошибка при добавлении товара:", err);
      if (err.code === "P2002")
        return res.status(409).json({ error: "Товар с таким штрихкодом уже существует!" });
      res.status(500).json({ error: "Ошибка при добавлении товара" });
    }
  },

  update: async (req, res) => {
    try {
      const result = await ProductsService.editProductById(req.params.id, req.body, req.user?.id);
      res.json({ success: true, result });
    } catch (err) {
      console.error("Ошибка при обновлении товара:", err);
      if (err.code === "P2025")
        return res.status(404).json({ error: "Товар не найден" });
      if (err.code === "P2002")
        return res.status(409).json({ error: "Товар с таким штрихкодом уже существует!" });
      res.status(500).json({ error: "Ошибка при обновлении товара" });
    }
  },

  remove: async (req, res) => {
    try {
      const deleted = await ProductsService.deleteProductById(req.params.id, req.user?.id);
      if (!deleted) return res.status(404).json({ error: "Товар не найден" });
      res.json({ success: true, data: deleted });
    } catch (err) {
      console.error("Ошибка при удалении товара:", err);
      if (err.code === "P2003")
        return res.status(409).json({ error: "Товар используется в складских документах" });
      res.status(500).json({ error: "Ошибка при удалении товара" });
    }
  },
};
