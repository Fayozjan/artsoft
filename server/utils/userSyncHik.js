import pool from "../db.js";
import {
  getUsers,
  updateUser,
  updateUserPhoto,
  deleteUser,
  deleteUserPhoto,
} from "./doorFunctions.js";

// Функция для получения всех дверей из БД
async function getAllDoors() {
  const { rows } = await pool.query("SELECT * FROM doors");
  return rows;
}

// Функция добавляет данные и фото пользователей в Hikvision
async function setUserToHikvision(
  ip,
  user_id,
  user_surname,
  user_name,
  user_photo
) {
  await updateUser(ip, user_id, user_surname, user_name);
  await updateUserPhoto(
    ip,
    user_id,
    `http://192.168.100.8:7000${user_photo}`,
    user_surname,
    user_name
  );
}

// Удаление неактивных пользователей из Hikvision
async function removeInactiveUsersFromHikvision(unactiveUsers, hikvisionUsers) {
  for (const { hikvisionData } of hikvisionUsers) {
    const doorIps = hikvisionData.map(({ ip }) => ip);

    for (const ip of doorIps) {
      for (const user of unactiveUsers) {
        const userIdStr = String(user.user_id);

        // Проверяем, есть ли пользователь в Hikvision
        const userExists = hikvisionData.some(({ users }) =>
          users.includes(userIdStr)
        );

        if (userExists) {
          try {
            await deleteUser(ip, userIdStr);
            await deleteUserPhoto(ip, userIdStr);
            console.log(
              `🚮 Удален: ${user.name} ${user.surname} (Дверь: ${ip})`
            );
          } catch (error) {
            console.error(
              `❌ Ошибка удаления ${user.name} ${user.surname} (Дверь: ${ip}):`,
              error.response?.data || error.message
            );
          }
        }
      }
    }
  }
}

// Функция добавляет пользователей в Hikvision
async function addUsersToHikvision(data) {
  for (const entry of data) {
    const { door_ip_address, missingUsers } = entry;
    for (const ip of door_ip_address) {
      for (const user of missingUsers) {
        try {
          await setUserToHikvision(
            ip,
            String(user.user_id),
            user.surname,
            user.name,
            user.photo
          );

          console.log(
            `✅ Добавлен: ${user.name} ${user.surname} (Дверь: ${ip})`
          );
        } catch (error) {
          console.error(
            `❌ Ошибка добавления ${user.name} ${user.surname} (Дверь: ${ip}):`,
            error.response?.data || error.message
          );
        }
      }
    }
  }
}

// Функция получает пользователей из БД
async function getUsersFromDB() {
  const { rows } = await pool.query(
    "SELECT surname, name, user_id, photo, door, status FROM users"
  );

  return rows;
}

// Функция получает пользователей из Hikvision
async function getUsersForAllDoors(allDoors) {
  const doorsUsers = [];

  for (const door of allDoors) {
    const ips = [door.door_ip_entry, door.door_ip_exit].filter(Boolean); // Получаем IP-адреса двери
    const hikvisionData = [];

    for (const ip of ips) {
      const hikUsers = await getUsers(ip); // Получаем пользователей с Hikvision
      hikvisionData.push({ ip, users: hikUsers });
    }

    doorsUsers.push({ door_id: door.id, hikvisionData });
  }

  return doorsUsers;
}

// Функция сравнивает пользователей БД с Hikvision
async function compareUsers(localUsers, hikvisionUsers) {
  const missingUsers = [];

  for (const { door_id, hikvisionData } of hikvisionUsers) {
    const localUsersForDoor = Array.isArray(localUsers[door_id])
      ? localUsers[door_id]
      : [];

    // Получаем список всех IP-адресов двери
    const doorIps = hikvisionData.map(({ ip }) => ip);

    // Создаем объект для отслеживания пользователей на каждом IP
    const usersPerIp = {};
    doorIps.forEach((ip) => (usersPerIp[ip] = new Set()));

    // Заполняем usersPerIp данными из Hikvision
    hikvisionData.forEach(({ ip, users }) => {
      users.forEach((userId) => usersPerIp[ip].add(String(userId)));
    });

    // Проверяем, каких локальных пользователей нет хотя бы на одном из IP-адресов
    const usersNotInHikvision = localUsersForDoor.filter((user) => {
      const userIdStr = String(user.user_id);
      return doorIps.some((ip) => !usersPerIp[ip].has(userIdStr));
    });

    if (usersNotInHikvision.length > 0) {
      missingUsers.push({
        door_id,
        door_ip_address: doorIps, // Сохраняем все IP-адреса двери
        missingUsers: usersNotInHikvision,
      });
    }
  }

  return missingUsers;
}

// Общая функция для синхронизации пользователей БД с Hikvision
export async function syncUsers() {
  try {
    // Получаем всех пользователей из БД
    const dbUsers = await getUsersFromDB();

    // Разделяем активных и неактивных пользователей
    const activeUsers = dbUsers.filter((user) => user.status === "true");
    const unactiveUsers = dbUsers.filter((user) => user.status === "false");

    // Создаем карту дверей для активных пользователей
    const doorsMap = {};
    activeUsers.forEach((user) => {
      const doors = Array.isArray(user.door)
        ? user.door
        : String(user.door).split(",");

      doors.forEach((doorId) => {
        if (!doorsMap[doorId]) {
          doorsMap[doorId] = [];
        }
        doorsMap[doorId].push(user);
      });
    });

    // Получаем список всех дверей и пользователей в Hikvision
    const allDoors = await getAllDoors();
    const hikvisionUsers = await getUsersForAllDoors(allDoors);

    // Удаляем неактивных пользователей из Hikvision
    await removeInactiveUsersFromHikvision(unactiveUsers, hikvisionUsers);

    // Находим пользователей, которых нет в Hikvision, и добавляем их
    const missingUsers = await compareUsers(doorsMap, hikvisionUsers);
    await addUsersToHikvision(missingUsers);

    console.log("Синхронизация завершена");
  } catch (error) {
    console.error("Ошибка в процессе синхронизации:", error.message);
  }
}
