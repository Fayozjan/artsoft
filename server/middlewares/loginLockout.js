import { LoginLockout } from "../services/loginLockout.js";

const subdomainOf = (req) =>
  String(req.headers.host || "")
    .split(":")[0]
    .split(".")[0] || "unknown";

export const tenantKeyOf = (req) => req.tenant?.schema || subdomainOf(req);

/** Ответ 429 с данными блокировки — один формат для middleware и контроллера */
export const sendLocked = (res, status) => {
  res.setHeader("Retry-After", status.retryAfter);
  return res.status(429).json({
    code: "TOO_MANY_ATTEMPTS",
    retryAfter: status.retryAfter,
    retryAfterMinutes: status.retryAfterMinutes,
    lockedUntil: status.lockedUntil,
    lockLevel: status.lockLevel,
    message: `Too many failed login attempts. Try again in ${status.retryAfterMinutes} minute(s).`,
  });
};

/**
 * Проверяет блокировку до обращения к БД и кладёт ключ в req.loginLockoutKey.
 * Сам счётчик двигает контроллер: он один знает, был ли пароль неверным.
 */
export const loginLockoutGuard = (req, res, next) => {
  const username = String(req.body?.username ?? "").trim();
  if (!username) return next();

  const key = LoginLockout.buildKey(tenantKeyOf(req), username);
  req.loginLockoutKey = key;

  const status = LoginLockout.status(key);
  if (!status.locked) return next();

  return sendLocked(res, status);
};
