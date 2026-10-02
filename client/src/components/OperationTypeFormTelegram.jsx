import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import {
  addOperationType,
  editOperationTypeById,
  getOperationTypeById,
  deleteOperationTypeById,
  getActiveOperationTypes,
  EmployeeService,
  getEmployeeTeams,
  addEmployeeTeam,
  editEmployeeTeamById,
  deleteEmployeeTeamById,
} from "../api";
import { userDisplayName } from "../utils/userDisplayName";
import { sameIdSet } from "../utils/ids";
import {
  UNIT_OPTIONS,
  UNIT_LABEL_KEYS,
  COMPLEXITY_OPTIONS,
  COMPLEXITY_LABEL_KEYS,
  COMPLEXITY_META,
  EMPTY_FORM,
  toForm,
  buildLinkOptions,
  applyFormChange,
} from "../utils/operationType";

import Loading from "./Loading";
import CenterModal from "./CenterModal";
import TgSheet from "./tg/TgSheet";
import TgPickSheet from "./tg/TgPickSheet";
import {
  IconChevronLeft,
  IconChevronRight,
  IconSliders,
  IconFlag,
  IconRoute,
  IconUsers,
  IconPlus,
  IconEdit,
  IconTrash,
  IconCheck,
} from "./tg/tgIcons";
import ui from "./tg/TgUi.module.scss";
import styles from "./OperationTypeFormTelegram.module.scss";

// В Telegram есть системная кнопка «назад» — своя в шапке не нужна (вне Telegram остаётся).
const hasNativeBackButton = () => Boolean(window.Telegram?.WebApp?.initData);

const toEmployeeOption = (emp) => ({
  id: Number(emp.id),
  title: emp.employeeFullName || `#${emp.id}`,
  subtitle: [emp.positionName, emp.departmentName].filter(Boolean).join(" · "),
});

