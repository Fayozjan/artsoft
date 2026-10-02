import ExcelJS from "exceljs";
import JSZip from "jszip";
import { UserModel } from "../users/users.model.js";
import { buildDepartmentAccess } from "./departments.helpers.js";
import { DepartmentsModel } from "./departments.model.js";
import { createAuditLog } from "../../utils/auditLog.js";
import { prismaContext } from "../../utils/prismaContext.js";

export const DepartmentsService = {
  getDepartments: async ({ userId, page = 1, pageSize = 20, filters }) => {
    const user = await UserModel.getById(Number(userId));
    if (!user) throw new Error("Пользователь не найден");

    const where = buildDepartmentAccess(user);

    if (filters?.search)
      where.name = { contains: filters.search, mode: "insensitive" };
    if (filters?.branch_id) where.branch_id = Number(filters.branch_id);
    if (filters?.status !== undefined && filters.status !== "")
      where.status = filters.status === "true";

    const skip = (page - 1) * pageSize;

    const records = await DepartmentsModel.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        branch: true,
        _count: { select: { employees: true } },
      },
    });

    const totalItems = await DepartmentsModel.count(where);

    const data = records.map((d) => ({
      id: d.id,
      name: d.name,
      status: d.status,
      branch: d.branch,
      employees_count: d._count.employees,
    }));

    return {
      data,
      pagination: {
        totalItems,
        currentPage: page,
        pageSize,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  },

  getActiveDepartments: async ({ userId }) => {
    const user = await UserModel.getById(Number(userId));
    if (!user) throw new Error("Пользователь не найден");

    const where = buildDepartmentAccess(user);
    where.status = true;

    const records = await DepartmentsModel.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        _count: { select: { employees: { where: { status: true } } } },
      },
    });

    const data = records.map((d) => ({
      id: d.id,
      name: d.name,
      status: d.status,
      branchId: d.branch_id,
      branchName: d.branch?.name || null,
      activeEmployeesCount: d._count.employees,
    }));

    return { data };
  },

  getDepartmentById: async (id) => {
    return DepartmentsModel.findUnique(id);
  },

  createDepartment: async (data, userId) => {
    const result = await DepartmentsModel.create(data);
    await createAuditLog({ userId, action: "create", entity: "departments", recordId: result.id, newData: result });
    return result;
  },

  editDepartment: async (id, data, userId) => {
    const old = await DepartmentsModel.findUnique(id);
    const result = await DepartmentsModel.update(id, data);
    await createAuditLog({ userId, action: "update", entity: "departments", recordId: id, oldData: old, newData: result });
    return result;
  },

  deleteDepartment: async (id, userId) => {
    const old = await DepartmentsModel.findUnique(id);
    const result = await DepartmentsModel.delete(id);
    await createAuditLog({ userId, action: "delete", entity: "departments", recordId: id, oldData: old });
    return result;
  },

  importFromExcel: async (buffer, userId) => {
    const illegalXmlRE = new RegExp('[\x00-\x08\x0B\x0C\x0E-\x1F' + String.fromCodePoint(0xD800) + '-' + String.fromCodePoint(0xDFFF) + String.fromCodePoint(0xFFFE) + String.fromCodePoint(0xFFFF) + ']', 'g');
    const zip = await JSZip.loadAsync(buffer);
    let zipDirty = false;
    for (const [name, file] of Object.entries(zip.files)) {
      if (file.dir || (!name.endsWith(".xml") && !name.endsWith(".rels"))) continue;
      const raw = await file.async("nodebuffer");
      let xml;
      let needsUpdate = false;
      if (raw[0] === 0xFF && raw[1] === 0xFE) {
        xml = raw.slice(2).toString("utf16le");
        xml = xml.replace(/encoding="UTF-16[^"]*"/i, 'encoding="UTF-8"');
        needsUpdate = true;
      } else if (raw[0] === 0xFE && raw[1] === 0xFF) {
        const swapped = Buffer.from(raw.slice(2));
        for (let i = 0; i + 1 < swapped.length; i += 2) {
          const t = swapped[i]; swapped[i] = swapped[i + 1]; swapped[i + 1] = t;
        }
        xml = swapped.toString("utf16le");
        xml = xml.replace(/encoding="UTF-16[^"]*"/i, 'encoding="UTF-8"');
        needsUpdate = true;
      } else {
        xml = raw.toString("utf8");
        if (xml.charCodeAt(0) === 0xFEFF) { xml = xml.slice(1); needsUpdate = true; }
      }
      let patched = xml.replace(illegalXmlRE, "");
      const firstAngle = patched.indexOf("<");
      if (firstAngle > 0) patched = patched.slice(firstAngle);
      if (patched !== xml) needsUpdate = true;
      if (needsUpdate) { zip.file(name, patched); zipDirty = true; }
    }
    const cleanBuf = zipDirty ? await zip.generateAsync({ type: "nodebuffer" }) : buffer;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(cleanBuf);
    const sheet = wb.worksheets[0];
    if (!sheet) throw new Error("Рабочий лист не найден");

    const normCell = (v) => {
      if (v === null || v === undefined) return null;
      if (v instanceof Date) return v;
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
      if (v && Array.isArray(v.richText)) return v.richText.map(r => r.text || "").join("");
      if (v && (v.formula !== undefined || v.sharedFormula !== undefined)) return normCell(v.result);
      if (v && v.text !== undefined) return String(v.text);
      return v;
    };

    const rows = [];
    sheet.eachRow({ includeEmpty: true }, (row) => {
      const arr = [];
      for (let c = 1; c <= row.cellCount; c++) arr.push(normCell(row.getCell(c).value));
      rows.push(arr);
    });

    const toStr = (v) => {
      if (v === null || v === undefined) return null;
      const s = String(v).trim();
      return s === "" ? null : s;
    };

    const prisma = prismaContext.get();
    const allBranches = await prisma.branches.findMany({ select: { id: true, name: true } });
    const branchByName = new Map(allBranches.map(b => [b.name.trim().toLowerCase(), b]));

    let created = 0, updated = 0, unchanged = 0;
    const errors = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;
      try {
        const rawId = toStr(row[0]);
        const name = toStr(row[1]);
        const branchName = toStr(row[2]);
        const rawStatus = toStr(row[3]);

        if (!name) continue;

        let branchId = null;
        if (branchName) {
          const found = branchByName.get(branchName.toLowerCase());
          if (found) branchId = found.id;
        }

        let status = null;
        if (rawStatus !== null) {
          const s = rawStatus.toLowerCase();
          if (s === "true" || s === "активный" || s === "active") status = true;
          else if (s === "false" || s === "неактивный" || s === "inactive") status = false;
        }

        if (rawId) {
          const id = Number(rawId);
          if (isNaN(id)) {
            errors.push({ row: rowNum, code: "INVALID_ID", error: `Неверный ID: ${rawId}` });
            continue;
          }
          const existing = await prisma.departments.findUnique({ where: { id } });
          if (!existing) {
            errors.push({ row: rowNum, code: "DEPARTMENT_NOT_FOUND", error: `Отдел ID=${id} не найден` });
            continue;
          }
          const updateData = {};
          if (name !== existing.name) updateData.name = name;
          if (branchId !== null && branchId !== existing.branch_id) updateData.branch_id = branchId;
          if (status !== null && status !== existing.status) updateData.status = status;
          if (Object.keys(updateData).length === 0) {
            unchanged++;
            continue;
          }
          const old = { name: existing.name, branch_id: existing.branch_id, status: existing.status };
          const result = await prisma.departments.update({ where: { id }, data: updateData });
          await createAuditLog({ userId, action: "update", entity: "departments", recordId: id, oldData: old, newData: result });
          updated++;
        } else {
          if (!branchId) {
            errors.push({ row: rowNum, code: "BRANCH_NOT_FOUND", error: "Филиал не найден для нового отдела" });
            continue;
          }
          const newDept = await prisma.departments.create({
            data: { name, branch_id: branchId, status: status ?? true },
          });
          await createAuditLog({ userId, action: "create", entity: "departments", recordId: newDept.id, newData: newDept });
          created++;
        }
      } catch (err) {
        errors.push({ row: rowNum, code: "UNKNOWN", error: err.message });
      }
    }

    return { created, updated, unchanged, errors };
  },

  getStaffingOverview: async ({ userId, branch_id, department_id }) => {
    const user = await UserModel.getById(Number(userId));
    if (!user) throw new Error("Пользователь не найден");
    const where = buildDepartmentAccess(user);
    if (branch_id) where.branch_id = branch_id;
    if (department_id) where.id = department_id;
    const rows = await DepartmentsModel.getStaffingOverview(where);
    return { data: rows };
  },
};
