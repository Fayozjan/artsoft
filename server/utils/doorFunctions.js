import "dotenv/config";
import fetch from "digest-fetch";
import pool from "../db.js";

const username = "admin";
const password = process.env.PASSWORD;
const client = new fetch(username, password);

const api_get_users = "/ISAPI/AccessControl/UserInfo/Search?format=json";
const api_edit_user = "/ISAPI/AccessControl/UserInfo/SetUp?format=json";
const api_edit_user_photo = "/ISAPI/Intelligent/FDLib/FDSetUp?format=json";
const api_delete_user = "/ISAPI/AccessControl/UserInfo/Delete?format=json";
const api_delete_user_photo =
  "/ISAPI/Intelligent/FDLib/FDSearch/Delete?format=json&FDID=1&faceLibType=blackFD";

/*
export async function updateUser(door_ip, user_id, surname, name) {
  try {
    const authHeaderUser = await digest(
      `http://${door_ip}${api_edit_user}`,
      'PUT',
      username,
      password
    );

    const response = await axios.put(
      `http://${door_ip}${api_edit_user}`,
      {
        UserInfo: {
          employeeNo: user_id,
          userType: 'normal',
          Valid: {
            enable: true,
            beginTime: '2023-01-01T00:00:00',
            endTime: '2037-12-31T23:59:59',
          },
          doorRight: '1',
          RightPlan: [{ doorNo: 1, planTemplateNo: '1' }],
          name: `${surname} ${name}`,
        },
      },
      {
        headers: {
          Authorization: authHeaderUser,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`Пользователь изменен в ${door_ip}:`, response.data);
  } catch (error) {
    console.error(
      `Ошибка при изменении пользователя в ${door_ip}:`,
      error.message
    );
  }
} */

/*
export async function updateUserPhoto(
  door_ip,
  user_id,
  photo_url,
  surname,
  name
) {
  try {
    const authHeaderPhoto = await digest(
      `http://${door_ip}${api_edit_user_photo}`,
      'PUT',
      username,
      password
    );

    const response = await axios.put(
      `http://${door_ip}${api_edit_user_photo}`,
      {
        faceURL: photo_url,
        faceLibType: 'blackFD',
        FDID: '1',
        FPID: user_id,
        bornTime: '1990-01-01T00:00:00Z',
        name: `${surname} ${name}`,
        PicFeaturePoints: [
          {
            featurePointType: 'face',
            coordinatePoint: {
              x: 160,
              y: 160,
              width: 1,
              height: 1,
            },
          },
        ],
        saveFacePic: true,
      },
      {
        headers: {
          Authorization: authHeaderPhoto,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`Фото изменено в ${door_ip}:`, response.data);
  } catch (error) {
    console.error(
      `Ошибка при изменении фотографии в ${door_ip}:`,
      error.message
    );
  }
} */

/*
export async function deleteUser(door_ip, user_id) {
  try {
    const authHeaderUser = await digest(
      `http://${door_ip}${api_delete_user}`,
      'PUT',
      username,
      password
    );

    const response = await axios.put(
      `http://${door_ip}${api_delete_user}`,
      {
        UserInfoDelCond: { EmployeeNoList: [{ employeeNo: user_id }] },
      },
      {
        headers: {
          Authorization: authHeaderUser,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`Пользователь удален в ${door_ip}:`, response.data);
  } catch (error) {
    console.error(
      `Ошибка при удалении пользователя в ${door_ip}:`,
      error.message
    );
  }
}
*/

/*
export async function deleteUserPhoto(door_ip, user_id) {
  try {
    const authHeaderPhoto = await digest(
      `http://${door_ip}${api_delete_user_photo}`,
      'PUT',
      username,
      password
    );

    const response = await axios.put(
      `http://${door_ip}${api_delete_user_photo}`,
      {
        FPID: [{ value: user_id }],
      },
      {
        headers: {
          Authorization: authHeaderPhoto,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`Фото пользователя удалено в ${door_ip}:`, response.data);
  } catch (error) {
    console.error(
      `Ошибка при удалении фотографии в ${door_ip}:`,
      error.message
    );
  }
}

*/

