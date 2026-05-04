import { PrismaClient as PublicClient } from "../prisma-clients/public/index.js";
import { PrismaClient as ClientClient } from "../prisma-clients/client/index.js";

const clientsCache = {};

export const prismaPublic = new PublicClient({
  datasources: {
    db: { url: `${process.env.DATABASE_URL}?connection_limit=5&pool_timeout=10` },
  },
});

export function getPrismaForTenant(schema) {
  if (!clientsCache[schema]) {
    const urlWithSchema = `${process.env.CLIENT_DATABASE_URL}?schema=${schema}&connection_limit=3&pool_timeout=10`;
    clientsCache[schema] = new ClientClient({
      datasources: { db: { url: urlWithSchema } },
    });
  }
  return clientsCache[schema];
}

export async function disconnectAll() {
  await prismaPublic.$disconnect();
  await Promise.all(Object.values(clientsCache).map((c) => c.$disconnect()));
}
