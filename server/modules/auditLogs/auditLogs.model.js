import { prismaContext } from "../../utils/prismaContext.js";

export const AuditLogsModel = {
  findMany: async ({ where, skip, take }) => {
    const prisma = prismaContext.get();
    return prisma.audit_logs.findMany({
      where,
      skip,
      take,
      orderBy: { added_at: "desc" },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            employee: {
              select: { first_name: true, last_name: true },
            },
          },
        },
      },
    });
  },

  count: async (where) => {
    const prisma = prismaContext.get();
    return prisma.audit_logs.count({ where });
  },

  findDistinctEntities: async () => {
    const prisma = prismaContext.get();
    const rows = await prisma.audit_logs.findMany({
      select: { entity: true },
      distinct: ["entity"],
      orderBy: { entity: "asc" },
    });
    return rows.map((r) => r.entity);
  },
};
