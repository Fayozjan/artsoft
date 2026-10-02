import { prismaContext } from "./prismaContext.js";

const SYSTEM_DEFAULTS = [
  { name: "Поставщики", usage: "supplier" },
  { name: "Клиенты", usage: "client" },
];

export async function ensureSystemLocations() {
  const prisma = prismaContext.get();
  const result = {};

  for (const loc of SYSTEM_DEFAULTS) {
    let existing = await prisma.stock_locations.findFirst({
      where: { usage: loc.usage, is_system: true, status: true },
      select: { id: true },
    });

    if (!existing) {
      existing = await prisma.stock_locations.create({
        data: { name: loc.name, usage: loc.usage, is_system: true, status: true },
        select: { id: true },
      });
    }

    result[loc.usage] = existing.id;
  }

  return result; // { supplier: id, client: id }
}
