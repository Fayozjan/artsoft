import "dotenv/config";
import path from "path";
import net from "net";
import fetch from "digest-fetch";
import pool from "../db.js";
import { internalIpV4 } from "internal-ip";
import { config } from "../config.js";
import { createTempToken } from "../middlewares/tempPhotoToken.js";

import axios from "axios";

const serverIp = await internalIpV4();
const username = "admin";
const password = process.env.PASSWORD;
const client = new fetch(username, password);

const api_get_users = "/ISAPI/AccessControl/UserInfo/Search?format=json";
const api_edit_user = "/ISAPI/AccessControl/UserInfo/SetUp?format=json";
const api_edit_user_photo = "/ISAPI/Intelligent/FDLib/FDSetUp?format=json";
const api_delete_user =
  "/ISAPI/AccessControl/UserInfoDetail/Delete?format=json";
const api_user_count = "/ISAPI/AccessControl/UserInfo/Count?format=json";
const api_user_capabilities = "/ISAPI/AccessControl/UserInfo/capabilities?format=json";

// Обёртки узлов у прошивок расходятся (UserInfoCount/UserInfo/плоский json) —
// пробуем известные варианты по очереди вместо жёсткого пути.
function extractCount(data) {
  const n =
    data?.UserInfoCount?.userNumber ??
    data?.UserInfo?.userNumber ??
    data?.userNumber;
  const num = Number(n);
  return Number.isFinite(num) ? num : null;
}

function extractMaxCapacity(data) {
  const n =
    data?.UserInfo?.maxRecordNum ??
    data?.maxRecordNum ??
    data?.UserInfoCount?.maxRecordNum;
  const num = Number(n);
  return Number.isFinite(num) ? num : null;
}
// Без ?format=json: подтверждено на реальном устройстве — с этим параметром
// System/time принимает только JSON-тело, а XML-тело (обязательное для этого
// core-модуля) отклоняет как badXmlContent даже при корректном XML.
const api_time = "/ISAPI/System/time";
const api_ntp_server = "/ISAPI/System/time/ntpServers/1";

const NTP_HOST = "time.google.com";

const pad = (n) => String(n).padStart(2, "0");

// ISAPI требует timeZone в POSIX-формате (знак смещения инвертирован:
// восток от Гринвича — минус). offsetMinutes — обычное смещение (Ташкент = +300).
function buildPosixTimeZone(offsetMinutes) {
  const sign = offsetMinutes <= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  return `CST${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}:00`;
}

const ISAPI_XML_NS = 'xmlns="http://www.isapi.org/ver20/XMLSchema"';

// System/time и его ntpServers — древние core-модули ISAPI, тело запроса
// принимают только в XML. С ?format=json в URL — независимо от заголовков —
// требуют JSON-тело (иначе 400 badXmlFormat); без него — XML-тело (badXmlContent
// при некорректном XML). Поэтому запрос идёт БЕЗ ?format=json, ответ тоже XML.

// Режим manual — время выставляется вручную одним запросом.
function buildManualTimeXml(offsetMinutes) {
  const target = new Date(Date.now() + offsetMinutes * 60000);
  const localTime =
    `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(target.getUTCDate())}` +
    `T${pad(target.getUTCHours())}:${pad(target.getUTCMinutes())}:${pad(target.getUTCSeconds())}`;

  const isoSign = offsetMinutes >= 0 ? "+" : "-";
  const isoAbs = Math.abs(offsetMinutes);
  const isoOffset = `${isoSign}${pad(Math.floor(isoAbs / 60))}:${pad(isoAbs % 60)}`;

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Time version="2.0" ${ISAPI_XML_NS}>` +
    `<timeMode>manual</timeMode>` +
    `<localTime>${localTime}${isoOffset}</localTime>` +
    `<timeZone>${buildPosixTimeZone(offsetMinutes)}</timeZone>` +
    `</Time>`
  );
}

// Режим NTP — таймзона выставляется отдельно, часы устройство тянет само
// с NTP-сервера (time.google.com), поэтому localTime не передаём.
function buildNtpTimeXml(offsetMinutes) {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Time version="2.0" ${ISAPI_XML_NS}>` +
    `<timeMode>NTP</timeMode>` +
    `<timeZone>${buildPosixTimeZone(offsetMinutes)}</timeZone>` +
    `</Time>`
  );
}

