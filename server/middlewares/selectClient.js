import { getPrismaForClient } from "../prisma/client.js";

export function clientMiddleware(req, res, next) {
  const host = req.headers.host;
  const subdomain = host.split(".")[0];

  req.prisma = getPrismaForClient(subdomain);
  req.clientSchema = subdomain;

  next();
}
