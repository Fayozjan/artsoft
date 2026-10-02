import { prismaPublic } from "../../utils/prismaForTenant.js";

export const TenantsModel = {
  getAll: () =>
    prismaPublic.tenants.findMany({
      select: { id: true, name: true, subdomain: true, schema: true },
      orderBy: { id: "asc" },
    }),

  getById: (id) =>
    prismaPublic.tenants.findUnique({
      where: { id },
      select: { id: true, name: true, subdomain: true, schema: true },
    }),
};
