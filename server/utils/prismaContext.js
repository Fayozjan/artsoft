import { AsyncLocalStorage } from "node:async_hooks";
import { getPrismaForTenant } from "./prismaForTenant.js";

const prismaStorage = new AsyncLocalStorage();

export const prismaContext = {
  run(prisma, callback) {
    return prismaStorage.run(prisma, callback);
  },

  get() {
    const prisma = prismaStorage.getStore();

    if (!prisma) {
      const defaultTenant = process.env.DEFAULT_TENANT;

      if (defaultTenant) {
        return getPrismaForTenant(defaultTenant);
      }
      throw new Error("Prisma not found in context");
    }

    return prisma;
  },
};
