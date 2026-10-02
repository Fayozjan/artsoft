import { Composer, Keyboard } from "grammy";
import { prismaPublic, getPrismaForTenant } from "../../../../utils/prismaForTenant.js";
import { prismaContext } from "../../../../utils/prismaContext.js";
import { TaskModel } from "../../../../modules/tasks/tasks.model.js";

const composer = new Composer();

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 9) return digits;
  if (digits.length === 12 && digits.startsWith("998")) return digits.slice(3);
  return digits;
}

function phoneCandidates(normalized) {
  return [
    normalized,
    `+${normalized}`,
    `998${normalized}`,
    `+998${normalized}`,
  ];
}

async function findEmployeeByPhone(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const candidates = phoneCandidates(normalized);

  const tenants = await prismaPublic.tenants.findMany({ select: { schema: true } });
  for (const tenant of tenants) {
    const prisma = getPrismaForTenant(tenant.schema);
    const employee = await prismaContext.run(prisma, () =>
      prisma.employees.findFirst({
        where: { phone: { in: candidates } },
        select: { id: true, first_name: true, last_name: true },
      })
    );
    if (employee) return { employee, schema: tenant.schema };
  }
  return null;
}

const requestContactKeyboard = new Keyboard()
  .requestContact("📱 Поделиться номером телефона")
  .resized()
  .oneTime();

composer.command("start", async (ctx) => {
  try {
    console.log("[employeeTaskHandler] /start from", ctx.chat.id);
    const chatId = String(ctx.chat.id);
    const existing = await prismaPublic.employee_telegram_chats.findUnique({
      where: { chat_id: chatId },
    });
    if (existing) {
      return ctx.reply("✅ Вы уже зарегистрированы. Уведомления о задачах будут приходить сюда.");
    }
    await ctx.reply(
      "👋 Для получения уведомлений о задачах поделитесь своим номером телефона:",
      { reply_markup: requestContactKeyboard }
    );
  } catch (err) {
    console.error("[employeeTaskHandler] /start error:", err.message, err.stack);
    await ctx.reply("❌ Ошибка при запуске. Попробуйте позже.").catch(() => {});
  }
});

composer.on("message:contact", async (ctx) => {
  const phone = ctx.message.contact?.phone_number;
  const chatId = String(ctx.chat.id);

  const result = await findEmployeeByPhone(phone);
  if (!result) {
    return ctx.reply(
      "❌ Сотрудник с номером " + phone + " не найден. Обратитесь к администратору.",
      { reply_markup: { remove_keyboard: true } }
    );
  }

  const { employee, schema } = result;
  await prismaPublic.employee_telegram_chats.upsert({
    where: { chat_id: chatId },
    create: { chat_id: chatId, schema_name: schema, employee_id: employee.id },
    update: { schema_name: schema, employee_id: employee.id },
  });

  const name = [employee.last_name, employee.first_name].filter(Boolean).join(" ");
  await ctx.reply(
    `✅ Вы успешно зарегистрированы как ${name}!\nТеперь вы будете получать уведомления о задачах.`,
    { reply_markup: { remove_keyboard: true } }
  );
});

const CALLBACK_ACTIONS = {
  accept:     { requiredStatus: "assigned",    nextStatus: "in_progress", label: "В работе" },
  unaccept:   { requiredStatus: "in_progress", nextStatus: "assigned",    label: "Назначена" },
  complete:   { requiredStatus: "in_progress", nextStatus: "done",        label: "Выполнена", completedAt: true },
  uncomplete: { requiredStatus: "done",        nextStatus: "in_progress", label: "В работе",  clearCompletedAt: true },
};

composer.callbackQuery(/^t_(accept|unaccept|complete|uncomplete)_(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();

  const action = ctx.match[1];
  const taskId = parseInt(ctx.match[2]);
  const chatId = String(ctx.callbackQuery.from.id);

  const registration = await prismaPublic.employee_telegram_chats.findUnique({
    where: { chat_id: chatId },
  });
  if (!registration) {
    return ctx.reply("❌ Вы не зарегистрированы. Отправьте /start.");
  }

  const prisma = getPrismaForTenant(registration.schema_name);

  await prismaContext.run(prisma, async () => {
    const task = await TaskModel.findById(taskId);
    if (!task) return ctx.reply("❌ Задача не найдена.");

    const cfg = CALLBACK_ACTIONS[action];
    if (!cfg || task.status !== cfg.requiredStatus) {
      return ctx.reply(`❌ Действие недоступно. Текущий статус задачи: ${task.status}`);
    }

    const updateData = { status: cfg.nextStatus };
    if (cfg.completedAt) updateData.completed_at = new Date();
    if (cfg.clearCompletedAt) updateData.completed_at = null;

    const updated = await TaskModel.update(taskId, updateData);

    const keyboard = buildTaskKeyboard(updated);
    const statusLine = `\n\n✅ <b>Статус обновлён:</b> ${cfg.label}`;

    try {
      await ctx.editMessageText(
        (ctx.callbackQuery.message.text || "") + statusLine,
        { parse_mode: "HTML", reply_markup: keyboard }
      );
    } catch (_) {
      await ctx.reply(`✅ Статус задачи обновлён: ${cfg.label}`);
    }
  });
});

export function buildTaskKeyboard(task) {
  const buttons = [];

  if (task.status === "assigned") {
    buttons.push({ text: "✅ Принять", callback_data: `t_accept_${task.id}` });
  }
  if (task.status === "in_progress") {
    buttons.push({ text: "↩️ Отменить принятие", callback_data: `t_unaccept_${task.id}` });
    buttons.push({ text: "✅ Завершить", callback_data: `t_complete_${task.id}` });
  }
  if (task.status === "done") {
    buttons.push({ text: "↩️ Отменить завершение", callback_data: `t_uncomplete_${task.id}` });
  }

  return buttons.length
    ? { inline_keyboard: [buttons] }
    : { inline_keyboard: [] };
}

export { composer as employeeTaskHandler };
