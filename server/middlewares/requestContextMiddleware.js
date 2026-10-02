import { requestContext } from "../utils/requestContext.js";

function resolveIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = forwarded ? forwarded.split(",")[0].trim() : req.socket.remoteAddress;
  if (!raw) return null;
  return raw.replace(/^::ffff:/, "");
}

export function requestContextMiddleware(req, res, next) {
  const data = {
    ip: resolveIp(req),
    userAgent: req.headers["user-agent"] || null,
  };

  requestContext.run(data, next);
}
