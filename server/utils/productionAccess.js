import { prismaContext } from "./prismaContext.js";
import { isCronActor } from "./cronActor.js";

// Права логина в меню «Производство», которые администратор задаёт в карточке
// пользователя: operationTypeIds — допустимые типы операций (пусто — все),
// canEditSticker — право менять шаблоны стикера, ownOnly — в истории приёма только
// то, что принял сам логин.
export const getProductionAccess = async (userId) => {
  if (isCronActor(userId)) return { operationTypeIds: [], canEditSticker: true, ownOnly: false };

  const user = await prismaContext.get().users.findUnique({
    where: { id: Number(userId) },
    select: { production_operation_ids: true, can_edit_sticker: true, production_own_only: true },
  });

  return {
    operationTypeIds: user?.production_operation_ids ?? [],
    canEditSticker: user?.can_edit_sticker ?? true,
    ownOnly: user?.production_own_only ?? false,
  };
};

const forbidden = (message, code) => {
  const err = new Error(message);
  err.code = code;
  return err;
};

// operationTypeIds — один id или массив: все должны входить в список разрешённых.
export const assertOperationAllowed = async (userId, operationTypeIds) => {
  const { operationTypeIds: allowed } = await getProductionAccess(userId);
  if (allowed.length === 0) return;

  const ids = [].concat(operationTypeIds).map(Number);
  if (ids.some((id) => !allowed.includes(id))) {
    throw forbidden("Эта операция вам недоступна", "OPERATION_FORBIDDEN");
  }
};

// Достаточно права на любую из операций (пустые id пропускаются): например,
// дочерний стикер, созданный раздачей, удаляет и тот, у кого есть операция его
// родителя, хотя следующая операция ему может быть недоступна.
export const assertAnyOperationAllowed = async (userId, operationTypeIds) => {
  const { operationTypeIds: allowed } = await getProductionAccess(userId);
  if (allowed.length === 0) return;

  const ids = [].concat(operationTypeIds).filter(Boolean).map(Number);
  if (!ids.some((id) => allowed.includes(id))) {
    throw forbidden("Эта операция вам недоступна", "OPERATION_FORBIDDEN");
  }
};

// Правка цены принятых стикеров в отчёте по производству — по праву «изменение» на пункте
// меню отчёта (то же, по которому клиент показывает кнопки правки).
export const assertCanEditProductionReport = async (userId) => {
  if (isCronActor(userId)) return;

  const access = await prismaContext.get().user_menu_access.findFirst({
    where: { user_id: Number(userId), can_update: true, menu: { path: "/production-report" } },
    select: { id: true },
  });
  if (!access) {
    throw forbidden("У вас нет права изменять цену в отчёте по производству", "REPORT_EDIT_FORBIDDEN");
  }
};

export const assertCanEditSticker = async (userId) => {
  const { canEditSticker } = await getProductionAccess(userId);
  if (!canEditSticker) {
    throw forbidden("У вас нет права редактировать стикер", "STICKER_EDIT_FORBIDDEN");
  }
};
