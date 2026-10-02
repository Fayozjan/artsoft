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

### production_calendar

Производственный календарь. Рабочие и выходные дни недели задаёт **график
сотрудника** (`work_schedules`) — календарь хранит только общефирменные
исключения поверх любого графика. Дни без строки работают по графику.

| Поле | Тип | |
|------|-----|-|
| id | Int PK | |
| date | Date @unique | |
| day_type | String | `holiday` / `weekend` / `short` |
| name | String? | Название праздника/дня |
| short_minutes | Int? | Только для `short`: на сколько минут сокращён день |
| added_by | FK → users | |

Используется для нормы рабочего времени: `buildCalendarContext()` из
`server/utils/productionCalendar.utils.js` отдаёт Set/Map, которые понимают
`countScheduledDays`, `countScheduledMinutes` и `generateAttendanceReport`.

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
| device_ip | String unique | IP адрес (опрос устройства поллером) |
| mac_address | String? unique | MAC, по нему webhook находит устройство |
| serial_number | String? | X-Devserial для облачного API удалённых устройств |
| port | Int | default 80 |
| direction | String | `in` / `out` |
| password | String | Пароль устройства |
| is_local | Boolean | Локальная сеть? |
| purpose | String | `access` — проход (пишется в face_passes) / `canteen` — столовая (пишется в canteen_meals) |

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
| personal_menus | String[] | Личный режим для меню телеграм приложения (`home`, `finance`, `tasks`). Админ задаёт в «Настройки телеграм приложения» |
| telegram_work_punch | Boolean | Телеграм приложение: кнопка «Начать работу» / «Завершить работу» на главной (default false). Без права сервер отклоняет отметку из телеграма (`FacePassesService.createFromTelegram`). Админ задаёт там же |
| settings | Json? | Интерфейс: `sidebarPosition` (left / top / hidden), `startPage` (путь после входа, по умолчанию `/home`). Админ задаёт в карточке логина, пользователь — в профиле |
| production_operation_ids | Int[] | Меню «Производство»: доступные типы операций (пусто — все). Только админ |
| can_edit_sticker | Boolean | Меню «Производство»: можно ли редактировать шаблон стикера (default true). Только админ |
| production_own_only | Boolean | Меню «Производство»: в истории приёма работы и во всех вкладках «Отчёта производства» только стикеры, принятые самим логином (`scanned_by`), default false. Оба места в любом случае режутся по `production_operation_ids`. Только админ |

### user_telegram_menu_access

Отдельные права логина на меню в телеграм приложении (те же поля, что у `user_menu_access`: `user_id`, `menu_id`, `can_view`, `can_add`, `can_update`, `can_delete`). Нет строк — телеграм использует веб-права. `GET /users/menu?platform=telegram` отдаёт дерево по этому набору (клиент добавляет параметр сам на путях `/tg`). Права нигде не проверяются на сервере — только UI, как и веб-права меню. Админ задаёт в «Настройки телеграм приложения» → «Доступные меню».

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

### product_categories

Иерархические категории продуктов (самоссылающаяся таблица).
| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| parent_id | FK → product_categories? | null = корневая категория |
| name | String | |
| status | Boolean | |

### products

Товарная номенклатура.
| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| category_id | FK → product_categories? | |
| name | String | |
| sku | String? | Внутренний код |
| barcode | String? | Штрихкод |
| description | String? | |
| min_stock | Int? | Минимальный остаток |
| status | Boolean | |
| created_at | DateTime | |

### stock_locations

Единое дерево локаций (Odoo-подобная модель). Заменяет `warehouses` / `warehouse_zones` / `storage_locations`.

| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| parent_id | FK → stock_locations? | Родитель (null = корень) |
| name | String | |
| complete_name | String? | Полный путь: "Склад A / Зона 1 / Полка A1" |
| type | String | `view` / `internal` / `supplier` / `customer` / `production` / `expense` / `inventory` / `transit` |
| branch_id | FK → branches? | |
| code | String? | |
| note | String? | |
| is_scrap | Boolean | |
| status | Boolean | |
| created_at | DateTime | |

