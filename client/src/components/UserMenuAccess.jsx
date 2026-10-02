import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";

import PermissionsManager from "./PermissionsManager";
import UserSidePanel from "./UserSidePanel";
import { menuMapToList } from "../utils/menuPermissions";

// «Доступные меню»: таблица прав логина открывается сайдбаром слева от формы.
// menu — текущие права формы {menuId: {view, add, update, delete}}: сайдбар при
// закрытии размонтируется, и таблица должна собраться заново уже с правками.
const UserMenuAccess = ({ panel, allMenus, userMenus, menu, onChange }) => {
  const { t } = useTranslation();

  const currentMenus = useMemo(
    () => (menu ? menuMapToList(menu) : userMenus),
    [menu, userMenus],
  );

  const total = allMenus?.length || 0;
  const allowed = menu
    ? (allMenus || []).filter((item) => menu[item.id]?.view).length
    : 0;

  return (
    <UserSidePanel
      panel={panel}
      icon={ShieldCheck}
      title={t("menuAccessButton")}
      hint={
        total > 0 && menu
          ? t("menuAccessSummary", { allowed, total })
          : t("menuAccessHint")
      }
    >
      <PermissionsManager
        allMenus={allMenus}
        userMenus={currentMenus}
        onChange={onChange}
      />
    </UserSidePanel>
  );
};

export default UserMenuAccess;
