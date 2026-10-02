import { DEFAULTS, STICKER_PRESETS } from "../modules/workStickerTemplate/workStickerTemplate.presets.js";

export async function seedLogin(prisma) {
  let user = await prisma.users.findUnique({ where: { username: "root" } });
  if (!user) {
    user = await prisma.users.create({
      data: {
        username: "root",
        password:
          "$2b$10$iOgDrBgGzTqU5QmyHSqA8OeFbfrDU1Bkh8v0i50amJah6X9XUZC6y",
        access_level: "absolute",
        language: "ru",
        theme: "light",
        sidebar: "opened",
        status: true,
      },
    });
  }
  return user;
}

export async function seedMenus(prisma, user) {
  const home = await prisma.menus.upsert({
    where: { name: "home" },
    update: {},
    create: { name: "home", path: "/home", sort_order: 1 },
  });

  const hr = await prisma.menus.upsert({
    where: { name: "hr" },
    update: {},
    create: { name: "hr", path: "/hr", sort_order: 2 },
  });

  await prisma.menus.upsert({
    where: { name: "tasks" },
    update: {},
    create: { name: "tasks", path: "/tasks", sort_order: 3 },
  });

  const finance = await prisma.menus.upsert({
    where: { name: "finance" },
    update: {},
    create: { name: "finance", path: "/finance", sort_order: 4 },
  });

  const vehiclePasses = await prisma.menus.upsert({
    where: { name: "vehicle-passes" },
    update: {},
    create: { name: "vehicle-passes", path: "/vehicle-passes", sort_order: 5 },
  });

  const canteen = await prisma.menus.upsert({
    where: { name: "canteen" },
    update: {},
    create: { name: "canteen", path: "/canteen", sort_order: 6 },
  });

  const production = await prisma.menus.upsert({
    where: { name: "production" },
    update: {},
    create: { name: "production", path: "/production", sort_order: 7 },
  });

  const stock = await prisma.menus.upsert({
    where: { name: "stock" },
    update: {},
    create: { name: "stock", path: "/stock", sort_order: 8 },
  });

  // Настройки всегда последние
  const settings = await prisma.menus.upsert({
    where: { name: "settings" },
    update: { sort_order: 9 },
    create: { name: "settings", path: "/settings", sort_order: 9 },
  });

  const hrChildren = [
    { name: "departments", path: "/departments" },
    { name: "staffing", path: "/staffing" },
    { name: "employees", path: "/employees" },
    { name: "employment-orders", path: "/employment-orders" },
    { name: "attendance", path: "/attendance" },
    { name: "late-employees", path: "/late-employees" },
    { name: "timesheet", path: "/timesheet" },
    { name: "time-off", path: "/time-off" },
    { name: "face-passes", path: "/face-passes" },
    { name: "production-calendar", path: "/production-calendar" },
    { name: "work-schedules", path: "/work-schedules" },
    { name: "positions", path: "/positions" },
    { name: "asset-assignments", path: "/asset-assignments" },
  ];

  for (const [i, item] of hrChildren.entries()) {
    await prisma.menus.upsert({
      where: { name: item.name },
      update: {},
      create: { ...item, parent_id: hr.id, sort_order: i + 1 },
    });
  }

  const financeChildren = [
    { name: "salary-settings", path: "/salary-settings" },
    { name: "payroll", path: "/payroll" },
    { name: "salary-payouts", path: "/salary-payouts" },
  ];

  for (const [i, item] of financeChildren.entries()) {
    await prisma.menus.upsert({
      where: { name: item.name },
      update: {},
      create: { ...item, parent_id: finance.id, sort_order: i + 1 },
    });
  }

  const productionChildren = [
    { name: "operations", path: "/operations" },
    { name: "batch-receipts", path: "/batch-receipts" },
    { name: "work-acceptance", path: "/work-acceptance" },
    { name: "production-report", path: "/production-report" },
  ];

  // sort_order обновляем и у существующих — порядок в Производстве фиксированный
  for (const [i, item] of productionChildren.entries()) {
    await prisma.menus.upsert({
      where: { name: item.name },
      update: { sort_order: i + 1 },
      create: { ...item, parent_id: production.id, sort_order: i + 1 },
    });
  }

  // Склады: только "Документы" (создание приходов/расходов). Справочники
  // (локации, склады, товары, партнёры и т.д.) переехали в Настройки — см.
  // stockSettingsChildren ниже.
  const stockChildren = [
    { name: "stock-pickings", path: "/stock-pickings" },
    { name: "stock-report", path: "/stock-report" },
  ];

  for (const [i, item] of stockChildren.entries()) {
    await prisma.menus.upsert({
      where: { name: item.name },
      update: {},
      create: { ...item, parent_id: stock.id, sort_order: i + 1 },
    });
  }

  const canteenChildren = [
    { name: "canteen-allowances", path: "/canteen-allowances" },
    { name: "canteen-display", path: "/canteen-display" },
    { name: "canteen-report", path: "/canteen-report" },
  ];

  for (const [i, item] of canteenChildren.entries()) {
    await prisma.menus.upsert({
      where: { name: item.name },
      update: {},
      create: { ...item, parent_id: canteen.id, sort_order: i + 1 },
    });
  }

  const settingsChildren = [
    { name: "users", path: "/users" },
    { name: "branches", path: "/branches" },
    { name: "doors", path: "/doors" },
    { name: "face-devices", path: "/face-devices" },
    { name: "telegram-bots", path: "/telegram-bots" },
    { name: "audit-logs", path: "/audit-logs" },
    { name: "cron-tasks", path: "/cron-tasks" },
  ];

  for (const [i, item] of settingsChildren.entries()) {
    await prisma.menus.upsert({
      where: { name: item.name },
      update: {},
      create: { ...item, parent_id: settings.id, sort_order: i + 1 },
    });
  }

  const vehiclePassesSettingsChildren = [
    { name: "gates", path: "/gates" },
    { name: "vehicle-cameras", path: "/vehicle-cameras" },
  ];

  for (const [i, item] of vehiclePassesSettingsChildren.entries()) {
    await prisma.menus.upsert({
      where: { name: item.name },
      update: {},
      create: {
        ...item,
        parent_id: settings.id,
        sort_order: settingsChildren.length + i + 1,
      },
    });
  }

  // Складские справочники (были детьми "Склады") и новое "Типы документов" —
  // перенесены/добавлены в Настройки. update ставит parent_id явно (а не {}),
  // потому что у существующих тенантов эти пункты уже есть под "Склады" —
  // их нужно именно переместить, а не оставить как есть.
  const stockSettingsChildren = [
    { name: "stock-locations", path: "/stock-locations" },
    { name: "warehouses", path: "/warehouses" },
    { name: "units", path: "/units" },
    { name: "product-categories", path: "/product-categories" },
    { name: "products", path: "/products" },
    { name: "attributes", path: "/attributes" },
    { name: "partner-categories", path: "/partner-categories" },
    { name: "partners", path: "/partners" },
    { name: "stock-picking-types", path: "/stock-picking-types" },
    { name: "currencies", path: "/currencies" },
  ];

  const stockSettingsOffset = settingsChildren.length + vehiclePassesSettingsChildren.length;
  for (const [i, item] of stockSettingsChildren.entries()) {
    await prisma.menus.upsert({
      where: { name: item.name },
      update: { parent_id: settings.id, sort_order: stockSettingsOffset + i + 1 },
      create: { ...item, parent_id: settings.id, sort_order: stockSettingsOffset + i + 1 },
    });
  }

  const rootUser =
    user || (await prisma.users.findUnique({ where: { username: "root" } }));
  if (!rootUser) return;

  const allMenus = await prisma.menus.findMany();
  await prisma.user_menu_access.createMany({
    data: allMenus.map((menu) => ({
      user_id: rootUser.id,
      menu_id: menu.id,
      can_view: true,
      can_add: true,
      can_update: true,
      can_delete: true,
    })),
    skipDuplicates: true,
  });
}

