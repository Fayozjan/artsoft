import prisma from "../../prisma/client.js";

export async function getFaceDevices(page, limit, filters = {}) {
  const currentPage = Math.max(parseInt(page) || 1, 1);
  const pageSize = Math.max(parseInt(limit) || 50, 1);
  const skip = (currentPage - 1) * pageSize;

  const { door_id, search, direction, status } = filters || {};

  let AND = [];
  let OR = [];

  if (search && search.trim() !== "") {
    const s = search.trim();

    const idNum = Number(s);
    const portNum = Number(s);

    OR.push(
      { name: { contains: s, mode: "insensitive" } },
      { door: { name: { contains: s, mode: "insensitive" } } },
      Number.isInteger(idNum) ? { id: { equals: idNum } } : null,
      Number.isInteger(portNum) ? { port: { equals: portNum } } : null,
      { device_ip: { contains: s, mode: "insensitive" } }
    );

    OR = OR.filter(Boolean);
  }

  if (door_id) {
    AND.push({ door_id: parseInt(door_id) });
  }

  if (direction === "entry" || direction === "exit") {
    AND.push({ direction });
  }

  if (status !== undefined && status !== "") {
    AND.push({ status: status === "true" });
  }

  // итоговый where
  const where = {};

  if (AND.length > 0) where.AND = AND;
  if (OR.length > 0) where.OR = OR;

  const [data, total] = await Promise.all([
    prisma.face_devices.findMany({
      skip,
      take: pageSize,
      orderBy: { id: "asc" },
      where,
      include: {
        door: { select: { id: true, name: true } },
      },
    }),
    prisma.face_devices.count({ where }),
  ]);

  return {
    data,
    pagination: {
      totalItems: total,
      currentPage,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getFaceDeviceById(id) {
  return prisma.face_devices.findUnique({
    where: { id: Number(id) },
    include: {
      door: { select: { id: true, name: true } },
    },
  });
}

export async function createFaceDevice(data) {
  return prisma.face_devices.create({ data });
}

export async function updateFaceDevice(id, data) {
  return prisma.face_devices.update({
    where: { id: Number(id) },
    data,
  });
}

export async function getFaceDeviceByDoorId(doorId) {
  return prisma.face_devices.findMany({
    where: {
      door_id: Number(doorId),
      status: true,
    },
    include: {
      door: { select: { id: true, name: true } },
    },
  });
}
