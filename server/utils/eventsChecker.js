import fetch from "digest-fetch";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import fsPromises from "fs/promises";

import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { getActiveDoors } from "../modules/doors/doors.model.js";
import { getFacePassIds } from "../modules/facePasses/facePasses.model.js";
import {
  addEmployeeRaw,
  getAllEmployeeIds,
} from "../modules/employees/employees.model.js";
import { getFaceDeviceByDoorId } from "../modules/faceDevices/faceDevices.model.js";
import { addFacePass } from "../modules/facePasses/facePasses.service.js";

const ADD_NOT_FOUND_USER = process.env.ADD_NOT_FOUND_USER === "true";
const username = "admin";
const password = process.env.PASSWORD;
const api_get_events = "/ISAPI/AccessControl/AcsEvent?format=json";

async function downloadImageWithRetries(
  url,
  imagePath,
  maxAttempts = 3,
  delayMs = 2000
) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const client = new fetch(username, password);
      const response = await client.fetch(url);

      if (!response.ok) {
        throw new Error(
          `HTTP Error: ${response.status} ${response.statusText}`
        );
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      await fsPromises.writeFile(imagePath, buffer);
      return true;
    } catch (err) {
      console.warn(
        `⚠️ Попытка ${attempt} загрузки фото не удалась: ${err.message}`
      );
      if (attempt < maxAttempts) {
        await new Promise((res) => setTimeout(res, delayMs));
      }
    }
  }
  return false;
}

function getDayRange(offsetDays = 0) {
  const pad = (n) => String(n).padStart(2, "0");

  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() + offsetDays);

  const startTime = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(
    start.getDate()
  )}T00:00:00+05:00`;
  const endTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )}T23:59:59+05:00`;

  return { startTime, endTime };
}

export function createHikClient(username, password) {
  return new fetch(username, password);
}

export async function saveEventPhoto(info) {
  const imageUrl = info.pictureURL;
  if (!imageUrl) return null;

  const eventDate = new Date(info.time);
  const year = eventDate.getFullYear();
  const month = (eventDate.getMonth() + 1).toString().padStart(2, "0");
  const imageName = `${info.employeeNoString}-${info.serialNo}.jpg`;
  const eventFolderPath = path.join(
    __dirname,
    "..",
    "events",
    year.toString(),
    month
  );
  const imagePath = path.join(eventFolderPath, imageName);

  if (!fs.existsSync(eventFolderPath)) {
    fs.mkdirSync(eventFolderPath, { recursive: true });
  }

  const success = await downloadImageWithRetries(imageUrl, imagePath, 3, 2000);

  if (success) {
    return `api/events/${year}/${month}/${imageName}`;
  } else {
    console.log(
      `🚫 Фото для события ${info.serialNo} не удалось скачать. Сохраняем без фото.`
    );
    return null;
  }
}

export async function requestWithRetries(client, url, data, maxAttempts) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await client.fetch(url, {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

      const json = await res.json();

      // Достаём события прямо здесь
      const events = json?.AcsEvent?.InfoList || [];

      return events;
    } catch (err) {
      if (attempt < maxAttempts) {
        console.warn(`⚠️ Попытка ${attempt} не удалась: ${err.message}`);
        await new Promise((res) => setTimeout(res, 5000));
      }
    }
  }

  return [];
}

export async function getEventsBatch(client, url, postData, maxAttempts) {
  const response = await requestWithRetries(client, url, postData, maxAttempts);
  return response || [];
}

function filterNewEvents(events, existedFacePassIds) {
  return events.filter((e) => {
    const key = e.employeeNoString + "-" + e.serialNo;
    return !existedFacePassIds.has(key);
  });
}

async function ensureEmployeeExists(empId, info, allEmployeeIds) {
  const exists = allEmployeeIds.has(empId);

  if (exists) return true;

  if (!ADD_NOT_FOUND_USER) return false;

  try {
    await addEmployeeRaw({
      id: empId,
      first_name: info.name,
      branch_id: 1,
      status: true,
    });
  } catch (err) {
    console.error("Ошибка добавления нового сотрудника:", err);
    return false;
  }

  allEmployeeIds.add(empId);
  console.log(`👤 Добавлен новый пользователь: ${info.name} (${empId})`);
  return true;
}

