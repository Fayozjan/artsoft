# Important Files

## Backend

### `server/server.js`
Точка запуска приложения. Запускает Express, регистрирует обработчики uncaughtException/unhandledRejection, инициализирует workers (notifications, doorTasks) и Hikvision event checker.

### `server/app.js`
Express конфигурация: middleware стек, статика `/client/dist`, монтирование `/api` роутера.

### `server/config.js`
Централизованный доступ к env-переменным. Всегда читать отсюда, не из `process.env` напрямую.

### `server/routes/index.js`
Центральный роутер — монтирует все 25 модулей на их пути. Добавление нового модуля начинается здесь.

### `server/middlewares/tenantMiddleware.js`
Критически важный middleware. Извлекает tenant из JWT, находит схему, создаёт `req.prisma` — Prisma-клиент для нужной БД. Должен быть первым в цепочке для любого tenant-specific маршрута.

### `server/middlewares/authMiddleware.js`
Проверяет `access_token` cookie, декодирует JWT, кладёт `req.user`. Используется после `tenantMiddleware`.

### `server/utils/prismaContext.js`
Фабрика Prisma-клиентов. Принимает schema_name, возвращает Prisma-инстанс подключённый к нужной схеме. Кэширует клиенты.

### `server/utils/attendanceUtils.js`
Логика расчёта посещаемости: определение опоздания, нормы рабочего времени, стыковка face_passes с рабочим графиком.

### `server/utils/hikEventChecker.js`
Polling Hikvision устройств на наличие новых событий (face passes). Запускается при старте сервера как периодический job.

### `server/prisma/schema.client.prisma`
Prisma-схема клиентской БД. Источник истины для всех моделей данных. При изменении модели — сначала сюда, потом `prisma generate`.

### `server/prisma/schema.public.prisma`
Prisma-схема публичной БД (tenants, notifications_outbox).

### `server/workers/notificationsWorker.js`
Фоновый worker: читает очередь `notifications_outbox`, отправляет Telegram-сообщения, помечает как отправленные.

### `server/workers/doorTasksWorker.js`
Фоновый worker: берёт задачи `employee_door_tasks` со статусом `pending`, синхронизирует face-устройства.

---

## Frontend

### `client/src/App.jsx`
Корневой компонент. Определяет двойную маршрутизацию (web vs telegram). Рендерит глобальный `<Alert>`.

### `client/src/routes.jsx`
Все ~20 веб-маршрутов с ленивой загрузкой. Добавление новой страницы начинается здесь.

### `client/src/telegramRoutes.jsx`
Telegram Web App маршруты. Используют `TelegramLayout`.

### `client/src/api/instance.js`
Axios-инстанс с базовым URL `/api`. Содержит interceptor: при 401/403 автоматически вызывает `/api/auth/refresh`, повторяет запрос. При fail refresh — вызывает logout.

### `client/src/stores/authStore.js`
Zustand store — сердце авторизации. Хранит: user, settings (theme, language, sidebar), access rights, функции login/logout/refresh. Персистируется в localStorage.

### `client/src/stores/alertStore.js`
Глобальный toast/alert store. Используется везде для показа success/error уведомлений.

### `client/src/hooks/usePermissions.js`
RBAC хук для веб. Принимает menu_name, возвращает `{ can_view, can_add, can_update, can_delete }`. Используется в каждой странице для управления видимостью кнопок.

### `client/src/hooks/useReferenceData.js`
Загружает справочные данные (branches, departments, positions, employees) один раз и предоставляет через контекст. Используется в формах с select-полями.

### `client/src/layouts/WebLayout.jsx`
Основной layout веб-версии. Рендерит `<Sidebar>` слева и `<Outlet>` справа.

### `client/src/layouts/TelegramLayout.jsx`
Layout Telegram версии. Рендерит `<BottomNavTelegram>` снизу и `<Outlet>` сверху.

### `client/src/components/Sidebar.jsx`
Боковое меню. Рендерит пункты динамически из `user.menus`. Поддерживает вложенность, свёртывание, темы.

### `client/src/utils/DownloadAttendanceToExcel.js`
Утилита экспорта посещаемости в Excel (ExcelJS). Формирует сложные таблицы с форматированием.

### `client/src/utils/DocGenerator.js`
Генерация Word (.docx) документов (приказы, справки). Использует библиотеку `docx`.

### `client/src/locales/ru.json`
Основной языковой файл (русский). При добавлении нового текста — добавлять ключи сюда и в uz.json, en.json, uzCyrl.json.

### `client/vite.config.js`
Vite конфигурация. Важно: dev-сервер на порту 5000, proxy `/api` → `localhost:7000`. При изменении портов — обновлять здесь.

### `client/src/themes.scss`
CSS-переменные для light/dark тем. Цвета, шрифты, тени. Используется во всех SCSS module файлах.
