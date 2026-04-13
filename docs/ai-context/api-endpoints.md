# API Endpoints

Base URL: `/api`  
Auth: JWT в httpOnly cookie `access_token`. Все маршруты (кроме отмеченных `*`) требуют авторизации.

---

## Auth — `/api/auth`

| Method | Path | Описание |
|--------|------|---------|
| POST | `/auth/login` * | Вход (username, password, language) → JWT cookies |
| POST | `/auth/telegram` * | Telegram-вход (telegram_id) |
| POST | `/auth/logout` | Выход, очистка cookies |
| POST | `/auth/refresh` * | Обновление access_token по refresh_token |
| GET | `/auth/me` | Текущий пользователь + настройки |

---

## Employees — `/api/employees`

| Method | Path | Описание |
|--------|------|---------|
| GET | `/employees` | Список сотрудников (фильтры: branch_id, department_id, status) |
| GET | `/employees/active` | Только активные сотрудники |
| GET | `/employees/:id` | Сотрудник по ID |
| POST | `/employees` | Создать сотрудника (multipart/form-data с фото) |
| PUT | `/employees/:id` | Обновить сотрудника (multipart/form-data) |
| DELETE | `/employees/:id` | Удалить сотрудника |
| GET | `/employees/image/*` | Получить фото (authPhoto) |
| GET | `/employees/image-link/*` | Временная ссылка на фото |
| GET | `/employees/photo/:token` | Фото по временному токену |

---

## Attendance — `/api/attendance`

| Method | Path | Описание |
|--------|------|---------|
| GET | `/attendance` | Посещаемость (params: date_from, date_to, branch_id, etc.) |
| GET | `/attendance/employee/:employeeId` | Посещаемость конкретного сотрудника |

---

## Face Passes — `/api/face-passes`

| Method | Path | Описание |
|--------|------|---------|
| GET | `/face-passes` | Список событий распознавания (фильтры: date, employee, door) |
| POST | `/face-passes` | Создать событие (от Hikvision устройства, multipart) |
| GET | `/face-passes/:id` | Событие по ID |
| PUT | `/face-passes/:id` | Обновить событие |
| DELETE | `/face-passes/:id` | Удалить событие |
| GET | `/face-passes/image/*` | Фото события (authPhoto) |

---

## Vehicle Passes — `/api/vehicle-passes`

| Method | Path | Описание |
|--------|------|---------|
| GET | `/vehicle-passes` | Список проездов (фильтры: date, gate, plate) |
| POST | `/vehicle-passes` | Создать запись (от ANPR камеры) |
| GET | `/vehicle-passes/:id` | Запись по ID |
| PUT | `/vehicle-passes/:id` | Обновить |
| DELETE | `/vehicle-passes/:id` | Удалить |

---

## Late Employees — `/api/late-employees`

| Method | Path | Описание |
|--------|------|---------|
| GET | `/late-employees` | Опоздавшие (params: date, branch_id) |

---

## Timesheet — `/api/timesheet`

| Method | Path | Описание |
|--------|------|---------|
| GET | `/timesheet` | Табель (params: month, year, branch_id) |
| POST | `/timesheet/by-employees` | Табель по списку сотрудников (body: employee_ids[]) |

---

## Work Schedules — `/api/work-schedules`

| Method | Path | Описание |
|--------|------|---------|
| GET | `/work-schedules` | Все графики |
| GET | `/work-schedules/active` | Только активные |
| GET | `/work-schedules/:id` | График по ID |
| POST | `/work-schedules` | Создать (type: fixed/shift/flexible) |
| PUT | `/work-schedules/:id` | Обновить |
| DELETE | `/work-schedules/:id` | Удалить |

---

## Employee Schedule History — `/api/employee-schedule-history`

