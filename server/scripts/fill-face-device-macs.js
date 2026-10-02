import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env"),
});

import fetch from "digest-fetch";
import { prismaPublic, getPrismaForTenant, disconnectAll } from "../utils/prismaForTenant.js";
import { normalizeMac } from "../utils/utils.js";
import pool from "../db.js";

const USERNAME = "admin";
const API_DEVICE_INFO = "/ISAPI/System/deviceInfo?format=json";

const xmlTag = (xml, tag) =>
  xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i"))?.[1]?.trim() ?? null;

// Часть прошивок игнорирует ?format=json и всё равно отдаёт XML.
function parseDeviceInfo(body) {
  if (body.trimStart().startsWith("<")) {
    return {
      macAddress: xmlTag(body, "macAddress"),
      serialNumber: xmlTag(body, "serialNumber"),
    };
  }
  return JSON.parse(body)?.DeviceInfo ?? {};
}

// MAC-адрес у Hikvision отдаётся только самим устройством, в событиях его
// приходится с чем-то сопоставлять — поэтому один раз опрашиваем каждое
// локальное устройство и сохраняем.
async function fetchMac(device) {
  const client = new fetch(USERNAME, device.password ?? process.env.PASSWORD);
  const url = `http://${device.device_ip}:${device.port ?? 80}${API_DEVICE_INFO}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await client.fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

    const info = parseDeviceInfo(await res.text());
    return { mac: normalizeMac(info.macAddress), serial: info.serialNumber ?? null };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function run() {
  const tenants = await prismaPublic.tenants.findMany();
  let filled = 0;
  let failed = 0;

  for (const tenant of tenants) {
    const prisma = getPrismaForTenant(tenant.schema);

    const devices = await prisma.face_devices.findMany({
      where: { mac_address: null, is_local: true },
    });

    if (!devices.length) {
      console.log(`[${tenant.schema}] нечего заполнять`);
      continue;
    }

    console.log(`[${tenant.schema}] устройств без MAC: ${devices.length}`);

    for (const device of devices) {
      try {
        const { mac, serial } = await fetchMac(device);

        if (!mac) {
          console.warn(`  ⚠️ ${device.device_ip} (${device.name}): устройство не вернуло MAC`);
          failed++;
          continue;
        }

        await prisma.face_devices.update({
          where: { id: device.id },
          data: {
            mac_address: mac,
            // серийник тоже подтянем, если его ещё нет
            ...(device.serial_number || !serial ? {} : { serial_number: serial }),
          },
        });

        console.log(`  ✅ ${device.device_ip} (${device.name}) → ${mac}`);
        filled++;
      } catch (err) {
        const reason = err.name === "AbortError" ? "таймаут 10с" : err.message;
        console.error(`  ❌ ${device.device_ip} (${device.name}): ${reason}`);
        failed++;
      }
    }
  }

  console.log(`\nЗаполнено: ${filled}, не удалось: ${failed}`);
  console.log(
    "Удалённым устройствам (is_local=false) MAC нужно проставить вручную — " +
      "опросить их напрямую нельзя.",
  );
}

run()
  .catch((err) => {
    console.error("Fatal:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectAll();
    await pool.end();
  });
