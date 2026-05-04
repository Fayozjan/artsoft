import fetch from "digest-fetch";
import path from "path";
import { fileURLToPath } from "url";
import fsPromises from "fs/promises";
import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { DoorModel } from "../modules/doors/doors.model.js";
import { FacePassesModel } from "../modules/facePasses/facePasses.model.js";
import {
  addEmployeeRaw,
  EmployeeModel,
} from "../modules/employees/employees.model.js";
import { notificationsOutboxService } from "../modules/notificationsOutbox/notificationsOutbox.service.js";
import { telegramBotsService } from "../modules/telegramBots/telegramBots.service.js";

// ─── Config ───────────────────────────────────────────────────────────────────

const ADD_NOT_FOUND_USER = process.env.ADD_NOT_FOUND_USER === "true";
const DEFAULT_TENANT = process.env.DEFAULT_TENANT;
const USERNAME = "admin";
const PASSWORD = process.env.PASSWORD;
const API_ACS_EVENT = "/ISAPI/AccessControl/AcsEvent?format=json";
const MAX_RESULTS_PER_REQUEST = 100;
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 2000;

const PHOTO_CONCURRENCY_PER_IP = 2;

const photoQueues = new Map();

function enqueuePhoto(ip, fn) {
  if (!photoQueues.has(ip)) {
    photoQueues.set(ip, { running: 0, queue: [] });
  }
  const q = photoQueues.get(ip);

  return new Promise((resolve, reject) => {
    q.queue.push({ fn, resolve, reject });
    drainQueue(q);
  });
}

function drainQueue(q) {
  while (q.running < PHOTO_CONCURRENCY_PER_IP && q.queue.length > 0) {
    const { fn, resolve, reject } = q.queue.shift();
    q.running++;
    fn()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        q.running--;
        drainQueue(q);
      });
  }
}

function parseMultipartResponse(buffer, boundary) {
  const sep = Buffer.from(`--${boundary}`);
  const CRLF = Buffer.from("\r\n\r\n");
  const parts = [];
  let start = 0;

  while (true) {
    const idx = buffer.indexOf(sep, start);
    if (idx === -1) break;

    const afterSep = idx + sep.length;
    if (buffer.slice(afterSep, afterSep + 2).toString() === "--") break;

    const partStart = afterSep + 2;
    const nextBoundary = buffer.indexOf(sep, partStart);
    if (nextBoundary === -1) break;

    const part = buffer.slice(partStart, nextBoundary - 2);
    const headerEnd = part.indexOf(CRLF);
    if (headerEnd === -1) {
      start = nextBoundary;
      continue;
    }

    parts.push({
      headers: part.slice(0, headerEnd).toString(),
      body: part.slice(headerEnd + 4),
    });

    start = nextBoundary;
  }

  return parts;
}

function buildPhotoPath(info) {
  const d = new Date(info.time);
  const year = d.getFullYear().toString();
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const fileName = `${info.employeeNoString}-${info.serialNo}.jpg`;
  const folderPath = path.join(
    __dirname,
    "..",
    "uploads",
    "face-passes",
    DEFAULT_TENANT,
    year,
    month,
  );
  return {
    folderPath,
    imagePath: path.join(folderPath, fileName),
    relativePath: `${DEFAULT_TENANT}/${year}/${month}/${fileName}`,
  };
}

async function writePhotoAtomically(imagePath, folderPath, buffer) {
  await fsPromises.mkdir(folderPath, { recursive: true });
  const tmpPath = `${imagePath}.tmp`;
  await fsPromises.writeFile(tmpPath, buffer);
  await fsPromises.rename(tmpPath, imagePath);
}

async function savePhotoFromBuffer(buffer, info) {
  if (!buffer?.length) return null;
  const { folderPath, imagePath, relativePath } = buildPhotoPath(info);
  await writePhotoAtomically(imagePath, folderPath, buffer);
  return relativePath;
}