// Переключатель с названием и «?»: подсказка раскрывается под строкой по тапу.
const SwitchRow = ({ label, hint, checked, disabled, onChange }) => {
  const [hintOpen, setHintOpen] = useState(false);

  return (
    <div className={`${styles.switchRow} ${disabled ? styles.disabled : ""}`}>
      <div className={styles.switchMain}>
        <div className={styles.switchText}>
          <span className={styles.switchLabel}>{label}</span>
          {hint && (
            <button
              type="button"
              className={`${styles.helpBtn} ${hintOpen ? styles.helpBtnOn : ""}`}
              onClick={() => setHintOpen((v) => !v)}
              aria-label="help"
              aria-expanded={hintOpen}
            >
              ?
            </button>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          className={`${styles.switch} ${checked ? styles.switchOn : ""}`}
          onClick={() => onChange(!checked)}
          disabled={disabled}
        >
          <span />
        </button>
      </div>
      {hint && hintOpen && <p className={styles.hint}>{hint}</p>}
    </div>
  );
};

// Строка-ссылка на выбор из списка: подпись, выбранные значения чипами и шеврон.
const PickRow = ({ label, hint, names, emptyText, disabled, onClick }) => {
  const [hintOpen, setHintOpen] = useState(false);
  const shown = names.slice(0, 2);
  const rest = names.length - shown.length;

  return (
    <div className={`${styles.pickWrap} ${disabled ? styles.disabled : ""}`}>
      <div className={styles.pickLabelRow}>
        <span className={styles.pickLabel}>{label}</span>
        {hint && (
          <button
            type="button"
            className={`${styles.helpBtn} ${hintOpen ? styles.helpBtnOn : ""}`}
            onClick={() => setHintOpen((v) => !v)}
            aria-label="help"
            aria-expanded={hintOpen}
          >
            ?
          </button>
        )}
      </div>
      {hint && hintOpen && <p className={styles.hint}>{hint}</p>}

      <button type="button" className={styles.pick} onClick={onClick} disabled={disabled}>
        <span className={styles.pickValue}>
          {names.length === 0 ? (
            <span className={styles.pickEmpty}>{emptyText}</span>
          ) : (
            <>
              {shown.map((name) => (
                <span key={name} className={styles.chip}>
                  {name}
                </span>
              ))}
              {rest > 0 && <span className={`${styles.chip} ${styles.chipMore}`}>+{rest}</span>}
            </>
          )}
        </span>
        <IconChevronRight />
      </button>
    </div>
  );
};

const Section = ({ icon, title, action, children }) => (
  <section className={styles.card}>
    <div className={styles.cardHead}>
      <span className={styles.cardIcon}>{icon}</span>
      <h2 className={styles.cardTitle}>{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

// Экран типа операции в Telegram: id = null — создание, иначе редактирование.
// Показывается поверх страницы через стек экранов; onChanged — обновить список позади.
const OperationTypeFormTelegram = ({ id, canDelete, onClose, onChanged }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [initialData, setInitialData] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [operationTypes, setOperationTypes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Открытая шторка выбора: "next" | "rework" | "reworkTarget" | "incomplete" | "employees" | "members" | null.
  const [pick, setPick] = useState(null);
  const lastPickRef = useRef("next");

  // Команды типа: нужен operation_type_id, поэтому доступны только после сохранения типа.
  const [teams, setTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [teamSheetOpen, setTeamSheetOpen] = useState(false);
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

  const { nextOptions, reworkOptions, incompleteOptions, reworkTargetOptions } = buildLinkOptions(
    operationTypes,
    initialData,
    form,
  );

  const setField = (name, value) => setForm((prev) => applyFormChange(prev, name, value));
  const setIds = (name) => (ids) => setForm((prev) => ({ ...prev, [name]: ids }));

  // Участник команды — только допущенный; сервер сверяет с сохранёнными допущенными. Выбор в форме
  // может быть ещё не сохранён — тогда сохраняем его перед командой (сервер оставляет прочие поля как есть).
  const syncEmployees = async () => {
    const saved = (initialData?.employees || []).map((e) => e.employee_id);
    if (sameIdSet(saved, form.employee_ids)) return;

    const res = await editOperationTypeById(id, { employee_ids: form.employee_ids });
    if (!res?.success) throw new Error(res?.error || t("error"));
    setInitialData((prev) => ({ ...prev, employees: form.employee_ids.map((employee_id) => ({ employee_id })) }));
  };

  const openTeamSheet = (team) => {
    setEditingTeam(team);
    setTeamForm({ name: team?.name || "", employee_ids: (team?.members || []).map((m) => m.employee_id) });
    setTeamSheetOpen(true);
  };

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
      setTeamSheetOpen(false);
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

  const handleSave = async () => {
    if (saving || !form.name.trim()) return;

    setSaving(true);
    try {
      const res = isEdit ? await editOperationTypeById(id, form) : await addOperationType(form);
      if (!res?.success) throw new Error(res?.error || t("error"));

      showAlert(t("success"), "success");
      onChanged?.();
      onClose?.();
    } catch (err) {
      showAlert(err?.response?.data?.error || err.message || t("error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    setSaving(true);
    try {
      await deleteOperationTypeById(id);
      showAlert(t("success"), "success");
      onChanged?.();
      onClose?.();
    } catch (err) {
      showAlert(err?.response?.data?.error || err.message || t("error"), "error");
      setSaving(false);
    }
  };

  // Исправляемая операция одна — в шторку выбора уходит массивом из одного id.
  const reworkTargetIds = form.rework_target_operation_type_id ? [Number(form.rework_target_operation_type_id)] : [];

  const nameOf = (options, ids) => ids.map((typeId) => options.find((o) => o.id === typeId)?.name).filter(Boolean);

  // Сотрудники: варианты для типа — все активные; для команды — только допущенные (если допуск задан).
  const employeeOptions = useMemo(() => employees.map(toEmployeeOption), [employees]);
  const memberOptions = useMemo(
    () => (form.employee_ids.length > 0 ? employeeOptions.filter((o) => form.employee_ids.includes(o.id)) : employeeOptions),
    [employeeOptions, form.employee_ids],
  );

  const complexityMeta = COMPLEXITY_META[form.complexity];
  const title = isEdit ? initialData?.name || t("editOperationType") : t("addOperationType");
  const author = isEdit && initialData?.addedBy ? userDisplayName(initialData.addedBy) : "";

  const pickConfig = {
    next: { title: t("nextOperationType"), options: nextOptions.map((o) => ({ id: o.id, title: o.name })), selected: form.next_operation_type_ids, onChange: setIds("next_operation_type_ids") },
    rework: { title: t("reworkOperationType"), options: reworkOptions.map((o) => ({ id: o.id, title: o.name })), selected: form.rework_operation_type_ids, onChange: setIds("rework_operation_type_ids") },
    incomplete: { title: t("incompleteOperationType"), options: incompleteOptions.map((o) => ({ id: o.id, title: o.name })), selected: form.incomplete_operation_type_ids, onChange: setIds("incomplete_operation_type_ids") },
    reworkTarget: {
      title: t("reworkTargetOperationType"),
      options: reworkTargetOptions.map((o) => ({ id: o.id, title: o.name })),
      selected: reworkTargetIds,
      single: true,
      onChange: (ids) => setField("rework_target_operation_type_id", ids[0] ?? ""),
    },
    employees: { title: t("operationTypeEmployees"), options: employeeOptions, selected: form.employee_ids, onChange: setIds("employee_ids") },
    members: {
      title: t("employees"),
      options: memberOptions,
      selected: teamForm.employee_ids,
      onChange: (ids) => setTeamForm((prev) => ({ ...prev, employee_ids: ids })),
    },
  };
  // Пока шторка уезжает вниз (pick уже null), её содержимое не должно меняться: держим последнюю конфигурацию.
  if (pick) lastPickRef.current = pick;
  const activePick = pickConfig[lastPickRef.current];

  return (
    <div className={styles.screen}>
      {(loading || saving) && <Loading />}
      <div className={styles.topGlass} />

      <div className={styles.scroll}>
        <header className={styles.hero} style={complexityMeta ? { "--tint": complexityMeta.color } : undefined}>
          <div className={styles.heroTop}>
            {!hasNativeBackButton() && (
              <button type="button" className={styles.backChip} onClick={onClose}>
                <IconChevronLeft />
                <span>{t("back")}</span>
              </button>
            )}
            <span className={styles.eyebrow}>{t("operationType")}</span>
            <span className={`${styles.statusPill} ${form.is_active ? styles.statusOn : styles.statusOff}`}>
              {form.is_active ? t("true") : t("false")}
            </span>
          </div>
          <h1 className={styles.heroTitle}>{title}</h1>
          {author && (
            <p className={styles.heroSub}>
              {t("addedBy")}: <b>{author}</b>
            </p>
          )}
        </header>

        <Section icon={<IconSliders />} title={t("operationTypeGroupMain")}>
          <div className={ui.form}>
            <div className={ui.field}>
              <label className={ui.label}>
                {t("name")} <span className={ui.req}>*</span>
              </label>
              <input
                className={ui.input}
                type="text"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className={ui.grid2}>
              <div className={ui.field}>
                <label className={ui.label}>{t("price")}</label>
                <input
                  className={ui.input}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) => setField("price", e.target.value)}
                />
              </div>
              <div className={ui.field}>
                <label className={ui.label}>{t("sortOrder")}</label>
                <input
                  className={ui.input}
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min="0"
                  value={form.sort_order}
                  onChange={(e) => setField("sort_order", e.target.value)}
                />
              </div>
            </div>

            <div className={ui.field}>
              <label className={ui.label}>{t("unit")}</label>
              <div className={styles.segment}>
                {UNIT_OPTIONS.map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    className={form.unit === unit ? styles.segmentOn : ""}
                    // Повторный тап по выбранной единице снимает выбор — поле необязательное.
                    onClick={() => setField("unit", form.unit === unit ? "" : unit)}
                  >
                    {t(UNIT_LABEL_KEYS[unit])}
                  </button>
                ))}
              </div>
            </div>

            <div className={ui.field}>
              <label className={ui.label}>{t("complexity")}</label>
              <div className={styles.segment}>
                {COMPLEXITY_OPTIONS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={form.complexity === level ? styles.segmentOn : ""}
                    style={{ "--seg-color": COMPLEXITY_META[level].color }}
                    onClick={() => setField("complexity", form.complexity === level ? "" : level)}
                  >
                    <i className={styles.segmentDot} />
                    {t(COMPLEXITY_LABEL_KEYS[level])}
                  </button>
                ))}
              </div>
            </div>

            <SwitchRow label={t("status")} checked={form.is_active} onChange={(v) => setField("is_active", v)} />
          </div>
        </Section>

        <Section icon={<IconFlag />} title={t("operationTypeGroupRole")}>
          <div className={styles.switchList}>
            <SwitchRow
              label={t("isReworkOperation")}
              hint={t("isReworkOperationHint")}
              checked={form.is_rework}
              onChange={(v) => setField("is_rework", v)}
            />
            <SwitchRow
              label={t("isFirstOperation")}
              hint={t("isFirstOperationHint")}
              checked={form.is_first}
              disabled={form.is_rework}
              onChange={(v) => setField("is_first", v)}
            />
            <SwitchRow
              label={t("isFinalOperation")}
              hint={t("isFinalOperationHint")}
              checked={form.is_final}
              onChange={(v) => setField("is_final", v)}
            />
            <SwitchRow
              label={t("isAllowMerge")}
              hint={t("isAllowMergeHint")}
              checked={form.allow_merge}
              onChange={(v) => setField("allow_merge", v)}
            />
          </div>
        </Section>

        <Section icon={<IconRoute />} title={t("operationTypeGroupLinks")}>
          <div className={styles.linkList}>
            <PickRow
              label={t("nextOperationType")}
              hint={t("nextOperationTypeHint")}
              names={nameOf(nextOptions, form.next_operation_type_ids)}
              emptyText={form.is_final ? t("isFinalOperation") : "—"}
              disabled={form.is_final}
              onClick={() => setPick("next")}
            />
            <PickRow
              label={t("reworkOperationType")}
              hint={t("reworkOperationTypeHint")}
              names={nameOf(reworkOptions, form.rework_operation_type_ids)}
              emptyText="—"
              onClick={() => setPick("rework")}
            />
            {form.is_rework && (
              <PickRow
                label={t("reworkTargetOperationType")}
                hint={t("reworkTargetOperationTypeHint")}
                names={nameOf(reworkTargetOptions, reworkTargetIds)}
                emptyText="—"
                onClick={() => setPick("reworkTarget")}
              />
            )}
            <SwitchRow
              label={t("isAllowIncomplete")}
              hint={t("isAllowIncompleteHint")}
              checked={form.allow_incomplete}
              onChange={(v) => setField("allow_incomplete", v)}
            />
            {form.allow_incomplete && (
              <PickRow
                label={t("incompleteOperationType")}
                hint={t("incompleteOperationTypeHint")}
                names={nameOf(incompleteOptions, form.incomplete_operation_type_ids)}
                emptyText="—"
                onClick={() => setPick("incomplete")}
              />
            )}
          </div>
        </Section>

        <Section icon={<IconUsers />} title={t("operationTypeEmployees")}>
          <p className={styles.sectionHint}>{t("operationTypeEmployeesHint")}</p>
          <button type="button" className={styles.pick} onClick={() => setPick("employees")}>
            <span className={styles.pickValue}>
              {form.employee_ids.length === 0 ? (
                <span className={styles.pickAll}>
                  <IconCheck />
                  {t("all")}
                </span>
              ) : (
                <span className={styles.pickCount}>
                  {t("selected")}: <b>{form.employee_ids.length}</b>
                </span>
              )}
            </span>
            <IconChevronRight />
          </button>
        </Section>

        <Section
          icon={<IconUsers />}
          title={t("operationTypeTeams")}
          action={
            isEdit && (
              <button type="button" className={styles.addPill} onClick={() => openTeamSheet(null)}>
                <IconPlus />
                <span>{t("add")}</span>
              </button>
            )
          }
        >
          <p className={styles.sectionHint}>{t("operationTypeTeamsHint")}</p>

          {!isEdit ? (
            <div className={styles.teamsEmpty}>{t("operationTypeTeamsSaveFirst")}</div>
          ) : loadingTeams && teams.length === 0 ? (
            <div className={styles.teamsEmpty}>{t("loading")}…</div>
          ) : teams.length === 0 ? (
            <div className={styles.teamsEmpty}>{t("noData")}</div>
          ) : (
            <div className={styles.teams}>
              {teams.map((team) => (
                <div key={team.id} className={styles.team}>
                  <span className={styles.teamAvatar}>
                    <IconUsers />
                  </span>
                  <div className={styles.teamInfo}>
                    <span className={styles.teamName}>{team.name}</span>
                    <span className={styles.teamCount}>
                      {t("operationTypeTeamMembersCount", { count: team.members?.length || 0 })}
                    </span>
                  </div>
                  <button type="button" className={styles.iconBtn} onClick={() => openTeamSheet(team)} aria-label={t("edit")}>
                    <IconEdit />
                  </button>
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                    onClick={() => setDeletingTeamId(team.id)}
                    aria-label={t("delete")}
                  >
                    <IconTrash />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <div className={styles.actionBar}>
        {isEdit && canDelete && (
          <button
            type="button"
            className={`${ui.btn} ${ui.btnDanger} ${ui.btnIcon}`}
            onClick={() => setConfirmDelete(true)}
            aria-label={t("delete")}
          >
            <IconTrash />
          </button>
        )}
        <button
          type="button"
          className={`${ui.btn} ${ui.btnPrimary}`}
          onClick={handleSave}
          disabled={saving || !form.name.trim()}
        >
          <IconCheck />
          <span>{t("save")}</span>
        </button>
      </div>

      <TgPickSheet
        isOpen={pick !== null}
        onClose={() => setPick(null)}
        title={activePick.title}
        options={activePick.options}
        selected={activePick.selected}
        single={activePick.single}
        onChange={activePick.onChange}
      />

      <TgSheet
        isOpen={teamSheetOpen}
        onClose={() => setTeamSheetOpen(false)}
        title={editingTeam ? t("operationTypeEditTeam") : t("operationTypeAddTeam")}
        footer={
          <button
            type="button"
            className={`${ui.btn} ${ui.btnPrimary}`}
            onClick={handleSaveTeam}
            disabled={savingTeam || !teamForm.name.trim()}
          >
            <IconCheck />
            <span>{savingTeam ? t("loading") : t("save")}</span>
          </button>
        }
      >
        <div className={ui.form}>
          <div className={ui.field}>
            <label className={ui.label}>{t("operationTypeTeamName")}</label>
            <input
              className={ui.input}
              type="text"
              value={teamForm.name}
              onChange={(e) => setTeamForm((prev) => ({ ...prev, name: e.target.value }))}
              autoComplete="off"
            />
          </div>

          <div className={ui.field}>
            <label className={ui.label}>{t("employees")}</label>
            <button type="button" className={styles.pick} onClick={() => setPick("members")}>
              <span className={styles.pickValue}>
                {teamForm.employee_ids.length === 0 ? (
                  <span className={styles.pickEmpty}>—</span>
                ) : (
                  <span className={styles.pickCount}>
                    {t("selected")}: <b>{teamForm.employee_ids.length}</b>
                  </span>
                )}
              </span>
              <IconChevronRight />
            </button>
          </div>
        </div>
      </TgSheet>

      <CenterModal
        isOpen={deletingTeamId !== null}
        onClose={() => setDeletingTeamId(null)}
        onAccept={handleDeleteTeam}
        message={t("operationTypeDeleteTeamConfirm")}
      />

      <CenterModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onAccept={handleDelete}
        message={t("areYouSureDelete")}
      />
    </div>
  );
};

export default OperationTypeFormTelegram;
