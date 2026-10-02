import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import {
  addOperationType,
  editOperationTypeById,
  getOperationTypeById,
  getActiveOperationTypes,
  EmployeeService,
  getEmployeeTeams,
  addEmployeeTeam,
  editEmployeeTeamById,
  deleteEmployeeTeamById,
  getWorkStickerTemplate,
} from "../api";
import { printEmployeeStickersPdf } from "../utils/DocGenerator";
import { userDisplayName } from "../utils/userDisplayName";
import { sameIdSet } from "../utils/ids";
import {
  UNIT_OPTIONS,
  UNIT_LABEL_KEYS,
  COMPLEXITY_OPTIONS,
  COMPLEXITY_LABEL_KEYS,
  EMPTY_FORM,
  toForm,
  buildLinkOptions,
  applyFormChange,
} from "../utils/operationType";

import Button from "./Button";
import Loading from "./Loading";
import EmployeePicker from "./EmployeePicker";
import MultiSelectOperationTypes from "./MultiSelectOperationTypes";
import CenterModal from "./CenterModal";
import { Icons } from "../icons/icons";
import styles from "./AddOperationType.module.scss";

// Подпись поля + значок "?" с подсказкой во всплывашке вместо текста под полем —
// не занимает место в сетке (см. AddOperationType.module.scss .hintIcon).
// align="right" — для полей в правой колонке сетки: подсказка растёт влево,
// иначе у левой колонки центрирование обрезалось бы скроллом секции (overflow-y:
// auto у .sectionData принудительно даёт и overflow-x, см. спеку CSS overflow).
const FieldLabel = ({ text, hint, align = "left" }) => (
  <label className={styles.labelRow}>
    <span>{text}</span>
    {hint && (
      <span className={`${styles.hintIcon} ${align === "right" ? styles.hintIconRight : ""}`} tabIndex={0}>
        {Icons.help}
        <span className={styles.hintTooltip}>{hint}</span>
      </span>
    )}
  </label>
);

