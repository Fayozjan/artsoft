# API Endpoints

Base URL: `/api`  
Auth: JWT в httpOnly cookie `access_token`. Все маршруты (кроме отмеченных `*`) требуют авторизации.

---

## Auth — `/api/auth`

| Method | Path | Описание |
|--------|------|---------|
| POST | `/auth/login` * | Вход (username, password, language) → JWT cookies. 429 `TOO_MANY_ATTEMPTS` при блокировке логина |
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
| GET | `/employees/rehire-candidates` | Все уволенные (`status=false`) без учёта зоны доступа логина — кандидаты на приём (params: search по ФИО/ID/таб. номеру/ПИНФЛ/паспорту, точные совпадения по ID и таб. номеру идут первыми; максимум 50 + `total`). Без личных данных: id, ФИО, ПИНФЛ, филиал/отдел/должность, `fired_date` |
| GET | `/employees/rehire-candidates/:id` | Данные уволенного для подстановки в форму приёма (личные + должность, график, `door_ids`; без зарплат и истории). 404 — сотрудник не уволен |
| POST | `/employees/:id/rehire` | Повторный приём уволенного (multipart/form-data): обновляет личные данные и создаёт приказ `hire` (`order_date`, `branch_id`, `department_id`, `position_id` обязательны; `order_date` строго позже даты увольнения). Нового сотрудника не создаёт |
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

## Production Calendar — `/api/production-calendar`

Производственный календарь. Рабочие/выходные дни недели задаёт график
сотрудника — календарь хранит только общефирменные исключения поверх графика.

| Method | Path | Описание |
|--------|------|---------|
| GET | `/production-calendar?year=&month=` | Дни года (или месяца) + сводка. `month` необязателен |
| GET | `/production-calendar/norm?year=&month=` | Только сводка, без списка дней |
| POST | `/production-calendar/days` | Массовое сохранение: `{ days: [{ date, day_type, name, short_minutes }] }` |
| DELETE | `/production-calendar/days` | Снять пометку: `{ dates: ["YYYY-MM-DD"] }` |
| DELETE | `/production-calendar/year/:year` | Снять все пометки года |

`day_type`: `holiday` | `weekend` | `short`. Для `short` обязателен (или
подставляется 60) `short_minutes` — на сколько минут сокращён день.

В ответе GET дни без пометки приходят с `day_type: "default"` — они работают по
графику сотрудника. Норма часов/дней конкретного работника считается через
`countScheduledMinutes` / `countScheduledDays` по его `work_schedules`;
календарь там только обнуляет `holiday`/`weekend` и вычитает `short_minutes`.

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
| GET | `/users/lockouts` | Активные блокировки входа (перебор пароля) |
| POST | `/users/:id/unlock` | Снять блокировку входа с пользователя |

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

---

## Product Categories — `/api/product-categories`

Иерархические категории продуктов. `parent_id = null` — корневая, иначе — дочерняя.

| Method | Path | Описание |
|--------|------|---------|
| GET | `/product-categories` | Список (фильтры: search, status; пагинация) |
| GET | `/product-categories/active` | Только активные (id + name) |
| GET | `/product-categories/:id` | По ID (включает parent) |
| POST | `/product-categories` | Создать |
| PUT | `/product-categories/:id` | Обновить |
| DELETE | `/product-categories/:id` | Удалить |

---

## Products — `/api/products`

| Method | Path | Описание |
|--------|------|---------|
| GET | `/products` | Список (фильтры: search, status, category_id; пагинация) |
| GET | `/products/active` | Только активные (id + name) |
| GET | `/products/:id` | По ID |
| POST | `/products` | Создать (name, category_id?, sku?, barcode?, description?, min_stock?) |
| PUT | `/products/:id` | Обновить |
| DELETE | `/products/:id` | Удалить |

---

## Warehouses — `/api/warehouses`

| Method | Path | Описание |
|--------|------|---------|
| GET | `/warehouses` | Список (фильтры: search, status, branch_id; пагинация) |
| GET | `/warehouses/active` | Только активные |
| GET | `/warehouses/:id` | По ID |
| POST | `/warehouses` | Создать (name, branch_id?) |
| PUT | `/warehouses/:id` | Обновить |
| DELETE | `/warehouses/:id` | Удалить |

