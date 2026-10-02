# Folder Structure

## Корень проекта
```
hrsystemNew/
├── client/          — React SPA
├── server/          — Node.js Express API
└── docs/ai-context/ — AI-контекст документация
```

---

## client/src/

```
src/
├── api/                  — Axios-функции для каждого backend-модуля
│   ├── instance.js       — axios-инстанс + refresh interceptor
│   ├── index.js          — центральный реэкспорт
│   └── <module>.js       — CRUD функции (attendance, employees, facePasses, ...)
│
├── assets/               — Изображения, иконки
├── icons/                — Кастомные SVG-иконки как React компоненты
│
├── components/           — Переиспользуемые UI-компоненты
│   ├── Add*.jsx          — Формы добавления (AddEmployee, AddUser, AddStockPicking, ...)
│   ├── Edit*.jsx         — Формы редактирования (EditStockPicking — с резолвингом локаций по типу операции)
│   ├── StockPickingDetail.jsx — Просмотр документа складской операции (в OverlaySidebar)
│   ├── StockPickingDetail.module.scss
│   ├── *Table.jsx        — Таблицы данных (AttendanceTable, EmployeesTable, ...)
│   ├── *Filter.jsx       — Компоненты фильтрации
│   ├── *Modal.jsx        — Модальные окна (рендерить через createPortal → document.body когда внутри OverlaySidebar)
│   ├── StockPickerModal.jsx — Выбор товаров из остатков склада (используется в Add/EditStockPicking когда src = warehouse)
│   ├── Sidebar.jsx       — Боковое меню
│   ├── Pagination.jsx    — Пагинация
│   ├── Button.jsx        — Кнопка (обёртка)
│   ├── Badge.jsx         — Статус-бейдж
│   ├── BottomNavTelegram.jsx — Нижняя навигация для Telegram (Главная / Задачи / Меню / Настройки)
│   ├── tg/               — Общие элементы Telegram-страниц Производства
│   │   ├── TgSheet.jsx   — Нижняя шторка (portal, свайп вниз, закреплённый footer)
│   │   ├── TgPickSheet.jsx — Шторка мультивыбора (поиск, «выбрать все», применить/отмена)
│   │   ├── TgUi.module.scss — Поля форм и кнопки (16px+ шрифт, чтобы iOS не зумил)
│   │   ├── CameraScanner.jsx — Полноэкранная камера: getUserMedia + zxing-wasm (читает DataMatrix и QR)
│   │   └── tgIcons.jsx   — Набор иконок (штрих 1.8)
│   ├── BatchReceiptDetailTelegram.jsx — Карточка партии в Telegram (шапка, позиции, панель действий)
│   ├── OperationTypeFormTelegram.jsx — Экран типа операции в Telegram (создание/правка: параметры, роль, связи, сотрудники, команды)
│   ├── BatchReceiptSheetsTelegram.jsx — Шторки формы партии (создание/правка) и позиции
│   ├── AttendanceSummaryTelegram.jsx — Посещаемость в Telegram: кольцо явки и плитки статусов (плитки = фильтры)
│   ├── AttendanceTableTelegram.jsx — Посещаемость в Telegram: карточки сотрудников + шторка «подробно о дне»
│   ├── AttendanceGroupsTelegram.jsx — Посещаемость в Telegram: карточки филиалов/отделов (день и период)
│   ├── AttendancePeriodTelegram.jsx — Посещаемость в Telegram: период по дням с раскрытием до филиалов/отделов
│   ├── AttendanceDateSheetTelegram.jsx — Шторка выбора периода (пресеты + две даты)
│   ├── LateSummaryTelegram.jsx — Опоздание в Telegram: число опоздавших, полоса тяжести (легенда = фильтры) и плитки итогов
│   ├── LateEmployeesTelegram.jsx — Опоздание в Telegram: карточки сотрудников + шторка «подробно» (за день — план/факт/фото, за период — по дням)
│   ├── LateGroupsTelegram.jsx — Опоздание в Telegram: карточки филиалов/отделов (тап = фильтр списка)
│   └── LateDaysTelegram.jsx — Опоздание в Telegram: период по дням с раскрытием до филиалов и сотрудников
│
├── context/
│   └── ScreenStackContext.jsx — Стек навигации (Telegram back-button)
│
├── helpers/
│   └── time.js           — Вспомогательные функции для времени
│
├── hooks/                — Кастомные React-хуки
│   ├── useAuthCheck.js   — Проверка авторизации
│   ├── usePermissions.js — RBAC для веб
│   ├── usePermissionsTelegram.js — RBAC для Telegram
│   ├── useTelegram.js    — Telegram WebApp SDK интеграция
│   ├── usePullToRefresh.js — Pull-to-refresh (mobile)
│   ├── useCameraScanner.jsx — Считывание кода камерой: своя камера, запасной вариант — сканер Telegram (только QR)
│   ├── useReferenceData.js — Загрузка справочников (branches, departments, employees)
│   └── useOpen*.js       — Навигационные хелперы (открыть форму добавления/редактирования; для TG-страниц — экраном поверх через ScreenStack)
│
├── layouts/
│   ├── WebLayout.jsx     — Основной layout: Sidebar + content + Alert
│   └── TelegramLayout.jsx — Telegram layout: BottomNav + content
│
├── locales/              — Переводы i18next
│   ├── ru.json           — Русский
│   ├── uz.json           — Узбекский (латиница)
│   ├── uzCyrl.json       — Узбекский (кириллица)
│   └── en.json           — Английский
│
├── pages/                — Страницы (маршруты)
│   ├── AuthPage.jsx      — Веб-логин
│   ├── AuthPageTelegram.jsx — Telegram-логин
│   ├── DashboardPage.jsx — Главная страница
│   ├── EmployeesPage.jsx / EmployeesPageTelegram.jsx
│   ├── AttendancePage.jsx / AttendancePageWeb.jsx / AttendancePageTelegram.jsx — TG: навигатор дат, сводка, виды «сотрудники / отделы / филиалы» (день) и «дни / группы» (период)
│   ├── FacePassesPage.jsx / FacePassesPageWeb.jsx / FacePassesPageTelegram.jsx
│   ├── VehiclePassesPage.jsx / VehiclePassesPageTelegram.jsx / VehiclePassesPageWeb.jsx
│   ├── LateEmployeesPage.jsx / LateEmployeesPageTelegram.jsx — TG: навигатор дат, сводка, виды «сотрудники / отделы / филиалы» (день) и «сотрудники / дни / группы» (период); каркас стилей общий с AttendancePageTelegram
│   ├── TimesheetPage.jsx
│   ├── WorkSchedulesPage.jsx
│   ├── TimeOffPage.jsx
│   ├── ProductionCalendarPage.jsx
│   ├── BranchesPage.jsx / DepartmentsPage.jsx / PositionsPage.jsx
│   ├── DepartmentsPageTelegram.jsx — Отделы в Telegram: плитки-фильтры, поиск, филиалы, карточки со штатом (форма — DepartmentFormScreenTelegram)
│   ├── ProductCategoryPage.jsx / ProductPage.jsx
│   ├── WarehousePage.jsx / WarehouseZonePage.jsx / StorageLocationPage.jsx / UnitPage.jsx
│   ├── PartnerPage.jsx / PartnerCategoryPage.jsx
│   ├── StockLocationsPage.jsx / StockPickingsPage.jsx / StockPickingTypesPage.jsx
│   ├── StockLotsPage.jsx / StockLedgerPage.jsx / StockInventoryPage.jsx
│   ├── StockPickingDetailPage.jsx  — (legacy, больше не используется как основной маршрут)
│   ├── BillOfMaterialsPage.jsx / ManufacturingOrdersPage.jsx
│   ├── CanteenAllowancesPage.jsx / CanteenDisplayPage.jsx / CanteenReportPage.jsx
│   ├── CanteenPage.module.scss     — общий SCSS для страниц столовой
│   ├── DoorsPage.jsx / GatesPage.jsx / FaceDevicesPage.jsx / VehicleCamerasPage.jsx
│   ├── UsersPage.jsx
│   ├── TelegramBotsPage.jsx
│   ├── HomePageTelegram.jsx / MenuPageTelegram.jsx / SettingsPageTelegram.jsx
│   ├── BatchReceiptsPage.jsx / BatchReceiptsPageTelegram.jsx — Приход партии (TG: список, фильтр-чипы, карточка экраном поверх)
│   ├── WorkAcceptancePage.jsx / WorkAcceptancePageTelegram.jsx — Приём работы (TG: вкладки Скан / Ждут / История, камера Telegram)
│   ├── OperationsPage.jsx / OperationsPageTelegram.jsx — Типы операций (TG: карточки, фильтр-чипы, форма экраном поверх)
│   └── StockPage.module.scss   — общий SCSS layout для всех Stock-страниц
│
├── services/
│   ├── api.js            — Вспомогательные API-утилиты
│   └── font.js           — Загрузка шрифтов
│
├── stores/               — Zustand-сторы
│   ├── authStore.js      — Состояние авторизации
│   ├── alertStore.js     — Глобальные уведомления
│   ├── filterDataStore.js — Состояния фильтров (persistent)
│   └── useSidebarStore.js — Состояние сайдбара
│
├── styles/               — Глобальные SCSS-стили
├── themes.scss           — CSS-переменные тем (light/dark)
│
├── utils/                — Утилиты
│   ├── DocGenerator.js   — Генерация Word (.docx) документов
│   ├── downloadDoc.js    — Скачивание PDF/документов
│   ├── DownloadAttendanceToExcel.js — Экспорт посещаемости в Excel
│   ├── attendanceTelegram.js — TG-посещаемость: статусы, цвета, даты (локальные, не UTC), пресеты периодов
│   ├── attendanceGroupsTelegram.js — TG-посещаемость: модели карточек филиалов/отделов (день и период)
│   ├── lateTelegram.js   — TG-опоздание: единая модель сотрудника (день/период), тяжесть, сводка, группы, дни, сортировка
│   ├── date.js           — Форматирование дат
│   ├── batchScan.js      — Разбор кода партии (поля через ';')
│   ├── operationType.js  — Общее веб/TG для типа операции: форма по умолчанию, связи, сложность, единицы
│   ├── telegramScan.js   — Проверки камеры / сканера Telegram / сенсорного экрана
│   └── utils.js          — Общие утилиты
│
├── App.jsx               — Корневой роутер (web + telegram routes)
├── routes.jsx            — Веб-маршруты
└── telegramRoutes.jsx    — Telegram-маршруты
```

