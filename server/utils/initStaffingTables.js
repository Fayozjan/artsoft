import { prismaPublic, getPrismaForTenant } from "./prismaForTenant.js";

const SQL_CREATE_STAFFING_TABLE = `
CREATE TABLE IF NOT EXISTS staffing_table (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  date_from   DATE         NOT NULL,
  date_to     DATE,
  status      BOOLEAN      NOT NULL DEFAULT true,
  added_by    INT          NOT NULL REFERENCES users(id),
  added_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
`;

const SQL_CREATE_STAFFING_TABLE_ITEMS = `
CREATE TABLE IF NOT EXISTS staffing_table_items (
  id                 SERIAL PRIMARY KEY,
  staffing_table_id  INT     NOT NULL REFERENCES staffing_table(id) ON DELETE CASCADE,
  branch_id          INT     NOT NULL REFERENCES branches(id),
  department_id      INT     REFERENCES departments(id),
  position_id        INT     NOT NULL REFERENCES positions(id),
  headcount          INT     NOT NULL DEFAULT 1,
  salary_type        VARCHAR(20),
  salary_amount      NUMERIC(15, 2),
  UNIQUE (staffing_table_id, branch_id, department_id, position_id)
);
`;

const SQL_CREATE_INDEX = `
CREATE INDEX IF NOT EXISTS idx_staffing_table_items_table_id
  ON staffing_table_items (staffing_table_id);
`;

async function upsertStaffingMenu(prisma) {
  const finance = await prisma.menus.findUnique({ where: { name: "finance" } });
  const parentId = finance?.id ?? null;

  const existing = await prisma.menus.findUnique({ where: { name: "staffing" } });
  if (!existing) {
    const created = await prisma.menus.create({
      data: {
        name: "staffing",
        path: "/staffing",
        parent_id: parentId,
        sort_order: 10,
      },
    });

    // Grant access to all users who have access to finance
    const adminUsers = await prisma.users.findMany({
      where: { access_level: "absolute" },
    });
    if (adminUsers.length > 0) {
      await prisma.user_menu_access.createMany({
        data: adminUsers.map((u) => ({
          user_id: u.id,
          menu_id: created.id,
          can_view: true,
          can_add: true,
          can_update: true,
          can_delete: true,
        })),
        skipDuplicates: true,
      });
    }
  }
}

export async function initStaffingTables() {
  try {
    const tenants = await prismaPublic.tenants.findMany();

    for (const tenant of tenants) {
      const prisma = getPrismaForTenant(tenant.schema);
      await prisma.$executeRawUnsafe(SQL_CREATE_STAFFING_TABLE);
      await prisma.$executeRawUnsafe(SQL_CREATE_STAFFING_TABLE_ITEMS);
      await prisma.$executeRawUnsafe(SQL_CREATE_INDEX);
      await upsertStaffingMenu(prisma);
      console.log(`✅ staffing ready for schema: ${tenant.schema}`);
    }
  } catch (err) {
    console.error("❌ initStaffingTables error:", err.message);
  }
}