---

## Units — `/api/units`

| Method | Path | Описание |
|--------|------|---------|
| GET | `/units` | Список (фильтры: search, status; пагинация) |
| GET | `/units/active` | Только активные |
| GET | `/units/:id` | По ID |
| POST | `/units` | Создать (name, short_name?) |
| PUT | `/units/:id` | Обновить |
| DELETE | `/units/:id` | Удалить |

---

## Partners — `/api/partners`

Партнёры: поставщики, клиенты или оба типа.

| Method | Path | Описание |
|--------|------|---------|
| GET | `/partners` | Список (фильтры: search, status, type, category_id; пагинация) — включает category_name |
| GET | `/partners/active` | Только активные (id, name, type) |
| GET | `/partners/:id` | По ID |
| POST | `/partners` | Создать (type, name, category_id?, code?, tax_number?, contact_person?, phone?, email?, address?, note?) |
| PUT | `/partners/:id` | Обновить |
| DELETE | `/partners/:id` | Удалить |

---

## Partner Categories — `/api/partner-categories`

| Method | Path | Описание |
|--------|------|---------|
| GET | `/partner-categories` | Список (фильтры: search, status; пагинация) — включает partners_count |
| GET | `/partner-categories/active` | Только активные |
| GET | `/partner-categories/:id` | По ID |
| POST | `/partner-categories` | Создать (name) |
| PUT | `/partner-categories/:id` | Обновить |
| DELETE | `/partner-categories/:id` | Удалить |

---

## Dashboard — `/api/dashboard`

| Method | Path | Описание |
|--------|------|---------|
| GET | `/dashboard/all` | Полный дашборд (attendance + finance + feeds) |
| GET | `/dashboard/summary` | Краткая сводка посещаемости |
| GET | `/dashboard/analytics` | Аналитика по посещаемости |
| GET | `/dashboard/feeds` | Лента последних событий |
| GET | `/dashboard/finance` | Финансовые показатели |

---

## Employee Salary History — `/api/employee-salary-history`

| Method | Path | Описание |
|--------|------|---------|
| GET | `/employee-salary-history/employees` | Список сотрудников с зарплатами |
| GET | `/employee-salary-history` | История зарплат (params: employee_id) |
| POST | `/employee-salary-history` | Добавить запись |
| PUT | `/employee-salary-history/:id` | Обновить |
| DELETE | `/employee-salary-history/:id` | Удалить |

---

## Payroll — `/api/payroll`

Расчёт зарплаты. Ведётся по месяцам (`payroll_sheets` → `payroll_sheet_items`).

| Method | Path | Описание |
|--------|------|---------|
| GET | `/payroll` | Получить или сгенерировать ведомость (params: month, year, branch_id) |
| GET | `/payroll/advances` | Авансы (params: month, year) |
| POST | `/payroll/advances` | Добавить аванс |
| PUT | `/payroll/advances/:id` | Обновить аванс |
| DELETE | `/payroll/advances/:id` | Удалить аванс |
| GET | `/payroll/payouts` | Выплаты (params: month, year) |
| PUT | `/payroll/payouts/bulk-status` | Массовое обновление статуса выплат |
| PUT | `/payroll/items/bulk-status` | Массовое обновление статуса строк |
| GET | `/payroll/items/:itemId/payments` | Лог платежей по строке |
| POST | `/payroll/items/:itemId/payments` | Добавить платёж |
| DELETE | `/payroll/items/:itemId/payments/:logId` | Удалить платёж |
| PUT | `/payroll/items/:itemId` | Обновить строку ведомости |
| PUT | `/payroll/:id/all-status` | Обновить статус всех строк |
| PUT | `/payroll/:id/bulk-apply` | Массово применить флаги |
| PUT | `/payroll/:id/payouts-all-status` | Обновить статус всех выплат |
| PUT | `/payroll/:id/recalculate-balances` | Пересчитать балансы |
| PUT | `/payroll/:id/recalculate-draft` | Пересчитать черновик |
| POST | `/payroll/:id/approve` | Утвердить ведомость |
| DELETE | `/payroll/:id/approve` | Снять утверждение |
| DELETE | `/payroll/:id` | Удалить ведомость |

