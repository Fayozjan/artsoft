// Набор иконок для Telegram-страниц Производства: единый штрих 1.8, размер задаёт CSS родителя.

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export const IconSearch = () => (
  <svg {...base}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);

export const IconClose = () => (
  <svg {...base}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const IconFilter = () => (
  <svg {...base}>
    <path d="M4 6h16M7 12h10M10 18h4" />
  </svg>
);

export const IconPlus = () => (
  <svg {...base} strokeWidth={2.2}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconChevronLeft = () => (
  <svg {...base} strokeWidth={2.2}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

export const IconChevronRight = () => (
  <svg {...base} strokeWidth={2.2}>
    <path d="M9 18l6-6-6-6" />
  </svg>
);

export const IconChevronDown = () => (
  <svg {...base} strokeWidth={2.2}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const IconCheck = () => (
  <svg {...base} strokeWidth={2.4}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export const IconEdit = () => (
  <svg {...base}>
    <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z" />
    <path d="M14 7l3 3" />
  </svg>
);

export const IconTrash = () => (
  <svg {...base}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </svg>
);

export const IconCopy = () => (
  <svg {...base}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </svg>
);

export const IconUndo = () => (
  <svg {...base}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </svg>
);

export const IconRefresh = () => (
  <svg {...base}>
    <path d="M20 11a8 8 0 1 0-2.3 5.7" />
    <path d="M20 5v6h-6" />
  </svg>
);

export const IconBox = () => (
  <svg {...base}>
    <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
    <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
  </svg>
);

export const IconCalendar = () => (
  <svg {...base}>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);

// Календарь с перечёркнутой линией — «отсутствие».
export const IconCalendarOff = () => (
  <svg {...base}>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
    <path d="M4.5 20.5l15-15" />
  </svg>
);

export const IconHash = () => (
  <svg {...base}>
    <path d="M5 9h14M5 15h14M10 4L8 20M16 4l-2 16" />
  </svg>
);

export const IconUser = () => (
  <svg {...base}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c1-4 4-6 8-6s7 2 8 6" />
  </svg>
);

export const IconUsers = () => (
  <svg {...base}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.8-3.5 3.3-5.5 6.5-5.5s5.7 2 6.5 5.5" />
    <path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.8c1.8.7 3 2.4 3.5 5.2" />
  </svg>
);

// Сотрудник с плюсом — «добавить сотрудника».
export const IconUserPlus = () => (
  <svg {...base}>
    <circle cx="9.5" cy="8" r="3.8" />
    <path d="M2.5 20c.9-3.9 3.6-6 7-6s6.1 2.1 7 6" />
    <path d="M19 7.5v6M16 10.5h6" strokeWidth={2.2} />
  </svg>
);

export const IconClock = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const IconMessage = () => (
  <svg {...base}>
    <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z" />
  </svg>
);

// Рамка видоискателя с линией сканирования — «навести камеру на код».
export const IconScan = () => (
  <svg {...base}>
    <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
    <path d="M7 12h10" />
  </svg>
);

export const IconQr = () => (
  <svg {...base}>
    <rect x="4" y="4" width="6" height="6" rx="1" />
    <rect x="14" y="4" width="6" height="6" rx="1" />
    <rect x="4" y="14" width="6" height="6" rx="1" />
    <path d="M14 14h2v2h-2zM18 14h2M14 18h2M18 18h2v2" />
  </svg>
);

export const IconLayers = () => (
  <svg {...base}>
    <path d="M12 3l9 5-9 5-9-5 9-5z" />
    <path d="M3 13l9 5 9-5" />
  </svg>
);

export const IconAlert = () => (
  <svg {...base}>
    <path d="M12 4l9 16H3L12 4z" />
    <path d="M12 10v4M12 17.5v.01" />
  </svg>
);

export const IconLock = () => (
  <svg {...base}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2" />
  </svg>
);

export const IconUnlock = () => (
  <svg {...base}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
    <path d="M8 10.5V8a4 4 0 0 1 7.6-1.7M12 14.5v2" />
  </svg>
);

export const IconShield = () => (
  <svg {...base}>
    <path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6L12 3z" />
    <path d="M9 12l2.2 2.2L15.5 10" />
  </svg>
);

export const IconUserCheck = () => (
  <svg {...base}>
    <circle cx="9.5" cy="8" r="3.8" />
    <path d="M2.5 20c.9-3.9 3.6-6 7-6 1.6 0 3 .4 4.2 1.2" />
    <path d="M15.5 17.5l2.2 2.2 4-4.4" strokeWidth={2.2} />
  </svg>
);

export const IconUserOff = () => (
  <svg {...base}>
    <circle cx="9.5" cy="8" r="3.8" />
    <path d="M2.5 20c.9-3.9 3.6-6 7-6 1.6 0 3 .4 4.2 1.2" />
    <path d="M16 16.5l5 5M21 16.5l-5 5" strokeWidth={2.2} />
  </svg>
);

export const IconBuilding = () => (
  <svg {...base}>
    <path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" />
    <path d="M15 10h2a2 2 0 0 1 2 2v9M3 21h18" />
    <path d="M9 7h2M9 11h2M9 15h2" />
  </svg>
);

export const IconMapPin = () => (
  <svg {...base}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.3" />
  </svg>
);

export const IconBriefcase = () => (
  <svg {...base}>
    <rect x="3.5" y="7.5" width="17" height="12" rx="2.5" />
    <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3.5 13h17" />
  </svg>
);

export const IconMinus = () => (
  <svg {...base} strokeWidth={2.2}>
    <path d="M5 12h14" />
  </svg>
);

export const IconFlash = () => (
  <svg {...base}>
    <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
  </svg>
);

// Маршрут: две точки, соединённые изгибом — «схема связей операций».
export const IconRoute = () => (
  <svg {...base}>
    <circle cx="6" cy="18" r="2.2" />
    <circle cx="18" cy="6" r="2.2" />
    <path d="M8.2 18H14a3.5 3.5 0 0 0 0-7h-4a3.5 3.5 0 0 1 0-7h5.8" />
  </svg>
);

export const IconArrowRight = () => (
  <svg {...base} strokeWidth={2}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

// Три ползунка — параметры операции.
export const IconSliders = () => (
  <svg {...base}>
    <path d="M4 6h7M16.2 6H20M4 12h2M11.2 12H20M4 18h9M18.2 18H20" />
    <circle cx="13.6" cy="6" r="2.2" />
    <circle cx="8.6" cy="12" r="2.2" />
    <circle cx="15.6" cy="18" r="2.2" />
  </svg>
);

// Стрелка в проём — «вход».
export const IconLogIn = () => (
  <svg {...base}>
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
    <path d="M4 12h10M10 8l4 4-4 4" />
  </svg>
);

// Стрелка из проёма — «выход».
export const IconLogOut = () => (
  <svg {...base}>
    <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
    <path d="M10 12h10M16 8l4 4-4 4" />
  </svg>
);

// Солнце — отпуск, выходной.
export const IconSun = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
  </svg>
);

export const IconFlag = () => (
  <svg {...base}>
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
  </svg>
);

export const IconCamera = () => (
  <svg {...base}>
    <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2a1 1 0 0 0 .8-.4l.9-1.2a1 1 0 0 1 .8-.4h3.6a1 1 0 0 1 .8.4l.9 1.2a1 1 0 0 0 .8.4h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8z" />
    <circle cx="12" cy="12.5" r="3.3" />
  </svg>
);

export const IconPhone = () => (
  <svg {...base}>
    <path d="M6.6 3.5h2.7l1.4 3.7-1.8 1.3a11 11 0 0 0 5.6 5.6l1.3-1.8 3.7 1.4v2.7a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z" />
  </svg>
);

export const IconDoor = () => (
  <svg {...base}>
    <path d="M6 20V5.5A1.5 1.5 0 0 1 7.5 4h9A1.5 1.5 0 0 1 18 5.5V20M4 20h16" />
    <circle cx="14.5" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

export const IconIdCard = () => (
  <svg {...base}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
    <circle cx="9" cy="11" r="2" />
    <path d="M6 16c.4-1.4 1.6-2.2 3-2.2s2.6.8 3 2.2M14.5 10h3M14.5 13.5h3" />
  </svg>
);

// Будильник — «опоздание».
export const IconAlarm = () => (
  <svg {...base}>
    <circle cx="12" cy="13" r="7.5" />
    <path d="M12 9.5V13l2.5 1.5M5 4.5L2.8 6.7M19 4.5l2.2 2.2" />
  </svg>
);

// Чашка — «перерыв».
export const IconCoffee = () => (
  <svg {...base}>
    <path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9z" />
    <path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8.5 3.5v2M12 3.5v2" />
  </svg>
);

// Кошелёк — «штраф».
export const IconWallet = () => (
  <svg {...base}>
    <rect x="3.5" y="7" width="17" height="12.5" rx="2.5" />
    <path d="M6 7l9.5-3a1 1 0 0 1 1.3.9V7M20.5 12.5H16a1.5 1.5 0 0 0 0 3h4.5" />
    <circle cx="16.2" cy="14" r="0.8" fill="currentColor" stroke="none" />
  </svg>
);

// Стрелка вправо в линию — «от плана к факту».
export const IconTrend = () => (
  <svg {...base}>
    <path d="M3 17l6-6 4 4 8-8" />
    <path d="M15 7h6v6" />
  </svg>
);

// Стрелка вниз на подложку — «скачать».
export const IconDownload = () => (
  <svg {...base}>
    <path d="M12 3v12M7.5 10.5L12 15l4.5-4.5" />
    <path d="M5 19h14" />
  </svg>
);

// Калькулятор — «пересчитать табель».
// Дом — «дистанционная работа».
export const IconHome = () => (
  <svg {...base}>
    <path d="M4 11.5L12 4l8 7.5" />
    <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
    <path d="M10 20v-5.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V20" />
  </svg>
);

// Кузов на колёсах — «транспорт».
export const IconCar = () => (
  <svg {...base}>
    <path d="M5 11l1.5-4.5h11L19 11" />
    <rect x="3" y="11" width="18" height="7" rx="2" />
    <circle cx="7.5" cy="18" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="16.5" cy="18" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

// Стойка с поднятой стрелой шлагбаума — «ворота / шлагбаум».
export const IconBarrier = () => (
  <svg {...base}>
    <circle cx="5" cy="13.5" r="1.8" />
    <rect x="3.5" y="4" width="2.4" height="9" rx="1.2" />
    <path d="M6.3 6.7l13.2-2.9" />
  </svg>
);

export const IconCalculator = () => (
  <svg {...base}>
    <rect x="5" y="3" width="14" height="18" rx="2.5" />
    <path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" strokeWidth={2.4} />
  </svg>
);
