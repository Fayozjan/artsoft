import dotenv from "dotenv";
dotenv.config();
import pool from "./db.js";
import { getPrismaForTenant } from "./utils/prismaForTenant.js";

const prisma = getPrismaForTenant("artsoft");
const user = await prisma.users.findFirst({ where: { username: "akt" } });
const allMenus = await prisma.menus.findMany({ select: { id: true, name: true } });
const access = await prisma.user_menu_access.findMany({ where: { user_id: user.id, can_view: true }, select: { menu_id: true } });
const seen = new Set(access.map(a => a.menu_id));
const missing = allMenus.filter(m => !seen.has(m.id));
console.log("missing for akt:", missing);
await prisma.$disconnect();
await pool.end();