---

## Staffing Positions — `/api/staffing-positions`

| Method | Path | Описание |
|--------|------|---------|
| GET | `/staffing-positions/department/:id` | Штатное расписание отдела |
| PUT | `/staffing-positions/department/:id` | Bulk upsert штатного расписания |

---

## Stock Locations — `/api/stock-locations`

Единое дерево локаций (тип: `view` / `internal` / `supplier` / `customer` / `production` / `expense` / `inventory` / `transit`).

| Method | Path | Описание |
|--------|------|---------|
| GET | `/stock-locations` | Список (фильтры: search, type, branch_id; пагинация) |
| GET | `/stock-locations/tree` | Дерево локаций |
| GET | `/stock-locations/active` | Только активные |
| GET | `/stock-locations/system` | Системные виртуальные локации |
| GET | `/stock-locations/:id` | По ID |
| POST | `/stock-locations` | Создать |
| PUT | `/stock-locations/:id` | Обновить |
| DELETE | `/stock-locations/:id` | Удалить |

---

## Stock Lots — `/api/stock-lots`

Партии / серийные номера.

| Method | Path | Описание |
|--------|------|---------|
| GET | `/stock-lots` | Список (фильтры: search, product_id; пагинация) |
| GET | `/stock-lots/active` | Только активные |
| GET | `/stock-lots/:id` | По ID |
| POST | `/stock-lots` | Создать (name, product_id, ref?, expiry_date?) |
| PUT | `/stock-lots/:id` | Обновить |
| DELETE | `/stock-lots/:id` | Удалить |

---

## Stock Picking Types — `/api/stock-picking-types`

| Method | Path | Описание |
|--------|------|---------|
| GET | `/stock-picking-types` | Список |
| GET | `/stock-picking-types/active` | Только активные |
| GET | `/stock-picking-types/:id` | По ID |
| POST | `/stock-picking-types` | Создать |
| PUT | `/stock-picking-types/:id` | Обновить |
| DELETE | `/stock-picking-types/:id` | Удалить |

---

## Currencies — `/api/currencies`

Валюты для приходов/расходов товаров. Ровно одна `is_base=true` — базовая валюта отчётности.

| Method | Path | Описание |
|--------|------|---------|
| GET | `/currencies` | Список (фильтры: search, status; пагинация) |
| GET | `/currencies/active` | Только активные |
| GET | `/currencies/:id` | По ID |
| GET | `/currencies/:id/rate` | Рекомендованный курс на дату (`?date=YYYY-MM-DD`, по умолчанию сегодня) — для базовой валюты 1 без запроса, для остальных курс ЦБ РУз (cbu.uz) по `code` |
| POST | `/currencies` | Создать (`is_base: true` снимает флаг с остальных валют) |
| PUT | `/currencies/:id` | Обновить |
| DELETE | `/currencies/:id` | Удалить (409, если валюта используется в документах) |

---

## Stock Pickings — `/api/stock-pickings`

Документы складских операций (приём, отгрузка, перемещение и т.д.).

| Method | Path | Описание |
|--------|------|---------|
| GET | `/stock-pickings` | Список (фильтры: state, type_id, partner_id; пагинация) — включает `location_src_name`, `location_dest_name` |
| GET | `/stock-pickings/:id` | По ID (включает moves, picking_type, src_partner, dest_partner, currency) — включает `location_src_name`, `location_dest_name` |
| POST | `/stock-pickings` | Создать (type_id, moves[], src/dest партнёры и локации, `currency_id`, `rate`) |
| PUT | `/stock-pickings/:id` | Обновить (только draft/confirmed); принимает `src_partner_id`, `dest_partner_id`, `src_warehouse_id`, `dest_warehouse_id`, `location_src_id`, `location_dest_id` — резолвит в локации как при создании |
| DELETE | `/stock-pickings/:id` | Удалить (только draft) |
| POST | `/stock-pickings/:id/confirm` | Подтвердить (`draft` → `confirmed`) |
| POST | `/stock-pickings/:id/validate` | Провести (`draft`/`confirmed` → `done`), обновляет quants |
| POST | `/stock-pickings/:id/cancel` | Отменить документ (`→ cancelled`), откатывает quants |
| POST | `/stock-pickings/:id/reverse` | Отменить проводку (`done` → `draft`), откатывает quants; строки moves возвращаются в `draft` |
| POST | `/stock-pickings/recompute-quants` | Пересчитать остатки вручную |

