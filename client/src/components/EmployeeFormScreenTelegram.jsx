import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  EmployeeService,
  getActiveBranches,
  getActivePositions,
  getActiveDoors,
  getActiveWorkSchedules,
} from "../api";
import { useAlertStore } from "../stores/alertStore";
import { useScreenStack } from "../context/ScreenStackContext";

import TgPickSheet from "./tg/TgPickSheet";
import ui from "./tg/TgUi.module.scss";
import {
  IconCheck,
  IconClose,
  IconCamera,
  IconUser,
  IconIdCard,
  IconPhone,
  IconBriefcase,
  IconDoor,
  IconRefresh,
  IconPlus,
  IconChevronDown,
} from "./tg/tgIcons";

import styles from "./EmployeeFormScreenTelegram.module.scss";

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM = {
  last_name: "",
  first_name: "",
  middle_name: "",
  gender: "",
  date_of_birth: "",
  pinfl: "",
  passport: "",
  passport_expiry_date: "",
  education: "",
  education_specialty: "",
  phone: "",
  address: "",
  employee_number: "",
  work_schedule_id: "",
  work_schedule_start_date: "",
  order_id: "",
  order_number: "",
  order_date: today(),
  branch_id: "",
  department_id: "",
  position_id: "",
  door_ids: [],
};

// Браузер сам применяет EXIF-ориентацию; на выходе всегда jpeg (heic и др. не проходят).
const fixImageOrientation = async (file) => {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0);
  bitmap.close();

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.9),
  );
  if (!blob) throw new Error("Canvas toBlob failed");
  return { url: URL.createObjectURL(blob), blob };
};

const trimValue = (v) => (typeof v === "string" ? v.trim() : v);

