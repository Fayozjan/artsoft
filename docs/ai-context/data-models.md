# Data Models

## Схемы базы данных

- **public** — общая для всех tenant (tenants, notifications)
- **{tenant_schema}** — отдельная схема для каждой организации

---

## Public Schema

### tenants

Регистрация организаций-клиентов.
| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| name | String | Название |
| schema_name | String unique | Название PostgreSQL-схемы |
| status | Boolean | |

### notifications_outbox

Очередь Telegram-уведомлений.
| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| chat_id | String | Telegram chat ID |
| message | String | Текст сообщения |
| sent | Boolean | Отправлено? |
| added_at | DateTime | |

---

## Client Schema (per tenant)

### employees

Основная таблица сотрудников.
| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| employee_number | Int unique | Табельный номер |
| last_name / first_name / middle_name | String | ФИО |
| date_of_birth | Date | |
| gender | String | |
| passport | String | Паспортные данные |
| pinfl | String unique | ИНН физлица |
| phone / email / address | String | Контакты |
| status | Boolean | Активен? |
| photo | String | Путь к фото |
| branch_id | FK → branches | |
| department_id | FK → departments | |
| position_id | FK → positions | |
| work_schedule_id | FK → work_schedules | Текущий график |
| added_at / updated_at | DateTime | |

### branches

Филиалы организации.
| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| name | String unique | |
| status | Boolean | |
| director_id | FK → employees | |
| region / address | String | |
| bank_name / bank_account / inn / mfo | String | Банковские реквизиты |
| added_by | FK → users | |

### departments

Отделы.
| Поле | Тип | |
|------|-----|-|
| id | Int PK | |
| name | String | |
| status | Boolean | |
| branch_id | FK → branches | |

### positions

Должности.
| Поле | Тип | |
|------|-----|-|
| id | Int PK | |
| name | String unique | |
| status | Boolean | |

### employment_orders

Приказы (прием, перевод, увольнение).
| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| employee_id | FK → employees | |
| type | String | Тип приказа |
| date | Date | Дата |
| branch_id / department_id / position_id | FK | Назначение |
| order_number | String | Номер приказа |
| note | String | Примечание |

### work_schedules

Шаблоны рабочих графиков.

| Поле         | Тип     | Описание                                   |
| ------------ | ------- | ------------------------------------------ |
| id           | Int PK  |                                            |
| name         | String  |                                            |
| type         | String  | `fixed` / `shift` / `flexible`             |
| weekly_days  | Int     | Кол-во рабочих дней (для fixed)            |
| weekly_hours | Int     | Норма часов в неделю                       |
| work_days    | JSON    | Массив рабочих дней с временем (для fixed) |
| shifts       | JSON    | Массив смен (для shift)                    |
| status       | Boolean |                                            |

### Пример `shifts`

```json
[
  {
    "shift_number": 1,
    "start": "08:00",
    "end": "18:00",
    "break_minutes": 60
  },
  {
    "shift_number": 2,
    "start": "18:00",
    "end": "08:00",
    "break_minutes": 60
  }
]
```

---

### Пример `work_days`

```json
[
  {
    "day": 1,
    "start": "08:00",
    "end": "18:00",
    "break_minutes": 60
  },
  {
    "day": 2,
    "start": "08:00",
    "end": "18:00",
    "break_minutes": 60
  },
  {
    "day": 3,
    "start": "08:00",
    "end": "18:00",
    "break_minutes": 60
  },
  {
    "day": 4,
    "start": "08:00",
    "end": "18:00",
    "break_minutes": 60
  },
  {
    "day": 5,
    "start": "08:00",
    "end": "18:00",
    "break_minutes": 60
  },
  {
    "day": 6,
    "start": "08:00",
    "end": "18:00",
    "break_minutes": 60
  }
]
```

### employee_schedule_history

История смены рабочих графиков.
| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| employee_id | FK → employees | |
| work_schedule_id | FK → work_schedules | |
| date_from | Date | Начало действия |
| date_to | Date? | Конец (null = текущий) |
| added_by | FK → users | |

### face_passes

События распознавания лица (вход/выход).
| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| date | DateTime | Время события |
| identifier | String unique | Внешний ID события |
| photo | String? | Фото события |
| employee_id | FK → employees | |
| door_id | FK → doors | |
| face_devices_id | FK → face_devices | |
| direction | String | `in` / `out` |
| Index: (employee_id, date) | | |