| Method | Path | Описание |
|--------|------|---------|
| GET | `/employee-schedule-history` | История смены графиков (params: employee_id) |
| POST | `/employee-schedule-history` | Добавить запись |
| PUT | `/employee-schedule-history/:id` | Обновить |
| DELETE | `/employee-schedule-history/:id` | Удалить |

---

## Time Off — `/api/time-off`

| Method | Path | Описание |
|--------|------|---------|
| GET | `/time-off` | Список отпусков/отсутствий |
| GET | `/time-off/:id` | По ID |
| POST | `/time-off` | Создать (employee_id, reason, date_from, date_to, type) |
| PUT | `/time-off/:id` | Обновить |
| DELETE | `/time-off/:id` | Удалить |

---

## Branches — `/api/branches`

| Method | Path | Описание |
|--------|------|---------|
| GET | `/branches` | Все филиалы |
| GET | `/branches/active` | Активные |
| GET | `/branches/:id` | По ID |
| GET | `/branches/:id/in-use` | Используется ли филиал |
| POST | `/branches` | Создать |
| PUT | `/branches/:id` | Обновить |
| DELETE | `/branches/:id` | Удалить |

---

## Departments — `/api/departments`

Стандартный CRUD: GET / GET/:id / POST / PUT/:id / DELETE/:id

---

## Positions — `/api/positions`

Стандартный CRUD: GET / GET/:id / POST / PUT/:id / DELETE/:id

---

## Holidays — `/api/holidays`

Стандартный CRUD: GET / GET/:id / POST / PUT/:id / DELETE/:id

---

## Employment Orders — `/api/employment-orders`

Стандартный CRUD: GET / GET/:id / POST / PUT/:id / DELETE/:id

---

## Users — `/api/users`

| Method | Path | Описание |
|--------|------|---------|
| GET | `/users` | Список пользователей |
| GET | `/users/me` | Профиль текущего пользователя |
| PUT | `/users/me` | Обновить профиль (theme, language, sidebar) |
| GET | `/users/me/access` | Права доступа текущего пользователя |
| GET | `/users/menu` | Доступные меню |
| GET | `/users/:id` | Пользователь по ID |
| POST | `/users` | Создать пользователя |
| PUT | `/users/:id` | Обновить пользователя |

---

## Doors — `/api/doors`

| Method | Path | Описание |
|--------|------|---------|
| GET | `/doors` | Все двери |
| GET | `/doors/active` | Активные |
| GET | `/doors/:id` | По ID |
| POST | `/doors` | Создать |
| PUT | `/doors/:id` | Обновить |

---

## Face Devices — `/api/face-devices`

| Method | Path | Описание |
|--------|------|---------|
| POST | `/face-devices/events` * | Webhook от Hikvision (multipart, без auth) |
| GET | `/face-devices` | Все устройства |
| GET | `/face-devices/:id` | По ID |
| POST | `/face-devices` | Создать |
| PUT | `/face-devices/:id` | Обновить |

---

## Gates — `/api/gates`

Стандартный CRUD: GET / GET/:id / POST / PUT/:id / DELETE/:id

---

## ANPR Cameras — `/api/anpr-cameras`

Стандартный CRUD: GET / GET/:id / POST / PUT/:id / DELETE/:id

---

## Employee Door Tasks — `/api/employee-door-tasks`

| Method | Path | Описание |
|--------|------|---------|
| GET | `/employee-door-tasks` | Задачи синхронизации доступа |
| POST | `/employee-door-tasks` | Создать задачу (action: add/update/delete) |
| DELETE | `/employee-door-tasks/:id` | Удалить |

---

## Telegram Bots — `/api/telegram-bots`

Стандартный CRUD: GET / GET/:id / POST / PUT/:id / DELETE/:id

---

## Menus — `/api/menus`

| Method | Path | Описание |
|--------|------|---------|
| GET | `/menus` | Дерево меню |
| POST | `/menus` | Создать пункт |
| PUT | `/menus/:id` | Обновить |
| DELETE | `/menus/:id` | Удалить |