**Типы локаций:**

| type | Хранит остатки | Назначение |
|------|---------------|-----------|
| `view` | Нет | Группировка (папка) |
| `internal` | **Да** | Физический склад / ячейка |
| `supplier` | Нет | Виртуальный: поставщики |
| `customer` | Нет | Виртуальный: клиенты |
| `production` | Нет | Виртуальный: производство |
| `expense` | Нет | Виртуальный: расход / офис |
| `inventory` | Нет | Виртуальный: инвентаризация |
| `transit` | Нет | Виртуальный: транзит |

### stock_lots

Партия остатка — связка (товар, цена, описание, набор характеристик).
Разделяет остаток одного товара на отдельные позиции с отдельным кол-вом,
когда они отличаются по цене/описанию/характеристикам; одинаковые или пустые
значения — одна и та же партия (остаток не дробится).

| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| product_id | FK → products | |
| price_unit | Decimal(15,4)? | |
| note | String? | |
| created_at | DateTime | |

Приход (`location_src` виртуальный) ищет-или-создаёт партию по этой связке
автоматически при проведении документа (`resolveOrCreateLot` в
`stockPickings.model.js`). Расход/перемещение (`location_src` физический)
выбирает партию в пикере товара — `lot_id` обязателен на строке документа,
сохраняется сразу в черновике (см. `stock_moves.lot_id` ниже).

### stock_lot_attribute_values

Набор характеристик партии (зеркало `stock_move_attribute_values`, но на
партии, а не на строке документа) — используется при сверке точного набора
характеристик в `resolveOrCreateLot`.

| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| lot_id | FK → stock_lots | |
| attribute_id | FK → attributes | |
| attribute_value_id | FK → attribute_values | |

**Unique:** `(lot_id, attribute_id)`

### currencies

Валюты для приходов/расходов товаров.

| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| code | String unique | ISO alpha, он же `Ccy` в ответе ЦБ РУз (USD/EUR/RUB/UZS/...) |
| name | String | |
| symbol | String? | |
| is_base | Boolean | Ровно одна строка `true` — базовая валюта отчётности (сум); её `rate` в документах всегда 1 |
| status | Boolean | |
| created_at | DateTime | |

Рекомендованный курс на дату документа подтягивается с `cbu.uz` (см. `server/utils/cbuExchangeRate.js`),
но остаётся редактируемым вручную — сохраняется как снимок в `stock_pickings.rate`.

### stock_picking_types

Типы складских операций (настраиваются под клиента).

| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| name | String | |
| code | String | `incoming` / `outgoing` / `internal` |
| sequence_prefix | String? | Префикс номера (RECV, DELI, INT) |
| default_location_src_id | FK → stock_locations? | Источник по умолчанию |
| default_location_dest_id | FK → stock_locations? | Назначение по умолчанию |
| status | Boolean | |
| created_at | DateTime | |

**Дефолтные типы (seed):**

| name | code | src → dest |
|------|------|-----------|
| Приём товара | incoming | Поставщики → Основной склад |
| Отгрузка | outgoing | Основной склад → Клиенты |
| Внутреннее перемещение | internal | Склад → Склад |
| Расход на офис | outgoing | Склад → Расходы |
| Производство: расход материалов | outgoing | Склад → Производство |
| Производство: выход продукции | incoming | Производство → Склад |
| Инвентаризация | internal | Инвентаризация ↔ Склад |

### stock_pickings

Документы складских операций.

| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| name | String? | Номер документа: RECV/2024/001 |
| type_id | FK → stock_picking_types | |
| partner_id | FK → partners? | Общий партнёр (устаревший, для совместимости) |
| src_partner_id | FK → partners? | Партнёр-источник (поставщик при приёме) |
| dest_partner_id | FK → partners? | Партнёр-назначение (клиент при отгрузке) |
| origin | String? | Источник / ссылка на заказ |
| state | String | `draft` / `confirmed` / `done` / `cancelled` |
| scheduled_date | DateTime? | Плановая дата |
| date_done | DateTime? | Фактическая дата выполнения |
| note | String? | |
| currency_id | FK → currencies | Валюта документа |
| rate | Decimal(15,6) | Курс к базовой валюте, снимок на момент документа (default 1) |
| transport | String? | Марка/тип транспорта |
| driver | String? | ФИО водителя |
| vehicle_number | String? | Гос. номер транспорта |
| added_by | FK → users? | |
| created_at / updated_at | DateTime | |

### stock_moves

Строки движения товаров.

| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| picking_id | FK → stock_pickings | |
| product_id | FK → products | |
| lot_id | FK → stock_lots? | Партия — обязательна, если `location_src` физический (расход/перемещение); пуста в черновике прихода, резолвится при проведении |
| unit_id | FK → units? | |
| qty_demand | Decimal(15,4) | Запланированное количество |
| qty_done | Decimal(15,4) | Фактическое количество (default 0) |
| qty_packages | Decimal(15,4)? | Кол-во упаковок |
| location_src_id | FK → stock_locations | Откуда |
| location_dest_id | FK → stock_locations | Куда |
| state | String | `draft` / `done` / `cancelled` |
| price_unit | Decimal(15,4)? | Цена за единицу |
| note | String? | |
| created_at | DateTime | |

Характеристики строки (цвет и т.п.) — `stock_move_attribute_values`, отдельная
таблица (move_id, attribute_id, attribute_value_id).

**Индексы:** `product_id`, `picking_id`, `lot_id`

### stock_quants

Текущие остатки по локациям и партиям (materialized cache, авто-обновляется
при validate/cancel — см. `applyQuantDelta` в `stockPickings.model.js`).

| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| product_id | FK → products | |
| location_id | FK → stock_locations | Только `internal` локации |
| lot_id | FK → stock_lots? | Nullable на уровне колонки (переходный период миграции партий), приложение всегда пишет конкретную партию |
| qty | Decimal(15,4) | Текущий остаток (штуки) |
| qty_packages | Decimal(15,4) | Текущий остаток упаковок — отдельный честный счётчик (вводится на приходе наравне с qty), не коэффициент |
| updated_at | DateTime | |

**Unique:** `(product_id, location_id, lot_id)`

Отчёт "Остатки" (`stockReport`) сворачивает это обратно по
`product_id + location_id` (`SUM(qty)` через raw SQL) — партии там не важны,
одна строка на товар+склад, как и до появления партий.

### bill_of_materials

Спецификации продуктов (BoM).

| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| product_id | FK → products | Готовая продукция |
| unit_id | FK → units? | |
| qty | Decimal(15,4) | Кол-во выхода (default 1) |
| type | String | `manufacture` / `phantom` |
| note | String? | |
| status | Boolean | |
| created_at | DateTime | |

### bom_lines

Строки спецификации (компоненты).

| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| bom_id | FK → bill_of_materials | |
| product_id | FK → products | Компонент |
| unit_id | FK → units? | |
| qty | Decimal(15,4) | Норма расхода |

### manufacturing_orders

Производственные заказы.

| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| name | String? | Номер: MO/2024/001 |
| product_id | FK → products | Производимая продукция |
| bom_id | FK → bill_of_materials? | Опциональная спецификация |
| unit_id | FK → units? | |
| qty_planned | Decimal(15,4) | Плановый выпуск |
| qty_produced | Decimal(15,4) | Фактический выпуск (default 0) |
| location_src_id | FK → stock_locations? | Откуда брать сырьё |
| location_dest_id | FK → stock_locations? | Куда класть готовую продукцию |
| state | String | `draft` / `confirmed` / `in_progress` / `done` / `cancelled` |
| scheduled_date | DateTime? | |
| date_start / date_finish | DateTime? | |
| origin | String? | |
| note | String? | |
| added_by | FK → users? | |
| created_at / updated_at | DateTime | |

### units

