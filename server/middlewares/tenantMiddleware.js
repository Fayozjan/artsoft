import { prismaContext } from "../utils/prismaContext.js";
import { prismaPublic, getPrismaForTenant } from "../utils/prismaForTenant.js";

const tenantCache = new Map();

export const tenantMiddleware = async (req, res, next) => {
  try {
    let host = req.headers.host;

    if (process.env.NODE_ENV === "development") {
      host = "artsoft.localhost:5000";
    }

    const subdomain = host.split(":")[0].split(".")[0];

    if (!tenantCache.has(subdomain)) {
      const tenant = await prismaPublic.tenants.findUnique({
        where: { subdomain },
      });

      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      tenantCache.set(subdomain, tenant);
    }

    const tenant = tenantCache.get(subdomain);
    const prisma = getPrismaForTenant(tenant.schema);

    req.tenant = tenant;

    prismaContext.run(prisma, () => next());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Tenant error" });
  }
};
