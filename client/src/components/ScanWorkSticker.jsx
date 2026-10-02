import { useState, useRef, useEffect, useCallback, useId, forwardRef, useImperativeHandle } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { useProductionAccess } from "../hooks/useProductionAccess";
import {
  getWorkStickers,
  getWorkStickerByCode,
  scanWorkSticker,
  revertWorkSticker,
  deleteWorkStickerById,
  getActiveOperationTypes,
  getEmployeeTeams,
  EmployeeService,
  mergeWorkStickers,
  setStickerAwaitingMerge,
} from "../api";
import { fmtNum, fmtQty, fmtInputValue, sanitizeNumericInput, roundQty, qtyToString, goodQuantity } from "../utils/quantity";

import EmployeeSelect from "./EmployeeSelect";
import TeamSelect from "./TeamSelect";
import TeamManageModal from "./TeamManageModal";
import ScanModeSelect from "./ScanModeSelect";
import SegmentedGroup from "./SegmentedGroup";
import CenterModal from "./CenterModal";
import PrintableStickerList, { PrintAllButton } from "./PrintableStickerList";
import WorkStickerRoutePanel, {
  AcceptedSummary,
  canDistribute,
  SectionHead,
  OperationChoice,
  nextOperationCandidates,
  nextOperationOptions,
} from "./WorkStickerRoutePanel";
import { Icons } from "../icons/icons";
import { IconChevronDown, IconUserPlus } from "./tg/tgIcons";
import { isTouchDevice } from "../utils/telegramScan";
import { playScanSound } from "../utils/scanSound";
import { parseEmployeeStickerCode } from "../utils/employeeSticker";
import { useCameraScanner } from "../hooks/useCameraScanner";
import routeStyles from "./WorkStickerRoutePanel.module.scss";
import styles from "./ScanWorkSticker.module.scss";

// Три порядка приёма: "sticker" — сначала скан, сотрудник выбирается в карточке;
// "employee" — сотрудник выбирается один раз и остаётся, пока его не сменят
// (у одного сотрудника много стикеров подряд); "team" — так же, но выбирается
// команда целиком: её состав автоматически становится сотрудниками стикера
// с равными долями (как при ручном выборе команды, только сразу при скане).
const SCAN_MODE_KEY = "workAcceptanceScanMode";

// Группа объединения с большим числом стикеров: список кодов свёрнут за кнопкой «Показать».
const MERGE_LIST_COLLAPSE_FROM = 10;

const readScanMode = () => {
  try {
    const saved = localStorage.getItem(SCAN_MODE_KEY);
    return saved === "employee" || saved === "team" ? saved : "sticker";
  } catch {
    return "sticker";
  }
};

// У типа операции задан список допущенных сотрудников — при приёме показываем
// только их; пустой список = тип доступен всем.
const isEmployeeAllowed = (employeeId, operationType) => {
  const allowed = operationType?.employees || [];
  return allowed.length === 0 || allowed.some((e) => String(e.employee_id) === String(employeeId));
};

const filterAllowedEmployees = (employees, operationType) =>
  employees.filter((emp) => isEmployeeAllowed(emp.id, operationType));

const fullName = (person) =>
  [person?.last_name, person?.first_name, person?.middle_name].filter(Boolean).join(" ");

const formatDateTime = (value) => (value ? new Date(value).toLocaleString("ru-RU") : "—");

// Доли команды: делим нацело по штукам (шаг 1, не 0.0001 — иначе остаток
// размазывается по десятитысячным вместо целой штуки). Если не делится
// поровну, лишние штуки — последним в списке (13491 на двоих: 6745 и 6746,
// а не 6745,5 каждому). Основной (не в этом списке) получает остальное.
const evenCoWorkerShares = (total, coWorkerCount) => {
  const UNIT = 1;
  const count = coWorkerCount + 1;
  const totalUnits = Math.round(total / UNIT);
  const baseUnits = Math.floor(totalUnits / count);
  const remainderUnits = totalUnits - baseUnits * count;
  return Array.from({ length: coWorkerCount }, (_, i) => {
    const fromEnd = coWorkerCount - i;
    const extra = fromEnd <= remainderUnits ? 1 : 0;
    return qtyToString((baseUnits + extra) * UNIT);
  });
};

