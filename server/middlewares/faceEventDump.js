import fs from "fs";
import fsp from "fs/promises";
import path from "path";

import { normalizeFaceEventLog } from "../utils/faceEventLog.js";

// Дамп сырых событий с face-устройств.
// Webhook всегда отвечает 200, поэтому со стороны устройства не видно, дошло
// событие до базы или было отброшено. Тут пишем один JSONL-объект на запрос:
// что прислало устройство + чем закончилась обработка (req.faceEventOutcome).
//
// FACE_EVENT_DUMP=false      — выключить совсем
// FACE_EVENT_DUMP_FULL=true  — дополнительно складывать тела частей multipart
//                              (включая фото) в logs/face-events/raw/
// FACE_EVENT_DUMP_DAYS=7     — сколько дней хранить

const ENABLED = process.env.FACE_EVENT_DUMP !== "false";
const FULL = process.env.FACE_EVENT_DUMP_FULL === "true";
const RETENTION_DAYS = Number(process.env.FACE_EVENT_DUMP_DAYS ?? 7);
// heartBeat — раз в 30 сек с каждого устройства, в дампе только мешает.
const DUMP_HEARTBEAT = process.env.FACE_EVENT_DUMP_HEARTBEAT === "true";

// Текстовые части (JSON-лог события) читаем целиком, но с потолком —
// прошивка может прислать base64-картинку внутри JSON.
const MAX_TEXT_PART = 256 * 1024;

const dumpDir = path.resolve("./logs/face-events");
const rawDir = path.join(dumpDir, "raw");

const pad = (n) => String(n).padStart(2, "0");

// Дата в Ташкенте — имя файла должно совпадать с тем днём, который админ ищет.
function tashkentNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type) => parts.find((p) => p.type === type)?.value;
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const time = `${get("hour")}:${get("minute")}:${get("second")}`;
  return { date, time, stamp: `${date} ${time}` };
}

const isImagePart = (f) =>
  /^image\//i.test(f.mimetype || "") ||
  /\.(jpe?g|png|bmp)$/i.test(f.originalname || "");

async function cleanupOldDumps() {
  if (!Number.isFinite(RETENTION_DAYS) || RETENTION_DAYS <= 0) return;
  const deadline = Date.now() - RETENTION_DAYS * 86_400_000;

  for (const dir of [dumpDir, rawDir]) {
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (dir === dumpDir && entry.name === "raw") continue;
      const target = path.join(dir, entry.name);
      try {
        const stat = await fsp.stat(target);
        if (stat.mtimeMs < deadline) {
          await fsp.rm(target, { recursive: true, force: true });
        }
      } catch {
        /* файл уже удалён — не важно */
      }
    }
  }
}

let lastCleanupDay = null;
function maybeCleanup(day) {
  if (lastCleanupDay === day) return;
  lastCleanupDay = day;
  cleanupOldDumps().catch((err) =>
    console.warn("face-dump: очистка не удалась:", err.message),
  );
}

// Части multipart multer уже разложил по файлам в tmp/, и контроллер удалит их
// в finally. Поэтому читаем/копируем здесь, до контроллера.
async function collectParts(req, rawTargetDir) {
  const parts = [];

  for (const file of req.files || []) {
    const part = {
      field: file.fieldname,
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };

    const image = isImagePart(file);

    if (!image) {
      try {
        const buf = await fsp.readFile(file.path);
        part.text = buf.slice(0, MAX_TEXT_PART).toString("utf8");
        if (buf.length > MAX_TEXT_PART) part.truncated = true;
      } catch (err) {
        part.readError = err.message;
      }
    }

    if (FULL && rawTargetDir) {
      try {
        await fsp.mkdir(rawTargetDir, { recursive: true });
        const safe = `${part.field || "part"}-${path.basename(file.originalname || "bin")}`
          .replace(/[^\w.\-]/g, "_")
          .slice(0, 120);
        const dest = path.join(rawTargetDir, safe);
        await fsp.copyFile(file.path, dest);
        part.savedAs = path.relative(dumpDir, dest);
      } catch (err) {
        part.saveError = err.message;
      }
    }

    parts.push(part);
  }

  return parts;
}