async function downloadPhotoByUrl(imageUrl, info) {
  const { folderPath, imagePath, relativePath } = buildPhotoPath(info);
  const client = new fetch(USERNAME, PASSWORD);

  for (let attempt = 1; attempt <= 5; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await client.fetch(imageUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.status === 404 || res.status === 403) {
        console.warn(`⛔ Фото недоступно (${res.status}): ${imageUrl}`);
        return null;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

      const buffer = Buffer.from(await res.arrayBuffer());
      await writePhotoAtomically(imagePath, folderPath, buffer);
      return relativePath;
    } catch (err) {
      clearTimeout(timeoutId);
      const cause = err.cause?.message ?? err.cause ?? "";
      const reason =
        err.name === "AbortError"
          ? "таймаут 10с"
          : `${err.message}${cause ? ` | cause: ${cause}` : ""}`;
      console.warn(`⚠️ Попытка ${attempt}/5 загрузки фото: ${reason}`);
      if (attempt === 5) break;
      const delay = BASE_DELAY_MS * 2 ** (attempt - 1) + Math.random() * 1000;
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  console.warn(`🚫 Фото для события ${info.serialNo} не удалось скачать.`);
  return null;
}

async function resolveEventPhoto(e) {
  if (e._photoBuffer) {
    return savePhotoFromBuffer(e._photoBuffer, e);
  }
  if (e.pictureURL) {
    const ip = new URL(e.pictureURL).hostname;
    return enqueuePhoto(ip, () => downloadPhotoByUrl(e.pictureURL, e));
  }
  return null;
}

// ─── Client factory ───────────────────────────────────────────────────────────

export function createHikClient() {
  return new fetch(USERNAME, PASSWORD);
}

async function fetchEventsBatch(client, deviceIp, postData) {
  const url = `http://${deviceIp}${API_ACS_EVENT}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    try {
      const res = await client.fetch(url, {
        method: "POST",
        body: JSON.stringify({
          AcsEventCond: { ...postData.AcsEventCond, picEnable: true },
        }),
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

      const contentType = res.headers.get("content-type") || "";
      const buffer = Buffer.from(await res.arrayBuffer());

      // ── Multipart: фото уже внутри ответа ──
      const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
      if (boundaryMatch) {
        const parts = parseMultipartResponse(buffer, boundaryMatch[1]);

        const jsonPart = parts.find((p) =>
          p.headers.includes("application/json"),
        );
        if (!jsonPart) throw new Error("Нет JSON-части в multipart ответе");

        const events =
          JSON.parse(jsonPart.body.toString())?.AcsEvent?.InfoList || [];

        const photoMap = new Map();
        for (const part of parts) {
          const fnMatch = part.headers.match(/filename="?([^";\r\n]+)"?/);
          if (fnMatch && part.headers.includes("image/")) {
            photoMap.set(fnMatch[1].trim(), part.body);
          }
        }

        return events.map((e) => ({
          ...e,
          _photoBuffer: photoMap.get(e.filename) ?? null,
        }));
      }

      // ── Fallback: plain JSON ──
      return JSON.parse(buffer.toString())?.AcsEvent?.InfoList || [];
    } catch (err) {
      clearTimeout(timeoutId);
      const reason = err.name === "AbortError" ? "таймаут 15с" : err.message;
      console.warn(
        `⚠️ [${deviceIp}] Попытка ${attempt}/${MAX_ATTEMPTS}: ${reason}`,
      );
      if (attempt === MAX_ATTEMPTS) return [];
      const delay = BASE_DELAY_MS * 2 ** (attempt - 1) + Math.random() * 1000;
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return [];
}

async function fetchAllBatchesForDevice(device, startTime, endTime) {
  const client = createHikClient();
  let position = 0;
  const allEvents = [];

  while (true) {
    const postData = {
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: position,
        maxResults: MAX_RESULTS_PER_REQUEST,
        major: 5,
        minor: 75,
        startTime,
        endTime,
      },
    };

    const batch = await fetchEventsBatch(client, device.device_ip, postData);
    if (!batch.length) break;

    allEvents.push(...batch.map((e) => ({ ...e, device })));
    position += batch.length;
  }

  return allEvents;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function getDayRange(offsetDays = 0) {
  const pad = (n) => String(n).padStart(2, "0");
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() + offsetDays);
  return {
    startTime: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T00:00:00+05:00`,
    endTime: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T23:59:59+05:00`,
  };
}

function getRange(from, to) {
  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const start = new Date(from);
  const end = to ? new Date(to) : new Date();
  return {
    startTime: `${fmt(start)}T00:00:00+05:00`,
    endTime: `${fmt(end)}T23:59:59+05:00`,
  };
}

async function asyncPool(poolLimit, array, iteratorFn) {
  const ret = [];
  const executing = new Set();
  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p);
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean).catch(clean);
    if (executing.size >= poolLimit) await Promise.race(executing);
  }
  return Promise.all(ret);
}

async function ensureEmployeeExists(empId, info, allEmployeeIds) {
  if (allEmployeeIds.has(empId)) return true;
  if (!ADD_NOT_FOUND_USER) return false;

  try {
    await addEmployeeRaw({
      id: empId,
      first_name: info.name,
      branch_id: 15,
      status: true,
    });
    allEmployeeIds.add(empId);
    console.log(`👤 Добавлен новый пользователь: ${info.name} (${empId})`);
    return true;
  } catch (err) {
    console.error("Ошибка добавления нового сотрудника:", err);
    return false;
  }
}

// ─── Main checker ─────────────────────────────────────────────────────────────

export async function events_checker(from, to) {
  const { startTime, endTime } =
    typeof from === "number" ? getDayRange(from) : getRange(from, to);

  const [allActiveDoors, existedIds, allEmployeeIds, employeeSubscribers] =
    await Promise.all([
      DoorModel.findActive(),
      FacePassesModel.findIds(startTime, endTime),
      EmployeeModel.getAllIds(),
      telegramBotsService.getEventAlertBots(),
    ]);

  const existedFacePassIds = new Set(existedIds);
  const employeeIdSet = new Set(allEmployeeIds);

  await asyncPool(3, allActiveDoors, async (door) => {
    try {
      console.log(`🚪 Сбор событий для двери: ${door.name}`);

      const perDevice = await asyncPool(
        10,
        door.faceDevices || [],
        async (device) => {
          try {
            return await fetchAllBatchesForDevice(device, startTime, endTime);
          } catch (err) {
            console.error(`❌ Устройство ${device.device_ip}:`, err.message);
            return [];
          }
        },
      );
      const doorEvents = perDevice.flat();

      // 2. Фильтруем только новые
      const newEvents = doorEvents.filter(
        (e) => !existedFacePassIds.has(`${e.employeeNoString}-${e.serialNo}`),
      );

      // 3. Проверяем/добавляем сотрудников
      await asyncPool(10, newEvents, async (e) => {
        const ok = await ensureEmployeeExists(
          Number(e.employeeNoString),
          e,
          employeeIdSet,
        );
        if (!ok) e.skip = true;
      });

      const eventsToInsert = newEvents.filter((e) => !e.skip);

      console.log(
        `📌 ${door.name}: всего ${doorEvents.length} / новых ${newEvents.length} / добавляем ${eventsToInsert.length}`,
      );

      if (!eventsToInsert.length) return;

      await asyncPool(5, eventsToInsert, async (e) => {
        e._resolvedPhoto = await resolveEventPhoto(e).catch((err) => {
          console.error(`❌ Фото для ${e.serialNo}:`, err.message);
          return null;
        });
      });

      // 5. Записываем в базу — фото уже готово, updatePhoto не нужен
      const newPasses = await FacePassesModel.bulkCreate(
        eventsToInsert.map((e) => ({
          date: e.time,
          identifier: `${e.employeeNoString}-${e.serialNo}`,
          photo: e._resolvedPhoto ?? null,
          employee_id: Number(e.employeeNoString),
          door_id: e.device.door_id,
          face_devices_id: e.device.id,
          direction: e.device.direction,
        })),
      );

      // 6. Уведомления (fire-and-forget, не блокируем)
      const eventByIdentifier = new Map(
        eventsToInsert.map((e) => [`${e.employeeNoString}-${e.serialNo}`, e]),
      );

      for (const newPass of newPasses) {
        existedFacePassIds.add(newPass.identifier);

        const e = eventByIdentifier.get(newPass.identifier);
        if (!e) continue;

        const chats = employeeSubscribers.get(Number(e.employeeNoString));
        if (chats?.size > 0) {
          notificationsOutboxService
            .create("face_pass", newPass, chats)
            .catch((err) =>
              console.error(`❌ Уведомление для ${newPass.id}:`, err.message),
            );
        }
      }

      console.log(`✅ ${door.name}: добавлено ${eventsToInsert.length}`);
    } catch (err) {
      console.error(`❌ Дверь ${door.name}:`, err.message);
    }
  });

  console.log("🏁 Все двери обработаны");
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

export function scheduleEventsChecker() {
  const tiers = [
    {
      label: "live",
      windowMs: 60 * 60 * 1000, // 1 час
      intervalMs: 30 * 60 * 1000, // каждые 30 минут
    },
    {
      label: "recovery",
      windowMs: 12 * 60 * 60 * 1000, // 12 часов
      intervalMs: 3 * 60 * 60 * 1000, // каждые 3 часа
    },
    {
      label: "deep_sync",
      windowMs: 24 * 60 * 60 * 1000, // 24 часа
      intervalMs: 24 * 60 * 60 * 1000, // каждые 24 часа
    },
    {
      label: "weekly_sync",
      windowMs: 30 * 24 * 60 * 60 * 1000, // 30 дней (месяц)
      intervalMs: 7 * 24 * 60 * 60 * 1000, // каждые 7 дней (неделя)
    },
  ];

  return function start() {
    tiers.forEach(({ label, windowMs, intervalMs }) => {
      const run = async () => {
        const endTime = new Date();
        const startTime = new Date(endTime - windowMs);

        try {
          console.log(
            `🚀 [${label}] ${startTime.toISOString()} → ${endTime.toISOString()}`,
          );
          await events_checker(startTime, endTime);
        } catch (err) {
          console.error(`❌ [${label}] Ошибка:`, err.message);
        } finally {
          setTimeout(run, intervalMs);
        }
      };

      const jitter = Math.random() * 5000;
      setTimeout(run, jitter);
    });
  };
}