export async function fetchEvents(
  startTime,
  endTime,
  device,
  existedFacePassIds,
  allEmployeeIds
) {
  const apiUrl = `http://${device.device_ip}${api_get_events}`;
  const client = createHikClient(username, password);

  const maxDataPerRequest = 30;
  const maxAttempts = 3;

  let position = 0;
  let hasMore = true;

  while (hasMore) {
    const postData = {
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: position,
        maxResults: maxDataPerRequest,
        major: 5,
        minor: 75,
        startTime,
        endTime,
      },
    };

    const batch = await getEventsBatch(client, apiUrl, postData, maxAttempts);

    if (batch.length === 0) {
      hasMore = false;
      break;
    }

    const newEvents = filterNewEvents(batch, existedFacePassIds);

    for (const info of newEvents) {
      const employeeId = Number(info.employeeNoString);

      const ok = await ensureEmployeeExists(employeeId, info, allEmployeeIds);

      if (!ok) continue;

      await insertEvent(info, device);
      existedFacePassIds.add(info.employeeNoString + "-" + info.serialNo);
    }

    position += batch.length;
  }

  console.log(`Готово: обработано ${existedFacePassIds.size} событий`);
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

    if (executing.size >= poolLimit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(ret);
}

async function fetchAllBatchesForDevice(device, startTime, endTime) {
  const client = createHikClient(username, password);
  const maxDataPerRequest = 100;
  const maxAttempts = 3;
  let position = 0;
  let hasMore = true;
  const batches = [];

  while (hasMore) {
    const postData = {
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: position,
        maxResults: maxDataPerRequest,
        major: 5,
        minor: 75,
        startTime,
        endTime,
      },
    };

    const batch = await getEventsBatch(
      client,
      `http://${device.device_ip}${api_get_events}`,
      postData,
      maxAttempts
    );

    if (!batch.length) {
      hasMore = false;
      break;
    }

    batches.push(...batch.map((e) => ({ ...e, device })));
    position += batch.length;
  }

  return batches;
}

async function processEvent(e, existedFacePassIds) {
  // Скачиваем фото параллельно
  const photoPathInDb = await saveEventPhoto(e);

  const payload = {
    date: e.time,
    identifier: `${e.employeeNoString}-${e.serialNo}`,
    photo: photoPathInDb,
    employee_id: Number(e.employeeNoString),
    door_id: e.device.door_id,
    face_devices_id: e.device.id,
    direction: e.device.direction,
  };

  try {
    const newPass = await addFacePass(payload);
    existedFacePassIds.add(e.employeeNoString + "-" + e.serialNo);
    return newPass;
  } catch (err) {
    console.error("Ошибка при добавлении события:", err);
    return null;
  }
}

export async function events_checker(time) {
  console.time("eventCheckerTime");

  const { startTime, endTime } = getDayRange(time);
  const allActiveDoors = await getActiveDoors();
  const existedFacePassIds = new Set(await getFacePassIds(startTime, endTime));
  const allEmployeeIds = new Set(await getAllEmployeeIds());

  const doorConcurrency = 3;

  await asyncPool(doorConcurrency, allActiveDoors, async (door) => {
    try {
      console.log(`🚪 Сбор событий для двери: ${door.name}`);

      const devices = await getFaceDeviceByDoorId(door.id);
      const deviceConcurrency = 10;
      let doorEvents = [];

      // 1. Собираем события с устройств двери параллельно
      await asyncPool(deviceConcurrency, devices, async (device) => {
        try {
          const deviceEvents = await fetchAllBatchesForDevice(
            device,
            startTime,
            endTime
          );
          doorEvents.push(...deviceEvents.map((e) => ({ ...e, device })));
        } catch (err) {
          console.error(
            `❌ Ошибка при обработке устройства ${device.device_ip}:`,
            err
          );
        }
      });

      // 2. Фильтруем новые события, которых ещё нет в базе
      const newEvents = doorEvents.filter((e) => {
        const key = e.employeeNoString + "-" + e.serialNo;
        return !existedFacePassIds.has(key);
      });

      // 3. Добавляем новых сотрудников при необходимости
      await asyncPool(10, newEvents, async (e) => {
        const empId = Number(e.employeeNoString);
        const ok = await ensureEmployeeExists(empId, e, allEmployeeIds);
        if (!ok) e.skip = true;
      });

      // 4. Фильтруем только события, которые реально пойдут в базу
      const eventsToInsert = newEvents.filter((e) => !e.skip);

      console.log(
        `📌 ${door.name}: all: ${doorEvents.length} / new: ${newEvents.length} / add: ${eventsToInsert.length}`
      );

      // 5. Добавляем события в базу с ограничением параллелизма
      const concurrency = 10;
      await asyncPool(concurrency, eventsToInsert, async (e) => {
        await processEvent(e, existedFacePassIds);
      });

      console.log(`✅ ${door.name}: ${eventsToInsert.length} added`);
    } catch (err) {
      console.error(`❌ Ошибка при обработке двери ${door.name}:`, err);
    }
  });

  console.log("🏁 Все двери обработаны");
  console.timeEnd("eventCheckerTime");
}
