import { useTranslation } from "react-i18next";

import { fmtQty } from "../utils/quantity";
import distStyles from "./WorkDistributionPanel.module.scss";

// Чип "Макс N" рядом с подписью поля — как в распределении работы по партии.
// Клик подставляет максимум в поле (onPick); при нуле чип красный и неактивен.
// Стили чипа заданы внутри `.printForm` панели распределения, поэтому используется
// только внутри формы с этим классом.
const MaxHint = ({ value, onPick }) => {
  const { t } = useTranslation();
  const max = Math.max(value, 0);

  return (
    <button
      type="button"
      className={`${distStyles.maxChip} ${max <= 0 ? distStyles.maxChipEmpty : ""}`}
      title={t("workStickerMaxCount")}
      disabled={max <= 0}
      onClick={onPick}
    >
      {t("workStickerMaxCount")} {fmtQty(max)}
    </button>
  );
};

export default MaxHint;
