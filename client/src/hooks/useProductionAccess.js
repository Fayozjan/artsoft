import { useMemo } from "react";
import { useAuthStore } from "../stores/authStore";

// Права логина в меню «Производство» (задаёт администратор в карточке пользователя):
// список доступных типов операций (пусто — доступны все) и право править стикер.
// Сервер проверяет то же самое; здесь — только чтобы не показывать недоступное.
export const useProductionAccess = () => {
  const production = useAuthStore((state) => state.access?.production);

  return useMemo(() => {
    const allowed = production?.operation_type_ids ?? [];
    const restricted = allowed.length > 0;

    return {
      restricted,
      canEditSticker: production?.can_edit_sticker ?? true,
      canUseOperation: (operationTypeId) =>
        !restricted || allowed.includes(Number(operationTypeId)),
      filterOperationTypes: (types) =>
        restricted ? types.filter((type) => allowed.includes(type.id)) : types,
    };
  }, [production]);
};
