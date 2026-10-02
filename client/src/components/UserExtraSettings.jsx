import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Settings2 } from "lucide-react";

import UserInterfaceSettings from "./UserInterfaceSettings";
import UserProductionSettings from "./UserProductionSettings";
import UserSidePanel from "./UserSidePanel";
import {
  startPageOptionsFromFlat,
  hasSectionAccess,
} from "../utils/startPageOptions";

// «Дополнительные настройки» логина (интерфейс, производство): кнопка в форме и
// сайдбар слева от неё. panel — см. UserSidePanel.
const UserExtraSettings = ({ panel, formData, setFormData, allMenus }) => {
  const { t } = useTranslation();

  // Варианты «меню при входе» — только пункты, к которым у логина есть доступ
  const startPageOptions = useMemo(
    () => startPageOptionsFromFlat(allMenus, formData.menu, t),
    [allMenus, formData.menu, t],
  );
  const productionMenuEnabled = hasSectionAccess(
    allMenus,
    formData.menu,
    "production",
  );

  const cards = (
    <>
      <UserInterfaceSettings
        value={formData.settings}
        onChange={(settings) => setFormData((prev) => ({ ...prev, settings }))}
        startPageOptions={startPageOptions}
        ready={Boolean(allMenus?.length)}
      />

      <UserProductionSettings
        value={{
          operationIds: formData.production_operation_ids,
          canEditSticker: formData.can_edit_sticker,
          ownOnly: formData.production_own_only,
        }}
        onChange={({ operationIds, canEditSticker, ownOnly }) =>
          setFormData((prev) => ({
            ...prev,
            production_operation_ids: operationIds,
            can_edit_sticker: canEditSticker,
            production_own_only: ownOnly,
          }))
        }
        menuEnabled={productionMenuEnabled}
      />
    </>
  );

  return (
    <UserSidePanel
      panel={panel}
      icon={Settings2}
      title={t("extraSettings")}
      hint={t("extraSettingsHint")}
    >
      {cards}
    </UserSidePanel>
  );
};

export default UserExtraSettings;