Единицы измерения.
| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| name | String | |
| short_name | String? | Сокращение (кг, шт, л) |
| status | Boolean | |
| created_at | DateTime | |

### partner_categories

Категории партнёров.
| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| name | String | |
| status | Boolean | |
| created_at | DateTime | |

### partners

Партнёры (поставщики и клиенты).
| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| category_id | FK → partner_categories? | |
| type | String | `supplier` / `client` / `both` |
| name | String | Название компании или ФИО |
| code | String? | Внутренний код |
| tax_number | String? unique | Налоговый номер |
| contact_person | String? | Контактное лицо |
| phone | String? | |
| email | String? | |
| address | String? | |
| note | String? | Примечание |
| supplier_location_id | FK → stock_locations? | Виртуальная локация поставщика (откуда приходит товар) |
| customer_location_id | FK → stock_locations? | Виртуальная локация клиента (куда уходит товар) |
| status | Boolean | |
| created_at | DateTime | |

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

### canteen_allowances

Дневная норма порций сотрудника. Одна строка на сотрудника, норма не
накапливается — остаток считается как `daily_limit − выданные сегодня`.
| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| employee_id | FK → employees unique | Один сотрудник — одна норма |
| daily_limit | Int | Порций в день (0–20) |
| status | Boolean | Выключенная норма = отказ на терминале |
| note | String? | Примечание |
| added_by | FK → users? | Кто назначил |

### canteen_meals

Одно распознавание на терминале столовой. Отказы пишутся тоже — нужны в отчёте.
| Поле | Тип | Описание |
|------|-----|---------|
| id | Int PK | |
| employee_id | FK → employees | |
| face_device_id | FK → face_devices? | |
| date | Timestamptz | Время события |
| meal_date | Date | Локальная (Asia/Tashkent) дата — по ней считается дневной остаток |
| identifier | String? | `employeeNo-serialNo`, unique с face_device_id — защита от повторной обработки |
| status | String | `served` — выдана / `denied` — отказ |
| deny_reason | String? | `no_allowance` / `limit_reached` |
| daily_limit | Int | Норма на момент события (отчёт не меняется задним числом) |
| photo | String? | Кадр с терминала |

---

## Ключевые связи (ERD кратко)

```
branches ──< departments ──< employees >── positions
│
work_schedules ──< employee_schedule_history
│
face_passes >── doors ──< face_devices
face_devices (purpose = canteen) ──< canteen_meals >── employees
employees ──1:1─ canteen_allowances
│
time_off, employment_orders
│
user (1:1 optional)

gates ──< anpr_cameras
gates ──< vehicle_passes

product_categories ──< product_categories (self: parent_id)
product_categories ──< products

partner_categories ──< partners (type = supplier | client | both)
partners >── stock_locations (supplier_location_id)
partners >── stock_locations (customer_location_id)

users ──< sessions
users >─< menus (user_menu_access)

── Складской учёт ──────────────────────────────────────────────
stock_locations ──< stock_locations (self: parent_id, tree)

stock_picking_types >── stock_locations (src default)
stock_picking_types >── stock_locations (dest default)

stock_pickings >── stock_picking_types
stock_pickings >── currencies
stock_pickings >── partners (src_partner_id)
stock_pickings >── partners (dest_partner_id)
stock_pickings ──< stock_moves

stock_moves >── products
stock_moves >── stock_locations (src)
stock_moves >── stock_locations (dest)
stock_moves >── stock_lots?
stock_moves >── units?

stock_quants >── products
stock_quants >── stock_locations (internal only)
stock_quants >── stock_lots?

stock_lots >── products
stock_lot_attribute_values >── stock_lots
stock_lot_attribute_values >── attributes
stock_lot_attribute_values >── attribute_values

── Производство ────────────────────────────────────────────────
bill_of_materials >── products (finished good)
bill_of_materials ──< bom_lines >── products (components)

manufacturing_orders >── products
manufacturing_orders >── bill_of_materials?
manufacturing_orders >── stock_locations (src, dest)
manufacturing_orders ──< stock_moves
```
