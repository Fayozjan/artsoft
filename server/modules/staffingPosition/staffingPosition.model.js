import { prismaContext } from "../../utils/prismaContext.js";

export const StaffingPositionModel = {
  findByDepartment: async (departmentId) => {
    const prisma = prismaContext.get();
    const deptId = Number(departmentId);
    return prisma.$queryRaw`
      SELECT
        sp.id,
        sp.department_id,
        sp.position_id,
        sp.headcount::int AS headcount,
        p.name AS position_name,
        COUNT(e.id)::int AS actual,
        GREATEST(0, sp.headcount - COUNT(e.id))::int AS vacancies,
        GREATEST(0, COUNT(e.id) - sp.headcount)::int AS non_staffed,
        false AS is_extra
      FROM staffing_position sp
      JOIN positions p ON p.id = sp.position_id
      LEFT JOIN employees e
        ON e.department_id = sp.department_id
        AND e.position_id = sp.position_id
        AND e.status = true
      WHERE sp.department_id = ${deptId}
      GROUP BY sp.id, sp.department_id, sp.position_id, sp.headcount, p.name

      UNION ALL

      SELECT
        0::int AS id,
        ${deptId}::int AS department_id,
        e.position_id,
        0::int AS headcount,
        p.name AS position_name,
        COUNT(e.id)::int AS actual,
        0::int AS vacancies,
        COUNT(e.id)::int AS non_staffed,
        true AS is_extra
      FROM employees e
      JOIN positions p ON p.id = e.position_id
      WHERE e.department_id = ${deptId}
        AND e.status = true
        AND e.position_id NOT IN (
          SELECT position_id FROM staffing_position WHERE department_id = ${deptId}
        )
      GROUP BY e.position_id, p.name

      ORDER BY position_name
    `;
  },

  bulkUpsert: async (departmentId, positions) => {
    const prisma = prismaContext.get();
    const deptId = Number(departmentId);

    const positionIds = positions.map((p) => Number(p.position_id));

    if (positionIds.length > 0) {
      await prisma.$executeRaw`
        DELETE FROM staffing_position
        WHERE department_id = ${deptId}
          AND position_id != ALL(${positionIds}::int[])
      `;
    } else {
      await prisma.$executeRaw`
        DELETE FROM staffing_position WHERE department_id = ${deptId}
      `;
      return [];
    }

    for (const p of positions) {
      await prisma.$executeRaw`
        INSERT INTO staffing_position (department_id, position_id, headcount)
        VALUES (${deptId}, ${Number(p.position_id)}, ${Number(p.headcount)})
        ON CONFLICT (department_id, position_id)
        DO UPDATE SET headcount = EXCLUDED.headcount
      `;
    }

    return StaffingPositionModel.findByDepartment(departmentId);
  },
};
