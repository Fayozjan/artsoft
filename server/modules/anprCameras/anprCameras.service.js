import { AnprCamerasModel } from "./anprCameras.model.js";

export const AnprCamerasService = {
  get: async ({ page, pageSize, filters = {} }) => {
    const currentPage = Math.max(parseInt(page || 1), 1);
    const limit = Math.max(parseInt(pageSize || 50), 1);
    const skip = (currentPage - 1) * limit;

    const { gate_id, search, direction, status } = filters;

    let AND = [];
    let OR = [];

    // Поиск по строке
    if (search && search.trim() !== "") {
      const s = search.trim();
      const idNum = Number(s);
      const portNum = Number(s);

      OR.push(
        { name: { contains: s, mode: "insensitive" } },
        { camera_ip: { contains: s, mode: "insensitive" } },
        Number.isInteger(idNum) ? { id: { equals: idNum } } : null,
        Number.isInteger(portNum) ? { port: { equals: portNum } } : null,
      );

      OR = OR.filter(Boolean);
    }

    if (gate_id) AND.push({ gate_id: Number(gate_id) });
    if (direction === "entry" || direction === "exit") AND.push({ direction });
    if (status !== undefined && status !== "")
      AND.push({ status: status === "true" });

    const where = {};
    if (AND.length > 0) where.AND = AND;
    if (OR.length > 0) where.OR = OR;

    const [data, total] = await Promise.all([
      AnprCamerasModel.findMany({ where, skip, take: limit }),
      AnprCamerasModel.count(where),
    ]);

    const formattedData = data.map((item) => ({
      id: item.id,
      name: item.name,
      gate_id: item.gate_id,
      gate_name: item.gate?.name || null,
      camera_ip: item.camera_ip,
      port: item.port,
      direction: item.direction,
      status: item.status,
      added_at: item.added_at,
      updated_at: item.updated_at,
    }));

    return {
      data: formattedData,
      pagination: {
        totalItems: total,
        currentPage,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  getActiveCameras: async () => {
    return AnprCamerasModel.findActive();
  },

  getById: async (id) => {
    return AnprCamerasModel.findById(id);
  },

  getByMacAddress: async (mac) => {
    return AnprCamerasModel.findByMacAddress(mac);
  },

  create: async (data) => {
    return AnprCamerasModel.create({
      ...data,
      port: data.port ? Number(data.port) : null,
      gate_id: data.gate_id ? Number(data.gate_id) : null,
      status: data.status === true || data.status === "true",
    });
  },

  update: async (id, data) => {
    const { id: _removedId, port, gate_id, status, ...rest } = data;

    return AnprCamerasModel.update(id, {
      ...rest,
      port: port ? Number(port) : null,
      gate_id: gate_id ? Number(gate_id) : null,
      status: status === true || status === "true",
    });
  },
};