/*
export async function getUsers(door_ip) {
  try {
    const authHeaderUser = await digest(
      `http://${door_ip}${api_get_users}`,
      'POST',
      username,
      password
    );

    const users_id = [];
    let searchResultPosition = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await axios.post(
        `http://${door_ip}${api_get_users}`,
        {
          UserInfoSearchCond: {
            searchID: '1',
            searchResultPosition: searchResultPosition,
            maxResults: 10,
          },
        },
        {
          headers: {
            Authorization: authHeaderUser,
            'Content-Type': 'application/json',
          },
        }
      );

      const userInfoData = response.data?.UserInfoSearch?.UserInfo || [];
      const usersId = userInfoData.map((user) => user.employeeNo);
      users_id.push(...usersId);

      // Проверяем, есть ли еще данные
      hasMore = response.data?.UserInfoSearch?.responseStatusStrg === 'MORE';
      if (hasMore) {
        searchResultPosition += userInfoData.length; // Увеличиваем позицию поиска
      }
    }

    console.log(
      `Всего пользователей получено для ${door_ip}:`,
      users_id.length
    );
    return users_id; // Возвращаем массив всех пользователей
  } catch (error) {
    console.error(
      `Ошибка при получении пользователей ${door_ip}:`,
      error.message
    );
    return []; // Возвращаем пустой массив в случае ошибки
  }
}

*/

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
        `Error HTTP: ${authHeaderUser.status} ${authHeaderUser.statusText}`
      );
    }

    const responseData = await authHeaderUser.json(); // Получаем и парсим ответ от API
    console.log(`Пользователь изменен в ${door_ip}:`, responseData);
  } catch (error) {
    console.error(
      `Ошибка при изменении пользователя в ${door_ip}:`,
      error.message
    );
  }
}

export async function updateUserPhoto(
  door_ip,
  user_id,
  photo_url,
  surname,
  name
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
        `Error HTTP: ${authHeaderPhoto.status} ${authHeaderPhoto.statusText}`
      );
    }

    const responseData = await authHeaderPhoto.json(); // Получаем и парсим ответ от API
    console.log(`Фото изменено в ${door_ip}:`, responseData);
  } catch (error) {
    console.error(
      `Ошибка при изменении фотографии в ${door_ip}:`,
      error.message
    );
  }
}

export async function updateUserAndPhoto(
  door_ip,
  user_id,
  surname,
  name,
  filePath
) {
  try {
    // --- Обновление данных пользователя ---
    const userUrl = `http://${door_ip}${api_edit_user}`;
    const userPayload = {
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
    };

    const userRes = await client.fetch(userUrl, {
      method: "PUT",
      body: JSON.stringify(userPayload),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!userRes.ok) {
      console.log(
        `Ошибка HTTP при обновлении пользователя: ${userRes.status} ${userRes.statusText}`
      );
    }

    const userData = await userRes.json();
    console.log(`✅ Пользователь обновлён в ${door_ip}:`, userData);

    // --- Обновление фотографии, если передан filePath ---
    if (filePath) {
      const photoUrl = `http://${door_ip}${api_edit_user_photo}`;
      const photoPayload = {
        faceURL: filePath,
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
      };

      const photoRes = await client.fetch(photoUrl, {
        method: "PUT",
        body: JSON.stringify(photoPayload),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!photoRes.ok) {
        console.log(
          `Ошибка HTTP при обновлении фото: ${photoRes.status} ${photoRes.statusText}`
        );
      }

      const photoData = await photoRes.json();
      console.log(`✅ Фото обновлено в ${door_ip}:`, photoData);
    } else {
      console.log("Фото не обновлено: filePath не передан.");
    }
  } catch (error) {
    console.error(
      `❌ Ошибка при обновлении пользователя или фото в ${door_ip}:`,
      error.message
    );
    throw error;
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
        `Error HTTP: ${authHeaderUser.status} ${authHeaderUser.statusText}`
      );
    }

    const responseData = await authHeaderUser.json(); // Получаем и парсим ответ от API
    console.log(`Пользователь удален в ${door_ip}:`, responseData);
  } catch (error) {
    console.error(
      `Ошибка при удалении пользователя в ${door_ip}:`,
      error.message
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
        `Error HTTP: ${authHeaderPhoto.status} ${authHeaderPhoto.statusText}`
      );
    }

    const responseData = await authHeaderPhoto.json(); // Получаем и парсим ответ от API
    console.log(`Фото пользователя удалено из ${door_ip}:`, responseData);
  } catch (error) {
    console.error(
      `Ошибка при удалении фотографии из ${door_ip}:`,
      error.message
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
      [user_id]
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
          `Error HTTP: ${authHeaderUser.status} ${authHeaderUser.statusText}`
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
      users_id.length
    );
    return users_id; // Возвращаем массив всех пользователей
  } catch (error) {
    console.error(
      `Ошибка при получении пользователей ${door_ip}:`,
      error.message
    );
    return []; // Возвращаем пустой массив в случае ошибки
  }
}