// Если content-type не подошёл ни express.json/urlencoded, ни multipart —
// тело осталось непрочитанным в потоке. Дочитываем сами, иначе payload
// прошивки (text/plain, xml, octet-stream) пропадает без следа.
function readLeftoverBody(req) {
  const hasBody = req.body && Object.keys(req.body).length > 0;
  if (hasBody || req.files?.length || !req.readable) return Promise.resolve(null);

  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    let done = false;

    const finish = (value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(value);
    };

    const timer = setTimeout(() => finish(null), 5000);

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size <= MAX_TEXT_PART) chunks.push(chunk);
    });
    req.on("end", () =>
      finish(
        chunks.length
          ? {
              text: Buffer.concat(chunks).toString("utf8"),
              size,
              truncated: size > MAX_TEXT_PART,
            }
          : null,
      ),
    );
    req.on("error", () => finish(null));
  });
}

// Короткая выжимка, чтобы grep по логу давал ответ без разбора всего JSON.
// Разбор — тем же нормализатором, что и в контроллере: summary должен
// показывать ровно то событие, по которому принято решение.
function summarize(body, parts, leftover) {
  const candidates = [
    body?.event_log,
    body,
    body?.AccessControllerEvent,
    ...parts.map((p) => p.text).filter(Boolean),
    leftover?.text,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const log = normalizeFaceEventLog(candidate);
    if (!log) continue;

    const inner = log.AccessControllerEvent;

    return {
      eventType: log.eventType ?? null,
      eventState: log.eventState ?? null,
      ipAddress: log.ipAddress ?? null,
      macAddress: log.macAddress ?? null,
      dateTime: log.dateTime ?? null,
      subEventType: inner?.subEventType ?? inner?.minorEventType ?? null,
      employeeNoString: inner?.employeeNoString ?? null,
      serialNo: inner?.serialNo ?? null,
      attendanceStatus: inner?.attendanceStatus ?? null,
    };
  }

  return null;
}

export function faceEventDump(req, res, next) {
  if (!ENABLED) return next();

  const { date, stamp } = tashkentNow();
  maybeCleanup(date);

  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const rawTargetDir = FULL ? path.join(rawDir, date, id) : null;

  // Части читаем сразу: контроллер удаляет tmp-файлы в finally.
  const partsPromise = collectParts(req, rawTargetDir).catch((err) => {
    console.warn("face-dump: части не собраны:", err.message);
    return [];
  });
  const leftoverPromise = readLeftoverBody(req).catch(() => null);

  res.on("finish", async () => {
    try {
      const parts = await partsPromise;
      const leftover = await leftoverPromise;
      const body = req.body && Object.keys(req.body).length ? req.body : null;

      const summary = summarize(body, parts, leftover);
      if (summary?.eventType === "heartBeat" && !DUMP_HEARTBEAT) return;

      const record = {
        id,
        ts: stamp,
        ip: req.ip,
        host: req.headers.host ?? null,
        url: req.originalUrl,
        deviceParam: req.params?.deviceId ?? req.query?.device ?? null,
        tenant: req.tenant?.schema ?? null,
        contentType: req.headers["content-type"] ?? null,
        contentLength: req.headers["content-length"] ?? null,
        status: res.statusCode,
        outcome: req.faceEventOutcome ?? null,
        summary,
        body,
        rawBody: leftover,
        parts,
      };

      await fsp.mkdir(dumpDir, { recursive: true });
      await fsp.appendFile(
        path.join(dumpDir, `${date}.jsonl`),
        JSON.stringify(record) + "\n",
      );
    } catch (err) {
      console.warn("face-dump: запись не удалась:", err.message);
    }
  });

  next();
}

// Каталог создаём заранее, чтобы админ видел, куда смотреть, ещё до первого события.
if (ENABLED) {
  try {
    fs.mkdirSync(dumpDir, { recursive: true });
  } catch {
    /* права/только чтение — тогда упадём на первой записи с внятным warn */
  }
}
