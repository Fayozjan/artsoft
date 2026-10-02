# Security Audit — hrsystemNew

**Дата аудита:** 2026-05-11  
**Аудитор:** Claude (автоматизированный анализ)  
**Стек:** Node.js ESM + Express + Prisma + PostgreSQL (multi-tenant), React SPA

---

## Сводка по приоритетам

| Критичность | Кол-во |
| ----------- | ------ |
| 🔴 CRITICAL | 5      |
| 🟠 HIGH     | 7      |
| 🟡 MEDIUM   | 10     |
| 🟢 LOW      | 3      |

---

## 🔴 CRITICAL

---

### C-1 · Одинаковые секреты для ACCESS и REFRESH токенов

📁 `server/.env` строки 5–6  
💥 Если атакующий получает `REFRESH_SECRET`, он может подписывать `accessToken` и наоборот. Компрометация одного секрета = полная компрометация обоих типов токенов.

**Текущее состояние:**

```
ACCESS_SECRET=Daddy5775$$
REFRESH_SECRET=Daddy5775$$
```

**Исправление:** Использовать разные, криптографически стойкие секреты (32+ случайных байта):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```
ACCESS_SECRET=<уникальный 64-char hex>
REFRESH_SECRET=<другой уникальный 64-char hex>
```

---

### C-2 · Слабые JWT-секреты (12 символов, предсказуемый паттерн)

📁 `server/.env` строки 5–6  
💥 `Daddy5775$$` — 12 символов, паттерн [Word][Year][Special]. Уязвим к атаке по словарю. JWT можно подделать офлайн без доступа к серверу.

**Исправление:** Сгенерировать случайные секреты (см. C-1 выше). Минимум — 32 байта (256 бит).

---

### C-3 · ✅ РЕАЛИЗОВАНО · Нет защиты от брутфорса на `/api/auth/login`

📁 `server/modules/auth/auth.routes.js` строка 8  
📁 `server/modules/auth/auth.service.js` строки 18–78  
💥 Атакующий может перебирать пароли неограниченно. Нет rate limiting, нет блокировки аккаунта, нет CAPTCHA. С паролями вида `Password2021` это риск реального взлома.

**Исправление:** Добавить `express-rate-limit` на auth-роуты:

```bash
npm install express-rate-limit
```

```js
// server/middlewares/rateLimiter.js
import rateLimit from "express-rate-limit";

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 10, // 10 попыток
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts, try again in 15 minutes" },
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
```

```js
// server/modules/auth/auth.routes.js
import { loginLimiter } from "../../middlewares/rateLimiter.js";

router.post("/login", loginLimiter, tenantMiddleware, AuthController.login);
router.post("/refresh", loginLimiter, tenantMiddleware, AuthController.refresh);
```

---

### C-4 · ✅ РЕАЛИЗОВАНО · Нет проверки типа файла при загрузке (File Upload)

📁 `server/middlewares/uploadPhoto.js` строки 6–22  
💥 Multer принимает **любой файл** — `.exe`, `.php`, `.svg`, `.html`. Расширение определяется из `file.originalname` (пользовательское). Атакующий может загрузить вредоносный файл или SVG с XSS.

**Текущее состояние:**

```js
const upload = multer({ storage }); // нет fileFilter
```

**Исправление:**

```js
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIME.has(file.mimetype) || !ALLOWED_EXT.has(ext)) {
      return cb(new Error("Only image files allowed"));
    }
    cb(null, true);
  },
});
```

---

### C-5 · Открытый Telegram bot token в `.env`

📁 `server/.env` строка 7  
💥 `BOT_TOKEN=8416134399:AAEiTmKdd_TbgWjmlp8OePur92oKbaIV0SM` — реальный токен. Если `.env` попадёт в git или на чужие руки, атакующий получит полный контроль над ботом: читать сообщения, рассылать сообщения от имени бота, изменять webhook.

> ⚠️ **Немедленно:** Отозвать токен через `@BotFather` → `/revoke` и сгенерировать новый.

---

## 🟠 HIGH

---

### H-1 · ✅ РЕАЛИЗОВАНО · Нет Helmet (отсутствуют security headers)

📁 `server/app.js` строки 1–22  
💥 Отсутствие заголовков открывает:

- Clickjacking (`X-Frame-Options` не установлен)
- MIME sniffing (`X-Content-Type-Options` не установлен)
- XSS-атаки (`Content-Security-Policy` не установлен)

**Исправление:**

```bash
npm install helmet
```

```js
// server/app.js
import helmet from "helmet";

app.use(helmet());
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
    },
  }),
);
```

---

### H-2 · Нет CORS-конфигурации

