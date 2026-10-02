# Coding Rules & Conventions

## Backend

### Структура модуля (обязательно)
Каждый новый домен = отдельная папка `server/modules/<name>/` с файлами:
- `<name>.routes.js` — Express Router
- `<name>.controller.js` — только req/res, без логики
- `<name>.service.js` — бизнес-логика
- `<name>.model.js` — запросы к БД
- (опционально) `<name>.helpers.js`

Регистрация в `server/routes/index.js`.

### Middleware порядок в routes
```js
router.use(tenantMiddleware);  // 1. всегда первым
router.use(authMiddleware);    // 2. после tenant
// затем специфичные роуты
```

### Именование
- Файлы: `camelCase.js` или `kebab-case.js` (последовательно внутри модуля)
- Классы контроллеров: `PascalCase` + суффикс `Controller` (`EmployeeController`)
- Функции сервиса: `camelCase` (`getAll`, `getById`, `create`, `update`, `delete`)
- Таблицы БД: `snake_case` множественное число (`employees`, `face_passes`)
- Поля БД: `snake_case` (`employee_id`, `date_from`, `added_at`)

### ES Modules
Весь сервер использует ESM (`"type": "module"` в package.json). Всегда `import/export`, не `require/module.exports`.

### Prisma usage
- Не использовать `prismaContext` напрямую в контроллерах — только через `req.prisma` (устанавливается tenantMiddleware)
- Для public схемы: отдельный Prisma-клиент из `prisma-clients/public`

### Error handling
Контроллеры оборачивают вызовы в try/catch, передают в `next(err)` или возвращают `res.status(xxx).json({ message })`.

### Auth
- Access token: 15 минут, в httpOnly cookie
- Refresh token: 8 часов, в httpOnly cookie
- Пароли: bcrypt hashing

---

## Frontend

### Именование компонентов
- Файлы компонентов: `PascalCase.jsx` (`AddEmployee.jsx`, `AttendanceTable.jsx`)
- CSS Modules: `PascalCase.module.scss` (рядом с компонентом)
- Хуки: `camelCase` с префиксом `use` (`usePermissions`, `useReferenceData`)
- API файлы: `camelCase.js` по домену (`employees.js`, `facePasses.js`)
- Stores: `camelCase` + суффикс `Store` (`authStore`, `alertStore`)

### Структура компонента (паттерн)
```jsx
// 1. Импорты (react, хуки, компоненты, стили, api)
// 2. Компонент с деструктуризацией props
// 3. Хуки и состояние
// 4. Обработчики (handleSubmit, handleChange)
// 5. JSX return
```

### API вызовы
Все API вызовы через функции из `src/api/<module>.js`, не напрямую через axios.
```js
// Правильно:
import { getEmployees } from '../api/employees'
// Неправильно:
import api from '../api/instance'; api.get('/employees')
```

### Стейт-менеджмент
- **Zustand** для глобального состояния (auth, alerts, filters, sidebar)
- **useState/useReducer** для локального состояния компонента
- Redux — только для legacy страниц, новый код использует Zustand

### Уведомления (alerts)
Всегда использовать `alertStore` для показа пользователю результатов операций:
```js
const { showAlert } = useAlertStore()
showAlert('success', t('saved'))
showAlert('error', error.message)
```

### Переводы (i18n)
- Все видимые тексты через `t('key')` из `useTranslation()`
- Ключи добавлять во все 4 файла: `ru.json`, `uz.json`, `uzCyrl.json`, `en.json`
- Ключи: `camelCase` или `snake_case`, по смыслу (`employee.firstName`, `button.save`)

### Permissions (RBAC)
В каждой странице проверять права перед рендером кнопок:
```jsx
const { can_add, can_update, can_delete } = usePermissions('menu_name')
// Показывать кнопку "Добавить" только если can_add === true
```

### Dual UI (Web + Telegram)
- Веб-страницы: в `src/pages/*Page.jsx` — используют `WebLayout`
- Telegram-страницы: в `src/pages/*PageTelegram.jsx` — используют `TelegramLayout`
- Общая логика — выносить в кастомные хуки, не дублировать

### Стилизация
- Предпочитать SCSS Modules (`.module.scss`) для стилей компонента
- Bootstrap классы для grid и простых утилит
- Глобальные переменные из `themes.scss` — использовать **только** определённые там:
  - Фон: `--card-bg` (белый/тёмный), `--bg-light` (вторичный), `--bg-color` (страница)
  - Текст: `--text-color` (основной), `--text-secondary` (второстепенный)
  - Границы: `--border-color`, `--border-subtle`
  - Инпуты: `--input-bg`
  - Акцент: `--third-color` (синий)
  - Типография: `--font-small`, `--font-body`, `--font-h1/h2/h3`
  - ⚠️ `--bg-primary`, `--bg-secondary`, `--text-primary`, `--primary` — **не существуют**, не использовать
- Не использовать inline styles кроме динамических значений (цвет, ширина, opacity)
- Не использовать `color-mix()` в SCSS — Sass парсер путает запятые внутри `var()` как аргументы функции → весь модуль ломается

### Паттерн страницы (Page Layout)
Все страницы с таблицами следуют единой структуре JSX и SCSS. Эталон — `EmployeesPage`, `BranchesPage`.

