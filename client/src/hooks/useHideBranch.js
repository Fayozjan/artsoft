import { useAuthStore } from "../stores/authStore";

/**
 * true, если логин работает в режиме одного филиала и филиал выбран.
 * В этом случае филиал в подписи "ФИО → Филиал / Отдел" не показываем —
 * мы и так находимся внутри одного филиала.
 */
export const useHideBranch = () => {
  const { viewMode, activeBranchId } = useAuthStore((s) => s.userSettings) || {};
  return viewMode === "branch" && !!activeBranchId;
};

export default useHideBranch;