// Экран добавления / правки сотрудника в Telegram: на весь экран поверх страницы,
// поля разложены по карточкам, «Сохранить» — в шапке справа.
// id не передан — добавление, иначе правка сотрудника с этим id.
const EmployeeFormScreenTelegram = ({ id, onSaved }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const { popScreen } = useScreenStack();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(EMPTY_FORM);
  // File — новое фото, "" — убрать текущее, null — не менять
  const [photo, setPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [status, setStatus] = useState(true);
  const [hasOrder, setHasOrder] = useState(false);
  const [meta, setMeta] = useState({
    branches: [],
    positions: [],
    schedules: [],
    doors: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pick, setPick] = useState(null); // "position" | "doors"

  const closedRef = useRef(false);
  const originalScheduleRef = useRef("");

  const close = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    popScreen();
  };

  useEffect(() => {
    (async () => {
      try {
        const [branchRes, posRes, doorRes, scheduleRes, empRes] =
          await Promise.all([
            getActiveBranches(),
            getActivePositions(),
            getActiveDoors(),
            getActiveWorkSchedules(),
            isEdit ? EmployeeService.getById(id) : null,
          ]);

        const branches = branchRes?.data || [];
        setMeta({
          branches,
          positions: posRes?.data || [],
          doors: doorRes?.data || [],
          schedules: scheduleRes?.data || [],
        });

        if (empRes?.data) {
          const e = empRes.data;
          const order = e.employmentOrders?.at(-1);
          originalScheduleRef.current = e.work_schedule_id ?? "";
          setStatus(e.status !== false);
          setHasOrder(Boolean(order));
          setForm({
            last_name: e.last_name || "",
            first_name: e.first_name || "",
            middle_name: e.middle_name || "",
            gender: e.gender || "",
            date_of_birth: e.date_of_birth || "",
            pinfl: e.pinfl || "",
            passport: e.passport || "",
            passport_expiry_date: e.passport_expiry_date || "",
            education: e.education || "",
            education_specialty: e.education_specialty || "",
            phone: e.phone || "",
            address: e.address || "",
            employee_number: e.employee_number || "",
            work_schedule_id: e.work_schedule_id ?? "",
            work_schedule_start_date: "",
            order_id: order?.id ?? "",
            order_number: order?.order_number ?? "",
            order_date: order?.date?.slice(0, 10) || "",
            branch_id: order?.branch_id ?? "",
            department_id: order?.department_id ?? "",
            position_id: order?.position_id ?? "",
            door_ids: (e.door_ids || []).map(Number),
          });
          if (e.photo) {
            const stamp = e.updated_at ? new Date(e.updated_at).getTime() : Date.now();
            setPhotoUrl(`/api/employees/image/${e.photo}?t=${stamp}`);
          }
        } else if (branches.length === 1) {
          // единственный филиал выбираем сразу
          setForm((prev) => ({ ...prev, branch_id: branches[0].id }));
        }
      } catch (err) {
        console.error("Ошибка загрузки формы сотрудника:", err);
        showAlert(t("errorLoading"), "error");
        close();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(
    () => () => {
      if (photoUrl?.startsWith("blob:")) URL.revokeObjectURL(photoUrl);
    },
    [photoUrl],
  );

  const set = (name, value) =>
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "branch_id" ? { department_id: "" } : {}),
    }));

  const bind = (name) => ({
    value: form[name] ?? "",
    onChange: (e) => set(name, e.target.value),
  });

  const changeSchedule = (value) =>
    setForm((prev) => ({
      ...prev,
      work_schedule_id: value,
      work_schedule_start_date: prev.work_schedule_start_date || today(),
    }));

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const { url, blob } = await fixImageOrientation(file);
      setPhotoUrl(url);
      setPhoto(
        new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
          type: "image/jpeg",
        }),
      );
    } catch (err) {
      console.error("Ошибка обработки фото:", err);
      setPhotoUrl(URL.createObjectURL(file));
      setPhoto(file);
    }
  };

  const removePhoto = () => {
    setPhotoUrl(null);
    setPhoto("");
  };

  const selectedBranch = meta.branches.find(
    (b) => String(b.id) === String(form.branch_id),
  );
  const departments = selectedBranch?.departments || [];
  const department = departments.find(
    (d) => String(d.id) === String(form.department_id),
  );
  const position = meta.positions.find(
    (p) => String(p.id) === String(form.position_id),
  );
  const selectedDoors = useMemo(
    () => meta.doors.filter((d) => form.door_ids.includes(Number(d.id))),
    [meta.doors, form.door_ids],
  );

  // Место работы правится через текущий приказ. У уволенного его не трогаем.
  const showPlacement = !isEdit || (status && hasOrder);
  const scheduleChanged =
    isEdit &&
    form.work_schedule_id !== "" &&
    String(form.work_schedule_id) !== String(originalScheduleRef.current);

  const fullName = [form.last_name, form.first_name, form.middle_name]
    .map((v) => v.trim())
    .filter(Boolean)
    .join(" ");

  const canSave =
    !loading &&
    !saving &&
    form.last_name.trim() &&
    form.first_name.trim() &&
    form.pinfl.trim() &&
    (!showPlacement ||
      (form.branch_id !== "" &&
        form.department_id !== "" &&
        form.position_id !== "" &&
        form.order_date)) &&
    (!scheduleChanged || form.work_schedule_start_date);

  const buildPayload = (syncDoors) => {
    const payload = {
      last_name: trimValue(form.last_name),
      first_name: trimValue(form.first_name),
      middle_name: trimValue(form.middle_name),
      gender: form.gender,
      date_of_birth: form.date_of_birth,
      pinfl: trimValue(form.pinfl),
      passport: trimValue(form.passport),
      passport_expiry_date: form.passport_expiry_date,
      education: form.education,
      education_specialty: trimValue(form.education_specialty),
      phone: trimValue(form.phone),
      address: trimValue(form.address),
      employee_number: trimValue(form.employee_number),
      work_schedule_id: form.work_schedule_id,
      door_ids: form.door_ids,
      sync_doors: syncDoors,
      photo,
    };

    if (showPlacement) {
      Object.assign(payload, {
        order_number: trimValue(form.order_number),
        order_date: form.order_date,
        branch_id: form.branch_id,
        department_id: form.department_id,
        position_id: form.position_id,
      });
    }

    if (isEdit) {
      if (showPlacement) payload.order_id = form.order_id;
      if (scheduleChanged) {
        payload.work_schedule_start_date = form.work_schedule_start_date;
      }
      return payload;
    }

    // при создании пустые поля не отправляем: сервер сам подставит значения по умолчанию
    return Object.fromEntries(
      Object.entries(payload).filter(
        ([key, value]) =>
          key === "photo" ||
          key === "door_ids" ||
          key === "sync_doors" ||
          (value !== "" && value !== null && value !== undefined),
      ),
    );
  };

  const save = async (syncDoors = false) => {
    if (!canSave) return;

    setSaving(true);
    try {
      const payload = buildPayload(syncDoors);
      if (isEdit) await EmployeeService.update(id, payload);
      else await EmployeeService.create(payload);

      showAlert(t("success"), "success");
      onSaved?.();
      close();
    } catch (err) {
      console.error("Ошибка сохранения сотрудника:", err);
      showAlert(err.response?.data?.error || err.message || t("error"), "error");
      setSaving(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    save(false);
  };

  const educationOptions = [
    { value: "higher", label: t("higherEdu") },
    { value: "secondary", label: t("secondaryEdu") },
    { value: "general", label: t("generalEdu") },
  ];

  const selectField = (name, label, options, { required, disabled, onChange } = {}) => (
    <div className={ui.field}>
      <label className={ui.label} htmlFor={`emp-${name}`}>
        {label} {required && <span className={ui.req}>*</span>}
      </label>
      <div className={styles.selectWrap}>
        <select
          id={`emp-${name}`}
          className={`${ui.input} ${styles.select}`}
          value={form[name] ?? ""}
          onChange={(e) => (onChange ? onChange(e.target.value) : set(name, e.target.value))}
          disabled={disabled}
          required={required}
        >
          <option value="">{t("select")}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className={styles.selectArrow}>
          <IconChevronDown />
        </span>
      </div>
    </div>
  );

  const sectionHead = (icon, tone, title, badge) => (
    <div className={styles.cardHead}>
      <span className={`${styles.cardIcon} ${styles[tone]}`}>{icon}</span>
      <h2 className={styles.cardTitle}>{title}</h2>
      {badge ? <span className={styles.total}>{badge}</span> : null}
    </div>
  );

  return (
    <form className={styles.screen} onSubmit={submit}>
      <div className={styles.topGlass} />

      <header className={styles.head}>
        <h1 className={styles.title}>
          {isEdit ? t("editEmployee") : t("addEmployee")}
        </h1>
        <button type="submit" className={styles.saveBtn} disabled={!canSave}>
          <IconCheck />
          {saving ? t("loading") : t("save")}
        </button>
      </header>

      <div className={styles.scroll}>
        {loading ? (
          <div className={styles.sections}>
            <div className={`${styles.card} ${styles.skHero}`}>
              <span className={styles.skAvatar} />
              <span className={styles.skLine} style={{ width: "50%", height: 16 }} />
            </div>
            <div className={styles.card}>
              <span className={styles.skLine} style={{ width: "30%" }} />
              <span className={styles.skLine} style={{ height: 48 }} />
              <span className={styles.skLine} style={{ width: "30%" }} />
              <span className={styles.skLine} style={{ height: 48 }} />
              <span className={styles.skLine} style={{ width: "30%" }} />
              <span className={styles.skLine} style={{ height: 48 }} />
            </div>
          </div>
        ) : (
          <div className={styles.sections}>
            <section className={`${styles.card} ${styles.hero}`}>
              <div className={styles.avatarWrap}>
                <label className={styles.avatar} htmlFor="emp-photo">
                  {photoUrl ? (
                    <img key={photoUrl} src={photoUrl} alt={fullName} />
                  ) : (
                    <span className={styles.avatarEmpty}>
                      <IconUser />
                    </span>
                  )}
                  <span className={styles.cameraBadge}>
                    <IconCamera />
                  </span>
                </label>
                <input
                  id="emp-photo"
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handlePhoto}
                />
                {photoUrl && (
                  <button
                    type="button"
                    className={styles.photoRemove}
                    aria-label={t("delete")}
                    onClick={removePhoto}
                  >
                    <IconClose />
                  </button>
                )}
              </div>

              <p className={styles.heroName}>
                {fullName || (isEdit ? "—" : t("addEmployee"))}
              </p>
              <p className={styles.heroSub}>
                {[position?.name, department?.name].filter(Boolean).join(" · ") ||
                  (photoUrl ? t("changePhoto") : t("uploadPhoto"))}
              </p>
              {isEdit && (
                <span
                  className={`${styles.statusChip} ${status ? styles.statusOn : styles.statusOff}`}
                >
                  <i />
                  {status ? t("active") : t("terminated")}
                </span>
              )}
            </section>

            <section className={styles.card}>
              {sectionHead(<IconUser />, "toneBlue", t("personalData"))}

              <div className={ui.field}>
                <label className={ui.label} htmlFor="emp-last_name">
                  {t("lastName")} <span className={ui.req}>*</span>
                </label>
                <input
                  id="emp-last_name"
                  className={ui.input}
                  type="text"
                  autoComplete="off"
                  required
                  {...bind("last_name")}
                />
              </div>

              <div className={ui.field}>
                <label className={ui.label} htmlFor="emp-first_name">
                  {t("firstName")} <span className={ui.req}>*</span>
                </label>
                <input
                  id="emp-first_name"
                  className={ui.input}
                  type="text"
                  autoComplete="off"
                  required
                  {...bind("first_name")}
                />
              </div>

              <div className={ui.field}>
                <label className={ui.label} htmlFor="emp-middle_name">
                  {t("middleName")}
                </label>
                <input
                  id="emp-middle_name"
                  className={ui.input}
                  type="text"
                  autoComplete="off"
                  {...bind("middle_name")}
                />
              </div>

              <div className={ui.field}>
                <span className={ui.label}>{t("gender")}</span>
                <div className={styles.segment} role="tablist">
                  {[
                    { value: "male", label: t("male") },
                    { value: "female", label: t("female") },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="tab"
                      aria-selected={form.gender === opt.value}
                      className={`${styles.segmentBtn} ${form.gender === opt.value ? styles.segmentOn : ""}`}
                      onClick={() => set("gender", opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={ui.field}>
                <label className={ui.label} htmlFor="emp-date_of_birth">
                  {t("dateOfBirth")}
                </label>
                <input
                  id="emp-date_of_birth"
                  className={ui.input}
                  type="date"
                  {...bind("date_of_birth")}
                />
              </div>
            </section>

            <section className={styles.card}>
              {sectionHead(<IconIdCard />, "toneAmber", t("documentsTitle"))}

              <div className={ui.field}>
                <label className={ui.label} htmlFor="emp-pinfl">
                  {t("pinfl")} <span className={ui.req}>*</span>
                </label>
                <input
                  id="emp-pinfl"
                  className={ui.input}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  required
                  {...bind("pinfl")}
                />
              </div>

              <div className={ui.grid2}>
                <div className={ui.field}>
                  <label className={ui.label} htmlFor="emp-passport">
                    {t("passport")}
                  </label>
                  <input
                    id="emp-passport"
                    className={ui.input}
                    type="text"
                    autoComplete="off"
                    {...bind("passport")}
                  />
                </div>
                <div className={ui.field}>
                  <label className={ui.label} htmlFor="emp-passport_expiry_date">
                    {t("passportExpiryDate")}
                  </label>
                  <input
                    id="emp-passport_expiry_date"
                    className={ui.input}
                    type="date"
                    {...bind("passport_expiry_date")}
                  />
                </div>
              </div>

              {selectField("education", t("education"), educationOptions)}

              <div className={ui.field}>
                <label className={ui.label} htmlFor="emp-education_specialty">
                  {t("speciality")}
                </label>
                <input
                  id="emp-education_specialty"
                  className={ui.input}
                  type="text"
                  autoComplete="off"
                  {...bind("education_specialty")}
                />
              </div>
            </section>

            <section className={styles.card}>
              {sectionHead(<IconPhone />, "toneGreen", t("contactsTitle"))}

              <div className={ui.field}>
                <label className={ui.label} htmlFor="emp-phone">
                  {t("phoneNumber")}
                </label>
                <input
                  id="emp-phone"
                  className={ui.input}
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  {...bind("phone")}
                />
              </div>

              <div className={ui.field}>
                <label className={ui.label} htmlFor="emp-address">
                  {t("address")}
                </label>
                <input
                  id="emp-address"
                  className={ui.input}
                  type="text"
                  autoComplete="off"
                  {...bind("address")}
                />
              </div>
            </section>

            <section className={styles.card}>
              {sectionHead(<IconBriefcase />, "tonePurple", t("jobTitle"))}

              {showPlacement && (
                <>
                  {meta.branches.length !== 1 &&
                    selectField(
                      "branch_id",
                      t("branch"),
                      meta.branches.map((b) => ({ value: b.id, label: b.name })),
                      { required: true },
                    )}

                  {selectField(
                    "department_id",
                    t("department"),
                    departments.map((d) => ({ value: d.id, label: d.name })),
                    { required: true, disabled: form.branch_id === "" },
                  )}

                  <div className={ui.field}>
                    <span className={ui.label}>
                      {t("position")} <span className={ui.req}>*</span>
                    </span>
                    <button
                      type="button"
                      className={`${ui.input} ${styles.pickBtn}`}
                      onClick={() => setPick("position")}
                    >
                      <span className={position ? "" : styles.pickPlaceholder}>
                        {position?.name || t("select")}
                      </span>
                      <span className={styles.selectArrow}>
                        <IconChevronDown />
                      </span>
                    </button>
                  </div>

                  <div className={ui.grid2}>
                    <div className={ui.field}>
                      <label className={ui.label} htmlFor="emp-order_number">
                        {t("orderNumber")}
                      </label>
                      <input
                        id="emp-order_number"
                        className={ui.input}
                        type="text"
                        autoComplete="off"
                        {...bind("order_number")}
                      />
                    </div>
                    <div className={ui.field}>
                      <label className={ui.label} htmlFor="emp-order_date">
                        {t("orderDate")} <span className={ui.req}>*</span>
                      </label>
                      <input
                        id="emp-order_date"
                        className={ui.input}
                        type="date"
                        required
                        {...bind("order_date")}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className={ui.field}>
                <label className={ui.label} htmlFor="emp-employee_number">
                  {t("employeeNumber")}
                </label>
                <input
                  id="emp-employee_number"
                  className={ui.input}
                  type="text"
                  autoComplete="off"
                  {...bind("employee_number")}
                />
              </div>

              {selectField(
                "work_schedule_id",
                t("workSchedule"),
                meta.schedules.map((s) => ({ value: s.id, label: s.name })),
                { onChange: changeSchedule },
              )}

              {scheduleChanged && (
                <div className={ui.field}>
                  <label className={ui.label} htmlFor="emp-work_schedule_start_date">
                    {t("workScheduleStartDate")} <span className={ui.req}>*</span>
                  </label>
                  <input
                    id="emp-work_schedule_start_date"
                    className={ui.input}
                    type="date"
                    required
                    {...bind("work_schedule_start_date")}
                  />
                </div>
              )}
            </section>

            <section className={styles.card}>
              {sectionHead(
                <IconDoor />,
                "toneBlue",
                t("doors"),
                selectedDoors.length || null,
              )}

              {selectedDoors.length > 0 && (
                <ul className={styles.doorList}>
                  {selectedDoors.map((door) => (
                    <li key={door.id} className={styles.doorChip}>
                      <span>{door.name}</span>
                      <button
                        type="button"
                        aria-label={t("delete")}
                        onClick={() =>
                          set(
                            "door_ids",
                            form.door_ids.filter((d) => d !== Number(door.id)),
                          )
                        }
                      >
                        <IconClose />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <button
                type="button"
                className={styles.addDoorBtn}
                onClick={() => setPick("doors")}
                disabled={meta.doors.length === 0}
              >
                <IconPlus />
                {t("doors")}
              </button>

              {meta.doors.length > 0 && (
                <button
                  type="button"
                  className={`${ui.btn} ${ui.btnSecondary} ${styles.syncBtn}`}
                  disabled={!canSave}
                  onClick={() => save(true)}
                >
                  <IconRefresh />
                  {t("syncWithDoor")}
                </button>
              )}
            </section>
          </div>
        )}
      </div>

      <TgPickSheet
        isOpen={pick === "position"}
        onClose={() => setPick(null)}
        title={t("position")}
        single
        options={meta.positions.map((p) => ({ id: p.id, title: p.name }))}
        selected={form.position_id === "" ? [] : [form.position_id]}
        onChange={(ids) => set("position_id", ids[0] ?? "")}
      />

      <TgPickSheet
        isOpen={pick === "doors"}
        onClose={() => setPick(null)}
        title={t("doors")}
        options={meta.doors.map((d) => ({ id: Number(d.id), title: d.name }))}
        selected={form.door_ids}
        onChange={(ids) => set("door_ids", ids)}
      />
    </form>
  );
};

export default EmployeeFormScreenTelegram;