---

## Stock Report — `/api/stock-report`

Отчёт по складу (меню `stock-report`, раздел «Склад»): остатки, движения и оборотная ведомость.

| Method | Path | Описание |
|--------|------|---------|
| GET | `/stock-report/balances` | Остатки (`stock_quants`) по физическим (`internal`) локациям, с товаром и локацией; партии (`stock_lots`) свёрнуты в одну строку на товар+склад (`SUM(qty)`). Фильтры: `search` (товар), `location_id`, `branch_id`, `show_zero` (по умолчанию нулевые остатки скрыты). Пагинация |
| GET | `/stock-report/balances/lots` | Разбивка строки остатка по партиям (`stock_lots`) — цена, описание, характеристики, кол-во на партию. Параметры: `product_id`, `location_id` (оба обязательны). Подгружается лениво при раскрытии строки на вкладке «Остатки» |
| GET | `/stock-report/movements` | Движения (`stock_moves`) — только проведённые (`state: "done"`) строки документов. Фильтры: `search` (товар), `location_id` (по src или dest), `picking_type_id`, `date_from`/`date_to` (по `picking.date_done`). Пагинация |
| GET | `/stock-report/turnover` | Оборотная ведомость по складу за период: остаток на начало + приход − расход = остаток на конец, по `stock_moves` (`state: "done"`), сгруппировано по товару (партии свёрнуты). Фильтры (обязательны `location_id`, `date_from`, `date_to`): `search` (товар), `show_zero`. Пагинация |
| GET | `/stock-report/turnover/lots` | Та же оборотная ведомость, но для одного товара и сгруппированная по партии (`lot_id`) — цена/описание/характеристики + начало/приход/расход/конец на партию. Параметры: `location_id`, `date_from`, `date_to`, `product_id` (все обязательны). Подгружается лениво при раскрытии строки на вкладке «Обороты» |

**Параметры запроса:** `page`, `pageSize`, `filters` — JSON-строка с полями выше (кроме `/balances/lots` и `/turnover/lots` — там обычные query-параметры, без `filters`).

---

## Stock Moves — `/api/stock-moves`

Строки движения товаров (read-only, создаются через stock-pickings).

| Method | Path | Описание |
|--------|------|---------|
| GET | `/stock-moves` | Список (фильтры: picking_id, product_id, state) |
| GET | `/stock-moves/:id` | По ID |

---

## Stock Quants — `/api/stock-quants`

Текущие остатки (read-only, обновляются автоматически при validate/cancel/reverse).

| Method | Path | Описание |
|--------|------|---------|
| GET | `/stock-quants` | Остатки (фильтры: product_id, location_id, lot_id, search, low_stock) |

**Параметры запроса:**
- `page`, `pageSize` — пагинация
- `filters` — JSON-строка: `JSON.stringify({ location_id, product_id, lot_id, search, low_stock })`
- Всегда фильтрует только по локациям с `usage = "internal"` (физические склады)

**Ответ включает:** `product_name`, `product_sku`, `lot_name`, `unit_name`, `qty`, `available_qty` (qty − reserved_qty), `is_low_stock`

---

## Bill of Materials — `/api/bill-of-materials`

Спецификации продуктов (BoM).

| Method | Path | Описание |
|--------|------|---------|
| GET | `/bill-of-materials` | Список (включает product_name, lines) |
| GET | `/bill-of-materials/active` | Только активные |
| GET | `/bill-of-materials/:id` | По ID (включает lines) |
| POST | `/bill-of-materials` | Создать (product_id, qty, type, lines[]) |
| PUT | `/bill-of-materials/:id` | Обновить |
| DELETE | `/bill-of-materials/:id` | Удалить |

---

## Manufacturing Orders — `/api/manufacturing-orders`

Производственные заказы.