---

## server/

```
server/
├── modules/              — Бизнес-модули (по одному на домен)
│   └── <name>/
│       ├── <name>.routes.js
│       ├── <name>.controller.js
│       ├── <name>.service.js
│       ├── <name>.model.js
│       └── <name>.helpers.js
│
├── middlewares/          — Express middleware
│   ├── authMiddleware.js      — Проверка JWT
│   ├── authPhotoMiddleware.js — Auth для фото
│   ├── tenantMiddleware.js    — Выбор tenant-схемы
│   ├── uploadPhoto.js         — Multer + Sharp
│   ├── logger.js              — HTTP-логгер
│   ├── deviceMiddleware.js    — Идентификация устройства
│   └── tempPhotoToken.js      — Временные токены фото
│
├── utils/                — Серверные утилиты
│   ├── hikEventChecker.js     — Polling Hikvision устройств
│   ├── faceDeviceFunction.js  — Управление face-устройствами
│   ├── doorFunctions.js       — Управление дверьми
│   ├── attendanceUtils.js     — Расчёт посещаемости
│   ├── parseHikvisionEvent.js — Парсинг событий Hikvision
│   ├── prismaContext.js       — Фабрика Prisma-клиентов по tenant
│   ├── prismaForTenant.js     — Tenant-специфичный Prisma
│   ├── userSyncHik.js         — Синхронизация с Hikvision
│   └── digest.js              — Digest authentication
│
├── services/
│   └── telegram-bot/    — Grammy Telegram Bot
│
├── workers/
│   ├── notificationsWorker.js — Отправка уведомлений из очереди
│   └── doorTasksWorker.js     — Обработка задач доступа к дверям
│
├── helpers/
│   └── timesheet.helpers.js   — Расчёты табеля
│
├── prisma/
│   ├── schema.client.prisma   — Схема для каждого tenant
│   └── schema.public.prisma   — Общая схема (tenants, notifications)
│
├── prisma-clients/       — Авто-сгенерированные Prisma клиенты
├── routes/index.js       — Центральный роутер (монтирует все модули)
├── app.js                — Express конфигурация
├── server.js             — Точка запуска
├── config.js             — ENV конфиг
└── db.js                 — PostgreSQL pool (pg)
```
