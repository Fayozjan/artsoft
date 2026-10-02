import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env"),
});

import { getPrismaForTenant, disconnectAll } from "../utils/prismaForTenant.js";
import { prismaContext } from "../utils/prismaContext.js";
import { tenantContext } from "../utils/tenantContext.js";
import { CanteenService } from "../modules/canteen/canteen.service.js";
import { todayMealDate } from "../modules/canteen/canteen.helpers.js";

// Демо-данные для экрана столовой. Проходы создаются через тот же
// CanteenService.registerFromDeviceEvent, что и события терминала, — значит
// нормы, отказы и остатки ведут себя ровно как в бою.
//
//   npm run seed:canteen-demo
//   npm run seed:canteen-demo -- --employees=20 --meals=40
//   npm run seed:canteen-demo -- --employee=123           (только один сотрудник)
//   npm run seed:canteen-demo -- --employee=123 --limit=2 --meals=3
//   npm run seed:canteen-demo -- --live=30 --delay=3000   (по одному проходу подряд)
//   npm run seed:canteen-demo -- --clear                  (стереть проходы за сегодня)

const FLAGS = [
  "tenant",
  "employee",
  "employees",
  "meals",
  "limit",
  "live",
  "delay",
  "clear",
];

// npm 10 на Windows не пробрасывает аргументы после `--` в argv, а кладёт их
// в окружение как npm_config_<flag>. Читаем оба источника, argv приоритетнее.
const fromNpmEnv = Object.fromEntries(
  FLAGS.map((flag) => [flag, process.env[`npm_config_${flag}`]]).filter(
    ([, value]) => value !== undefined && value !== "",
  ),
);

const fromArgv = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, "").split("=");
    return [key, value === undefined ? true : value];
  }),
);

const args = { ...fromNpmEnv, ...fromArgv };

const SCHEMA = args.tenant || process.env.DEFAULT_TENANT;
// --employee=<id> — режим одного сотрудника: только его нормы и проходы
const EMPLOYEE_ID = args.employee ? Number(args.employee) : null;
const EMPLOYEES = Number(args.employees || 15);
// --limit=<n> — принудительно выставить норму сотруднику
const LIMIT = args.limit === undefined ? null : Number(args.limit);
const LIVE = Number(args.live || 0);
const DELAY_MS = Number(args.delay || 4000);
// При --live историю по умолчанию не создаём: иначе она съедает норму и
// живые проходы идут сплошными отказами
const MEALS = Number(args.meals ?? (LIVE > 0 ? 0 : EMPLOYEE_ID ? 5 : 25));

if (EMPLOYEE_ID !== null && !Number.isInteger(EMPLOYEE_ID)) {
  console.error("--employee ждёт числовой id сотрудника");
  process.exit(1);
}

if (!SCHEMA) {
  console.error("Не задан тенант: --tenant=<schema> или DEFAULT_TENANT в .env");
  process.exit(1);
}