📁 `server/app.js`  
💥 `cors` пакет установлен в `package.json` но **не используется**. Браузер применяет SOP, но API не возвращает CORS-заголовков. Для настроенных клиентских запросов (credentials, Authorization header) — запросы будут блокироваться или разрешаться некорректно.

**Исправление:**

```js
// server/app.js
import cors from "cors";

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
```

---

### H-3 · Endpoint `/api/auth/telegram` без middleware

📁 `server/modules/auth/auth.routes.js` строка 9  
💥 `POST /api/auth/telegram` — единственный роут **без каких-либо middleware** (нет `tenantMiddleware`). Принимает `{ id }` из body без валидации типа, выдаёт полноценные JWT-токены. Если Telegram ID известен (публичные профили, утечки), атакующий получит сессию без пароля.

```js
router.post("/telegram", AuthController.telegramLogin); // ← нет middleware!
```

**Исправление:** Добавить `loginLimiter` + валидацию ID:

```js
import { loginLimiter } from "../../middlewares/rateLimiter.js";

router.post("/telegram", loginLimiter, AuthController.telegramLogin);
```

```js
// auth.controller.js — telegramLogin
const telegramId = String(id);
if (!/^\d{5,15}$/.test(telegramId)) {
  return res.status(400).json({ message: "Invalid Telegram ID" });
}
```

---

### H-4 · Нет валидации входных данных (глобально)

📁 Все `*.controller.js` файлы  
💥 `req.body` передаётся в сервисы без проверки типов, диапазонов, обязательных полей. Может привести к ошибкам БД, некорректному поведению, потенциальным type confusion атакам.

**Исправление:** Установить `zod` или `express-validator`, добавить схемы на уровне роутов:

```bash
npm install zod
```

```js
// server/modules/auth/auth.validator.js
import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
});

// middleware
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten() });
  }
  req.body = result.data;
  next();
};
```

---

### H-5 · Tenant isolation не проверяется для пользователя

📁 `server/middlewares/authMiddleware.js` строки 22–31  
📁 `server/middlewares/tenantMiddleware.js`  
💥 `authMiddleware` проверяет JWT и загружает пользователя из текущей схемы тенанта. Но нет проверки, что пользователь **принадлежит именно этому тенанту**. Если пользователь Tenant A каким-то образом получит токен и обратится к API Tenant B, — запрос может пройти.

**Исправление:** В `authMiddleware` добавить проверку связи пользователя с тенантом:

```js
const tenant = tenantContext.get();
const user = await prisma.users.findUnique({
  where: { id: payload.id },
  select: {
    id: true,
    username: true,
    language: true,
    theme: true,
    sidebar: true,
    status: true,
  },
});
if (!user || !user.status)
  return res.status(401).json({ message: "User not found or disabled" });
```

(В текущей реализации `status` не проверяется в `authMiddleware` — добавить эту проверку.)

---

### H-6 · Информация об ошибках утекает клиенту

📁 `server/modules/auth/auth.controller.js` строка 41  
📁 `server/modules/employees/employees.controller.js` строка 77  
💥 `res.status(err.status || 401).json({ ...err })` — spread объекта ошибки. Может включать `stack`, внутренние поля, имена таблиц БД.

```js
// Уязвимо:
res.status(err.status || 401).json({ ...err });
// details: err.message — тоже уязвимо
```

**Исправление:**

```js
// Безопасно:
res.status(err.status || 500).json({
  code: err.code || "INTERNAL_ERROR",
  message: err.message || "Server error",
});
```

---

### H-7 · cookies без `sameSite: strict` и без явного `domain`

📁 `server/modules/auth/auth.controller.js` строки 11–23  
💥 `sameSite: "lax"` — уязвим к CSRF в некоторых сценариях top-level navigation (форм, кросс-доменных редиректов). Для API, который использует только cookie-auth, лучше `strict`.

**Исправление:**

```js
res.cookie("refreshToken", refreshToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict", // было "lax"
  maxAge: 8 * 60 * 60 * 1000,
});
```

---

## 🟡 MEDIUM

---

### M-1 · Tenant cache без TTL

📁 `server/middlewares/tenantMiddleware.js` строки 5–27  
💥 `const tenantCache = new Map()` — никогда не очищается. Если тенант удалён или деактивирован в БД, кешированная запись остаётся в памяти до перезапуска сервера.

**Исправление:**

```js
const CACHE_TTL = 5 * 60 * 1000; // 5 минут
const tenantCache = new Map(); // { subdomain: { tenant, expiry } }

if (
  !tenantCache.has(subdomain) ||
  tenantCache.get(subdomain).expiry < Date.now()
) {
  const tenant = await prismaPublic.tenants.findUnique({
    where: { subdomain },
  });
  if (!tenant) return res.status(404).json({ message: "Tenant not found" });
  tenantCache.set(subdomain, { tenant, expiry: Date.now() + CACHE_TTL });
}
const { tenant } = tenantCache.get(subdomain);
```

