import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env"),
});

import { getPrismaForTenant, disconnectAll } from "../utils/prismaForTenant.js";
import { prismaContext } from "../utils/prismaContext.js";
import { tenantContext } from "../utils/tenantContext.js";

// Тестовые товары для склада.
//
//   npm run seed:test-products
//   npm run seed:test-products -- --count=500
//   npm run seed:test-products -- --clear             (удалить товары с префиксом TEST-)

const FLAGS = ["tenant", "count", "clear"];

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
const COUNT = Number(args.count || 1000);
const CLEAR = args.clear !== undefined && args.clear !== "false" && args.clear !== "0";
const PREFIX = "TEST-";

if (!SCHEMA) {
  console.error("Не задан тенант: --tenant=<schema> или DEFAULT_TENANT в .env");
  process.exit(1);
}

async function run(prisma) {
  if (CLEAR) {
    const removed = await prisma.products.deleteMany({
      where: { sku: { startsWith: PREFIX } },
    });
    console.log(`Удалено тестовых товаров: ${removed.count}`);
    return;
  }

  let category = await prisma.product_categories.findFirst({
    where: { name: "Тестовая категория" },
  });
  if (!category) {
    category = await prisma.product_categories.create({
      data: { name: "Тестовая категория", status: true },
    });
    console.log(`Создана категория: ${category.name} (id=${category.id})`);
  }

  let unit = await prisma.units.findFirst({ where: { name: "Штука" } });
  if (!unit) {
    unit = await prisma.units.create({
      data: { name: "Штука", short_name: "шт", status: true },
    });
    console.log(`Создана единица измерения: ${unit.name} (id=${unit.id})`);
  }

  const existing = await prisma.products.count({
    where: { sku: { startsWith: PREFIX } },
  });
  const startIndex = existing + 1;

  const data = Array.from({ length: COUNT }, (_, i) => {
    const n = startIndex + i;
    return {
      category_id: category.id,
      unit_id: unit.id,
      name: `Тестовый товар ${n}`,
      sku: `${PREFIX}${String(n).padStart(6, "0")}`,
      barcode: `2${String(Date.now()).slice(-6)}${String(n).padStart(6, "0")}`.slice(0, 13),
      min_stock: Math.floor(Math.random() * 50),
      status: true,
    };
  });

  const result = await prisma.products.createMany({ data, skipDuplicates: true });
  console.log(`Создано товаров: ${result.count} (запрошено ${COUNT})`);
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
