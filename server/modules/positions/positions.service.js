import ExcelJS from "exceljs";
import JSZip from "jszip";
import { PositionModel } from "./positions.model.js";
import { createAuditLog } from "../../utils/auditLog.js";
import { prismaContext } from "../../utils/prismaContext.js";

export const PositionsService = {
  getPositions: async ({ page, pageSize, filters = {} }) => {
    const currentPage = Math.max(parseInt(page || 1), 1);
    const limit = Math.max(parseInt(pageSize || 50), 1);
    const skip = (currentPage - 1) * limit;

    const where = {};
    if (filters.search)
      where.name = { contains: filters.search, mode: "insensitive" };
    if (filters.status !== undefined && filters.status !== "")
      where.status = filters.status === "true";

    const [positions, total] = await Promise.all([
      PositionModel.findMany({ where, skip, take: limit }),
      PositionModel.count(where),
    ]);

    const formatted = positions.map((p) => ({
      ...p,
      sort_order: p.sort_order,
      employees_count: p._count.employees,
    }));

    return {
      data: formatted,
      pagination: {
        totalItems: total,
        currentPage,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  getActivePositions: async () => {
    const records = await PositionModel.findMany({ where: { status: true } });
    return {
      data: records.map((p) => ({ id: p.id, name: p.name, status: p.status, sort_order: p.sort_order })),
    };
  },

  getPositionById: async (id) => {
    return PositionModel.findUnique(id);
  },

  addPosition: async ({ name, status, sort_order }, userId) => {
    const result = await PositionModel.create({
      name,
      status,
      sort_order: sort_order !== undefined && sort_order !== "" ? parseInt(sort_order, 10) : 0,
    });
    await createAuditLog({ userId, action: "create", entity: "positions", recordId: result.id, newData: result });
    return result;
  },

  editPositionById: async (id, { name, status, sort_order }, userId) => {
    const old = await PositionModel.findUnique(id);
    const result = await PositionModel.update(id, {
      name,
      status,
      sort_order: sort_order !== undefined && sort_order !== "" ? parseInt(sort_order, 10) : 0,
    });
    await createAuditLog({ userId, action: "update", entity: "positions", recordId: id, oldData: old, newData: result });
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
    let created = 0, updated = 0, unchanged = 0;
    const errors = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;
      try {
        const rawId = toStr(row[0]);
        const name = toStr(row[1]);
        const rawStatus = toStr(row[2]);

        if (!name) continue;

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
          const existing = await prisma.positions.findUnique({ where: { id } });
          if (!existing) {
            errors.push({ row: rowNum, code: "POSITION_NOT_FOUND", error: `Должность ID=${id} не найдена` });
            continue;
          }
          const updateData = {};
          if (name !== existing.name) updateData.name = name;
          if (status !== null && status !== existing.status) updateData.status = status;
          if (Object.keys(updateData).length === 0) {
            unchanged++;
            continue;
          }
          const old = { name: existing.name, status: existing.status };
          const result = await prisma.positions.update({ where: { id }, data: updateData });
          await createAuditLog({ userId, action: "update", entity: "positions", recordId: id, oldData: old, newData: result });
          updated++;
        } else {
          const newPos = await prisma.positions.create({
            data: { name, status: status ?? true },
          });
          await createAuditLog({ userId, action: "create", entity: "positions", recordId: newPos.id, newData: newPos });
          created++;
        }
      } catch (err) {
        if (err.code === "P2002") {
          errors.push({ row: rowNum, code: "DUPLICATE", error: `Должность с таким именем уже существует` });
        } else {
          errors.push({ row: rowNum, code: "UNKNOWN", error: err.message });
        }
      }
    }

    return { created, updated, unchanged, errors };
  },
};
