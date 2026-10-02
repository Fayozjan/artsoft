import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { addEmployeeTeam, editEmployeeTeamById, getEmployeeTeams, editOperationTypeById } from "../api";

import EmployeePicker from "./EmployeePicker";
import SegmentedGroup from "./SegmentedGroup";
import TgSheet from "./tg/TgSheet";
import { Icons } from "../icons/icons";
import { sameIdSet } from "../utils/ids";
import styles from "./TeamManageModal.module.scss";

const EMPTY_FORM = { name: "", employee_ids: [] };
const ACCENT = "var(--third-color, #1455fe)";

// Универсальная модалка настройки типа операции прямо с формы приёма работы. Две вкладки:
//  — «Сотрудники» (первая, открывается по умолчанию): кто допущен к операции
//    (operation_types.employees; пусто — допущены все);
//  — «Команды»: список команд (правка по значку, «Добавить команду») и форма (название + состав).
// withTeams=false — вкладки команд нет (режим «Сотрудник»), только допущенные сотрудники.
// Десктоп — модалка по центру, телефон (sheet) — нижняя шторка. Удаление команд здесь не делаем —
// только у типа операции.
// employees — все активные сотрудники (EmployeeService.getActive()); operationEmployeeIds — кто сейчас
// допущен к операции (числа, [] = все). Участником команды может быть только допущенный — по выбору на
// вкладке «Сотрудники», даже несохранённому: сервер сверяет состав с сохранёнными допущенными, поэтому
// при сохранении команды несохранённый выбор сначала сохраняется.
// onSaved(teams, savedId, allowedIds) — сохранили команду: свежий список команд типа, id созданной/изменённой
// и допущенные сотрудники на этот момент (родитель ещё не успел обновить свои).
// onEmployeesSaved(ids) — сохранили допущенных сотрудников.
const TeamManageModal = ({
  isOpen,
  onClose,
  operationTypeId,
  withTeams = true,
  teams = [],
  employees = [],
  operationEmployeeIds = [],
  onSaved,
  onEmployeesSaved,
  sheet = false,
}) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();

  const [tab, setTab] = useState("employees"); // "employees" | "teams"
  const [view, setView] = useState("list"); // вкладка команд: "list" | "form"
  const [editingTeam, setEditingTeam] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [allowedDraft, setAllowedDraft] = useState([]);
  const [saving, setSaving] = useState(false);

  // Вкладки команд нет — всегда «Сотрудники».
  const activeTab = withTeams ? tab : "employees";

  // В состав команды — допущенные по текущему выбору на вкладке «Сотрудники» (пусто — все).
  const draftSet = new Set(allowedDraft.map(Number));
  const memberOptions = draftSet.size > 0 ? employees.filter((emp) => draftSet.has(Number(emp.id))) : employees;

  const openCreate = () => {
    setEditingTeam(null);
    setForm(EMPTY_FORM);
    setView("form");
  };

  const openEdit = (team) => {
    setEditingTeam(team);
    setForm({ name: team.name, employee_ids: (team.members || []).map((m) => Number(m.employee_id)) });
    setView("form");
  };

  // Открыли: список команд (даже пустой — вкладки остаются доступны), допущенные — как сейчас у типа.
  useEffect(() => {
    if (!isOpen) return;
    setTab("employees");
    setView("list");
    setAllowedDraft(operationEmployeeIds.map(Number));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || sheet) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, sheet, onClose]);

  const canSave = form.name.trim() !== "" && form.employee_ids.length > 0;

  // Только employee_ids: остальные поля типа сервер оставляет как есть (см. OperationTypesService.update).
  // Выбор изменился и не сохранён — сохраняем; иначе сервер отклонит участника («не допущен к этому типу»).
  const syncAllowed = async () => {
    if (sameIdSet(operationEmployeeIds, allowedDraft)) return;
    const res = await editOperationTypeById(operationTypeId, { employee_ids: allowedDraft });
    if (!res?.success) throw new Error(t("error"));
    onEmployeesSaved?.(allowedDraft);
  };

  const handleSave = async () => {
    if (saving || !canSave) return;

    setSaving(true);
    try {
      await syncAllowed();
      const payload = { name: form.name.trim(), employee_ids: form.employee_ids, operation_type_id: operationTypeId };
      const res = editingTeam
        ? await editEmployeeTeamById(editingTeam.id, payload)
        : await addEmployeeTeam(payload);
      if (!res?.success) throw new Error(t("error"));

      const list = (await getEmployeeTeams(operationTypeId)).data || [];
      showAlert(t("success"), "success");
      onSaved?.(list, res.data?.id ?? editingTeam?.id, allowedDraft);
      onClose();
    } catch (err) {
      showAlert(err?.response?.data?.error || err.message || t("error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEmployees = async () => {
    if (saving) return;

    setSaving(true);
    try {
      const res = await editOperationTypeById(operationTypeId, { employee_ids: allowedDraft });
      if (!res?.success) throw new Error(t("error"));

      showAlert(t("success"), "success");
      onEmployeesSaved?.(allowedDraft);
      onClose();
    } catch (err) {
      showAlert(err?.response?.data?.error || err.message || t("error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const teamForm = activeTab === "teams" && view === "form";

  const title =
    activeTab === "employees"
      ? t("operationTypeEmployees")
      : teamForm
        ? editingTeam
          ? t("operationTypeEditTeam")
          : t("operationTypeAddTeam")
        : t("operationTypeTeams");

  // Вкладки прячем, пока открыта форма команды: уйти с неё значит потерять введённое.
  const tabs =
    withTeams && !teamForm ? (
      <div className={styles.tabs}>
        <SegmentedGroup
          options={[
            { value: "employees", label: t("employees"), color: ACCENT },
            { value: "teams", label: t("operationTypeTeams"), color: ACCENT },
          ]}
          value={activeTab}
          onChange={setTab}
        />
      </div>
    ) : null;

  let content;
  let footer;

  if (activeTab === "employees") {
    content = (
      <div className={styles.form}>
        <p className={styles.hint}>{t("operationTypeEmployeesHint")}</p>
        <div className={styles.pickerBox}>
          <EmployeePicker options={employees} selected={allowedDraft} onChange={setAllowedDraft} />
        </div>
      </div>
    );
    footer = (
      <div className={styles.actions}>
        <button type="button" className={styles.cancelBtn} onClick={onClose}>
          {t("cancel")}
        </button>
        <button type="button" className={styles.saveBtn} onClick={handleSaveEmployees} disabled={saving}>
          {saving ? t("loading") : t("save")}
        </button>
      </div>
    );
  } else if (view === "form") {
    content = (
      <div className={styles.form}>
        <input
          type="text"
          className={styles.nameInput}
          placeholder={t("operationTypeTeamName")}
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSave();
            }
          }}
          maxLength={100}
          autoFocus={!sheet}
        />
        <div className={styles.pickerBox}>
          <EmployeePicker
            options={memberOptions}
            selected={form.employee_ids}
            onChange={(ids) => setForm((prev) => ({ ...prev, employee_ids: ids }))}
          />
        </div>
      </div>
    );
    footer = (
      <div className={styles.actions}>
        <button type="button" className={styles.cancelBtn} onClick={() => setView("list")}>
          {t("cancel")}
        </button>
        <button type="button" className={styles.saveBtn} onClick={handleSave} disabled={saving || !canSave}>
          {saving ? t("loading") : t("save")}
        </button>
      </div>
    );
  } else {
    content =
      teams.length > 0 ? (
        <div className={styles.list}>
          {teams.map((team) => (
            <div key={team.id} className={styles.card}>
              <div className={styles.cardInfo}>
                <span className={styles.cardName}>{team.name}</span>
                <span className={styles.cardCount}>
                  {t("operationTypeTeamMembersCount", { count: team.members?.length || 0 })}
                </span>
              </div>
              <button type="button" className={styles.cardEdit} onClick={() => openEdit(team)} title={t("edit")}>
                {Icons.edit}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>{t("noData")}</div>
      );
    footer = (
      <div className={styles.actions}>
        <button type="button" className={styles.saveBtn} onClick={openCreate}>
          {Icons.plus} {t("operationTypeAddTeam")}
        </button>
      </div>
    );
  }

  const body = (
    <>
      {tabs}
      {content}
    </>
  );

  if (sheet) {
    return (
      // Клики из портала по дереву React всплывают к предкам (форма приёма) — гасим здесь.
      <div onClick={(e) => e.stopPropagation()}>
        <TgSheet isOpen={isOpen} onClose={onClose} title={title} footer={footer}>
          <div className={styles.sheetBody}>{body}</div>
        </TgSheet>
      </div>
    );
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          // Пока открыта форма или правка допущенных, случайный клик мимо не должен терять введённое.
          onClick={(e) => {
            e.stopPropagation();
            if (activeTab === "teams" && view === "list") onClose();
          }}
        >
          <motion.div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.header}>
              <h2 className={styles.title}>{title}</h2>
              <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={t("close")}>
                {Icons.clear}
              </button>
            </div>
            <div className={styles.body}>{body}</div>
            <div className={styles.footer}>{footer}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default TeamManageModal;
