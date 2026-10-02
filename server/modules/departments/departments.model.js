import { prismaContext } from "../../utils/prismaContext.js";

export const DepartmentsModel = {
  findMany: async ({ where, skip, take, include }) => {
    const prisma = prismaContext.get();
    return prisma.departments.findMany({
      where,
      skip,
      take,
      include,
      orderBy: { name: "asc" },
    });
  },

  count: async (where) => {
    const prisma = prismaContext.get();
    return prisma.departments.count({ where });
  },

  findUnique: async (id) => {
    const prisma = prismaContext.get();
    return prisma.departments.findUnique({
      where: { id: Number(id) },
      select: { name: true, branch_id: true, status: true },
    });
  },

  create: async (data) => {
    const prisma = prismaContext.get();
    return prisma.departments.create({ data });
  },

  update: async (id, data) => {
    const prisma = prismaContext.get();
    return prisma.departments.update({
      where: { id: Number(id) },
      data,
    });
  },

  delete: async (id) => {
    const prisma = prismaContext.get();
    const count = await prisma.employees.count({
      where: { department_id: Number(id) },
    });
    if (count > 0) throw new Error("Невозможно удалить отдел с сотрудниками");
    return prisma.departments.delete({ where: { id: Number(id) } });
  },

  getStaffingOverview: async (where) => {
    const prisma = prismaContext.get();

    const departments = await prisma.departments.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        _count: { select: { employees: { where: { status: true } } } },
      },
      orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
    });

    if (departments.length === 0) return [];

    const deptIds = departments.map((d) => d.id);

    const [headcounts, breakdown] = await Promise.all([
      prisma.$queryRaw`
        SELECT department_id, COALESCE(SUM(headcount), 0)::int AS planned
        FROM staffing_position
        WHERE department_id = ANY(${deptIds}::int[])
        GROUP BY department_id
      `,
      prisma.$queryRaw`
        SELECT
          department_id,
          SUM(GREATEST(0, headcount - actual))::int AS vacancies,
          SUM(GREATEST(0, actual - headcount))::int AS non_staffed
        FROM (
          SELECT sp.department_id, sp.headcount::int, COUNT(e.id)::int AS actual
          FROM staffing_position sp
          LEFT JOIN employees e
            ON e.department_id = sp.department_id
            AND e.position_id = sp.position_id
            AND e.status = true
          WHERE sp.department_id = ANY(${deptIds}::int[])
          GROUP BY sp.department_id, sp.position_id, sp.headcount

          UNION ALL

          SELECT e.department_id, 0::int AS headcount, COUNT(e.id)::int AS actual
          FROM employees e
          WHERE e.department_id = ANY(${deptIds}::int[])
            AND e.status = true
            AND NOT EXISTS (
              SELECT 1 FROM staffing_position sp
              WHERE sp.department_id = e.department_id
                AND sp.position_id = e.position_id
            )
          GROUP BY e.department_id, e.position_id
        ) sub
        GROUP BY department_id
      `,
    ]);

    const hcMap = {};
    for (const r of headcounts) {
      hcMap[Number(r.department_id)] = Number(r.planned);
    }

    const bdMap = {};
    for (const r of breakdown) {
      bdMap[Number(r.department_id)] = {
        vacancies: Number(r.vacancies),
        non_staffed: Number(r.non_staffed),
      };
    }

    return departments.map((d) => {
      const planned = hcMap[d.id] || 0;
      const actual = d._count.employees;
      const bd = bdMap[d.id] || { vacancies: 0, non_staffed: 0 };
      return {
        id: d.id,
        name: d.name,
        status: d.status,
        branch_id: d.branch_id,
        branch_name: d.branch?.name || null,
        planned,
        actual,
        vacancies: bd.vacancies,
        non_staffed: bd.non_staffed,
      };
    });
  },
};
