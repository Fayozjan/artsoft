import { PrismaClient } from "../prisma-clients/client/index.js";
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pg;

// Run with: node scripts/migrateToStockLocations.js [schema_name]
// e.g.: node scripts/migrateToStockLocations.js tenant_acme
const schemaName = process.argv[2];
if (!schemaName) {
  console.error("Usage: node scripts/migrateToStockLocations.js <schema_name>");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function getPrisma() {
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
  });
  await prisma.$executeRawUnsafe(`SET search_path TO "${schemaName}"`);
  return prisma;
}

async function migrate() {
  const prisma = await getPrisma();
  const client = await pool.connect();

  try {
    await client.query(`SET search_path TO "${schemaName}"`);

    console.log(`\nMigrating schema: ${schemaName}`);

    // 1. Create root virtual node
    console.log("Creating virtual root locations...");
    const virtualRoot = await prisma.stock_locations.create({
      data: { name: "Виртуальные локации", type: "view", complete_name: "Виртуальные локации", status: true },
    });

    // 2. Create virtual child locations
    const virtualChildren = [
      { name: "Поставщики", type: "supplier" },
      { name: "Клиенты", type: "customer" },
      { name: "Производство", type: "production" },
      { name: "Расходы / Офис", type: "expense" },
      { name: "Инвентаризация", type: "inventory" },
      { name: "Транзит", type: "transit" },
    ];

    const virtualLocs = {};
    for (const child of virtualChildren) {
      const loc = await prisma.stock_locations.create({
        data: {
          name: child.name,
          type: child.type,
          parent_id: virtualRoot.id,
          complete_name: `${virtualRoot.name} / ${child.name}`,
          status: true,
        },
      });
      virtualLocs[child.type] = loc;
      console.log(`  Created virtual location: ${child.name} (id=${loc.id})`);
    }

    // 3. Create physical root node
    const physRoot = await prisma.stock_locations.create({
      data: { name: "Физические склады", type: "view", complete_name: "Физические склады", status: true },
    });

    // 4. Migrate warehouses → zones → storage_locations
    const warehouses = await client.query("SELECT * FROM warehouses ORDER BY id");
    console.log(`\nMigrating ${warehouses.rows.length} warehouses...`);

    const warehouseLocMap = {};
    for (const wh of warehouses.rows) {
      const loc = await prisma.stock_locations.create({
        data: {
          name: wh.name,
          type: "internal",
          parent_id: physRoot.id,
          branch_id: wh.branch_id,
          complete_name: `${physRoot.name} / ${wh.name}`,
          note: wh.address,
          status: wh.status,
        },
      });
      warehouseLocMap[wh.id] = loc;
      console.log(`  Warehouse: "${wh.name}" → location id=${loc.id}`);

      // Migrate zones
      const zones = await client.query("SELECT * FROM warehouse_zones WHERE warehouse_id = $1 ORDER BY id", [wh.id]);
      for (const zone of zones.rows) {
        const zoneLoc = await prisma.stock_locations.create({
          data: {
            name: zone.name,
            type: "internal",
            parent_id: loc.id,
            complete_name: `${loc.complete_name} / ${zone.name}`,
            status: zone.status,
          },
        });

        // Migrate storage locations
        const bins = await client.query("SELECT * FROM storage_locations WHERE zone_id = $1 ORDER BY id", [zone.id]);
        for (const bin of bins.rows) {
          await prisma.stock_locations.create({
            data: {
              name: bin.name,
              type: "internal",
              parent_id: zoneLoc.id,
              code: bin.code,
              complete_name: `${zoneLoc.complete_name} / ${bin.name}`,
              status: bin.status,
            },
          });
        }
      }
    }

    // 5. Seed default picking types
    console.log("\nSeeding default picking types...");
    const supplierLoc = virtualLocs["supplier"];
    const customerLoc = virtualLocs["customer"];
    const productionLoc = virtualLocs["production"];
    const expenseLoc = virtualLocs["expense"];
    const inventoryLoc = virtualLocs["inventory"];

    // Find first internal location for defaults
    const firstInternal = await prisma.stock_locations.findFirst({
      where: { type: "internal", status: true },
    });

    const pickingTypes = [
      {
        name: "Приём товара",
        code: "incoming",
        sequence_prefix: "RECV",
        default_location_src_id: supplierLoc.id,
        default_location_dest_id: firstInternal?.id ?? null,
        use_create_lots: true,
      },
      {
        name: "Отгрузка",
        code: "outgoing",
        sequence_prefix: "DELI",
        default_location_src_id: firstInternal?.id ?? null,
        default_location_dest_id: customerLoc.id,
        use_existing_lots: true,
      },
      {
        name: "Внутреннее перемещение",
        code: "internal",
        sequence_prefix: "INT",
        default_location_src_id: firstInternal?.id ?? null,
        default_location_dest_id: firstInternal?.id ?? null,
      },
      {
        name: "Расход на офис",
        code: "outgoing",
        sequence_prefix: "EXP",
        default_location_src_id: firstInternal?.id ?? null,
        default_location_dest_id: expenseLoc.id,
        use_existing_lots: true,
      },
      {
        name: "Производство: расход материалов",
        code: "outgoing",
        sequence_prefix: "MFI",
        default_location_src_id: firstInternal?.id ?? null,
        default_location_dest_id: productionLoc.id,
        use_existing_lots: true,
      },
      {
        name: "Производство: выход продукции",
        code: "incoming",
        sequence_prefix: "MFO",
        default_location_src_id: productionLoc.id,
        default_location_dest_id: firstInternal?.id ?? null,
        use_create_lots: true,
      },
      {
        name: "Инвентаризация",
        code: "internal",
        sequence_prefix: "INV",
        default_location_src_id: inventoryLoc.id,
        default_location_dest_id: firstInternal?.id ?? null,
      },
    ];

    for (const pt of pickingTypes) {
      await prisma.stock_picking_types.create({ data: pt });
      console.log(`  Created picking type: ${pt.name}`);
    }

    console.log("\nMigration complete!");
    console.log("IMPORTANT: Old tables (warehouses, warehouse_zones, storage_locations) are still intact.");
    console.log("Verify the migration, then remove them from schema and run prisma migrate dev.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    client.release();
    await pool.end();
  }
}

migrate();
