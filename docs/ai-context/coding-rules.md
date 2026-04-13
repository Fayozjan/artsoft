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
- Глобальные переменные из `themes.scss`
- Не использовать inline styles кроме динамических значений

### Архитектурные паттерны
- Страницы = "умные" компоненты (данные, логика, API вызовы)
- Компоненты в `components/` = "глупые" (получают данные через props)
- Формы Add/Edit — отдельные компоненты, открываются через sidebar или модальное окно

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
