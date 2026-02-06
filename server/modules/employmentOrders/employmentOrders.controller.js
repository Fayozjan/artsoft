import * as service from "./employmentOrders.service.js";

export const getEmploymentOrders = async (req, res) => {
  try {
    const result = await service.getEmploymentOrders({
      userId: req.user.id,
      page: req.query.page,
      pageSize: req.query.pageSize,
      filters: req.query.filters,
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка при получении приказов" });
  }
};

export const getEmploymentOrdersByEmployeeId = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "employeeId обязателен" });
    }

    const result = await service.getEmploymentOrdersByEmployeeId({
      userId: req.user.id,
      employeeId: id,
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка при поиске приказов по сотруднику" });
  }
};

export const getEmploymentOrderById = async (req, res) => {
  const data = await service.getEmploymentOrderById(req.params.id);
  if (!data) return res.status(404).json({ error: "Приказ не найден" });

  res.json({ success: true, data });
};

export const createEmploymentOrder = async (req, res) => {
  const data = await service.createEmploymentOrder(req.body);
  res.status(201).json({ success: true, data });
};

export const updateEmploymentOrder = async (req, res) => {
  const data = await service.updateEmploymentOrder(req.params.id, req.body);
  res.json({ success: true, data });
};

export const deleteEmploymentOrder = async (req, res) => {
  try {
    const result = await service.deleteEmploymentOrder(
      req.user.id,
      req.params.id,
    );

    if (result?.status) {
      return res.status(result.status).json({
        success: false,
        message: result.message,
      });
    }

    return res.json({
      success: true,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message || "Ошибка при удалении приказа",
    });
  }
};