---

### M-2 · JWT без проверки `iss` / `aud`

📁 `server/middlewares/authMiddleware.js` строка 17  
💥 `jwt.verify(token, process.env.ACCESS_SECRET)` — без опций `issuer` и `audience`. Любой сервис с тем же секретом может выпустить валидный токен.

**Исправление:**

```js
payload = jwt.verify(token, process.env.ACCESS_SECRET, {
  issuer: "hrsystem",
  audience: "hrsystem-client",
});
// При выпуске:
jwt.sign({ id }, secret, {
  expiresIn: "15m",
  issuer: "hrsystem",
  audience: "hrsystem-client",
});
```

---

### M-3 · Дублирующийся пакет bcryptjs (неиспользуемый)

📁 `server/package.json` строки 18–19  
💥 Оба `bcrypt` и `bcryptjs` в зависимостях. `bcryptjs` — чистый JS, намного медленнее. Если где-то случайно импортирован `bcryptjs` вместо `bcrypt`, хэши будут одинаковы (совместимы), но производительность деградирует.

**Исправление:**

```bash
npm uninstall bcryptjs
```

Убедиться, что все импорты используют `bcrypt` (нативный).

---

### M-4 · Пакет `cors` установлен, но не используется

📁 `server/package.json` строка 22  
💥 Мёртвая зависимость создаёт путаницу и увеличивает attack surface (лишний пакет в node_modules).

**Исправление:** Начать использовать (см. H-2) или удалить:

```bash
npm uninstall cors  # если не используется
```

---

### M-5 · ✅ РЕАЛИЗОВАНО · `pinfl` из `req.body` используется как имя файла без санитизации

📁 `server/middlewares/uploadPhoto.js` строка 17  
💥 `const pinfl = req.body.pinfl || ...` используется как часть имени файла. Если `pinfl` содержит `../` или спецсимволы, возможен path traversal при сохранении файла.

**Исправление:**

```js
const rawPinfl = req.body.pinfl || `upload_${Date.now()}`;
// Санитизировать: только цифры/буквы/дефис
const pinfl = rawPinfl.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
```

---

### M-6 · `req.body` передаётся в Prisma `$executeRaw` без валидации

📁 `server/modules/employees/employees.model.js`  
💥 Prisma template literals безопасны от SQL injection, но без валидации на уровне контроллера возможна передача `null`, `undefined`, чрезмерно длинных строк или неожиданных типов, что может вызвать ошибки БД, раскрывающие структуру схемы.

**Исправление:** Добавить валидацию перед вызовом model (см. H-4, использовать `zod`).

---

### M-7 · Информация о тенанте в `res.status(500).json({ error: "Tenant error" })`

📁 `server/middlewares/tenantMiddleware.js` строка 37  
💥 Ошибка внутри `tenantMiddleware` раскрывает, что система использует multi-tenant архитектуру.

**Исправление:** Вернуть `404` вместо `500` с нейтральным сообщением:

```js
} catch (err) {
  console.error("Tenant error:", err);
  res.status(404).json({ message: "Not found" });
}
```

---

### M-8 · Блокировка аккаунта после N неудачных попыток входа — ИСПРАВЛЕНО

📁 `server/services/loginLockout.js`, `server/middlewares/loginLockout.js`

Счётчик неудач ведётся по ключу `<схема арендатора>:<логин>`, а не по IP: блокируется
только тот логин, по которому ошибались. Соседи за тем же NAT не задеты.

Эскалация: 3 неудачи подряд → блок 5 мин. После истечения ещё 3 неудачи → 15 мин,
далее 30 → 60 → 120 → 240 (последний шаг повторяется). Успешный вход сбрасывает
и счётчик, и уровень. Счётчик неудач остывает за 30 мин тишины, уровень эскалации — за 24 ч.

Настройки через env: `LOGIN_FAIL_THRESHOLD`, `LOGIN_LOCK_LADDER_MIN`,
`LOGIN_FAIL_WINDOW_MIN`, `LOGIN_LEVEL_RESET_HOURS`, `LOGIN_LOCKOUT_MAX_ENTRIES`.

Ответ при блокировке — 429 `{ code: "TOO_MANY_ATTEMPTS", retryAfter, retryAfterMinutes, lockedUntil, lockLevel }`
плюс заголовок `Retry-After`. Снятие вручную: `POST /api/users/:id/unlock` (кнопка на странице пользователей).