// Варианты дизайна стикера "Распределение работы". Только добавляет недостающее:
// существующие варианты (в т.ч. отредактированные) не трогает, активным остаётся
// тот, что был. Отдельная функция (а не только часть seedTenantData), потому что
// seedLogin пересоздаёт root со стандартным паролем — на проде для существующих
// тенантов гонять весь сид ради дизайнов нельзя (см. seed-sticker-templates.js).
export async function seedStickerTemplates(prisma) {
  const existing = await prisma.work_sticker_templates.findMany({ select: { name: true } });
  const names = new Set(existing.map((row) => row.name));

  // Пустая таблица — сначала дефолтный макет как активный, иначе печать пошла бы
  // по первому же пресету.
  if (existing.length === 0) {
    await prisma.work_sticker_templates.create({ data: { ...DEFAULTS, is_active: true } });
    names.add(DEFAULTS.name);
  }

  for (const preset of STICKER_PRESETS) {
    if (names.has(preset.name)) continue;
    await prisma.work_sticker_templates.create({ data: { ...preset, is_active: false } });
  }
}

// Дефолтное дерево локаций (Odoo-стиль): виртуальные счета-анкеры для
// partners.supplier_location_id/customer_location_id и будущих picking types,
// плюс пустой корень для физических складов. Не трогает существующие данные —
// только если таблица пуста (повторный запуск сида безопасен).
export async function seedStockLocations(prisma) {
  const existing = await prisma.stock_locations.count();
  if (existing > 0) return;

  const virtualRoot = await prisma.stock_locations.create({
    data: { name: "Виртуальные локации", type: "view", complete_name: "Виртуальные локации", status: true },
  });

  const virtualChildren = [
    { name: "Поставщики", type: "supplier" },
    { name: "Клиенты", type: "customer" },
    { name: "Производство", type: "production" },
    { name: "Расходы / Офис", type: "expense" },
    { name: "Инвентаризация", type: "inventory" },
    { name: "Транзит", type: "transit" },
  ];

  for (const child of virtualChildren) {
    await prisma.stock_locations.create({
      data: {
        name: child.name,
        type: child.type,
        parent_id: virtualRoot.id,
        complete_name: `${virtualRoot.name} / ${child.name}`,
        status: true,
      },
    });
  }

  // code — стабильный технический идентификатор singleton-корня, НЕ имя.
  // Имя может измениться (в будущем, когда появится редактирование), code — нет:
  // на него опирается сервер при авторезолве parent_id для складов (см.
  // stockLocations.service.js addStockLocation), чтобы никогда не промахнуться
  // мимо айди при создании склада.
  await prisma.stock_locations.create({
    data: {
      name: "Физические склады",
      type: "view",
      code: "PHYS_ROOT",
      complete_name: "Физические склады",
      status: true,
    },
  });
}