| Method | Path | Описание |
|--------|------|---------|
| GET | `/manufacturing-orders` | Список (фильтры: state, product_id; пагинация) |
| GET | `/manufacturing-orders/active` | Только активные |
| GET | `/manufacturing-orders/:id` | По ID (включает moves) |
| POST | `/manufacturing-orders` | Создать (product_id, bom_id?, qty_planned, ...) |
| PUT | `/manufacturing-orders/:id` | Обновить (только draft) |
| DELETE | `/manufacturing-orders/:id` | Удалить |
| POST | `/manufacturing-orders/:id/confirm` | Подтвердить (`draft` → `confirmed`) |
| POST | `/manufacturing-orders/:id/produce` | Произвести (списать компоненты, оприходовать ГП) |
| POST | `/manufacturing-orders/:id/cancel` | Отменить |

---

## Canteen — `/api/canteen`

Столовая. Норма порций — дневная: не накапливается, остаток обнуляется
каждые местные (Asia/Tashkent) сутки. Списание происходит по событию
face-терминала с `purpose = "canteen"` — отдельного эндпоинта для выдачи нет.

| Method | Path | Описание |
|--------|------|---------|
| GET | `/canteen/allowances` | Нормы сотрудников (фильтры: search, status, branch_id, department_id) |
| GET | `/canteen/allowances/stats` | Виджеты: всего норм, активных, ёмкость/день, выдано и отказов за сегодня |
| GET | `/canteen/allowances/:id` | Норма по ID |
| POST | `/canteen/allowances` | Назначить норму группе (employee_ids[], daily_limit, status, note) — upsert |
| PUT | `/canteen/allowances/:id` | Изменить норму (daily_limit 0–20, status, note) |
| DELETE | `/canteen/allowances/:id` | Удалить норму |
| GET | `/canteen/display` | Состояние экрана: лента последних проходов за сегодня + счётчики дня (params: device_id, limit ≤ 50) |
| GET | `/canteen/devices` | Терминалы с `purpose = "canteen"` |
| GET | `/canteen/meals` | Журнал порций (фильтры: date_from, date_to, status, device_id, search) |
| GET | `/canteen/report` | Сводка за период (group_by: employee \| department \| branch \| day) |

---

## Production Report — `/api/production-report`

Отчёт по швейному производству (меню `production-report`, раздел «Производство»).
Чтение (плюс правка цены стикеров, см. ниже); источник — `work_stickers` (партия → позиция → стикеры). Фильтры
передаются как `filters` (JSON): `date_from`, `date_to`, `search`, `operation_type_id`.
Суммы по сотрудникам ограничены доступом пользователя (филиал/отдел), как в списке сотрудников.

| Method | Path | Описание |
|--------|------|---------|
| GET | `/production-report/batches` | По партиям (клиент его не вызывает — вкладка «По заказам» строится на этих же данных через `/orders`): принято/роздано/в работе/выполнено/исправление/брак/зарплата + дерево `items[]` (позиции партии, с `received_qty`, `progress` — % выпуска последней операции от кол-ва позиции) → `operations[]` (`distributed_qty` — роздано, `progress` — % принятого от кол-ва позиции) → `employees[]` (сотрудники операции). Период — по `receipt_date` партии |
| GET | `/production-report/employees` | По сотрудникам: стикеры, кол-во, зарплата (Σ `amount` принятых стикеров), ср. расценка + разбивка `details[]` (партия × операция). Период — по `scanned_at` (дата приёма работы) |
| GET | `/production-report/operations` | По операциям: стикеры, кол-во, зарплата, ср. расценка, кол-во партий/сотрудников + разбивка `employees[]` и `batches[]`. `search` — по названию операции. Период — по `scanned_at` |
| GET | `/production-report/orders` | По заказам (`batch_receipts.order_number`, партии без заказа → `order_number: null`): то же, что `/batches`, но партии сгруппированы по заказу — итоги заказа (принято/роздано/в работе/выполнено/исправление/брак/зарплата/готовность) и дерево `batches[]` → `items[]` → `operations[]` → `employees[]` в том же формате, что у `/batches`. `search` — по партии/документу/клиенту/заказу. Период — по `receipt_date` партии |
| GET | `/production-report/monitoring` | Мониторинг: элемент на каждую операцию (в т.ч. без движения; выключенные — только с движением), только количество: `arrived_qty` (пришло: стикеры, напечатанные на операцию за период, `added_at`), `pending_qty` (в процессе: не принятые стикеры, напечатанные не позже конца периода — на текущий момент), `done_qty` (завершено: принятые за период, `scanned_at`, с долями сотрудников) + `batches[]` (разбивка по партиям: `batch_id`, `batch_number`, `order_number`, те же три количества; нули пропускаются) + `totals`. `search` — по названию операции. Клиент рисует каждую операцию карточкой с тремя ячейками по горизонтали (пришло / в процессе / завершено), под ними — строки по партиям с номером партии и заказа (список прокручивается), в конце — «Итого»; карточки переносятся на новую строку, когда не помещаются в ширину экрана; по умолчанию шлёт период «сегодня» |
| GET | `/production-report/stickers` | По стикерам: строка на стикер, постранично. Период — по `added_at` (дата печати) |
| GET | `/production-report/stickers/:id/chronology` | Хронология стикера: предыдущие → этот → дочерние стикеры, у каждого журнал событий |
| PUT | `/production-report/stickers/rate` | Правка цены принятых стикеров — одного или пачки. Body `{ ids: [...], rate }`; ответ `{ requested, updated, unchanged, skipped }`. Единственная запись в этом модуле |

