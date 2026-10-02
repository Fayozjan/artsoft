import { prismaContext } from "../../utils/prismaContext.js";

const taskInclude = {
  assignee_employee: {
    select: {
      id: true,
      first_name: true,
      last_name: true,
      middle_name: true,
      photo: true,
      branch: { select: { name: true } },
      department: { select: { name: true } },
      position: { select: { name: true } },
    },
  },
  assignee_department: { select: { id: true, name: true } },
  assignee_position: { select: { id: true, name: true } },
  assignee_user: { select: { id: true, username: true } },
  created_by: {
    select: {
      id: true,
      username: true,
      employee_id: true,
      employee: {
        select: {
          first_name: true,
          last_name: true,
          middle_name: true,
          photo: true,
          branch: { select: { name: true } },
          department: { select: { name: true } },
          position: { select: { name: true } },
        },
      },
    },
  },
  confirmed_by: { select: { id: true, username: true, employee_id: true, employee: { select: { first_name: true, last_name: true } } } },
};

export const TaskModel = {
  findMany: async ({ where, skip, take }) => {
    const prisma = prismaContext.get();
    return prisma.tasks.findMany({
      where,
      skip,
      take,
      orderBy: { created_at: "desc" },
      include: taskInclude,
    });
  },

  count: async (where) => {
    const prisma = prismaContext.get();
    return prisma.tasks.count({ where });
  },

  findById: async (id) => {
    const prisma = prismaContext.get();
    return prisma.tasks.findUnique({
      where: { id: Number(id) },
      include: {
        ...taskInclude,
        comments: {
          include: { user: { select: { id: true, username: true } } },
          orderBy: { created_at: "asc" },
        },
        files: {
          include: { uploaded_by: { select: { id: true, username: true } } },
          orderBy: { created_at: "asc" },
        },
      },
    });
  },

  create: async (data) => {
    const prisma = prismaContext.get();
    return prisma.tasks.create({ data, include: taskInclude });
  },

  update: async (id, data) => {
    const prisma = prismaContext.get();
    return prisma.tasks.update({ where: { id: Number(id) }, data, include: taskInclude });
  },

  remove: async (id) => {
    const prisma = prismaContext.get();
    return prisma.tasks.delete({ where: { id: Number(id) } });
  },

  addComment: async (taskId, userId, text) => {
    const prisma = prismaContext.get();
    return prisma.task_comments.create({
      data: { task_id: Number(taskId), user_id: Number(userId), text },
      include: { user: { select: { id: true, username: true } } },
    });
  },

  removeComment: async (commentId) => {
    const prisma = prismaContext.get();
    return prisma.task_comments.delete({ where: { id: Number(commentId) } });
  },

  findCommentById: async (commentId) => {
    const prisma = prismaContext.get();
    return prisma.task_comments.findUnique({ where: { id: Number(commentId) } });
  },

  addFile: async (taskId, fileData) => {
    const prisma = prismaContext.get();
    return prisma.task_files.create({
      data: { task_id: Number(taskId), ...fileData },
      include: { uploaded_by: { select: { id: true, username: true } } },
    });
  },

  removeFile: async (fileId) => {
    const prisma = prismaContext.get();
    return prisma.task_files.delete({ where: { id: Number(fileId) } });
  },

  findFileById: async (fileId) => {
    const prisma = prismaContext.get();
    return prisma.task_files.findUnique({ where: { id: Number(fileId) } });
  },
};
