import prisma from "../../prisma/client.js";

export const BranchModel = {
  create: async (data) => {
    return prisma.branches.create({
      data: {
        name: data.name,
        director: data.director_id
          ? { connect: { id: Number(data.director_id) } }
          : null,
        region: data.region || null,
        address: data.address || null,
        bank_name: data.bank_name || null,
        bank_account: data.bank_account || null,
        inn: data.inn || null,
        mfo: data.mfo || null,
        status: data.status ?? true,
        addedBy: {
          connect: { id: Number(data.added_by) },
        },
      },
    });
  },

  findMany({ where, skip, take }) {
    return prisma.branches.findMany({
      where,
      include: {
        director: true,
        departments: {
          include: {
            _count: { select: { employees: true } },
          },
        },
        addedBy: {
          select: {
            id: true,
            employee: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                middle_name: true,
              },
            },
          },
        },
      },
      skip,
      take,
      orderBy: { name: "asc" },
    });
  },

  findByName(name) {
    return prisma.branches.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
      },
    });
  },

  findById: async (id) => {
    return prisma.branches.findUnique({
      where: { id },
      include: { director: true },
    });
  },

  findActive(where) {
    return prisma.branches.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        departments: {
          where: { status: true },
          select: { id: true, name: true },
        },
        _count: {
          select: {
            employees: {
              where: { status: true },
            },
          },
        },
      },
    });
  },

  count(where) {
    return prisma.branches.count({ where });
  },

  update: async (id, data) => {
    return prisma.branches.update({
      where: { id },
      data: {
        name: data.name,
        director: data.director_id
          ? { connect: { id: Number(data.director_id) } }
          : null,
        region: data.region || null,
        address: data.address || null,
        bank_name: data.bank_name || null,
        bank_account: data.bank_account || null,
        inn: data.inn || null,
        mfo: data.mfo || null,
        status: data.status,
      },
    });
  },

  delete: async (id) => {
    return prisma.branches.delete({ where: { id } });
  },
};
