import "dotenv/config";
import fetch from "digest-fetch";
import pool from "../db.js";
import { internalIpV4 } from "internal-ip";
import { config } from "../config.js";

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

export const FaceDeviceClient = {
  async updateUser(ip, employeeId, fullName) {
    const client = new fetch(username, password);

    const url = `http://${ip}${api_edit_user}`;

    const payload = {
      UserInfo: {
        employeeNo: employeeId,
        userType: "normal",
        Valid: {
          enable: true,
          beginTime: "2023-01-01T00:00:00",
          endTime: "2037-12-31T23:59:59",
        },
        doorRight: "1",
        RightPlan: [{ doorNo: 1, planTemplateNo: "1" }],
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
      throw new Error(`Ошибка обновления пользователя (${res.status})`);
    }
  },

  async updateUserPhoto(ip, employeeId, fullName, photoPath) {
    const client = new fetch(username, password);

    const url = `http://${ip}${api_edit_user_photo}`;

    const tempLinkRes = await axios.get(
      `http://${serverIp}:${config.port}/api/employees/image-link/${photoPath}`,
    );

    const photoUrl = tempLinkRes.data.url;

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

  // ➕ Добавление / обновление пользователя
  async addUserToDevice(employeeNo, name, deviceSerial) {
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
  },

  // 📷 Добавление фото
  async addUserPhotoToDevice(employeeNo, name, deviceSerial, photoPath) {
    await this.ensureToken();

    const url = `${this.domain}/api/hpcgw/v1/device/transparent/ISAPI/Intelligent/FDLib/FDSetUp?format=json`;

    const tempLinkRes = await axios.get(
      `http://${serverIp}:${config.port}/api/employees/image-link/${photoPath}`,
    );

    const photoUrl = tempLinkRes.data.url;

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
  },

  // ❌ Удаление пользователя
  async deleteUserFromDevice(employeeNo, deviceSerial) {
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