Вкладка «По стикерам» — журнал для разбора ошибок. `GET /production-report/stickers` — строка на
стикер (в т.ч. в работе и брак; доли других сотрудников приходят в `workers[]` основного стикера),
постранично (`page`, `pageSize` ≤ 1000), `pagination` в ответе, `totals` — счётчики по статусам.
`filters`: `date_from`/`date_to` — по дате печати (`added_at`), `status` (`pending|done|scrapped`),
`operation_type_id`, `search` — по коду стикера, партии/документу/клиенту/заказу, операции, сотруднику
(в т.ч. по долям). `GET /production-report/stickers/:id/chronology` — `{ selected_id, nodes[] }`: цепочка
предыдущих стикеров (`parent_sticker_id`) от первого до выбранного, сам стикер и его дочерние; у узла
`relation` (`ancestor|selected|descendant`), `depth` и `events[]` по времени: `created` (печать, из строки),
`accepted`, `returned` (отмена приёма), `advanced` (раздача дальше, `children[]`), `child_deleted`
(удалён дочерний стикер), `updated` — последние из `audit_logs` (`entity = work_stickers`), т.к. в строке
остаётся только последний приём. Приём, которого нет в аудите, добавляется из самой строки. Сотрудники вне
доступа пользователя показываются как `hidden` (без ФИО и суммы).

`PUT /production-report/stickers/rate` — мастер исправляет ошибочную цену без возврата стикера (возврат
невозможен после раздачи дальше). Нужно право «изменение» на пункте меню `production-report`
(`user_menu_access.can_update`, проверяется и на сервере) и доступная логину операция. Правятся только принятые
(`done`) основные стикеры (не доли), не больше 1000 за раз; в пределах доступа логина (операции, «только свои»,
филиал/отдел). Остальные из `ids` пропускаются (`skipped`), уже с такой ценой — `unchanged`. У стикера и у всех его долей
меняются `rate` и `amount` (пересчёт через `calcAmount`, для единицы `m` — по длине из размера), количества не
трогаются. В `audit_logs` — по записи `update` на стикер (`{ rate, amount }` до/после), в хронологии это событие
`rate_changed` (`old_rate → rate`). Отказ по правам — 400 с текстом, не 403 (клиент трактует 403 как протухший токен).

Выполнено (`finished_qty`, колонка «Выполнено» в отчёте по заказам и партиям) — сумма факта (`actual_quantity`, вместе с долями)
принятых стикеров только последних операций (`operation_types.is_final`), иначе одна штука считалась бы на каждой операции
маршрута. Если ни у одной операции нет флага `is_final`, завершение не фиксируется: `finished_qty = 0`, готовность 0%.
Выработка по всем операциям остаётся в `operations[].done_qty` (детализация партии).
Зарплата здесь — сдельная по стикерам; в `payroll` она пока не подмешивается
(для `piecework` там `accrued = baseSalary`).

---

## Admin: Tenants — `/api/admin/tenants`

Управление организациями (только для системного администратора).

Стандартный CRUD: GET / GET/:id / POST / PUT/:id / DELETE/:id