// Страница типа операции (не модалка): id = null — создание, иначе редактирование.
const AddOperationType = ({ id, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [initialData, setInitialData] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [operationTypes, setOperationTypes] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Команды сотрудников этого типа: доступны только после сохранения типа
  // (нужен operation_type_id). Участник команды — только уже допущенный
  // сотрудник (form.employee_ids), поэтому список не зависит от загрузки заново.
  const [teams, setTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [teamFormOpen, setTeamFormOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [teamForm, setTeamForm] = useState({ name: "", employee_ids: [] });
  const [savingTeam, setSavingTeam] = useState(false);
  const [deletingTeamId, setDeletingTeamId] = useState(null);

  const loadTeams = useCallback(() => {
    if (!isEdit) return;
    setLoadingTeams(true);
    getEmployeeTeams(id)
      .then((res) => setTeams(res.data || []))
      .catch((err) => console.error(err))
      .finally(() => setLoadingTeams(false));
  }, [id, isEdit]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const openCreateTeam = () => {
    setEditingTeam(null);
    setTeamForm({ name: "", employee_ids: [] });
    setTeamFormOpen(true);
  };

  const openEditTeam = (team) => {
    setEditingTeam(team);
    setTeamForm({ name: team.name, employee_ids: (team.members || []).map((m) => m.employee_id) });
    setTeamFormOpen(true);
  };

  const closeTeamForm = () => setTeamFormOpen(false);

  // Участник команды — только допущенный, и сервер сверяет с сохранёнными допущенными. Выбор в форме ниже
  // может быть ещё не сохранён — тогда сохраняем его перед командой (только employee_ids, остальные поля
  // типа сервер оставляет как есть).
  const syncEmployees = async () => {
    const saved = (initialData?.employees || []).map((e) => e.employee_id);
    if (sameIdSet(saved, form.employee_ids)) return;

    const res = await editOperationTypeById(id, { employee_ids: form.employee_ids });
    if (!res?.success) throw new Error(res?.error || t("error"));
    setInitialData((prev) => ({ ...prev, employees: form.employee_ids.map((employee_id) => ({ employee_id })) }));
  };

  // Форма команды — не <form>: она живёт внутри формы типа операции, вложенный
  // <form> в DOM был бы невалиден (Enter в поле имени иначе отправил бы тип операции).
  const handleSaveTeam = async () => {
    if (savingTeam || !teamForm.name.trim()) return;

    setSavingTeam(true);
    try {
      await syncEmployees();
      const payload = { ...teamForm, operation_type_id: id };
      const res = editingTeam
        ? await editEmployeeTeamById(editingTeam.id, payload)
        : await addEmployeeTeam(payload);

      if (!res?.success) throw new Error(res?.error || t("error"));

      showAlert(t("success"), "success");
      setTeamFormOpen(false);
      loadTeams();
    } catch (err) {
      showAlert(err?.response?.data?.error || err.message || t("error"), "error");
    } finally {
      setSavingTeam(false);
    }
  };

  const handleDeleteTeam = async () => {
    if (!deletingTeamId) return;
    try {
      const res = await deleteEmployeeTeamById(deletingTeamId);
      if (!res?.success) throw new Error(res?.error || t("error"));
      showAlert(t("success"), "success");
      loadTeams();
    } catch (err) {
      showAlert(err?.response?.data?.error || err.message || t("error"), "error");
    } finally {
      setDeletingTeamId(null);
    }
  };

  useEffect(() => {
    getActiveOperationTypes()
      .then((res) => setOperationTypes(res.data || []))
      .catch((err) => console.error(err));
    EmployeeService.getActive()
      .then((res) => setEmployees(res.data || []))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    getOperationTypeById(id)
      .then((res) => {
        if (cancelled) return;
        setInitialData(res.data);
        setForm(toForm(res.data));
      })
      .catch((err) => {
        if (cancelled) return;
        showAlert(err?.response?.data?.error || t("error"), "error");
        onClose?.();
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Цели связей: активные подходящего вида плюс уже выбранные, отключённые с тех пор.
  const { nextOptions, reworkOptions, incompleteOptions, reworkTargetOptions } = buildLinkOptions(
    operationTypes,
    initialData,
    form,
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => applyFormChange(prev, name, value));
  };

  // Стикеры допущенных сотрудников (пустой выбор = допущены все — печатаем всех активных).
  // Сотрудник сканирует свой стикер в "Приём работы" вместо выбора из списка.
  const printedEmployees = (form.employee_ids.length > 0
    ? employees.filter((emp) => form.employee_ids.includes(Number(emp.id)))
    : employees
  )
    .slice()
    .sort((a, b) => (a.employeeFullName || "").localeCompare(b.employeeFullName || "", "ru"));

  const handlePrintEmployeeStickers = async () => {
    if (printedEmployees.length === 0) return;
    try {
      // Размер и тип кода — из шаблона стикера работы; не загрузился — печатаем по умолчанию.
      const template = await getWorkStickerTemplate()
        .then((res) => res?.data)
        .catch(() => undefined);
      await printEmployeeStickersPdf(printedEmployees, template);
    } catch (err) {
      showAlert(err?.message || t("error"), "error");
    }
  };

  const setEmployeeIds = (ids) => setForm((prev) => ({ ...prev, employee_ids: ids }));
  const setNextOperationTypeIds = (ids) => setForm((prev) => ({ ...prev, next_operation_type_ids: ids }));
  const setReworkOperationTypeIds = (ids) => setForm((prev) => ({ ...prev, rework_operation_type_ids: ids }));
  const setIncompleteOperationTypeIds = (ids) =>
    setForm((prev) => ({ ...prev, incomplete_operation_type_ids: ids }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      const res = isEdit ? await editOperationTypeById(id, form) : await addOperationType(form);

      if (!res?.success) throw new Error(res?.error || t("error"));

      showAlert(t("success"), "success");
      onSuccess?.();
    } catch (err) {
      showAlert(err?.response?.data?.error || err.message || t("error"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={styles.page} onSubmit={handleSubmit}>
      {(loading || saving) && <Loading />}

      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onClose}>
          {Icons.arrowBack}
          <span>{t("back")}</span>
        </button>
        <div className={styles.headerText}>
          <span className={styles.eyebrow}>
            {t("operationType")}
            {isEdit && initialData?.addedBy && ` · ${t("addedBy")}: ${userDisplayName(initialData.addedBy)}`}
          </span>
          <h2>{isEdit ? initialData?.name || t("editOperationType") : t("addOperationType")}</h2>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.content}>
          <section className={`${styles.section} ${styles.sectionData}`}>
            <div className={styles.sectionHeader}>
              <h3>{t("operationTypeData")}</h3>
            </div>

            <div className={styles.group}>
              <h4 className={styles.groupTitle}>{t("operationTypeGroupMain")}</h4>
              <div className={styles.grid}>
                <div className={styles.nameCol}>
                  <label>{t("name")} <span className={styles.req}>*</span></label>
                  <input type="text" name="name" value={form.name} onChange={handleChange} required />
                </div>
                <div className={styles.orderCol}>
                  <label>{t("sortOrder")}</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    name="sort_order"
                    value={form.sort_order}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label>{t("unit")}</label>
                  <select name="unit" value={form.unit} onChange={handleChange}>
                    <option value="">—</option>
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>{t(UNIT_LABEL_KEYS[u])}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>{t("price")}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="price"
                    value={form.price}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label>{t("complexity")}</label>
                  <select name="complexity" value={form.complexity} onChange={handleChange}>
                    <option value="">—</option>
                    {COMPLEXITY_OPTIONS.map((c) => (
                      <option key={c} value={c}>{t(COMPLEXITY_LABEL_KEYS[c])}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>{t("status")}</label>
                  <select name="is_active" value={form.is_active} onChange={handleChange}>
                    <option value="true">{t("true")}</option>
                    <option value="false">{t("false")}</option>
                  </select>
                </div>
              </div>
            </div>

            <div className={styles.group}>
              <h4 className={styles.groupTitle}>{t("operationTypeGroupRole")}</h4>
              <div className={styles.grid}>
                <div>
                  <FieldLabel text={t("isReworkOperation")} hint={t("isReworkOperationHint")} />
                  <select name="is_rework" value={form.is_rework} onChange={handleChange}>
                    <option value="false">{t("no")}</option>
                    <option value="true">{t("yes")}</option>
                  </select>
                </div>
                <div>
                  <FieldLabel text={t("isFirstOperation")} hint={t("isFirstOperationHint")} align="right" />
                  <select
                    name="is_first"
                    value={form.is_first}
                    onChange={handleChange}
                    disabled={form.is_rework}
                  >
                    <option value="false">{t("no")}</option>
                    <option value="true">{t("yes")}</option>
                  </select>
                </div>

                <div>
                  <FieldLabel text={t("isFinalOperation")} hint={t("isFinalOperationHint")} />
                  <select name="is_final" value={form.is_final} onChange={handleChange}>
                    <option value="false">{t("no")}</option>
                    <option value="true">{t("yes")}</option>
                  </select>
                </div>
                <div>
                  <FieldLabel text={t("isAllowMerge")} hint={t("isAllowMergeHint")} align="right" />
                  <select name="allow_merge" value={form.allow_merge} onChange={handleChange}>
                    <option value="false">{t("no")}</option>
                    <option value="true">{t("yes")}</option>
                  </select>
                </div>
              </div>
            </div>

            <div className={styles.group}>
              <h4 className={styles.groupTitle}>{t("operationTypeGroupLinks")}</h4>
              <div className={styles.grid}>
                <div>
                  <FieldLabel text={t("nextOperationType")} hint={t("nextOperationTypeHint")} />
                  {form.is_final ? (
                    <div className={styles.disabledField}>—</div>
                  ) : (
                    <MultiSelectOperationTypes
                      formField
                      options={nextOptions}
                      selected={form.next_operation_type_ids}
                      onChange={setNextOperationTypeIds}
                    />
                  )}
                </div>
                <div>
                  <FieldLabel text={t("reworkOperationType")} hint={t("reworkOperationTypeHint")} align="right" />
                  <MultiSelectOperationTypes
                    formField
                    options={reworkOptions}
                    selected={form.rework_operation_type_ids}
                    onChange={setReworkOperationTypeIds}
                  />
                </div>

                <div>
                  <FieldLabel text={t("isAllowIncomplete")} hint={t("isAllowIncompleteHint")} />
                  <select name="allow_incomplete" value={form.allow_incomplete} onChange={handleChange}>
                    <option value="false">{t("no")}</option>
                    <option value="true">{t("yes")}</option>
                  </select>
                </div>
                <div>
                  <FieldLabel text={t("incompleteOperationType")} hint={t("incompleteOperationTypeHint")} align="right" />
                  {form.allow_incomplete ? (
                    <MultiSelectOperationTypes
                      formField
                      options={incompleteOptions}
                      selected={form.incomplete_operation_type_ids}
                      onChange={setIncompleteOperationTypeIds}
                    />
                  ) : (
                    <div className={styles.disabledField}>—</div>
                  )}
                </div>

                {form.is_rework && (
                  <div>
                    <FieldLabel text={t("reworkTargetOperationType")} hint={t("reworkTargetOperationTypeHint")} />
                    <select
                      name="rework_target_operation_type_id"
                      value={form.rework_target_operation_type_id}
                      onChange={handleChange}
                    >
                      <option value="">—</option>
                      {reworkTargetOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className={`${styles.section} ${styles.sectionEmployees}`}>
            <div className={styles.sectionHeader}>
              <h3>{t("operationTypeEmployees")}</h3>
              {printedEmployees.length > 0 && (
                <button type="button" className={styles.addTeamBtn} onClick={handlePrintEmployeeStickers}>
                  {Icons.print} {t("employeeStickersPrint")} ({printedEmployees.length})
                </button>
              )}
            </div>
            <span className={styles.hint}>{t("operationTypeEmployeesHint")}</span>

            <EmployeePicker
              options={employees}
              selected={form.employee_ids}
              onChange={setEmployeeIds}
            />
          </section>

          <section className={`${styles.section} ${styles.sectionTeams}`}>
            <div className={styles.sectionHeader}>
              <h3>{t("operationTypeTeams")}</h3>
              {isEdit && !teamFormOpen && (
                <button type="button" className={styles.addTeamBtn} onClick={openCreateTeam}>
                  {Icons.plus} {t("operationTypeAddTeam")}
                </button>
              )}
            </div>
            <span className={styles.hint}>{t("operationTypeTeamsHint")}</span>

            {!isEdit ? (
              <div className={styles.teamsEmpty}>{t("operationTypeTeamsSaveFirst")}</div>
            ) : teamFormOpen ? (
              <div className={styles.teamForm}>
                {savingTeam && <Loading />}

                <div className={styles.teamFormHead}>
                  <span>{editingTeam ? t("operationTypeEditTeam") : t("operationTypeAddTeam")}</span>
                  <span className={styles.teamFormClose} onClick={closeTeamForm}>
                    {Icons.clear}
                  </span>
                </div>

                <input
                  type="text"
                  className={styles.teamFormName}
                  placeholder={t("operationTypeTeamName")}
                  value={teamForm.name}
                  onChange={(e) => setTeamForm((prev) => ({ ...prev, name: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSaveTeam();
                    }
                  }}
                  autoFocus
                />

                <div className={styles.teamFormPicker}>
                  <EmployeePicker
                    options={
                      form.employee_ids.length > 0
                        ? employees.filter((emp) => form.employee_ids.includes(Number(emp.id)))
                        : employees
                    }
                    selected={teamForm.employee_ids}
                    onChange={(ids) => setTeamForm((prev) => ({ ...prev, employee_ids: ids }))}
                  />
                </div>

                <div className={styles.teamFormActions}>
                  <button type="button" className={styles.cancelBtn} onClick={closeTeamForm}>
                    {t("cancel")}
                  </button>
                  <button
                    type="button"
                    className={styles.teamFormSaveBtn}
                    onClick={handleSaveTeam}
                    disabled={savingTeam || !teamForm.name.trim()}
                  >
                    {savingTeam ? t("loading") : t("save")}
                  </button>
                </div>
              </div>
            ) : loadingTeams ? (
              <Loading />
            ) : teams.length > 0 ? (
              <div className={styles.teamsList}>
                {teams.map((team) => (
                  <div key={team.id} className={styles.teamCard}>
                    <div className={styles.teamCardInfo}>
                      <span className={styles.teamCardName}>{team.name}</span>
                      <span className={styles.teamCardCount}>
                        {t("operationTypeTeamMembersCount", { count: team.members?.length || 0 })}
                      </span>
                    </div>
                    <div className={styles.teamCardActions}>
                      <button type="button" onClick={() => openEditTeam(team)} title={t("edit")}>
                        {Icons.edit}
                      </button>
                      <button type="button" onClick={() => setDeletingTeamId(team.id)} title={t("delete")}>
                        {Icons.delete}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.teamsEmpty}>{t("noData")}</div>
            )}
          </section>
        </div>
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.cancelBtn} onClick={onClose}>
          {t("cancel")}
        </button>
        <Button text={t("save")} type="submit" loading={saving} />
      </div>

      <CenterModal
        isOpen={deletingTeamId !== null}
        onClose={() => setDeletingTeamId(null)}
        onAccept={handleDeleteTeam}
        message={t("operationTypeDeleteTeamConfirm")}
      />
    </form>
  );
};

export default AddOperationType;