function buildNtpServerXml() {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<NTPServer version="2.0" ${ISAPI_XML_NS}>` +
    `<id>1</id>` +
    `<addressingFormatType>hostname</addressingFormatType>` +
    `<hostName>${NTP_HOST}</hostName>` +
    `<portNo>123</portNo>` +
    `<synchronizeInterval>60</synchronizeInterval>` +
    `</NTPServer>`
  );
}

// Ошибки синхронизации времени приводим к стабильным кодам: UI переводит код
// сам, а detail (текст устройства) показывает вторым планом и не переводит.
export function syncTimeError(code, detail = "") {
  const err = new Error(detail ? `${code}: ${detail}` : code);
  err.syncCode = code;
  err.detail = String(detail || "").slice(0, 200);
  return err;
}

// Устройство отвечает XML/JSON: в UI нужен statusString, а не весь дамп тела.
function extractDeviceMessage(body) {
  if (!body) return "";
  const text = typeof body === "string" ? body : JSON.stringify(body);
  const sub = text.match(/<subStatusCode>([^<]+)<\/subStatusCode>/i)?.[1];
  const status = text.match(/<statusString>([^<]+)<\/statusString>/i)?.[1];

  let fromJson = "";
  try {
    const parsed = JSON.parse(text);
    fromJson =
      parsed?.subStatusCode ||
      parsed?.statusString ||
      parsed?.message ||
      parsed?.errorCode ||
      "";
  } catch {
    fromJson = "";
  }

  const message = sub || status || fromJson || text;
  return String(message).replace(/\s+/g, " ").trim().slice(0, 200);
}

const NETWORK_ERROR_CODES = {
  ECONNREFUSED: "CONNECTION_REFUSED",
  ETIMEDOUT: "TIMEOUT",
  ESOCKETTIMEDOUT: "TIMEOUT",
  ECONNABORTED: "TIMEOUT",
  EHOSTUNREACH: "UNREACHABLE",
  ENETUNREACH: "UNREACHABLE",
  ENOTFOUND: "UNREACHABLE",
  EAI_AGAIN: "UNREACHABLE",
  ECONNRESET: "NETWORK",
  EPIPE: "NETWORK",
};

export function classifyTransportError(err) {
  if (err?.syncCode) return err;

  const code =
    NETWORK_ERROR_CODES[err?.code] || NETWORK_ERROR_CODES[err?.errno];
  if (code) return syncTimeError(code, err?.message);
  if (err?.type === "request-timeout" || /timeout/i.test(err?.message || ""))
    return syncTimeError("TIMEOUT", err?.message);

  return syncTimeError("NETWORK", err?.message);
}

export function classifyHttpError(status, body) {
  const detail = extractDeviceMessage(body);
  if (status === 401 || status === 403) return syncTimeError("AUTH", detail);
  if (status === 404) return syncTimeError("NOT_SUPPORTED_BY_DEVICE", detail);
  if (status >= 500)
    return syncTimeError("DEVICE_ERROR", detail || `HTTP ${status}`);
  return syncTimeError("DEVICE_REJECTED", detail || `HTTP ${status}`);
}

export const FaceDeviceClient = {
  async updateUser(ip, employeeId, fullName) {
    const client = new fetch(username, password);

    const url = `http://${ip}${api_edit_user}`;

    const payload = {
      UserInfo: {
        employeeNo: String(employeeId),
        userType: "normal",
        Valid: {
          enable: true,
          beginTime: "2023-01-01T00:00:00",
          endTime: "2037-12-31T23:59:59",
        },
        doorRight: "1",
        RightPlan: [
          {
            doorNo: 1,
            planTemplateNo: "1",
          },
        ],
        name: fullName,
      },
    };

    const res = await client.fetch(url, {
      method: "PUT",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "(no body)");
      console.error(`[updateUser] ${ip} 400 payload:`, JSON.stringify(payload));
      console.error(`[updateUser] ${ip} response:`, body);
      throw new Error(`Ошибка обновления пользователя (${res.status})`);
    }
  },

  async updateUserPhoto(ip, employeeId, fullName, photoPath) {
    const client = new fetch(username, password);

    const url = `http://${ip}${api_edit_user_photo}`;

    const filePath = path.join(
      process.cwd(),
      "uploads",
      "employees",
      photoPath,
    );
    const token = createTempToken(filePath);
    const photoUrl = `http://${serverIp}:${config.port}/api/employees/photo/${token}`;

    const payload = {
      faceURL: photoUrl,
      faceLibType: "blackFD",
      FDID: "1",
      FPID: String(employeeId),
      bornTime: "1990-01-01T00:00:00Z",
      name: fullName,
      saveFacePic: true,
    };

    const res = await client.fetch(url, {
      method: "PUT",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Ошибка загрузки фото (${res.status})`);
    }
  },

  async deleteUser(ip, employeeId) {
    const client = new fetch(username, password);
    const url = `http://${ip}${api_delete_user}`;

    const res = await client.fetch(url, {
      method: "PUT",
      body: JSON.stringify({
        UserInfoDetail: {
          mode: "byEmployeeNo",
          EmployeeNoList: [
            {
              employeeNo: String(employeeId),
            },
          ],
        },
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.log(`Error HTTP: Ошибка удаления пользователя ${res.status}`);
    }
  },

  async searchUsers(ip) {
    const client = new fetch(username, password);
    const url = `http://${ip}${api_get_users}`;
    const users = [];
    let position = 0;
    let hasMore = true;

    while (hasMore) {
      const res = await client.fetch(url, {
        method: "POST",
        body: JSON.stringify({
          UserInfoSearchCond: {
            searchID: "1",
            searchResultPosition: position,
            maxResults: 30,
          },
        }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) break;
      const data = await res.json();
      const items = data?.UserInfoSearch?.UserInfo || [];
      users.push(
        ...items.map((u) => ({ employeeNo: u.employeeNo, name: u.name || "" })),
      );
      hasMore = data?.UserInfoSearch?.responseStatusStrg === "MORE";
      if (hasMore) position += items.length;
    }
    return users;
  },

  async syncTime(ip, offsetMinutes, mode = "manual") {
    const client = new fetch(username, password);

    const putXml = async (path, xml) => {
      let res;
      try {
        res = await client.fetch(`http://${ip}${path}`, {
          method: "PUT",
          body: xml,
          headers: { "Content-Type": "application/xml" },
        });
      } catch (err) {
        throw classifyTransportError(err);
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw classifyHttpError(res.status, body);
      }
    };

    if (mode === "ntp") {
      // NTP-сервер — обязательный шаг, именно он запускает синхронизацию.
      await putXml(api_ntp_server, buildNtpServerXml());
      // Переключение timeMode на NTP часть прошивок отклоняет как избыточное
      // (сервер уже включён и синхронизирует), это не должно считаться сбоем.
      try {
        await putXml(api_time, buildNtpTimeXml(offsetMinutes));
      } catch (err) {
        console.warn(`syncTime NTP ${ip}: timeMode не переключён:`, err.message);
      }
    } else {
      await putXml(api_time, buildManualTimeXml(offsetMinutes));
    }
  },

  async checkOnline(ip, port = 80, timeout = 2000) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const finish = (online) => {
        socket.destroy();
        resolve(online);
      };
      socket.setTimeout(timeout);
      socket.once("connect", () => finish(true));
      socket.once("timeout", () => finish(false));
      socket.once("error", () => finish(false));
      socket.connect(port, ip);
    });
  },

  // Сколько людей уже прописано на терминале и сколько всего влезает.
  // Не хранится в базе — запрашивается на лету, как онлайн-статус.
  async getUserCapacity(ip) {
    const client = new fetch(username, password);

    const [countRes, capRes] = await Promise.all([
      client.fetch(`http://${ip}${api_user_count}`, { method: "GET" }),
      client.fetch(`http://${ip}${api_user_capabilities}`, { method: "GET" }),
    ]);

    if (!countRes.ok || !capRes.ok) {
      throw new Error(`Ошибка запроса вместимости (${countRes.status}/${capRes.status})`);
    }

    const [countData, capData] = await Promise.all([
      countRes.json(),
      capRes.json(),
    ]);

    return {
      registered: extractCount(countData),
      capacity: extractMaxCapacity(capData),
    };
  },
};

export const RemoteFaceDeviceClient = {
  apiKey: "ykED51zjLL",
  apiSecret: "qVbE912Yuy",

  accessToken: null,
  tokenExpireTime: 0,
  domain: null,

  // 🔐 Получение токена
  async getToken() {
    try {
      const response = await axios.post(
        "https://api.hik-partnerru.com/api/hpcgw/v1/token/get",
        {
          appKey: this.apiKey,
          secretKey: this.apiSecret,
        },
      );

      if (response.data.errorCode !== "0") {
        throw new Error(response.data.message || "Token error");
      }

      const data = response.data.data;

      this.accessToken = data.accessToken;
      this.tokenExpireTime = Date.now() + data.expireTime - 60000;

      this.domain = data.areaDomain.startsWith("http")
        ? data.areaDomain
        : `https://${data.areaDomain}`;

      return true;
    } catch (error) {
      throw new Error(
        error.response?.data?.message ||
          error.response?.data ||
          error.message ||
          "Token request failed",
      );
    }
  },

  // 🔄 Проверка токена
  async ensureToken() {
    if (!this.accessToken || Date.now() >= this.tokenExpireTime) {
      await this.getToken();
    }
  },

  isTokenExpiredError(err) {
    return (
      err?.errorCode === "LAP500004" ||
      err?.message?.includes("LAP500004") ||
      err?.response?.data?.errorCode === "LAP500004" ||
      err?.response?.data?.message?.includes("LAP500004")
    );
  },

  async callWithRetry(fn) {
    try {
      return await fn();
    } catch (err) {
      if (this.isTokenExpiredError(err)) {
        this.accessToken = null;
        this.tokenExpireTime = 0;
        await this.getToken();
        return fn();
      }
      throw err;
    }
  },

  // ➕ Добавление / обновление пользователя
  async addUserToDevice(employeeNo, name, deviceSerial) {
    return this.callWithRetry(async () => {
      await this.ensureToken();

      const url = `${this.domain}/api/hpcgw/v1/device/transparent/ISAPI/AccessControl/UserInfo/SetUp?format=json`;

      const data = {
        UserInfo: {
          employeeNo,
          name,
          userType: "normal",
          Valid: {
            enable: true,
            beginTime: "2024-01-01T00:00:00",
            endTime: "2037-12-31T23:59:59",
            timeType: "local",
          },
          doorRight: "1",
          RightPlan: [
            {
              doorNo: 1,
              planTemplateNo: "1",
            },
          ],
        },
      };

      try {
        const response = await axios.put(url, data, {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "X-Devserial": deviceSerial,
            "Content-Type": "application/json",
          },
        });

        if (response.data.errorCode && response.data.errorCode !== "0") {
          throw new Error(response.data.message || "User API error");
        }

        const status = response.data.ResponseStatus || response.data;

        if (status.statusCode !== 1 && status.statusString !== "OK") {
          throw new Error(
            status.subStatusCode ||
              status.statusString ||
              "Device rejected user setup",
          );
        }

        return true;
      } catch (error) {
        throw new Error(
          error.response?.data?.message ||
            error.response?.data?.ResponseStatus?.subStatusCode ||
            error.response?.data ||
            error.message ||
            "User setup failed",
        );
      }
    });
  },

  // 📷 Добавление фото
  async addUserPhotoToDevice(
    employeeNo,
    name,
    deviceSerial,
    photoPath,
    tenant,
  ) {
    return this.callWithRetry(async () => {
      await this.ensureToken();

      const url = `${this.domain}/api/hpcgw/v1/device/transparent/ISAPI/Intelligent/FDLib/FDSetUp?format=json`;

      const filePath = path.join(
        process.cwd(),
        "uploads",
        "employees",
        photoPath,
      );
      const token = createTempToken(filePath);
      const photoUrl = `https://${tenant}.onbase.uz/api/employees/photo/${token}`;

      const data = {
        faceURL: photoUrl,
        faceLibType: "blackFD",
        FDID: "1",
        FPID: String(employeeNo),
        name: name,
        bornTime: "1990-01-01T00:00:00Z",
        saveFacePic: true,
      };

      try {
        const response = await axios.put(url, data, {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "X-Devserial": deviceSerial,
            "Content-Type": "application/json",
          },
        });

        if (response.data.errorCode && response.data.errorCode !== "0") {
          throw new Error(response.data.message || "Photo API error");
        }

        const status = response.data.ResponseStatus || response.data;

        if (status.statusCode !== 1 && status.statusString !== "OK") {
          throw new Error(
            status.subStatusCode ||
              status.statusString ||
              "Device rejected photo",
          );
        }

        return true;
      } catch (error) {
        throw new Error(
          error.response?.data?.message ||
            error.response?.data?.ResponseStatus?.subStatusCode ||
            error.response?.data ||
            error.message ||
            "Photo upload failed",
        );
      }
    });
  },

  async getUsers(deviceSerial) {
    return this.callWithRetry(async () => {
      await this.ensureToken();
      const url = `${this.domain}/api/hpcgw/v1/device/transparent/ISAPI/AccessControl/UserInfo/Search?format=json`;
      const users = [];
      let position = 0;
      let hasMore = true;

      while (hasMore) {
        try {
          const response = await axios.post(
            url,
            {
              UserInfoSearchCond: {
                searchID: "1",
                searchResultPosition: position,
                maxResults: 30,
              },
            },
            {
              headers: {
                Authorization: `Bearer ${this.accessToken}`,
                "X-Devserial": deviceSerial,
                "Content-Type": "application/json",
              },
            },
          );
          if (response.data.errorCode && response.data.errorCode !== "0") {
            if (this.isTokenExpiredError(response.data))
              throw new Error(response.data.message);
            break;
          }
          const items = response.data?.UserInfoSearch?.UserInfo || [];
          users.push(
            ...items.map((u) => ({
              employeeNo: u.employeeNo,
              name: u.name || "",
            })),
          );
          hasMore =
            response.data?.UserInfoSearch?.responseStatusStrg === "MORE";
          if (hasMore) position += items.length;
          else break;
        } catch (err) {
          if (this.isTokenExpiredError(err)) throw err;
          break;
        }
      }
      return users;
    });
  },

  // 📋 Получение событий доступа
  async getEvents(deviceSerial, startTime, endTime) {
    return this.callWithRetry(async () => {
      await this.ensureToken();

      const url = `${this.domain}/api/hpcgw/v1/device/transparent/ISAPI/AccessControl/AcsEvent?format=json`;
      const allEvents = [];
      let position = 0;

      while (true) {
        let response;
        try {
          response = await axios.post(
            url,
            {
              AcsEventCond: {
                searchID: "1",
                searchResultPosition: position,
                maxResults: 100,
                major: 5,
                minor: 75,
                startTime,
                endTime,
                picEnable: false,
              },
            },
            {
              headers: {
                Authorization: `Bearer ${this.accessToken}`,
                "X-Devserial": deviceSerial,
                "Content-Type": "application/json",
              },
              timeout: 20000,
            },
          );
        } catch (err) {
          if (this.isTokenExpiredError(err)) throw err;
          console.warn(
            `⚠️ [remote:${deviceSerial}] getEvents error: ${err.message}`,
          );
          break;
        }

        if (response.data.errorCode && response.data.errorCode !== "0") {
          if (this.isTokenExpiredError(response.data))
            throw new Error(response.data.message);
          console.warn(
            `⚠️ [remote:${deviceSerial}] API error: ${response.data.message}`,
          );
          break;
        }

        const batch = response.data?.AcsEvent?.InfoList || [];
        if (!batch.length) break;

        allEvents.push(...batch);
        position += batch.length;
      }

      return allEvents;
    });
  },

  // 🕒 Синхронизация времени
  async syncTime(deviceSerial, offsetMinutes, mode = "manual") {
    return this.callWithRetry(async () => {
      await this.ensureToken();

      // Без ?format=json (см. комментарий у api_time выше) — с ним устройство
      // ждёт JSON-тело и отклоняет XML как badXmlContent. Ответ тоже придёт
      // как XML-строка, поэтому статус не разбираем — успех есть успех, если
      // axios не бросил исключение (не 2xx).
      const putIsapi = async (isapiPath, xml) => {
        const url = `${this.domain}/api/hpcgw/v1/device/transparent${isapiPath}`;

        try {
          await axios.put(url, xml, {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              "X-Devserial": deviceSerial,
              "Content-Type": "application/xml",
            },
          });
        } catch (error) {
          // Протухший токен обрабатывает callWithRetry — ошибку не подменяем.
          if (this.isTokenExpiredError(error)) throw error;
          if (error.response)
            throw classifyHttpError(error.response.status, error.response.data);
          throw classifyTransportError(error);
        }
      };

      if (mode === "ntp") {
        // NTP-сервер — обязательный шаг, именно он запускает синхронизацию.
        await putIsapi("/ISAPI/System/time/ntpServers/1", buildNtpServerXml());
        // Переключение timeMode часть прошивок отклоняет как избыточное
        // (сервер уже включён и синхронизирует), это не должно считаться сбоем.
        try {
          await putIsapi("/ISAPI/System/time", buildNtpTimeXml(offsetMinutes));
        } catch (err) {
          console.warn(
            `syncTime NTP [remote:${deviceSerial}]: timeMode не переключён: ${err.message}`,
          );
        }
      } else {
        await putIsapi("/ISAPI/System/time", buildManualTimeXml(offsetMinutes));
      }

      return true;
    });
  },

  // ❌ Удаление пользователя
  async deleteUserFromDevice(employeeNo, deviceSerial) {
    return this.callWithRetry(async () => {
      await this.ensureToken();

      const url = `${this.domain}/api/hpcgw/v1/device/transparent/ISAPI/AccessControl/UserInfo/Delete?format=json`;

      const data = {
        UserInfoDelCond: {
          EmployeeNoList: [{ employeeNo }],
        },
      };

      try {
        const response = await axios.put(url, data, {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "X-Devserial": deviceSerial,
            "Content-Type": "application/json",
          },
        });

        if (response.data.errorCode && response.data.errorCode !== "0") {
          throw new Error(response.data.message || "Delete API error");
        }

        const status = response.data.ResponseStatus || response.data;

        if (status.statusCode !== 1 && status.statusString !== "OK") {
          throw new Error(
            status.subStatusCode ||
              status.statusString ||
              "Device rejected delete",
          );
        }

        return true;
      } catch (error) {
        throw new Error(
          error.response?.data?.message ||
            error.response?.data?.ResponseStatus?.subStatusCode ||
            error.response?.data ||
            error.message ||
            "User delete failed",
        );
      }
    });
  },

  // Аналог FaceDeviceClient.getUserCapacity, только через транспарентный канал
  async getUserCapacity(deviceSerial) {
    return this.callWithRetry(async () => {
      await this.ensureToken();

      const headers = {
        Authorization: `Bearer ${this.accessToken}`,
        "X-Devserial": deviceSerial,
        "Content-Type": "application/json",
      };

      const [countRes, capRes] = await Promise.all([
        axios.get(
          `${this.domain}/api/hpcgw/v1/device/transparent${api_user_count}`,
          { headers },
        ),
        axios.get(
          `${this.domain}/api/hpcgw/v1/device/transparent${api_user_capabilities}`,
          { headers },
        ),
      ]);

      if (countRes.data.errorCode && countRes.data.errorCode !== "0") {
        throw new Error(countRes.data.message || "Count API error");
      }

      return {
        registered: extractCount(countRes.data),
        capacity: extractMaxCapacity(capRes.data),
      };
    });
  },
};

