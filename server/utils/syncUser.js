// import axios from 'axios'; // Для работы с API Hikvision
// import pool from '../db.js';
// import { digest } from './digest.js';
// import { getUsers } from './doorFunctions.js';
// import 'dotenv/config';

// const username = 'admin';
// const password = process.env.PASSWORD;

// const api_edit_user = '/ISAPI/AccessControl/UserInfo/SetUp?format=json';

// // Функция для получения пользователей из базы данных
// async function getUsersFromDatabase() {
//   const query = 'SELECT user_id, surname, name FROM users';
//   const { rows } = await pool.query(query);
//   return rows;
// }

// async function updateUser(door_ip, user) {
//   const user_id = user.user_id.toString();
//   try {
//     const authHeaderUser = await digest(
//       `http://${door_ip}${api_edit_user}`,
//       'PUT',
//       username,
//       password
//     );

//     const response = await axios.put(
//       `http://${door_ip}${api_edit_user}`,
//       {
//         UserInfo: {
//           employeeNo: user_id,
//           userType: 'normal',
//           Valid: {
//             enable: true,
//             beginTime: '2023-01-01T00:00:00',
//             endTime: '2037-12-31T23:59:59',
//           },
//           doorRight: '1',
//           RightPlan: [{ doorNo: 1, planTemplateNo: '1' }],
//           name: `${user.surname} ${user.name}`,
//         },
//       },
//       {
//         headers: {
//           Authorization: authHeaderUser,
//           'Content-Type': 'application/json',
//         },
//       }
//     );
//     console.log(`Пользователь изменен в ${door_ip}:`, response.data);
//   } catch (error) {
//     console.log(error);
//   }
// }

// // Основная функция для синхронизации пользователей
// export async function syncUsers(door_ip) {
//   try {
//     const dbUsers = await getUsersFromDatabase();
//     const hikvisionUsers = await getUsers(door_ip);

//     // Найдем пользователей, которых нет в Hikvision
//     const usersToAdd = dbUsers.filter(
//       (user) => !hikvisionUsers.includes(user.user_id.toString())
//     );

//     // Добавим недостающих пользователей в Hikvision
//     for (const user of usersToAdd) {
//       await updateUser(door_ip, user);
//     }

//     console.log('Синхронизация завершена.');
//   } catch (error) {
//     console.error('Ошибка при синхронизации пользователей:', error.message);
//   }
// }
