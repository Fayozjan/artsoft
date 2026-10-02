import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { FacePassesService } from "../api";
import { formatIsoToDateTimeLocal } from "../utils/date";
import { useAlertStore } from "../stores/alertStore";

import Button from "./Button";

import styles from "./AddTimeOff.module.scss";

const EditFacePassTime = ({ item, handleClose, onSuccess }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const [date, setDate] = useState("");

  useEffect(() => {
    setDate(formatIsoToDateTimeLocal(item?.date));
  }, [item]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date) {
      showAlert(t("selectDate"), "error");
      return;
    }

    try {
      await FacePassesService.updateFacePass(item.id, {
        date: new Date(date + ":00+05:00").toISOString(),
      });

      showAlert(t("success"), "success");
      onSuccess();
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (error) {
      showAlert(t("error"), "error");
    }
  };

  return (
    <form className={styles.addTimeOff} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("editFacePassTime")}</h2>
        <Button text={t("save")} type={"submit"} />
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("facePassEventTime")}</label>
          <input
            type="datetime-local"
            name="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            onFocus={(e) => e.target.showPicker?.()}
          />
        </div>
      </div>
    </form>
  );
};

export default EditFacePassTime;
