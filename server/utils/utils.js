const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MAC_RE = /^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i;

// Прошивки кладут MAC в разные поля (macAddress, MACAddress, внутрь
// AccessControllerEvent) или не кладут вовсе. Ищем первое MAC-подобное
// значение по всему объекту, а не по конкретному имени поля.
export function extractMac(obj, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 4) return null;

  for (const value of Object.values(obj)) {
    if (typeof value === "string" && MAC_RE.test(value.trim())) return value.trim();
  }

  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      const found = extractMac(value, depth + 1);
      if (found) return found;
    }
  }

  return null;
}

// MAC храним в одном виде — строчными через двоеточие.
// Приходит по-разному: "AC-CB-51-..", "accb51..", "ac:cb:51:..".
// Невалидное значение → null, чтобы в базу не попал мусор.
export function normalizeMac(value) {
  if (!value) return null;
  const hex = String(value)
    .replace(/[^0-9a-fA-F]/g, "")
    .toLowerCase();
  if (hex.length !== 12) return null;
  return hex.match(/.{2}/g).join(":");
}

// Устройство с direction="universal" стоит на одной двери и на вход, и на выход —
// само направление не знает. Берём его из attendanceStatus события.
// Общий хелпер для webhook (facePasses.service) и cron events_sync (hikEventChecker),
// чтобы логика не разъезжалась между путями.
export function resolveEventDirection(device, event) {
  const deviceDirection = device?.direction ?? null;
  if (deviceDirection !== "universal") return deviceDirection;

  if (event?.attendanceStatus === "checkIn") return "entry";
  if (event?.attendanceStatus === "checkOut") return "exit";
  return null;
}

export async function retry(fn, { retries = 3, delay = 2000, onError } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (onError) {
        onError(err, attempt);
      }

      if (attempt < retries) {
        await sleep(delay);
      }
    }
  }

  throw lastError;
}
