import * as employeesModel from "./employees.model.js";
import {
  addEmployeeService,
  getEmployeesService,
  getEmployeeService,
  getActiveEmployeesService,
} from "./employees.service.js";
import path from "path";
import fs from "fs";

export const getEmployees = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Не авторизован" });
    }

    const {
      page,
      pageSize,
      branch_id,
      department_id,
      employee_id,
      position_id,
      search,
      status,
    } = req.query;

    const result = await getEmployeesService({
      userId,
      page,
      pageSize,
      filters: {
        branch_id,
        department_id,
        employee_id,
        position_id,
        search,
        status,
      },
    });

    return res.json({ success: true, ...result });
  } catch (err) {
    console.error("Ошибка при получении сотрудников:", err);
    return res.status(500).json({
      error: "Ошибка при получении сотрудников",
      details: err.message,
    });
  }
};

export const getEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await getEmployeeService(id);

    if (!employee)
      return res.status(404).json({ error: "Сотрудник не найден" });

    res.json({ success: true, data: employee });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка при получении сотрудника" });
  }
};

export const getActiveEmployees = async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: "Не авторизован" });
  }

  try {
    const data = await getActiveEmployeesService({ userId });
    res.json({ success: true, ...data });
  } catch (err) {
    console.error("Error in getActiveEmployees:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const addEmployee = async (req, res) => {
  try {
    const result = await addEmployeeService(req);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    console.error("Ошибка при добавлении сотрудника:", err);
    res.status(500).json({
      error: err.message || "Ошибка при добавлении сотрудника",
    });
  }
};

export const editEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const raw = { ...req.body };

    delete raw.id;

    if (req.file) {
      const ext = path.extname(req.file.originalname);
      const newFileName = `${raw.last_name}_${raw.first_name}_${id}${ext}`;
      const newPath = path.join(req.file.destination, newFileName);

      fs.renameSync(req.file.path, newPath);

      raw.photo = `/api/uploads/employees/${newFileName}`;
    }

    Object.keys(raw).forEach((k) => {
      if (raw[k] === "") delete raw[k];
    });

    const data = {};

    if (raw.employee_number !== undefined)
      data.employee_number = Number(raw.employee_number);

    const scalarFields = [
      "first_name",
      "last_name",
      "middle_name",
      "gender",
      "passport",
      "pinfl",
      "education",
      "phone",
      "email",
      "order_number",
      "address",
      "education_specialty",
      "photo",
    ];
    scalarFields.forEach((f) => {
      if (raw[f] !== undefined) data[f] = raw[f];
    });

    if (raw.date_of_birth !== undefined)
      data.date_of_birth = new Date(raw.date_of_birth);
    if (raw.document_validity_period !== undefined)
      data.document_validity_period = new Date(raw.document_validity_period);

    if (raw.status !== undefined) {
      if (raw.status === "true" || raw.status === "active") data.status = true;
      else if (raw.status === "false" || raw.status === "inactive")
        data.status = false;
      else data.status = Boolean(raw.status);
    }

    if (raw.branch_id !== undefined) {
      data.branch = { connect: { id: Number(raw.branch_id) } };
    }

    if (raw.department_id !== undefined) {
      data.department = { connect: { id: Number(raw.department_id) } };
    }

    if (raw.position_id !== undefined) {
      data.position = { connect: { id: Number(raw.position_id) } };
    }

    if (raw.door_id !== undefined) {
      data.door = { connect: { id: Number(raw.door_id) } };
    }

    if (raw.work_schedule_id !== undefined) {
      data.workSchedule = { connect: { id: Number(raw.work_schedule_id) } };
    }

    const updated = await employeesModel.editEmployee(id, data);

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error("Ошибка при обновлении сотрудника:", err);
    res
      .status(500)
      .json({ error: err.message || "Ошибка при обновлении сотрудника" });
  }
};

export const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await employeesModel.deleteEmployee(id);
    res.json({ success: true, data: deleted });
  } catch (err) {
    console.error(err);
    res
      .status(400)
      .json({ error: err.message || "Ошибка при удалении сотрудника" });
  }
};