// dockNode — DOM-узел закреплённого низа страницы (Telegram): кнопки «Принять» и
// «Раздать дальше» уходят порталом туда, чтобы быть всегда внизу экрана на сплошном
// фоне, а не плавать поверх прокручиваемой формы. Нет узла — кнопки остаются на месте.
// compact — телефонный вид (Telegram): короткая подпись количества в форме приёма и
// команда выбирается только селектом, без плиток.
const ScanWorkSticker = forwardRef(({ onDone, stickerTemplate, canDelete, onMergeModeChange, topBarExtra, dockNode, compact = false }, ref) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const { canUseOperation } = useProductionAccess();
  // Кнопка «Принять» может лежать вне <form> (в док-панели) — связываем по id.
  const acceptFormId = useId();
  const dock = (node) => (dockNode ? createPortal(node, dockNode) : node);

  const [mode, setMode] = useState(readScanMode);
  const byEmployee = mode === "employee";
  const byTeam = mode === "team";

  const [scanValue, setScanValue] = useState("");
  const [looking, setLooking] = useState(false);
  const [sticker, setSticker] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState("");
  // "Сначала команда": команда выбирается один раз и остаётся, пока её не сменят
  // (как employeeId в режиме "сначала сотрудник", только состав целиком).
  const [fixedTeamId, setFixedTeamId] = useState("");
  const [defectQuantity, setDefectQuantity] = useState("");
  const [defectQuantityFocused, setDefectQuantityFocused] = useState(false);
  const [reworkQuantity, setReworkQuantity] = useState("");
  const [reworkQuantityFocused, setReworkQuantityFocused] = useState(false);
  // «Не выполнено» — только у операций с allow_incomplete (см. AddOperationType).
  const [incompleteQuantity, setIncompleteQuantity] = useState("");
  const [incompleteQuantityFocused, setIncompleteQuantityFocused] = useState(false);
  // Другие сотрудники, выполнявшие работу вместе с основным: [{ key, employeeId, quantity }].
  // Основному остаётся выполненное минус их доли.
  const [coWorkers, setCoWorkers] = useState([]);
  // Чья строка сейчас в фокусе — только у неё показываем сырой ввод, у
  // остальных, как у брака/исправления/цены, сгруппированный формат.
  const [focusedWorkerKey, setFocusedWorkerKey] = useState(null);
  const workerKeyRef = useRef(0);
  // Команды типа операции — кэш по operation_type_id: тип у стикеров подряд
  // часто один и тот же, не перезапрашиваем.
  const [teamsByType, setTeamsByType] = useState({});
  // "Командная работа": вместо ручного набора долей — вся команда сразу,
  // распределение количества между её участниками считается поровну само.
  const [teamWork, setTeamWork] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  // Модалка «создать / править команды» типа операции стикера.
  const [teamsModalOpen, setTeamsModalOpen] = useState(false);
  const [rate, setRate] = useState("");
  const [rateFocused, setRateFocused] = useState(false);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const [operationTypes, setOperationTypes] = useState([]);
  // Стикеры, созданные последним "Раздать дальше" — карточка с печатью остаётся
  // на экране до следующего скана / закрытия.
  const [advanced, setAdvanced] = useState(null); // {code, stickers} | null
  const [backConfirm, setBackConfirm] = useState(false);

  // Режим объединения: сканы не открывают карточку приёма/раздачи, а копятся в
  // mergeBucket (принятые, не разданные стикеры одной операции/партии/размера) —
  // см. operation_types.allow_merge.
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeBucket, setMergeBucket] = useState([]);
  // Выбранная след. операция на группу (см. mergeGroups) — у разных партий/размеров
  // разная следующая операция может быть настроена по-разному.
  const [mergeTargetByGroup, setMergeTargetByGroup] = useState({});
  const [mergeSavingKey, setMergeSavingKey] = useState(null); // ключ группы, что сейчас объединяется
  const [mergeExpanded, setMergeExpanded] = useState({}); // {ключ группы: true} — развёрнутый длинный список
  const [mergeCompletedResults, setMergeCompletedResults] = useState([]); // [{key, stickers}]
  const [cancelMergeConfirm, setCancelMergeConfirm] = useState(false);

  const scanInputRef = useRef(null);
  const touch = isTouchDevice();
  const camera = useCameraScanner();

  // Сканер "печатает" в поле — возвращаем в него фокус (кроме сенсорных устройств, см. isTouchDevice).
  const focusScan = useCallback(() => {
    if (!touch) scanInputRef.current?.focus();
  }, [touch]);

  useEffect(() => {
    focusScan();
    EmployeeService.getActive()
      .then((res) => setEmployees(res.data || []))
      .catch((err) => console.error(err));
    getActiveOperationTypes()
      .then((res) => setOperationTypes(res.data || []))
      .catch((err) => console.error(err));
  }, [focusScan]);

  // Сканер "печатает" в поле, поэтому пока стикер не открыт, фокус возвращаем в
  // поле после клика по странице. Раньше это делал onBlur — он отбирал фокус
  // на mousedown, и выделить/скопировать номер стикера в таблице или списке
  // было невозможно. Теперь решаем на mouseup: есть выделенный текст или
  // пользователь в другом поле ввода — фокус не трогаем.
  useEffect(() => {
    // Карточка открыта и поле заблокировано — фокус не нужен; после раздачи
    // (advanced) поле снова свободно для следующего скана.
    if (sticker && !advanced) return;

    const refocus = () => {
      setTimeout(() => {
        if (window.getSelection()?.toString()) return;
        const active = document.activeElement;
        const editing =
          active &&
          active !== scanInputRef.current &&
          (/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) || active.isContentEditable);
        if (!editing) focusScan();
      }, 0);
    };

    document.addEventListener("mouseup", refocus);
    return () => document.removeEventListener("mouseup", refocus);
  }, [sticker, advanced, focusScan]);

  const reset = useCallback(() => {
    setSticker(null);
    // "Сначала сотрудник": выбранный сотрудник переживает сброс карточки.
    if (!byEmployee) setEmployeeId("");
    setDefectQuantity("");
    setReworkQuantity("");
    setIncompleteQuantity("");
    setCoWorkers([]);
    setTeamWork(false);
    setSelectedTeamId("");
    setTeamsModalOpen(false);
    setRate("");
    setComment("");
    setScanValue("");
    setAdvanced(null);
    setTimeout(focusScan, 0);
  }, [byEmployee, focusScan]);

  const handleModeChange = (next) => {
    if (next === mode) return;
    try {
      localStorage.setItem(SCAN_MODE_KEY, next);
    } catch {
      // Приватный режим / заблокированное хранилище — режим просто не запомнится.
    }
    setMode(next);
    reset();
    // Сотрудник/команда прежнего режима не должны просочиться в другой режим
    // (reset из старого режима мог их оставить).
    setEmployeeId("");
    setFixedTeamId("");
  };

  // Сканер "печатает" в поле — после выбора команды сразу возвращаем фокус в него.
  const handleFixedTeamChange = (id) => {
    setFixedTeamId(id);
    setTimeout(focusScan, 0);
  };

  // Сканер "печатает" в поле — после выбора сотрудника сразу возвращаем фокус в него.
  const handleFixedEmployeeChange = (id) => {
    setEmployeeId(id);
    setTimeout(focusScan, 0);
  };

  // Стикер сотрудника (см. employeeSticker.js) в режиме "Сначала сотрудник" выбирает
  // сотрудника вместо списка; им же меняют сотрудника между стикерами работы.
  const handleEmployeeSticker = (scannedId) => {
    setScanValue("");
    if (!byEmployee) {
      showAlert(t("workAcceptanceEmployeeStickerWrongMode"), "error");
      return;
    }
    // Список — активные сотрудники в доступе логина: уволенный / чужой стикер не подходит.
    if (!employees.some((emp) => String(emp.id) === scannedId)) {
      showAlert(t("workAcceptanceEmployeeStickerUnknown"), "error");
      return;
    }
    handleFixedEmployeeChange(scannedId);
  };

  // Показывает карточку принятого (done) стикера. Если есть что раздавать —
  // рядом с ней распределение: следующая операция, операция для исправления,
  // стикер брака (WorkStickerRoutePanel). Иначе (последняя операция без
  // исправления и брака) — просто итог и кнопка "Вернуть" (отменить приём, пока
  // стикер не разделён дальше). Возвращает true, если распределение открыто.
  const openStickerCard = (data) => {
    setSticker(data);
    return canDistribute(data);
  };

  // Открыть уже принятый стикер из истории — как будто его только что
  // отсканировали: если не раздан, появится распределение. Раздан дальше —
  // под карточкой список стикеров, на которые он разделён (children).
  useImperativeHandle(ref, () => ({
    openSticker: (data, children = []) => {
      setAdvanced(children.length > 0 ? { code: data.sticker_code, stickers: children } : null);
      // Раздан — поле скана свободно для следующего стикера; иначе показывает код.
      setScanValue(children.length > 0 ? "" : data.sticker_code);
      openStickerCard(data);
    },
    // Ждущий скана стикер из списка: полный путь скана по коду (проверки допуска,
    // цена, состав команды) — как будто код только что считали.
    scanCode: (code) => {
      setScanValue(code);
      openByCode(code);
    },
  }));

  const handleScanKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();

    const code = scanValue.trim();
    if (!code || looking) return;

    openByCode(code);
  };

  // Поиск стикера по коду и открытие нужной карточки (приём / распределение) —
  // общий путь для скана и для "Вернуть" (после отката стикер снова pending и
  // открывается как только что считанный).
  const openByCode = async (code) => {
    // Режим объединения без скана: в очередь стикер попадает при приёме работы
    // ("Объединить с другими стикерами"), там же разносятся брак и исправление.
    // Сюда доходит только scanCode (список ждущих в Telegram) — поле и камера заблокированы.
    if (mergeMode) {
      showAlert(t("workStickerMergeScanOff"), "error");
      setScanValue("");
      return;
    }

    const scannedEmployeeId = parseEmployeeStickerCode(code);
    if (scannedEmployeeId) {
      handleEmployeeSticker(scannedEmployeeId);
      return;
    }

    // Поле скана открыто и без сотрудника (им может быть стикер сотрудника) —
    // а стикер работы без сотрудника принять нельзя.
    if (byEmployee && !employeeId) {
      showAlert(t("workAcceptanceScanEmployeeSticker"), "error");
      setScanValue("");
      return;
    }

    setLooking(true);
    try {
      const res = await getWorkStickerByCode(code);
      if (!res?.success) throw new Error();
      const data = res.data;

      // Операция стикера не входит в доступные логину (задаёт администратор).
      if (!canUseOperation(data.operation_type_id ?? data.operationType?.id)) {
        showAlert(t("productionOperationForbidden"), "error");
        setScanValue("");
        return;
      }

      // Доля другого сотрудника: стикером работают через основной.
      if (data.share_of_id) {
        showAlert(t("workStickerIsShare"), "error");
        setScanValue("");
        return;
      }

      if (data.status === "done") {
        // Раздан дальше — не ошибка, а то же, что клик в истории: карточка и под
        // ней стикеры, на которые он разделён (см. openSticker).
        if ((data.children?.length || 0) > 0) {
          const { data: children } = await getWorkStickers({
            pageSize: 500,
            filters: { parent_sticker_id: data.id },
          });
          setAdvanced({ code: data.sticker_code, stickers: children || [] });
          setScanValue("");
          openStickerCard(data);
          return;
        }
        setAdvanced(null);
        openStickerCard(data);
        return;
      }

      if (data.status !== "pending") {
        // Брак — конечный статус, а не "принят": иначе оператор ищет принятый
        // стикер, которого в истории нет.
        showAlert(t(data.status === "scrapped" ? "workStickerScrapped" : "workStickerAlreadyDone"), "error");
        setScanValue("");
        return;
      }

      // Сотрудник выбран до скана — тип операции стикера мог его не допускать
      // (сервер отклонит приём), говорим сразу, а не после заполнения карточки.
      if (byEmployee && !isEmployeeAllowed(employeeId, data.operationType)) {
        showAlert(t("workAcceptanceEmployeeNotAllowed"), "error");
        setScanValue("");
        return;
      }

      // Команда выбрана до скана — она привязана к своему типу операции, стикер
      // другой операции ей не подходит; так же проверяем состав на допуск.
      let teamMemberIds = [];
      if (byTeam) {
        const stickerOperationTypeId = data.operation_type_id ?? data.operationType?.id;
        if (!fixedTeam || Number(fixedTeam.operation_type_id) !== Number(stickerOperationTypeId)) {
          showAlert(t("workAcceptanceTeamOperationMismatch"), "error");
          setScanValue("");
          return;
        }

        const allowedIds = new Set(filterAllowedEmployees(employees, data.operationType).map((e) => String(e.id)));
        teamMemberIds = (fixedTeam.members || [])
          .map((m) => String(m.employee_id))
          .filter((id) => allowedIds.has(id));
        if (teamMemberIds.length === 0) {
          showAlert(t("workAcceptanceEmployeeNotAllowed"), "error");
          setScanValue("");
          return;
        }
      }

      setAdvanced(null);
      setSticker(data);
      setDefectQuantity("");
      setReworkQuantity("");
      setIncompleteQuantity("");
      setRate(data.rate !== null && data.rate !== undefined ? String(data.rate) : "");

      if (byTeam) {
        // Состав команды: первый — основной, остальные — со своей долей (как при
        // ручном выборе команды через handleTeamSelect, только сразу при скане).
        const [mainId, ...restIds] = teamMemberIds;
        setEmployeeId(mainId || "");
        setTeamWork(true);
        setSelectedTeamId(fixedTeamId);
        setCoWorkers(
          restIds.map((id) => {
            workerKeyRef.current += 1;
            return { key: workerKeyRef.current, employeeId: id, quantity: "" };
          }),
        );
      } else {
        setCoWorkers([]);
        setTeamWork(false);
        setSelectedTeamId("");
      }
    } catch (err) {
      showAlert(err?.response?.data?.error || t("workStickerNotFound"), "error");
      setScanValue("");
    } finally {
      setLooking(false);
      // Поле блокировалось на время запроса и потеряло фокус — возвращаем для
      // следующего скана (если карточка открылась, поле disabled и это no-op).
      setTimeout(focusScan, 0);
    }
  };

  const handleAcceptSubmit = async (e) => {
    e.preventDefault();
    if (saving || !sticker) return;

    if (!employeeId) {
      showAlert(t("selectEmployee"), "error");
      return;
    }
    // Брак и исправление вместе больше количества на стикере — не сохраняем и
    // говорим об этом (то же проверяет сервер).
    if (blockError) {
      showAlert(blockError, "error");
      return;
    }

    setSaving(true);
    try {
      const res = await scanWorkSticker(sticker.sticker_code, {
        employee_id: employeeId,
        actual_quantity: qtyToString(actualNum),
        defect_quantity: defectQuantity,
        rework_quantity: reworkQuantity,
        incomplete_quantity: allowIncomplete ? incompleteQuantity : "",
        co_workers: coWorkers.map((worker) => ({ employee_id: worker.employeeId, quantity: worker.quantity })),
        rate,
        comment,
      });
      if (!res?.success) throw new Error(res?.error || t("error"));

      onDone?.();
      const hasDistribution = openStickerCard(res.data);
      showAlert(t("success"), "success");
      // "Сначала сотрудник"/"Сначала команда": стикеров подряд много — раздавать
      // дальше нечего, сразу готовы к следующему скану, без закрытия карточки вручную.
      if ((byEmployee || byTeam) && !hasDistribution) reset();
    } catch (err) {
      showAlert(err?.response?.data?.error || err.message || t("error"), "error");
    } finally {
      setSaving(false);
    }
  };

  // Отмена приёма — стикер возвращается в pending. Карточку не закрываем, а
  // открываем заново как только что считанный: выбор сотрудника, брак и
  // исправление — снова форма приёма. Только пока не раздан дальше.
  const handleRevert = async () => {
    if (saving || !sticker) return;

    const code = sticker.sticker_code;
    setSaving(true);
    try {
      const res = await revertWorkSticker(code);
      if (!res?.success) throw new Error(res?.error || t("error"));

      onDone?.();
      showAlert(t("success"), "success");
      // reset чистит введённое (брак, доли, команду) — форма приёма пустая;
      // код возвращаем в поле, как после обычного скана.
      reset();
      setScanValue(code);
      await openByCode(code);
    } catch (err) {
      showAlert(err?.response?.data?.error || err.message || t("error"), "error");
    } finally {
      setSaving(false);
    }
  };

  // Приём: стикер делится на выполнено (= годное), брак, исправление и — если
  // операция разрешает — не выполнено. Остальное вводят вручную, "Выполнено"
  // считается само — всё, что осталось от количества стикера, поэтому остатка не
  // бывает. Части вместе не больше количества стикера — иначе ошибка сразу при
  // вводе, до "Принять". Операцию для исправления и не выполненных выбирают после
  // приёма, при раздаче.
  const allowIncomplete = Boolean(sticker?.operationType?.allow_incomplete);
  const stickerQty = Number(sticker?.planned_quantity) || 0;
  const defectNum = Number(defectQuantity) || 0;
  const reworkNum = Number(reworkQuantity) || 0;
  const incompleteNum = allowIncomplete ? Number(incompleteQuantity) || 0 : 0;
  const actualNum = Math.max(roundQty(stickerQty - defectNum - reworkNum - incompleteNum), 0);
  const maxDefect = Math.max(roundQty(stickerQty - reworkNum - incompleteNum), 0);
  const maxRework = Math.max(roundQty(stickerQty - defectNum - incompleteNum), 0);
  const maxIncomplete = Math.max(roundQty(stickerQty - defectNum - reworkNum), 0);
  const defectOver = defectNum - maxDefect > 0.0001;
  const reworkOver = reworkNum - maxRework > 0.0001;
  const incompleteOver = incompleteNum - maxIncomplete > 0.0001;
  const quantityError =
    defectOver || reworkOver || incompleteOver
      ? t("workStickerQuantityExceedsMax", { max: fmtQty(stickerQty) })
      : "";

  // Несколько сотрудников: доли остальных вводят вручную, основному остаётся
  // выполненное минус они. Не сохраняем, пока у каждой доли нет сотрудника и
  // количества, сотрудники повторяются или основному ничего не осталось.
  const coTotal = roundQty(coWorkers.reduce((sum, worker) => sum + (Number(worker.quantity) || 0), 0));
  const primaryShare = roundQty(actualNum - coTotal);
  const pickedIds = [employeeId, ...coWorkers.map((worker) => worker.employeeId)].filter(Boolean).map(String);
  const workersError =
    coWorkers.length === 0
      ? ""
      : coWorkers.some((worker) => !worker.employeeId || !(Number(worker.quantity) > 0))
        ? t("workAcceptanceWorkerIncomplete")
        : new Set(pickedIds).size !== pickedIds.length
          ? t("workAcceptanceWorkerDuplicate")
          : !(primaryShare > 0.0001)
            ? t("workAcceptanceWorkersExceed", { max: fmtQty(actualNum) })
            : "";
  const blockError = quantityError || workersError;
  // Сотрудников много (большая команда) — список в две колонки, а не в одну длинную.
  const compactWorkers = coWorkers.length + 1 >= 4;
  // Поле доли по ширине значения: число символов уходит в CSS (--qty-ch), там же
  // добавляются отступы. Минимум — два знака, запас — полсимвола (пробелы в "5 000" уже цифр).
  const qtyBoxStyle = (text) => ({ "--qty-ch": Math.max(String(text ?? "").length, 2) + 0.5 });

  // Кого можно выбрать в строке: допущенные к операции и ещё не выбранные в других строках.
  const employeesFor = (currentId) =>
    filterAllowedEmployees(employees, sticker?.operationType).filter(
      (emp) => String(emp.id) === String(currentId) || !pickedIds.includes(String(emp.id)),
    );
  // Командная работа: список не только из состава команды — можно дописать
  // ещё одного вручную (новая строка встаёт в конец, долю пересчитает эффект).
  const addCoWorker = () => {
    workerKeyRef.current += 1;
    setCoWorkers((prev) => [...prev, { key: workerKeyRef.current, employeeId: "", quantity: "" }]);
  };
  const updateCoWorker = (key, patch) =>
    setCoWorkers((prev) => prev.map((worker) => (worker.key === key ? { ...worker, ...patch } : worker)));
  const removeCoWorker = (key) => setCoWorkers((prev) => prev.filter((worker) => worker.key !== key));
  // Убрать основного — освободившееся место занимает первый из команды (как при
  // выборе команды), а если больше никого нет — основного просто выбирают заново.
  const removePrimary = () => {
    if (coWorkers.length === 0) {
      setEmployeeId("");
      return;
    }
    const [next, ...rest] = coWorkers;
    setEmployeeId(next.employeeId);
    setCoWorkers(rest);
  };

  // Команды типа операции стикера: выбираются здесь же, создаются/правятся в модалке
  // (TeamManageModal) или у самого типа операции.
  const operationTypeId = sticker?.operationType?.id ?? null;
  const availableTeams = operationTypeId ? teamsByType[operationTypeId] || [] : [];
  // Кнопка настройки типа операции (модалка) — универсальная: допущенные сотрудники всегда, команды —
  // только в «Командной работе» (в режиме «Сотрудник» команд не показываем). Командная работа у типа
  // разрешена, когда у него есть команды (без них нет и переключателя, teamWork не включить): нет
  // команд — кнопка остаётся, но в модалке только сотрудники; первую команду создают у типа операции.
  // «Сначала команда»: команда выбрана наверху, из этой карточки её не правим — кнопки нет.
  const canManage = !byTeam && Boolean(operationTypeId);
  const manageWithTeams = teamWork;
  const manageLabel = manageWithTeams ? t("workAcceptanceManageTeamsEmployees") : t("workAcceptanceOperationEmployees");

  useEffect(() => {
    if (!operationTypeId || teamsByType[operationTypeId]) return;
    getEmployeeTeams(operationTypeId)
      .then((res) => setTeamsByType((prev) => ({ ...prev, [operationTypeId]: res.data || [] })))
      .catch((err) => console.error(err));
  }, [operationTypeId, teamsByType]);

  // "Сначала команда": какую команду выбрать, неизвестно заранее — подгружаем
  // команды всех типов операций сразу, чтобы заполнить общий список выбора.
  useEffect(() => {
    if (!byTeam) return;
    operationTypes.forEach((ot) => {
      if (teamsByType[ot.id]) return;
      getEmployeeTeams(ot.id)
        .then((res) => setTeamsByType((prev) => ({ ...prev, [ot.id]: res.data || [] })))
        .catch((err) => console.error(err));
    });
  }, [byTeam, operationTypes, teamsByType]);

  // Выбранная в режиме "сначала команда" команда — ищем во всех уже
  // загруженных командах (тип операции наперёд неизвестен).
  const fixedTeam =
    byTeam && fixedTeamId
      ? Object.values(teamsByType)
          .flat()
          .find((tm) => String(tm.id) === String(fixedTeamId))
      : null;

  // "Командная работа": включили — состав задаётся выбором команды целиком (не
  // построчным добавлением), доли считаются поровну сами. Переключение туда и
  // обратно сбрасывает уже выбранных — старый выбор от одного режима к другому
  // не переносим. "Сначала сотрудник": основной зафиксирован вверху, его не трогаем.
  const handleTeamWorkToggle = (checked) => {
    setTeamWork(checked);
    setSelectedTeamId("");
    setCoWorkers([]);
    if (!byEmployee) setEmployeeId("");
  };

  // Выбор команды в режиме "командная работа" заменяет состав целиком. Основной —
  // участник команды (в "сначала сотрудник" им остаётся уже выбранный сверху),
  // остальные — co-workers с равной долей.
  // teams — откуда брать команду: по умолчанию загруженные, после сохранения в модалке — свежий список.
  // allowedIds — допущенные к операции вместо тех, что в открытом стикере (модалка только что их сохранила,
  // а стикер в этом замыкании ещё старый); null — брать из стикера.
  const handleTeamSelect = (teamId, teams = availableTeams, allowedIds = null) => {
    setSelectedTeamId(teamId);
    const team = teams.find((tm) => String(tm.id) === String(teamId));
    if (!team) {
      setCoWorkers([]);
      return;
    }

    const operationType = allowedIds
      ? { employees: allowedIds.map((employee_id) => ({ employee_id })) }
      : sticker?.operationType;
    const allowedSet = new Set(filterAllowedEmployees(employees, operationType).map((e) => String(e.id)));
    const memberIds = (team.members || []).map((m) => String(m.employee_id)).filter((id) => allowedSet.has(id));

    let mainId = String(employeeId);
    if (!byEmployee) {
      mainId = memberIds.includes(mainId) ? mainId : memberIds[0] || "";
      if (mainId) setEmployeeId(mainId);
    }

    const restIds = memberIds.filter((id) => id !== mainId);
    const shares = evenCoWorkerShares(actualNum, restIds.length);
    setCoWorkers(
      restIds.map((id, i) => {
        workerKeyRef.current += 1;
        return { key: workerKeyRef.current, employeeId: id, quantity: shares[i] ?? "" };
      }),
    );
  };

  // Сохранили команду в модалке: обновляем кэш команд типа и сразу берём её в работу —
  // включаем «Командную работу» и выбираем эту команду (состав перечитывается заново,
  // если правили ту, что уже была выбрана).
  const handleTeamsSaved = (teams, savedId, allowedIds) => {
    setTeamsByType((prev) => ({ ...prev, [operationTypeId]: teams }));
    if (!savedId) return;
    setTeamWork(true);
    handleTeamSelect(savedId, teams, allowedIds);
  };

  // Сохранили «Сотрудники, выполняющие операцию»: обновляем тип у открытого стикера — по нему
  // фильтруются списки сотрудников и составы команд (filterAllowedEmployees).
  const handleOperationEmployeesSaved = (ids) =>
    setSticker((prev) =>
      prev
        ? { ...prev, operationType: { ...prev.operationType, employees: ids.map((employee_id) => ({ employee_id })) } }
        : prev,
    );

  // У типа операции одна команда — выбирать не из чего: подставляем её сразу, как
  // только включили "Командную работу" (или команды подгрузились).
  useEffect(() => {
    if (!teamWork || selectedTeamId || availableTeams.length !== 1) return;
    handleTeamSelect(availableTeams[0].id);
  }, [teamWork, selectedTeamId, availableTeams]);

  // Брак/исправление меняют "выполнено" уже после выбора команды — доли
  // пересчитываем поровну заново. Основному ничего считать не надо: его доля и
  // так автоматика (primaryShare = actualNum минус доли команды).
  useEffect(() => {
    if (!teamWork || coWorkers.length === 0) return;
    const shares = evenCoWorkerShares(actualNum, coWorkers.length);
    setCoWorkers((prev) =>
      prev.every((worker, i) => worker.quantity === shares[i])
        ? prev
        : prev.map((worker, i) => ({ ...worker, quantity: shares[i] })),
    );
  }, [teamWork, coWorkers.length, actualNum]);

  // Поля разложения стикера — одним списком: подпись, ошибка, тон.
  // "Выполнено" — auto: только показывает посчитанное, вводить в него нельзя.
  const splitFields = [
    {
      key: "actual",
      toneClass: styles.toneGood,
      label: t("workStickerActualQuantity"),
      auto: true,
      value: qtyToString(actualNum),
    },
    {
      key: "rework",
      toneClass: styles.toneWarn,
      label: t("workStickerReworkQuantity"),
      value: reworkQuantity,
      setValue: setReworkQuantity,
      focused: reworkQuantityFocused,
      setFocused: setReworkQuantityFocused,
      over: reworkOver,
    },
    ...(allowIncomplete
      ? [
          {
            key: "incomplete",
            toneClass: styles.toneInfo,
            label: t("workStickerIncompleteQuantity"),
            value: incompleteQuantity,
            setValue: setIncompleteQuantity,
            focused: incompleteQuantityFocused,
            setFocused: setIncompleteQuantityFocused,
            over: incompleteOver,
          },
        ]
      : []),
    // Брак — в конце: основные поля (исправление / не выполнено) идут раньше.
    {
      key: "defect",
      toneClass: styles.toneBad,
      label: t("workStickerDefectQuantity"),
      value: defectQuantity,
      setValue: setDefectQuantity,
      focused: defectQuantityFocused,
      setFocused: setDefectQuantityFocused,
      over: defectOver,
    },
  ];

  // Удалили стикер из созданных (значок корзины в строке) — список убирает его.
  // Не осталось ни одного — стикер снова "не распределён": справа возвращается
  // распределение. Историю обновляем (у родителя стало меньше детей).
  const handleAdvancedDeleted = (ids) => {
    const rest = (advanced?.stickers || []).filter((s) => !ids.includes(s.id));
    if (rest.length > 0) {
      setAdvanced({ ...advanced, stickers: rest });
    } else {
      setAdvanced(null);
      setSticker((prev) => (prev ? { ...prev, children: [] } : prev));
      releaseAwaitingMerge();
    }
    onDone?.();
  };

  // Стикеры брака/исправления убрали целиком — у стикера, чьё годное ждало объединения,
  // отметка тоже снимается: распределение снова открыто, как у только принятого.
  // Отметку сервер снимает только у стикера без детей, поэтому — после удаления.
  const releaseAwaitingMerge = async () => {
    if (!sticker?.awaiting_merge || sticker.merged_into_id) return;
    try {
      const { success, data } = await setStickerAwaitingMerge(sticker.sticker_code, false);
      if (success) setSticker(data);
    } catch (err) {
      showAlert(err?.response?.data?.error || t("error"), "error");
    }
    onDone?.();
  };

  // Раздали дальше (WorkStickerRoutePanel): слева остаются данные стикера, справа
  // вместо распределения — печать созданных стикеров по операциям. Поле скана
  // свободно для следующего стикера. Если у типа операции нет следующей операции,
  // детей может не быть вовсе — тогда просто закрываем карточку.
  // awaitMerge — выбрано "объединить с другими": годное ждёт объединения, а созданные
  // стикеры (брак/исправление/не выполненное) печатаются здесь. Не создано ничего —
  // карточка остаётся, панель показывает статус ожидания.
  const handleAdvanced = (created, { awaitMerge = false } = {}) => {
    onDone?.();
    if (awaitMerge) {
      setSticker((prev) =>
        prev
          ? { ...prev, awaiting_merge: true, children: created.map((s) => ({ id: s.id, split_kind: s.split_kind })) }
          : prev,
      );
      setAdvanced(created.length > 0 ? { code: sticker.sticker_code, stickers: created } : null);
      setScanValue("");
      setTimeout(focusScan, 0);
      return;
    }
    if (created.length === 0) {
      reset();
      return;
    }
    setAdvanced({ code: sticker.sticker_code, stickers: created });
    setScanValue("");
    setTimeout(focusScan, 0);
  };

  // "Назад к распределению": созданные стикеры (в т.ч. стикер брака) удаляются, и
  // справа снова открывается распределение принятого стикера. Только пока ни один из
  // них не принят дальше — принятый удалить нельзя (как и на сервере).
  const handleBackToDistribution = async () => {
    setBackConfirm(false);
    if (!advanced || saving) return;

    setSaving(true);
    try {
      const ids = advanced.stickers.map((s) => s.id);
      // allSettled: один отказ не должен скрыть уже удалённые — иначе список разойдётся с базой.
      const results = await Promise.allSettled(ids.map((id) => deleteWorkStickerById(id)));
      const deleted = ids.filter((_, i) => results[i].status === "fulfilled" && results[i].value?.success);

      if (deleted.length === ids.length) {
        setAdvanced(null);
        setSticker((prev) => (prev ? { ...prev, children: [] } : prev));
        await releaseAwaitingMerge();
        showAlert(t("success"), "success");
      } else {
        setAdvanced((prev) => ({ ...prev, stickers: prev.stickers.filter((s) => !deleted.includes(s.id)) }));
        const failure = results.find((r) => r.status === "rejected");
        showAlert(failure?.reason?.response?.data?.error || t("error"), "error");
      }
      onDone?.();
    } finally {
      setSaving(false);
    }
  };

  // Группа объединения — то же сочетание, что проверяет сервер (одна операция,
  // партия, размер): разные сочетания в бакете не смешиваются, у каждой группы
  // своя следующая операция и своя кнопка "Объединить и передать".
  const mergeGroupKey = (item) =>
    `${item.operation_type_id}|${item.batchReceiptItem?.receipt?.id ?? ""}|${item.batchReceiptItem?.size ?? ""}`;

  const mergeGroups = mergeBucket.reduce((groups, item) => {
    const key = mergeGroupKey(item);
    const group = groups.find((g) => g.key === key);
    if (group) group.items.push(item);
    else groups.push({ key, items: [item] });
    return groups;
  }, []);

  // Включили режим — сразу подтягиваем всё, что уже отмечено "ждёт объединения"
  // (см. AddOperationType/allow_merge и кнопку в WorkStickerRoutePanel) — сканить
  // заново не нужно. Выключили — просто закрываем, отметки на сервере остаются.
  const handleMergeToggle = async () => {
    const turningOn = !mergeMode;
    setMergeMode(turningOn);
    onMergeModeChange?.(turningOn);
    setMergeTargetByGroup({});
    setMergeExpanded({});
    setMergeCompletedResults([]);
    if (!turningOn) {
      setMergeBucket([]);
      setTimeout(focusScan, 0);
      return;
    }
    try {
      const { data } = await getWorkStickers({
        pageSize: 500,
        filters: { awaiting_merge: true, by_production_access: true },
      });
      setMergeBucket(data || []);
    } catch (err) {
      showAlert(err?.response?.data?.error || t("error"), "error");
      setMergeBucket([]);
    }
    setTimeout(focusScan, 0);
  };

  // Объединение разрешено хотя бы у одной доступной логину операции.
  const canMerge = operationTypes.some((ot) => ot.allow_merge && canUseOperation(ot.id));

  // Единый селект верхней строки: "merge" включает объединение, остальное — выключает
  // его (если оно было) и меняет порядок приёма.
  const handleTopModeSelect = (next) => {
    if (next === "merge") {
      if (!mergeMode) handleMergeToggle();
      return;
    }
    if (mergeMode) handleMergeToggle();
    handleModeChange(next);
  };

  // Снять отметку "ждёт объединения" (панель WorkStickerRoutePanel показывает её вместо
  // распределения, когда объединение выбрано, а печатать больше нечего). Если стикеры
  // брака/исправления уже напечатаны, сервер откажет — сначала "Назад к распределению".
  const handleCancelAwaitingMerge = async () => {
    if (!sticker) return;
    setSaving(true);
    try {
      const { success, data } = await setStickerAwaitingMerge(sticker.sticker_code, false);
      if (!success) return showAlert(t("error"), "error");
      showAlert(t("success"), "success");
      setSticker(data);
      onDone?.();
    } catch (err) {
      showAlert(err?.response?.data?.error || t("error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleMergeSubmitGroup = async (group, targetId) => {
    if (group.items.length < 2 || !targetId || mergeSavingKey) return;
    setMergeSavingKey(group.key);
    try {
      const { success, data } = await mergeWorkStickers(
        group.items.map((s) => s.id),
        Number(targetId),
      );
      if (!success) throw new Error();
      showAlert(t("success"), "success");
      const mergedIds = new Set(group.items.map((s) => s.id));
      setMergeBucket((prev) => prev.filter((s) => !mergedIds.has(s.id)));
      setMergeCompletedResults((prev) => [...prev, { key: group.key, stickers: data }]);
      onDone?.();
    } catch (err) {
      showAlert(err?.response?.data?.error || t("error"), "error");
    } finally {
      setMergeSavingKey(null);
      setTimeout(focusScan, 0);
    }
  };

  // Удалили созданный мерджем стикер (значок корзины в PrintableStickerList) —
  // как handleAdvancedDeleted, только результатов теперь может быть несколько
  // (по одному на каждую завершённую группу).
  const handleMergeResultDeleted = (index, ids) => {
    setMergeCompletedResults((prev) => {
      const next = [...prev];
      const rest = next[index].stickers.filter((s) => !ids.includes(s.id));
      if (rest.length > 0) next[index] = { ...next[index], stickers: rest };
      else next.splice(index, 1);
      return next;
    });
    onDone?.();
  };

  // Отмена объединения прямо с карточки источника: удаляет результат мерджа
  // (обычный pending-стикер) — FK merged_into_id (onDelete: SetNull) сам
  // расцепляет все источники обратно в принятые-нераспределённые.
  const handleCancelMerge = async () => {
    if (!sticker?.mergedInto) return;
    setSaving(true);
    try {
      const { success } = await deleteWorkStickerById(sticker.mergedInto.id);
      if (!success) return showAlert(t("error"), "error");
      showAlert(t("success"), "success");
      // Источник с уже напечатанными стикерами брака/исправления снова ждёт объединения
      // (сервер ставит отметку при удалении результата) — иначе его годное некуда деть.
      setSticker((prev) =>
        prev
          ? { ...prev, merged_into_id: null, mergedInto: null, awaiting_merge: (prev.children?.length || 0) > 0 }
          : prev,
      );
      onDone?.();
    } catch (err) {
      showAlert(err?.response?.data?.error || t("error"), "error");
    } finally {
      setSaving(false);
      setCancelMergeConfirm(false);
    }
  };

  // Поле скана недоступно в режиме объединения (скан там не нужен) и пока не выбрана
  // команда. Сотрудника выбирают и сканом его стикера, поэтому на ПК поле открыто и без него.
  const scanBlocked = mergeMode || (byTeam && !fixedTeamId);
  // Телефон (Telegram): без сотрудника поле скана закрыто — сотрудника берут из списка или
  // камерой рядом с ним (topEmployeeCamera, она handleCameraScan не блокирует).
  const employeeMissing = compact && byEmployee && !employeeId;
  const scanInputBlocked = scanBlocked || employeeMissing;

  // Камера телефона: считанный код сразу уходит в тот же поиск, что и скан сканером.
  const handleCameraScan = () => {
    if (!camera.available || looking || scanBlocked) return;
    camera.start((code) => {
      playScanSound("success");
      setScanValue(code);
      openByCode(code);
    });
  };

  const selectedEmployee = employees.find((emp) => String(emp.id) === String(employeeId));
  const isPending = sticker?.status === "pending";
  const isDone = sticker?.status === "done";
  const itemParts = [
    { key: "color", label: t("color"), value: sticker?.batchReceiptItem?.color },
    { key: "size", label: t("size"), value: sticker?.batchReceiptItem?.size },
    { key: "material", label: t("material"), value: sticker?.batchReceiptItem?.material },
    { key: "design", label: t("design"), value: sticker?.batchReceiptItem?.design },
  ].filter((part) => part.value);
  // Раздан дальше (в т.ч. объединён с другими — merged_into_id): распределять
  // повторно и возвращать в pending нельзя.
  const isAdvanced = (sticker?.children?.length || 0) > 0 || Boolean(advanced) || Boolean(sticker?.merged_into_id);
  const showDistribution = isDone && !isAdvanced && canDistribute(sticker);
  // Вернуться к распределению можно, пока все созданные стикеры не приняты дальше.
  const canGoBack =
    canDelete && Boolean(advanced) && advanced.stickers.every((s) => s.status === "pending" || s.status === "scrapped");

  // Общая карточка стикера: номер, статус, операция, партия/позиция/количество.
  const renderInfoCard = () => (
    <section className={styles.infoCard}>
      <div className={styles.infoHead}>
        <span className={styles.stickerCode}>{sticker.sticker_code}</span>
        <span className={`${styles.statusBadge} ${isDone ? styles.statusDone : ""}`}>
          {t(isDone ? "workStickerDone" : "workStickerPending")}
        </span>
      </div>

      <span className={styles.operationName}>{sticker.operationType?.name || "—"}</span>

      <dl className={styles.infoList}>
        <div>
          <dt>{t("workStickerCreatedAt")}</dt>
          <dd>{formatDateTime(sticker.added_at)}</dd>
        </div>
        <div>
          <dt>{t("batchNumber")}</dt>
          <dd>{sticker.batchReceiptItem?.receipt?.batch_number || "—"}</dd>
        </div>
        {/* Позиция партии: каждая характеристика — своя строка со своим названием (цвет, размер, ...). */}
        {itemParts.length > 0 ? (
          // Телефон (compact): позиция выводится одной строкой в самом низу карточки (см. ниже).
          !compact &&
          itemParts.map((part) => (
            <div key={part.key}>
              <dt>{part.label}</dt>
              <dd>{part.value}</dd>
            </div>
          ))
        ) : (
          <div>
            <dt>{t("workStickerBatchItem")}</dt>
            <dd>—</dd>
          </div>
        )}
        <div>
          <dt>{t("workStickerPlannedQuantity")}</dt>
          <dd>{fmtNum(sticker.planned_quantity)}</dd>
        </div>
        {isPending && byEmployee && (
          <div>
            <dt>{t("employee")}</dt>
            <dd>{selectedEmployee?.employeeFullName || "—"}</dd>
          </div>
        )}
        {isDone && sticker.employee && (sticker.shares || []).length === 0 && (
          <div>
            <dt>{t("employee")}</dt>
            <dd>{fullName(sticker.employee) || "—"}</dd>
          </div>
        )}
        {/* Работу выполнили несколько сотрудников — каждый со своей долей. */}
        {isDone && sticker.employee && (sticker.shares || []).length > 0 && (
          <div className={styles.infoWorkers}>
            <dt>{t("workAcceptanceWorkers")}</dt>
            <dd>
              <ul>
                {[
                  { key: "main", person: sticker.employee, quantity: sticker.actual_quantity },
                  ...sticker.shares.map((share) => ({
                    key: share.id,
                    person: share.employee,
                    quantity: share.actual_quantity,
                  })),
                ].map((worker) => (
                  <li key={worker.key}>
                    <span>{fullName(worker.person) || "—"}</span>
                    <b>{fmtQty(worker.quantity || 0)}</b>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
      </dl>

      {isDone && (
        <>
          <AcceptedSummary sticker={sticker} />

          {/* Годное этого стикера объединили с другими и передали на след.
              операцию одним стикером — без этого блока непонятно, куда он делся. */}
          {sticker.merged_into_id && sticker.mergedInto && (
            <div className={styles.mergedBanner}>
              <div className={styles.mergedBannerHead}>
                <span className={styles.mergedDot} />
                <b>{t("workStickerMergedIntoTitle")}</b>
              </div>
              <div className={styles.mergedBannerRow}>
                <span>{t("workStickerMergedInfoTarget")}</span>
                <b>{sticker.mergedInto.sticker_code}</b>
              </div>
              <div className={styles.mergedBannerRow}>
                <span>{t("workStickerNextOperation")}</span>
                <b>{sticker.mergedInto.operationType?.name || "—"}</b>
              </div>
              <div className={styles.mergedBannerRow}>
                <span>{t("workStickerPlannedQuantity")}</span>
                <b>{fmtNum(sticker.mergedInto.planned_quantity)}</b>
              </div>
              {sticker.mergedInto.mergedSources?.filter((s) => s.id !== sticker.id).length > 0 && (
                <div className={styles.mergedBannerSources}>
                  <span>{t("workStickerMergedWith")}</span>
                  <div className={styles.mergedBannerChips}>
                    {sticker.mergedInto.mergedSources
                      .filter((s) => s.id !== sticker.id)
                      .map((s) => (
                        <span key={s.id} className={styles.mergedChip}>
                          {s.sticker_code}
                        </span>
                      ))}
                  </div>
                </div>
              )}
              {canDelete && (
                <button
                  type="button"
                  className={styles.cancelMergeBtn}
                  onClick={() => setCancelMergeConfirm(true)}
                  disabled={saving}
                >
                  {Icons.undo}
                  <span>{t("workStickerCancelMerge")}</span>
                </button>
              )}
            </div>
          )}

          {/* Этот стикер сам — результат объединения: откуда он собран. */}
          {(sticker.mergedSources?.length || 0) > 0 && (
            <div className={styles.mergedBanner}>
              <div className={styles.mergedBannerHead}>
                <span className={styles.mergedDot} />
                <b>{t("workStickerMergedFromTitle")}</b>
              </div>
              <div className={styles.mergedBannerChips}>
                {sticker.mergedSources.map((s) => (
                  <span key={s.id} className={styles.mergedChip}>
                    {s.sticker_code}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Отмечен для объединения — снять отметку можно только в панели
              справа (WorkStickerRoutePanel), обычный "Вернуть" тут заблокирован
              сервером же (assertNotAwaitingMerge). */}
          {!isAdvanced && !sticker.awaiting_merge && (
            <button type="button" className={styles.returnBtn} onClick={handleRevert} disabled={saving}>
              {Icons.undo} {t("workStickerReturn")}
            </button>
          )}
        </>
      )}

      {/* Телефон (Telegram): цвет / размер / материал / дизайн — одной строкой, в самом низу карточки. */}
      {compact && itemParts.length > 0 && (
        <dl className={styles.infoParts}>
          {itemParts.map((part) => (
            <div key={part.key}>
              <dt>{part.label}</dt>
              <dd>{part.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );

  return (
    <div className={styles.scan}>
      {/* Компактная строка: режим приёма, сотрудник (если он выбирается заранее) и скан. */}
      <div className={styles.topBar}>
        {/* Выбор режима и сотрудника/команды — отдельная обёртка: на телефоне она
            уезжает вверх при прокрутке, а поле скана ниже остаётся закреплённым. */}
        <div className={styles.topSelectors}>
          {/* Один селект: три порядка приёма и (если у какой-то операции разрешено
              объединение) режим объединения. Объединение включают только при закрытой
              карточке — как раньше кнопку. */}
          <ScanModeSelect
            value={mergeMode ? "merge" : mode}
            onChange={handleTopModeSelect}
            options={[
              { value: "sticker", label: t("workAcceptanceModeSticker") },
              { value: "employee", label: t("workAcceptanceModeEmployee") },
              { value: "team", label: t("workAcceptanceModeTeam") },
              ...(canMerge
                ? [
                    {
                      value: "merge",
                      label: t("workStickerMergeMode"),
                      hint: t("workStickerMergeModeHint"),
                      disabled: !!sticker && !mergeMode,
                      accent: true,
                    },
                  ]
                : []),
            ]}
          />

          {/* В режиме объединения сотрудник/команда не при делах — сканы не
              принимают работу, а копятся в бакет. */}
          {!mergeMode && byEmployee && (
            <div
              className={`${styles.topEmployee} ${camera.available ? styles.topEmployeeWithCamera : ""}`}
              title={t("workAcceptanceEmployeeHint")}
            >
              <div className={styles.topEmployeeSelect}>
                <EmployeeSelect
                  bar
                  clearable
                  value={employeeId}
                  onChange={handleFixedEmployeeChange}
                  employees={employees}
                  placeholder={`${t("employee")} *`}
                />
              </div>
              {/* Телефон: сотрудника выбирают сканом его стикера камерой — та же камера и
                  тот же разбор кода (handleEmployeeSticker), что у поля скана ниже. */}
              {camera.available && (
                <button
                  type="button"
                  className={styles.topEmployeeCamera}
                  onClick={handleCameraScan}
                  disabled={looking || (!!sticker && !advanced)}
                  title={t("workAcceptanceScanEmployeeCamera")}
                  aria-label={t("workAcceptanceScanEmployeeCamera")}
                >
                  {Icons.scan}
                </button>
              )}
            </div>
          )}

          {!mergeMode && byTeam && (
            <div className={styles.topEmployee} title={t("workAcceptanceTeamHint")}>
              <select
                className={styles.topTeamSelect}
                value={fixedTeamId}
                onChange={(e) => handleFixedTeamChange(e.target.value)}
              >
                <option value="">{`${t("workAcceptanceSelectTeam")} *`}</option>
                {operationTypes.map((ot) =>
                  (teamsByType[ot.id] || []).length > 0 ? (
                    <optgroup key={ot.id} label={ot.name}>
                      {teamsByType[ot.id].map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null,
                )}
              </select>
            </div>
          )}
        </div>

        {/* В режиме объединения скан не нужен (стикеры попадают в список при приёме) — поле
            скрыто. Без кнопок страницы пустую строку не рисуем: на телефоне она липкая. */}
        {(!mergeMode || topBarExtra) && (
          <div className={styles.scanRow}>
            {!mergeMode && (
              <div
                className={`${styles.scanBox} ${sticker && !advanced ? styles.scanBoxLocked : ""} ${employeeMissing ? styles.scanBoxBlocked : ""} ${compact ? styles.scanBoxNoIcon : ""}`}
              >
                {/* Телефон (compact): значок скана — на кнопке камеры справа, слева его нет. */}
                {!compact && <span className={styles.scanIcon}>{Icons.scan}</span>}
                <input
                  ref={scanInputRef}
                  type="text"
                  value={scanValue}
                  onChange={(e) => setScanValue(e.target.value)}
                  onKeyDown={handleScanKeyDown}
                  placeholder={
                    employeeMissing
                      ? t("workAcceptanceSelectEmployeeFirst")
                      : byEmployee && !employeeId
                        ? t("workAcceptanceScanEmployeeSticker")
                        : byTeam && !fixedTeamId
                          ? t("workAcceptanceSelectTeamFirst")
                          : touch
                            ? t("tgCodePlaceholder")
                            : t("scanInputPlaceholder")
                  }
                  disabled={(!!sticker && !advanced) || looking || scanInputBlocked}
                  autoFocus={!touch}
                  enterKeyHint="go"
                  autoComplete="off"
                  autoCorrect="off"
                />
                {sticker && (
                  <button type="button" className={styles.scanClear} onClick={reset} title={t("cancel")}>
                    {Icons.clear}
                  </button>
                )}
                {/* Телефон: код набирают руками — кнопка вместо Enter сканера. */}
                {touch && (!sticker || advanced) && scanValue.trim() && !scanInputBlocked && (
                  <button
                    type="button"
                    className={styles.scanGo}
                    onClick={() => openByCode(scanValue.trim())}
                    disabled={looking}
                    aria-label={t("tgFind")}
                  >
                    {Icons.arrowForward}
                  </button>
                )}
                {camera.available && (!sticker || advanced) && (
                  <button
                    type="button"
                    className={styles.scanCamera}
                    onClick={handleCameraScan}
                    disabled={looking || scanInputBlocked}
                    aria-label={t("tgScanCamera")}
                  >
                    {Icons.scan}
                  </button>
                )}
              </div>
            )}

            {/* Кнопки страницы (история / ждут скана) — сразу после поля скана. */}
            {topBarExtra}
          </div>
        )}
      </div>

      {/* Ждём скан: пустое состояние. */}
      {!sticker && !mergeMode && (
        <div className={styles.hero}>
          <div className={styles.heroIcon}>{Icons.scan}</div>
          <h2>{t("scanInputLabel")}</h2>
          <p>
            {byEmployee && !employeeId
              ? t("workAcceptanceScanEmployeeSticker")
              : byTeam && !fixedTeamId
                ? t("workAcceptanceSelectTeamFirst")
                : t("workAcceptanceScanHint")}
          </p>
        </div>
      )}

      {/* Режим объединения: сканы копятся в список ниже вместо открытия карточки
          приёма/раздачи — см. handleScanKeyDown. */}
      {!sticker && mergeMode && (
        <div className={styles.mergePanel}>
          {mergeBucket.length === 0 && mergeCompletedResults.length === 0 ? (
            <div className={styles.hero}>
              <div className={styles.heroIcon}>{Icons.scan}</div>
              {/* Телефон (compact): заголовок и общая подсказка не нужны — режим уже выбран сверху. */}
              {!compact && <h2>{t("workStickerMergeTitle")}</h2>}
              {!compact && <p>{t("workStickerMergeHint")}</p>}
              <p>{t("workStickerMergeEmptyHint")}</p>
            </div>
          ) : (
            <>
              {!compact && (
                <div className={styles.mergeHead}>
                  <h2>{t("workStickerMergeTitle")}</h2>
                  <p>{t("workStickerMergeHint")}</p>
                </div>
              )}

              {/* Разные партии/размеры/операции в бакете не смешиваются — каждая
                  своя группа, со своей след. операцией и своей кнопкой отправки.
                  Карточки групп и результатов — по две в строке. */}
              <div className={styles.mergeGrid}>
              {mergeGroups.map((group) => {
                const first = group.items[0];
                const groupOptions = nextOperationOptions(
                  operationTypes,
                  nextOperationCandidates(first.operationType),
                );
                const chosenId =
                  mergeTargetByGroup[group.key] ?? (groupOptions.length === 1 ? String(groupOptions[0].id) : "");
                const groupHint =
                  group.items.length < 2
                    ? t("workStickerMergeMinTwo")
                    : !chosenId
                      ? t("workStickerSelectNextOperation")
                      : "";
                const groupTotal = group.items.reduce((sum, s) => sum + goodQuantity(s), 0);
                const isSaving = mergeSavingKey === group.key;
                const collapsible = group.items.length > MERGE_LIST_COLLAPSE_FROM;
                const listOpen = !collapsible || Boolean(mergeExpanded[group.key]);

                return (
                  <section key={group.key} className={styles.mergeGroup}>
                    <div className={styles.mergeGroupHead}>
                      {/* Операция, на которой стикеры уже приняты, — ниже выбирается следующая. */}
                      <div className={styles.mergeGroupOpBlock}>
                        <span className={styles.mergeGroupOpLabel}>{t("workStickerLastOperation")}</span>
                        <span className={styles.mergeGroupOp}>{first.operationType?.name || "—"}</span>
                      </div>
                      <span className={styles.mergeGroupBatch}>
                        {t("batchNumber")}: <b>{first.batchReceiptItem?.receipt?.batch_number || "—"}</b>
                      </span>
                      {/* Размер и количество — обёртка нужна телефону: они уходят второй строкой. */}
                      <div className={styles.mergeGroupMeta}>
                        {first.batchReceiptItem?.size && (
                          <span className={styles.mergeGroupSize}>{first.batchReceiptItem.size}</span>
                        )}
                        <span className={styles.mergeGroupCount}>
                          {t("workStickerMergeCount")}: <b>{group.items.length}</b>
                        </span>
                      </div>
                    </div>

                    {/* Стикеров много — список свёрнут, число и сумма видны в шапке и ниже. */}
                    {collapsible && (
                      <button
                        type="button"
                        className={`${styles.mergeListToggle} ${listOpen ? styles.mergeListToggleOpen : ""}`}
                        aria-expanded={listOpen}
                        onClick={() => setMergeExpanded((prev) => ({ ...prev, [group.key]: !listOpen }))}
                      >
                        <span>{listOpen ? t("hide") : `${t("show")} (${group.items.length})`}</span>
                        <IconChevronDown />
                      </button>
                    )}

                    {listOpen && (
                      <ul className={`${styles.mergeList} ${compact ? styles.mergeListCompact : ""}`}>
                        {group.items.map((s) => (
                          <li key={s.id}>
                            <span className={styles.stickerCode}>{s.sticker_code}</span>
                            <b>{fmtNum(goodQuantity(s))}</b>
                          </li>
                        ))}
                      </ul>
                    )}

                    <section className={`${routeStyles.section} ${routeStyles.sectionNext}`}>
                      <SectionHead
                        badge={Icons.arrowForward}
                        title={t("workStickerNextOperation")}
                        hint={t("workStickerNextHint")}
                        qty={groupTotal}
                        qtyLabel={t("workStickerActualQuantity")}
                        qtyClassName={styles.mergeQty}
                      />
                      {groupOptions.length > 0 ? (
                        <OperationChoice
                          options={groupOptions}
                          value={chosenId}
                          onChange={(id) => setMergeTargetByGroup((prev) => ({ ...prev, [group.key]: id }))}
                          label={t("workStickerNextOperation")}
                        />
                      ) : (
                        <p className={routeStyles.sectionNote}>{t("workStickerNoNextOperations")}</p>
                      )}
                    </section>

                    <div className={`${routeStyles.footer} ${styles.mergeFooter}`}>
                      <span className={`${routeStyles.footerText} ${groupHint ? routeStyles.footerWarn : ""}`}>
                        {groupHint || t("workStickerOneSticker")}
                      </span>
                      <button
                        type="button"
                        className={`${routeStyles.submit} ${groupHint ? routeStyles.submitIncomplete : ""}`}
                        disabled={Boolean(mergeSavingKey) || Boolean(groupHint)}
                        onClick={() => handleMergeSubmitGroup(group, chosenId)}
                      >
                        <span>
                          {isSaving ? t("loading") : t("workStickerMergeSubmit")}
                        </span>
                        {!isSaving && <span className={routeStyles.submitArrow}>{Icons.arrowForward}</span>}
                      </button>
                    </div>
                  </section>
                );
              })}

              {mergeCompletedResults.map((result, index) => (
                <section key={`${result.key}-${index}`} className={styles.resultCard}>
                  <div className={styles.resultHead}>
                    <div className={styles.resultTitle}>
                      <b>{t("workStickerPrintTitle")}</b>
                    </div>
                    <PrintAllButton
                      className={styles.resultPrintAll}
                      stickers={result.stickers}
                      template={stickerTemplate}
                    />
                  </div>
                  <PrintableStickerList
                    stickers={result.stickers}
                    template={stickerTemplate}
                    canDelete={canDelete}
                    bulkDelete={false}
                    onDeleted={(ids) => handleMergeResultDeleted(index, ids)}
                    fill
                  />
                </section>
              ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Приём: карточка стикера слева, форма выполнено / брак справа. */}
      {isPending && (
        <div className={styles.workGrid}>
          {renderInfoCard()}

          <form id={acceptFormId} className={styles.acceptForm} onSubmit={handleAcceptSubmit}>
            <div className={styles.formHead}>
              {/* Сотрудник / Командная работа — на одном уровне с количеством. */}
              {!byTeam && availableTeams.length > 0 && (
                <div className={styles.teamToggle}>
                  <SegmentedGroup
                    options={[
                      { value: "employee", label: t("employee"), color: "var(--third-color, #1455fe)" },
                      { value: "team", label: t("workAcceptanceTeamWork"), color: "var(--third-color, #1455fe)" },
                    ]}
                    value={teamWork ? "team" : "employee"}
                    onChange={(v) => handleTeamWorkToggle(v === "team")}
                  />
                </div>
              )}
              <span className={styles.formTotal}>
                {t(compact ? "workStickerFieldQuantity" : "workStickerPlannedQuantity")}: <b>{fmtQty(stickerQty)}</b>
              </span>
              {/* Настройка типа операции: допущенные сотрудники и (в «Командной работе») команды — модалка. */}
              {canManage && (
                <button
                  type="button"
                  className={styles.settingsBtn}
                  onClick={() => setTeamsModalOpen(true)}
                  title={manageLabel}
                  aria-label={manageLabel}
                >
                  {Icons.settings}
                </button>
              )}
            </div>

            {/* Сотрудники: основной и, если работу делили, другие со своей долей выполненного.
                "Сначала сотрудник": основной уже выбран вверху и не меняется от стикера к стикеру. */}
            <div className={styles.workers}>
              {/* Командная работа: вместо ручного набора — сразу вся команда, доля
                  каждого считается поровну сама. В "Сначала команда" выбор уже
                  сделан наверху — здесь его не дублируем. Переключатель «Сотрудник /
                  Командная работа» — в шапке формы, рядом с количеством. Здесь, одной
                  строкой: команда (одна выбрана сама — плашка без выбора, несколько —
                  селект) и ручное дополнение состава сверх команды. Кнопка настройки
                  (шестерёнка) — в правом углу шапки формы, см. formHead. */}
              {teamWork && (
                <div className={styles.modeRow}>
                  <div className={styles.workerActions}>
                    {!compact && availableTeams.length === 1 && (
                      <span className={`${styles.teamChoice} ${styles.teamChoiceActive} ${styles.teamChoiceStatic}`}>
                        {availableTeams[0].name}
                      </span>
                    )}
                    {/* Команд больше одной — селект. Телефон (compact): команда выбирается
                        только селектом, при любом числе команд. */}
                    {availableTeams.length > 0 && (compact || availableTeams.length > 1) && (
                      <TeamSelect
                        value={selectedTeamId}
                        onChange={handleTeamSelect}
                        teams={availableTeams}
                        placeholder={t("workAcceptanceSelectTeam")}
                      />
                    )}
                    {/* Телефон (compact): только значок «сотрудник +» — рядом с селектом команды, в одной строке. */}
                    <button
                      type="button"
                      className={`${styles.addWorkerBtn} ${compact ? styles.addWorkerIcon : ""}`}
                      onClick={addCoWorker}
                      title={t("workAcceptanceAddWorker")}
                      aria-label={t("workAcceptanceAddWorker")}
                    >
                      {compact ? <IconUserPlus /> : Icons.plus}
                      {!compact && t("workAcceptanceAddWorker")}
                    </button>
                  </div>
                </div>
              )}

              <div className={`${styles.workerList} ${compactWorkers ? styles.workerListCompact : ""}`}>
                <div className={styles.workerRow}>
                  <div className={styles.workerSelect}>
                    {byEmployee ? (
                      <div className={styles.workerFixed}>{selectedEmployee?.employeeFullName || "—"}</div>
                    ) : (
                      <EmployeeSelect
                        large
                        compact
                        value={employeeId}
                        onChange={setEmployeeId}
                        employees={employeesFor(employeeId)}
                        placeholder={t("employee")}
                      />
                    )}
                  </div>
                  {coWorkers.length > 0 && (
                    <div
                      className={`${styles.workerQty} ${styles.workerAuto}`}
                      style={qtyBoxStyle(fmtQty(Math.max(primaryShare, 0)))}
                    >
                      {fmtQty(Math.max(primaryShare, 0))}
                    </div>
                  )}
                  {/* Основной — тоже участник команды, его тоже можно убрать (место займёт следующий). */}
                  {teamWork && (
                    <button
                      type="button"
                      className={styles.workerRemove}
                      title={t("workAcceptanceRemoveWorker")}
                      onClick={removePrimary}
                    >
                      {Icons.clear}
                    </button>
                  )}
                </div>

                {coWorkers.map((worker) => (
                  <div className={styles.workerRow} key={worker.key}>
                    <div className={styles.workerSelect}>
                      <EmployeeSelect
                        large
                        compact
                        value={worker.employeeId}
                        onChange={(id) => updateCoWorker(worker.key, { employeeId: id })}
                        employees={employeesFor(worker.employeeId)}
                        placeholder={t("employee")}
                      />
                    </div>
                    {/* По умолчанию — доля поровну (эффект пересчитывает при смене состава
                        или "Выполнено"), но её можно скорректировать вручную. Формат ввода —
                        тот же, что у "Доли основного": сгруппировано, пока не в фокусе. */}
                    <input
                      type="text"
                      inputMode="decimal"
                      className={`${styles.workerQty} ${styles.workerQtyInput} ${styles.workerAuto}`}
                      style={qtyBoxStyle(focusedWorkerKey === worker.key ? worker.quantity : fmtInputValue(worker.quantity))}
                      value={focusedWorkerKey === worker.key ? worker.quantity : fmtInputValue(worker.quantity)}
                      placeholder="0"
                      onChange={(e) => updateCoWorker(worker.key, { quantity: sanitizeNumericInput(e.target.value) })}
                      onFocus={() => setFocusedWorkerKey(worker.key)}
                      onBlur={() => setFocusedWorkerKey((k) => (k === worker.key ? null : k))}
                    />
                    <button
                      type="button"
                      className={styles.workerRemove}
                      title={t("workAcceptanceRemoveWorker")}
                      onClick={() => removeCoWorker(worker.key)}
                    >
                      {Icons.clear}
                    </button>
                  </div>
                ))}
              </div>

              {workersError && <div className={styles.splitStatus}>{workersError}</div>}

              <TeamManageModal
                isOpen={teamsModalOpen}
                onClose={() => setTeamsModalOpen(false)}
                operationTypeId={operationTypeId}
                withTeams={manageWithTeams}
                teams={availableTeams}
                employees={employees}
                operationEmployeeIds={(sticker?.operationType?.employees || []).map((e) => Number(e.employee_id))}
                onSaved={handleTeamsSaved}
                onEmployeesSaved={handleOperationEmployeesSaved}
                sheet={compact}
              />
            </div>

            {/* Стикер делится целиком: выполнено + брак + на исправление (+ не выполнено,
                если операция разрешает) = его количество. "Выполнено" считается само —
                вручную не вводится. Операции для исправления и не выполненных выбирают
                после приёма, в распределении. */}
            <div className={`${styles.splitGrid} ${allowIncomplete ? styles.splitGridFour : ""}`}>
              {splitFields.map((field) => (
                <div className={`${styles.splitField} ${field.toneClass}`} key={field.key}>
                  <div className={styles.fieldLabelRow}>
                    <label className={styles.fieldLabel}>
                      <i className={styles.splitDot} />
                      {field.label}
                    </label>
                  </div>

                  {field.auto ? (
                    <input
                      type="text"
                      className={styles.autoInput}
                      value={fmtInputValue(field.value)}
                      readOnly
                      tabIndex={-1}
                    />
                  ) : (
                    <input
                      type="text"
                      inputMode="decimal"
                      className={field.over ? styles.invalid : undefined}
                      value={field.focused ? field.value : fmtInputValue(field.value)}
                      onChange={(e) => field.setValue(sanitizeNumericInput(e.target.value))}
                      onFocus={() => field.setFocused(true)}
                      onBlur={() => field.setFocused(false)}
                      placeholder="0"
                      autoFocus={field.key === "defect" && !touch}
                    />
                  )}
                </div>
              ))}
            </div>

            {quantityError && <div className={styles.splitStatus}>{quantityError}</div>}

            {/* Цена и комментарий — крупные поля; под ними большая кнопка "Принять",
                как "Раздать дальше" в распределении. */}
            <div className={styles.formFooter}>
              <div className={`${styles.field} ${styles.fieldPrice}`}>
                <label className={styles.fieldLabel}>{t("price")}</label>
                <input
                  type="text"
                  inputMode="decimal"
                  className={styles.bigInput}
                  value={rateFocused ? rate : fmtInputValue(rate)}
                  onChange={(e) => setRate(sanitizeNumericInput(e.target.value))}
                  onFocus={() => setRateFocused(true)}
                  onBlur={() => setRateFocused(false)}
                />
              </div>
              <div className={`${styles.field} ${styles.fieldGrow}`}>
                <label className={styles.fieldLabel}>{t("comment")}</label>
                <input
                  type="text"
                  className={styles.textInput}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>
            </div>

            {dock(
              <div className={`${styles.acceptActions} ${dockNode ? styles.acceptActionsDocked : ""}`}>
                <button
                  type="submit"
                  form={acceptFormId}
                  className={styles.acceptSubmit}
                  disabled={saving || Boolean(blockError)}
                >
                  <span>{saving ? t("loading") : t("acceptWork")}</span>
                  {!saving && <span className={styles.acceptArrow}>{Icons.arrowForward}</span>}
                </button>
              </div>,
            )}
          </form>
        </div>
      )}

      {/* Принят: слева всегда данные стикера, справа — распределение (следующая
          операция, исправление, брак), а после раздачи — печать созданных стикеров. */}
      {isDone && (
        <div className={`${styles.workGrid} ${advanced || showDistribution ? "" : styles.workGridSingle}`}>
          {renderInfoCard()}

          {advanced ? (
            <section className={styles.resultCard}>
              <div className={styles.resultHead}>
                <div className={styles.resultTitle}>
                  <b>{t("workStickerPrintTitle")}</b>
                </div>
                <PrintAllButton
                  className={styles.resultPrintAll}
                  stickers={advanced.stickers}
                  template={stickerTemplate}
                />
              </div>

              {/* Годное ждёт объединения, а стикеры ниже (брак / исправление / не
                  выполненное) напечатаны при раздаче — статус показываем только здесь. */}
              {sticker.awaiting_merge && !sticker.merged_into_id && (
                <div className={routeStyles.awaitingMerge}>
                  <span className={routeStyles.awaitingMergeDot} />
                  <div className={routeStyles.awaitingMergeTexts}>
                    <b>{t("workStickerAwaitingMergeTitle")}</b>
                    <span>{t("workStickerAwaitingMergePrintedHint")}</span>
                  </div>
                </div>
              )}

              <PrintableStickerList
                stickers={advanced.stickers}
                template={stickerTemplate}
                canDelete={canDelete}
                bulkDelete={false}
                onDeleted={handleAdvancedDeleted}
                fill
              />

              {/* Откат — внизу карточки, после списка: сначала печатают, отменяют редко. */}
              {canGoBack && (
                <div className={styles.resultFooter}>
                  <button
                    type="button"
                    className={routeStyles.backBtn}
                    onClick={() => setBackConfirm(true)}
                    disabled={saving}
                  >
                    <span className={routeStyles.backArrow}>{Icons.arrowBack}</span>
                    <span>{t("workStickerBackToDistribution")}</span>
                  </button>
                </div>
              )}
            </section>
          ) : (
            showDistribution && (
              <WorkStickerRoutePanel
                key={sticker.id}
                sticker={sticker}
                operationTypes={operationTypes}
                busy={saving}
                onAdvanced={handleAdvanced}
                onBack={handleRevert}
                onCancelAwaitingMerge={handleCancelAwaitingMerge}
                dockNode={dockNode}
              />
            )
          )}
        </div>
      )}

      {camera.element}

      <CenterModal
        isOpen={backConfirm}
        onClose={() => setBackConfirm(false)}
        onAccept={handleBackToDistribution}
        message={t("workStickerBackConfirm")}
      />

      <CenterModal
        isOpen={cancelMergeConfirm}
        onClose={() => setCancelMergeConfirm(false)}
        onAccept={handleCancelMerge}
        message={t("workStickerCancelMergeConfirm")}
      />
    </div>
  );
});

export default ScanWorkSticker;