// Дефолтные типы документов склада — примеры логики из ТЗ (Приём от
// поставщика/из цеха — incoming, Перемещение — internal, Отгрузка/Списание —
// outgoing). Только если таблица пуста — повторный запуск сида безопасен.
// default_location_* резолвим по type виртуальной локации (см. seedStockLocations:
// под каждым такой ровно один, code у них не нужен) — у Перемещения обе стороны
// (физические склады) оставляем пустыми, их выбирают при создании документа.
export async function seedStockPickingTypes(prisma) {
  const existing = await prisma.stock_picking_types.count();
  if (existing > 0) return;

  const findByType = async (type) => prisma.stock_locations.findFirst({ where: { type } });

  const [suppliers, customers, production, expense] = await Promise.all([
    findByType("supplier"),
    findByType("customer"),
    findByType("production"),
    findByType("expense"),
  ]);

  const types = [
    { name: "Приём от поставщика", code: "incoming", sequence_prefix: "REC-SUP", default_location_src_id: suppliers?.id ?? null, default_location_dest_id: null },
    { name: "Приём из цеха", code: "incoming", sequence_prefix: "REC-PROD", default_location_src_id: production?.id ?? null, default_location_dest_id: null },
    { name: "Перемещение", code: "internal", sequence_prefix: "MOVE", default_location_src_id: null, default_location_dest_id: null },
    { name: "Отгрузка", code: "outgoing", sequence_prefix: "SHIP", default_location_src_id: null, default_location_dest_id: customers?.id ?? null },
    { name: "Списание", code: "outgoing", sequence_prefix: "WOFF", default_location_src_id: null, default_location_dest_id: expense?.id ?? null },
  ];

  await prisma.stock_picking_types.createMany({ data: types });
}

// Базовая валюта отчётности — сум. Только если таблица пуста (повторный
// запуск сида безопасен). is_base=true — курс документов в этой валюте
// всегда 1 (см. CurrenciesService.getRecommendedRate), без похода в ЦБ.
export async function seedCurrencies(prisma) {
  const existing = await prisma.currencies.count();
  if (existing > 0) return;

  await prisma.currencies.create({
    data: { code: "UZS", name: "Узбекский сум", symbol: "сум", is_base: true, status: true },
  });
}

export async function seedTenantData(prisma) {
  const user = await seedLogin(prisma);
  await seedMenus(prisma, user);
  await seedStickerTemplates(prisma);
  await seedStockLocations(prisma);
  await seedStockPickingTypes(prisma);
  await seedCurrencies(prisma);
}