### vehicle_passes

События проезда транспорта (ANPR).
| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| date | DateTime | Время события |
| plate | String | Номерной знак |
| photo | String? | Фото |
| gate_id | FK → gates | |
| camera_id | FK → anpr_cameras | |
| direction | String | `in` / `out` |

### time_off

Отпуска и отсутствия.
| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| employee_id | FK → employees | |
| reason | String | Причина |
| date_from / date_to | DateTime | Период |
| type | String | `hour` / `day` |
| is_company_paid | Boolean | За счёт компании? |
| credited_hours | Int | Зачтённые часы |
| added_by | FK → users | |

### holidays

Праздничные дни.
| Поле | Тип | |
|------|-----|-|
| id | Int PK | |
| name | String | |
| date_from / date_to | Date | |
| added_by | FK → users | |

### timesheet

Табель рабочего времени.
| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| month / year / day | Int | |
| worked_hours | String | Кол-во отработанных часов |
| intervals | String[] | Массив временных интервалов |
| user_id | Int | |

### doors

Точки доступа (двери).
| Поле | Тип | |
|------|-----|-|
| id | Int PK | |
| name | String unique | |
| status | Boolean | |

### face_devices

Устройства распознавания лиц (Hikvision).
| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| name | String | |
| door_id | FK → doors | |
| device_ip | String unique | IP адрес |
| serial_number | String? | |
| port | Int | default 80 |
| direction | String | `in` / `out` |
| password | String | Пароль устройства |
| is_local | Boolean | Локальная сеть? |

### gates

Ворота (для ANPR).
| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| name | String | |
| branch_id | FK → branches | |
| telegram_chat_ids | String[] | Куда слать оповещения |
| status | Boolean | |

### anpr_cameras

ANPR-камеры (распознавание номеров).
| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| gate_id | FK → gates | |
| device_ip | String | |
| direction | String | `in` / `out` |
| status | Boolean | |

### users

Системные пользователи.
| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| username | String unique | |
| password | String | bcrypt hash |
| telegram_id | String? unique | Telegram user ID |
| employee_id | FK → employees unique | Привязка к сотруднику |
| status | Boolean | |
| access_level | String? | Уровень доступа |
| branch_access | Int[] | Доступные филиалы |
| department_access | Int[] | Доступные отделы |
| language | String | ru / uz / uzCyrl / en |
| theme | String | light / dark |
| sidebar | String | opened / closed |
| view_mode | String | branch / department |
| active_branch_id | Int? | Активный филиал |
| personal_menus | String[] | Кастомные меню |

### sessions

JWT refresh-сессии.
| Поле | Тип | |
|------|-----|-|
| id | UUID PK | |
| refresh_token | String | |
| ip_address / user_agent | String? | |
| user_id | FK → users | |
| expires_at | DateTime? | |

### menus

Дерево меню системы.
| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| name | String unique | |
| path | String? | URL путь |
| parent_id | FK → menus? | Родительский пункт |
| sort_order | Int | |

### user_menu_access

RBAC — права пользователя на меню.
| Поле | Тип | Описание |
|------|-----|---------|
| user_id | FK → users | |
| menu_id | FK → menus | |
| can_view | Boolean | |
| can_add | Boolean | |
| can_update | Boolean | |
| can_delete | Boolean | |
| Unique: (user_id, menu_id) | | |

### employee_door_tasks

Очередь задач синхронизации доступа на устройства.
| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| employee_id | FK → employees | |
| door_id | FK → doors | |
| action | String | `add` / `update` / `delete` |
| status | String | `pending` / `done` / `error` |
| retry_count | Int | |
| error | String? | Сообщение ошибки |

### telegram_bots

Конфигурация Telegram-ботов.
| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| name | String unique | |
| chat_id | String unique | |
| selectedEmployeeIds | Int[] | Отслеживаемые сотрудники |
| receive_late_report | Boolean | |
| receive_event_alerts | Boolean | |
| receive_attendance_report | Boolean | |
| status | Boolean | |

---

## Ключевые связи (ERD кратко)

````

branches ──< departments ──< employees >── positions
│
work_schedules ──< employee_schedule_history
│
face_passes >── doors ──< face_devices
│
time_off, employment_orders
│
user (1:1 optional)

gates ──< anpr_cameras
gates ──< vehicle_passes

users ──< sessions
users >─< menus (user_menu_access)

```

```
````