**Структура JSX:**
```jsx
<div className={styles.page}>
  {loading ? <Loading /> : (
    <div className={styles.main}>
      <div className={styles.mainHeader}>
        <div className={styles.filterWrapper}>
          <Search ... />
          {/* фильтры */}
        </div>
        <Pagination ... />
        <div className={styles.buttonsWrapper}>
          {canAdd && <Button text={t("add")} onClick={...} />}
          <div className={styles.refreshBtn} onClick={fetchData}>{Icons.refresh}</div>
        </div>
      </div>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead><tr><th>...</th></tr></thead>
          <tbody>...</tbody>
        </table>
      </div>
    </div>
  )}
</div>
```

**Ключевые классы в SCSS:**
- `.page` — `height: 100vh`, flex column
- `.main` — `background: var(--card-bg)`, flex column, `height: 100%`
- `.mainHeader` — flex row, space-between, flex-wrap
- `.filterWrapper` — flex row, gap
- `.buttonsWrapper` — flex row, gap
- `.refreshBtn` — styled div с border, hover эффект
- `.tableContainer` — `flex: 1`, `overflow: auto`, sticky-scroll
- `.table` — sticky thead, th uppercase 11px `var(--text-secondary)`, td padding 8px 10px, tbody tr hover

**Для Stock-страниц** используется общий `StockPage.module.scss` (не создавать отдельный на каждую страницу).

**Инлайн-стили в таблице — только для:**
- `fontWeight`, `fontSize` на отдельных ячейках
- `textAlign: "right"` для числовых колонок
- `color` для динамических значений (красный при ошибке, и т.д.)
- `background`, `opacity`, `cursor` — строко-специфичные

### Компоненты статуса и действий в таблицах
```jsx
// Статус-бейдж с цветом
<span className={styles.statusBadge} style={{ background: color + "20", color }}>
  {label}
</span>

// Иконочные кнопки (edit/delete)
<div className={styles.actionsCell}>
  <button className={styles.iconBtn} onClick={...}>{Icons.edit}</button>
  <button className={styles.iconBtn} onClick={...}>{Icons.delete}</button>
</div>

// Кнопки действий (validate/cancel)
<button className={styles.btnSuccess}>Провести</button>
<button className={styles.btnDanger}>Отменить</button>
<button className={styles.btnMuted}>{Icons.delete}</button>
```

### Архитектурные паттерны
- Страницы = "умные" компоненты (данные, логика, API вызовы)
- Компоненты в `components/` = "глупые" (получают данные через props)
- Формы Add/Edit — отдельные компоненты, открываются через sidebar или модальное окно

### Модальные окна внутри OverlaySidebar
`OverlaySidebar` использует framer-motion `transform` → `position: fixed` дочерних элементов позиционируется относительно sidebar, а не viewport → overlay выглядит прозрачным или смещённым.

**Решение:** рендерить модал через `createPortal`:
```jsx
import { createPortal } from "react-dom";

// В конце return компонента:
return createPortal(
  <div className={styles.overlay}>...</div>,
  document.body
);
```

### Выбор товаров из склада (StockPickerModal)
Когда в форме накладной `srcIsWarehouse === true` и склад выбран — показывать кнопку "Выбрать из склада".
Она открывает `StockPickerModal` с `locationId` склада.
Модал использует `getStockQuants({ filters: JSON.stringify({ location_id }) })` и заменяет список строк накладной.

### Просмотр документов (Detail view) — паттерн OverlaySidebar
Для документов (Stock Pickings и аналогичных) клик по строке открывает **`OverlaySidebar`** с компонентом просмотра, а не `navigate` на отдельную страницу.

```jsx
// В странице-списке:
const [viewItemId, setViewItemId] = useState(null);
const [sidebarMode, setSidebarMode] = useState("view"); // "view" | "edit"
const [editData, setEditData] = useState(null);

// Строка таблицы:
<tr onClick={() => { setViewItemId(item.id); setSidebarMode("view"); }}>

// Sidebar:
<OverlaySidebar isOpen={!!viewItemId} onClose={() => setViewItemId(null)} width="900px">
  {sidebarMode === "view" && (
    <DetailComponent id={viewItemId} onEdit={(data) => { setEditData(data); setSidebarMode("edit"); }} onRefreshList={fetchData} />
  )}
  {sidebarMode === "edit" && editData && (
    <EditComponent data={editData} onSuccess={() => { setSidebarMode("view"); setEditData(null); fetchData(); }} onCancel={() => setSidebarMode("view")} />
  )}
</OverlaySidebar>
```

### Кнопки действий для документов с проводкой
| Статус | Кнопки |
|--------|--------|
| `draft` | Редактировать, Провести |
| `confirmed` | Провести |
| `done` | Отменить проводку (`/reverse` → возврат в `draft`) |
| `cancelled` | — |

**Отменить проводку** ≠ **Отменить документ**: `/reverse` возвращает `done → draft` (откатывает quants, восстанавливает редактируемость). `/cancel` переводит в `cancelled` (финальное состояние).

---

## Общие правила

### Языки
- Весь код: английский (переменные, функции, комментарии)
- Переводы пользовательского интерфейса: через i18n
- Документация: русский (этот проект)

### Git
- Ветки по фичам: `feat/<feature-name>`
- Коммиты: императив, кратко (`feat(employees): add photo upload`)

### Формат дат
- Backend: хранить в UTC, `Timestamptz(6)` в Prisma
- Frontend: отображать через `dayjs` или `luxon` с учётом timezone пользователя
