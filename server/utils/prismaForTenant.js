import { PrismaClient as PublicClient } from "../prisma-clients/public/index.js";
import { PrismaClient as ClientClient } from "../prisma-clients/client/index.js";

const clientsCache = {};

export const prismaPublic = new PublicClient();

export function getPrismaForTenant(schema) {
  if (!clientsCache[schema]) {
    const urlWithSchema = `${process.env.CLIENT_DATABASE_URL}?schema=${schema}`;
    clientsCache[schema] = new ClientClient({
      datasources: { db: { url: urlWithSchema } },
    });
  }
  return clientsCache[schema];
}
