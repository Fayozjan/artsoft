import rateLimit, { ipKeyGenerator } from "express-rate-limit";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_IP_MAX_ATTEMPTS = 100;
const TELEGRAM_MAX_ATTEMPTS = 10;

// Осталось секунд до сброса счётчика попыток
const retryAfterSeconds = (req, fallbackMs) => {
  const resetTime = req.rateLimit?.resetTime;
  if (!resetTime) return Math.ceil(fallbackMs / 1000);
  return Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000));
};

const limitHandler = (code, fallbackMs) => (req, res) => {
  const retryAfter = retryAfterSeconds(req, fallbackMs);
  res.setHeader("Retry-After", retryAfter);
  res.status(429).json({
    code,
    retryAfter,
    retryAfterMinutes: Math.ceil(retryAfter / 60),
    message: `Too many attempts. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
  });
};

// Ключ лимита для входа через Telegram — по telegram id
const telegramKeyGenerator = (req) => {
  const id = String(req.body?.id ?? "").trim();
  if (!id) return `tg:ip:${ipKeyGenerator(req.ip)}`;
  return `tg:${id}`;
};

// Блокировка конкретного логина живёт в services/loginLockout.js (эскалирующая).
// Здесь только грубый заслон по IP от перебора чужих логинов: лимит намеренно
// высокий, чтобы офис за одним NAT в него не упирался.
export const loginIpLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  limit: LOGIN_IP_MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  handler: limitHandler("TOO_MANY_ATTEMPTS", LOGIN_WINDOW_MS),
});

export const telegramLoginLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  limit: TELEGRAM_MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: telegramKeyGenerator,
  handler: limitHandler("TOO_MANY_ATTEMPTS", LOGIN_WINDOW_MS),
});

// /auth/refresh дёргает каждая открытая вкладка — лимит мягкий и отдельный,
// иначе фоновые обновления токена съедали квоту логина.
const REFRESH_WINDOW_MS = 60 * 1000;

export const refreshLimiter = rateLimit({
  windowMs: REFRESH_WINDOW_MS,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  handler: limitHandler("TOO_MANY_REQUESTS", REFRESH_WINDOW_MS),
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  handler: limitHandler("TOO_MANY_REQUESTS", 60 * 1000),
});