Счётчик двигает только неверный пароль — несуществующий логин ключей не создаёт.
Дополнительно `loginIpLimiter` (100 неудач / 15 мин на IP) прикрывает перебор чужих логинов.

**Ограничение:** состояние живёт в памяти процесса — рестарт сервера снимает все блокировки,
а при нескольких инстансах счётчики не общие. Для кластера нужен общий стор (Redis/БД).

---

### M-9 · `NODE_ENV=development` хардкодно в `.env`

📁 `server/.env` строка 10  
💥 Если `.env` используется в продакшене без изменений, `secure: false` на cookies, dev-хардкодинг тенанта в `tenantMiddleware` (строка 12), и другие dev-условия будут активны в проде.

**Исправление:** Разделить `.env.development` и `.env.production`. В `.env.production`:

```
NODE_ENV=production
```

---

### M-10 · `recharts` в server/package.json

📁 `server/package.json` строка 44  
💥 `recharts` — React-библиотека для клиентских чартов. Нет причин устанавливать её на сервере. Увеличивает размер `node_modules` и attack surface.

**Исправление:**

```bash
npm uninstall recharts  # в server/
```

---

## 🟢 LOW

---

### L-1 · Telegram endpoint раскрывает `err.message` клиенту

📁 `server/modules/auth/auth.controller.js` строка 79  
💥 `message: err.message` — в ошибках Telegram API могут быть внутренние детали.

**Исправление:** Возвращать только `err.code` или статичное сообщение в ошибках 5xx.

---

### L-2 · Два пакета для cron (`cron` и `node-cron`)

📁 `server/package.json` строки 23, 38  
💥 Дублирование зависимостей — запутывает, увеличивает bundle, возможны конфликты.

**Исправление:** Определить, какой используется, удалить второй.

---

### L-3 · Пакет `fs` v0.0.1-security в зависимостях

📁 `server/package.json` строка 31  
💥 `"fs": "^0.0.1-security"` — это заглушка (placeholder), Node.js имеет встроенный `fs`. Этот пакет ничего не делает и не нужен.

**Исправление:**

```bash
npm uninstall fs
```

Использовать `import fs from "fs"` или `import { promises as fsp } from "fs"` — это встроенные модули Node.js.

---

## Чеклист по приоритетам (что делать первым)

### Неделя 1 — Критично

- [ ] **C-1/C-2** Сгенерировать новые ACCESS_SECRET и REFRESH_SECRET (разные, 32+ байта)
- [ ] **C-5** Отозвать Telegram bot token, выпустить новый
- [x] **C-3** Добавить rate limiting на `/login`, `/refresh`, `/telegram`
- [x] **C-4** Добавить `fileFilter` + `limits.fileSize` в multer
- [x] **H-1** Добавить `helmet()`
- [ ] **H-2** Настроить CORS

### Месяц 1 — Важно

- [ ] **H-3** Добавить middleware на `/api/auth/telegram`
- [ ] **H-4** Внедрить валидацию через `zod` (начать с auth и employees)
- [ ] **H-5** Добавить проверку `status` пользователя в `authMiddleware`
- [ ] **H-6** Убрать spread объекта ошибки (`{ ...err }`)
- [ ] **H-7** Поменять `sameSite: "lax"` → `"strict"`
- [ ] **M-1** Добавить TTL для tenant cache
- [x] **M-5** Санитизировать `pinfl` перед использованием в имени файла

### Месяц 2 — Улучшения

- [ ] **M-2** Добавить `issuer`/`audience` в JWT
- [ ] **M-3** Удалить `bcryptjs`
- [ ] **M-4** Использовать или удалить `cors` из deps
- [x] **M-8** Блокировка аккаунта после N попыток (эскалирующая, `services/loginLockout.js`)
- [ ] **M-9** Разделить `.env.development` и `.env.production`
- [ ] **L-1/L-2/L-3** Чистка зависимостей

---

## Что сделано хорошо

- ✅ `.env` в `.gitignore` — секреты не в репозитории
- ✅ Пароли хешируются через `bcrypt` с 10 раундами соли
- ✅ JWT в `httpOnly` cookies (недоступен из JS)
- ✅ Refresh token rotation — новый токен при каждом refresh
- ✅ Сессии хранятся в БД — возможен принудительный logout
- ✅ Multi-tenant изоляция через отдельные PostgreSQL схемы
- ✅ Sharp конвертирует все файлы в JPEG, ограничивает размер 200KB
- ✅ Все `$queryRaw` / `$executeRaw` используют Prisma template literals (безопасны от SQL injection)
- ✅ Проверка `user.status` в `auth.service.login` (деактивированные аккаунты)
- ✅ Отдельные Prisma-клиенты для public/tenant схем — изоляция данных