const shuffle = (array) => {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run(prisma) {
  // ── Терминал ───────────────────────────────────────────────────────────────
  let device = await prisma.face_devices.findFirst({
    where: { purpose: "canteen" },
    select: { id: true, name: true },
  });

  if (!device) {
    console.warn(
      "⚠  Терминала с purpose = 'canteen' нет. Проходы создам без привязки к устройству —\n" +
        "   на экране в фильтре «Все терминалы столовой» они будут видны.\n",
    );
  } else {
    console.log(`Терминал: ${device.name || device.id}\n`);
  }

  // ── Очистка ────────────────────────────────────────────────────────────────
  // через env флаг приходит строкой, поэтому не полагаемся на truthy
  const clearMode =
    args.clear !== undefined && args.clear !== "false" && args.clear !== "0";

  if (clearMode) {
    // Локальная дата, а не UTC: до 05:00 по Ташкенту они не совпадают
    const mealDate = todayMealDate();
    const removed = await prisma.canteen_meals.deleteMany({
      where: {
        meal_date: mealDate,
        identifier: { startsWith: "demo-" },
        ...(EMPLOYEE_ID !== null ? { employee_id: EMPLOYEE_ID } : {}),
      },
    });
    console.log(`Удалено демо-проходов за сегодня: ${removed.count}`);
    return;
  }

  // Норму заводим, если её нет; с --limit ещё и перезаписываем существующую
  const ensureAllowance = async (employeeId) => {
    const existing = await prisma.canteen_allowances.findUnique({
      where: { employee_id: employeeId },
    });

    if (existing && LIMIT === null) return false;

    await prisma.canteen_allowances.upsert({
      where: { employee_id: employeeId },
      create: {
        employee_id: employeeId,
        daily_limit: LIMIT ?? randomInt(1, 3),
        status: true,
        note: "демо",
      },
      // null в daily_limit Prisma не примет — при отсутствии --limit не шлём поле
      update: LIMIT === null ? { status: true } : { daily_limit: LIMIT, status: true },
    });
    return !existing;
  };

  let candidates;

  if (EMPLOYEE_ID !== null) {
    // ── Один сотрудник ───────────────────────────────────────────────────────
    const employee = await prisma.employees.findUnique({
      where: { id: EMPLOYEE_ID },
      select: { id: true, first_name: true, last_name: true },
    });

    if (!employee) {
      console.error(`Сотрудник id=${EMPLOYEE_ID} не найден.`);
      return;
    }

    // Без --limit норму не трогаем: возможно, её намеренно нет и нужен отказ
    if (LIMIT !== null) await ensureAllowance(employee.id);

    const allowance = await prisma.canteen_allowances.findUnique({
      where: { employee_id: employee.id },
    });

    console.log(
      `Сотрудник: ${[employee.last_name, employee.first_name].filter(Boolean).join(" ") || employee.id}` +
        ` (id=${employee.id}), норма: ` +
        (allowance
          ? `${allowance.daily_limit}${allowance.status ? "" : " (выключена)"}`
          : "нет → все проходы будут отказами, задай --limit=<n>"),
    );

    candidates = [employee];
  } else {
    // ── Случайная выборка ────────────────────────────────────────────────────
    const pool = await prisma.employees.findMany({
      where: { status: true },
      select: { id: true, first_name: true, last_name: true },
      take: 300,
    });

    if (pool.length === 0) {
      console.error("В базе нет активных сотрудников — нечего кормить.");
      return;
    }

    const employees = shuffle(pool).slice(0, Math.min(EMPLOYEES, pool.length));

    let createdAllowances = 0;
    for (const employee of employees) {
      if (await ensureAllowance(employee.id)) createdAllowances++;
    }
    console.log(
      `Сотрудников в выборке: ${employees.length}, новых норм: ${createdAllowances}`,
    );

    // Часть сотрудников намеренно без нормы — чтобы на экране были и отказы
    const withoutAllowance = shuffle(pool)
      .filter((e) => !employees.some((x) => x.id === e.id))
      .slice(0, 3);

    candidates = [...employees, ...withoutAllowance];
  }

  // ── Проходы ────────────────────────────────────────────────────────────────
  // Кадра с терминала у демо-события нет — берём фото реальных проходов,
  // иначе на карточке экрана нечего показывать
  const photoPool = (
    await prisma.face_passes.findMany({
      where: { photo: { not: null } },
      select: { photo: true },
      orderBy: { date: "desc" },
      take: 50,
    })
  ).map((p) => p.photo);

  if (photoPool.length === 0) {
    console.warn("⚠  В face_passes нет фото — карточка покажет фото из базы.");
  }

  const stats = { served: 0, denied: 0, skipped: 0 };
  let counter = Date.now() % 100000;

  const push = async (date) => {
    const employee = candidates[randomInt(0, candidates.length - 1)];
    const result = await CanteenService.registerFromDeviceEvent({
      employeeId: employee.id,
      faceDeviceId: device?.id ?? null,
      date,
      identifier: `demo-${employee.id}-${counter++}`,
      photo: photoPool.length
        ? photoPool[randomInt(0, photoPool.length - 1)]
        : null,
    });

    if (result.duplicate || result.notFound) {
      stats.skipped++;
      return;
    }
    if (result.status === "served") stats.served++;
    else stats.denied++;

    const name =
      [employee.last_name, employee.first_name].filter(Boolean).join(" ") ||
      `#${employee.id}`;
    console.log(
      `  ${date.toLocaleTimeString("ru-RU")}  ${name} — ` +
        (result.status === "served"
          ? `выдано, остаток ${result.remaining_today}/${result.daily_limit}`
          : `отказ (${result.deny_reason})`),
    );
  };

  // История за сегодня: события раскиданы по последним трём часам
  if (MEALS > 0) console.log(`\nСоздаю ${MEALS} проходов за сегодня:`);
  const now = Date.now();
  const backfill = Array.from({ length: MEALS }, () =>
    randomInt(2, 180),
  ).sort((a, b) => b - a);

  for (const minutesAgo of backfill) {
    await push(new Date(now - minutesAgo * 60_000));
  }

  // Живой режим: экран обновляется раз в 1.5 с, так что каждое событие видно
  if (LIVE > 0) {
    console.log(
      `\nЖивой режим: ${LIVE} проходов с интервалом ${DELAY_MS} мс. Открой /canteen-display.`,
    );
    for (let i = 0; i < LIVE; i++) {
      await sleep(DELAY_MS);
      await push(new Date());
    }
  }

  console.log(
    `\nГотово. Выдано: ${stats.served}, отказов: ${stats.denied}, пропущено: ${stats.skipped}`,
  );
}

const prisma = getPrismaForTenant(SCHEMA);
console.log(`Тенант: ${SCHEMA}\n`);

prismaContext
  .run(prisma, () => tenantContext.run({ schema: SCHEMA }, () => run(prisma)))
  .catch((err) => {
    console.error("Ошибка:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectAll();
  });