export async function updateUser(door_ip, user_id, surname, name) {
  try {
    const url = `http://${door_ip}${api_edit_user}`;

    const authHeaderUser = await client.fetch(url, {
      method: "PUT",
      body: JSON.stringify({
        UserInfo: {
          employeeNo: user_id,
          userType: "normal",
          Valid: {
            enable: true,
            beginTime: "2023-01-01T00:00:00",
            endTime: "2037-12-31T23:59:59",
          },
          doorRight: "1",
          RightPlan: [{ doorNo: 1, planTemplateNo: "1" }],
          name: `${surname} ${name}`,
        },
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!authHeaderUser.ok) {
      console.log(
        `Error HTTP: ${authHeaderUser.status} ${authHeaderUser.statusText}`,
      );
    }

    const responseData = await authHeaderUser.json(); // Получаем и парсим ответ от API
    console.log(`Пользователь изменен в ${door_ip}:`, responseData);
  } catch (error) {
    console.error(
      `Ошибка при изменении пользователя в ${door_ip}:`,
      error.message,
    );
  }
}

export async function updateUserPhoto(
  door_ip,
  user_id,
  photo_url,
  surname,
  name,
) {
  try {
    const url = `http://${door_ip}${api_edit_user_photo}`;

    const authHeaderPhoto = await client.fetch(url, {
      method: "PUT",
      body: JSON.stringify({
        faceURL: photo_url,
        faceLibType: "blackFD",
        FDID: "1",
        FPID: user_id,
        bornTime: "1990-01-01T00:00:00Z",
        name: `${surname} ${name}`,
        PicFeaturePoints: [
          {
            featurePointType: "face",
            coordinatePoint: {
              x: 160,
              y: 160,
              width: 1,
              height: 1,
            },
          },
        ],
        saveFacePic: true,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!authHeaderPhoto.ok) {
      console.log(
        `Error HTTP: ${authHeaderPhoto.status} ${authHeaderPhoto.statusText}`,
      );
    }

    const responseData = await authHeaderPhoto.json(); // Получаем и парсим ответ от API
    console.log(`Фото изменено в ${door_ip}:`, responseData);
  } catch (error) {
    console.error(
      `Ошибка при изменении фотографии в ${door_ip}:`,
      error.message,
    );
  }
}

export async function deleteUser(door_ip, user_id) {
  try {
    const url = `http://${door_ip}${api_delete_user}`;

    const authHeaderUser = await client.fetch(url, {
      method: "PUT",
      body: JSON.stringify({
        UserInfoDelCond: { EmployeeNoList: [{ employeeNo: user_id }] },
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!authHeaderUser.ok) {
      console.log(
        `Error HTTP: ${authHeaderUser.status} ${authHeaderUser.statusText}`,
      );
    }

    const responseData = await authHeaderUser.json(); // Получаем и парсим ответ от API
    console.log(`Пользователь удален в ${door_ip}:`, responseData);
  } catch (error) {
    console.error(
      `Ошибка при удалении пользователя в ${door_ip}:`,
      error.message,
    );
  }
}

export async function deleteUserPhoto(door_ip, user_id) {
  try {
    const url = `http://${door_ip}${api_delete_user_photo}`;

    const authHeaderPhoto = await client.fetch(url, {
      method: "PUT",
      body: JSON.stringify({
        FPID: [{ value: user_id }],
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!authHeaderPhoto.ok) {
      console.log(
        `Error HTTP: ${authHeaderPhoto.status} ${authHeaderPhoto.statusText}`,
      );
    }

    const responseData = await authHeaderPhoto.json(); // Получаем и парсим ответ от API
    console.log(`Фото пользователя удалено из ${door_ip}:`, responseData);
  } catch (error) {
    console.error(
      `Ошибка при удалении фотографии из ${door_ip}:`,
      error.message,
    );
  }
}

export async function removeUserFromDoors(user_id) {
  try {
    // Получаем пользователя и его список дверей
    const {
      rows: [user],
    } = await pool.query(
      `SELECT name, surname, door FROM users WHERE user_id = $1`,
      [user_id],
    );

    if (!user) {
      console.log(`Пользователь с ID ${user_id} не найден.`);
      return;
    }

    const { door } = user;

    if (!Array.isArray(door) || door.length === 0) {
      console.log("У пользователя нет назначенных дверей.");
      return;
    }

    // Получаем все двери
    const { rows: allDoors } = await pool.query("SELECT * FROM doors");

    // Собираем уникальные IP адреса дверей (вход/выход)
    const uniqueDoorIps = new Set();

    for (const doorId of door) {
      const matchedDoor = allDoors.find((d) => d.id === doorId);
      if (matchedDoor) {
        if (matchedDoor.door_ip_entry)
          uniqueDoorIps.add(matchedDoor.door_ip_entry);
        if (matchedDoor.door_ip_exit)
          uniqueDoorIps.add(matchedDoor.door_ip_exit);
      }
    }

    if (uniqueDoorIps.size === 0) {
      console.log("Не найдено действительных IP адресов дверей.");
      return;
    }

    // Удаляем фото и пользователя с каждой уникальной двери
    for (const ip of uniqueDoorIps) {
      try {
        await deleteUserPhoto(ip, user_id);
        await deleteUser(ip, user_id);
        console.log(`Пользователь ${user_id} удален с двери по IP ${ip}`);
      } catch (err) {
        console.error(`Ошибка при удалении с двери ${ip}: ${err.message}`);
      }
    }

    console.log(`Удаление пользователя ${user_id} завершено.`);
  } catch (err) {
    console.error("Ошибка в removeUserFromDoors:", err.message);
  }
}

export async function getUsers(door_ip) {
  try {
    const url = `http://${door_ip}${api_get_users}`;

    const users_id = [];
    let searchResultPosition = 0;
    let hasMore = true;

    while (hasMore) {
      const authHeaderUser = await client.fetch(url, {
        method: "POST",
        body: JSON.stringify({
          UserInfoSearchCond: {
            searchID: "1",
            searchResultPosition: searchResultPosition,
            maxResults: 10,
          },
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!authHeaderUser.ok) {
        console.log(
          `Error HTTP: ${authHeaderUser.status} ${authHeaderUser.statusText}`,
        );
      }

      const responseData = await authHeaderUser.json(); // Получаем и парсим ответ от API
      const userInfoData = responseData?.UserInfoSearch?.UserInfo || [];
      const usersId = userInfoData.map((user) => user.employeeNo);
      users_id.push(...usersId);

      // Проверяем, есть ли еще данные
      hasMore = responseData?.UserInfoSearch?.responseStatusStrg === "MORE";
      if (hasMore) {
        searchResultPosition += userInfoData.length; // Увеличиваем позицию поиска
      }
    }

    console.log(
      `Всего пользователей получено для ${door_ip}:`,
      users_id.length,
    );
    return users_id; // Возвращаем массив всех пользователей
  } catch (error) {
    console.error(
      `Ошибка при получении пользователей ${door_ip}:`,
      error.message,
    );
    return []; // Возвращаем пустой массив в случае ошибки
  }
}
