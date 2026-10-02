import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";
import { ChevronDown, ChevronRight, Info, Pencil, X } from "lucide-react";

import { useAlertStore } from "../stores/alertStore";
import { usePermissions } from "../hooks/usePermissions";
import { useProductionAccess } from "../hooks/useProductionAccess";
import {
  getOperationTypes,
  getProductionReportByEmployee,
  getProductionReportByOperation,
  getProductionReportByOrder,
  getProductionReportBySticker,
  getProductionReportMonitoring,
  getProductionReportStickerItemAttributes,
} from "../api";

import EmployeeCell from "../components/EmployeeCell";
import Loading from "../components/Loading";
import Pagination from "../components/Pagination";
import Search from "../components/Search";
import SortArrow from "../components/SortArrow";
import StickerChronology from "../components/StickerChronology";
import StickerRateModal from "../components/StickerRateModal";
import StickerStatusBadge from "../components/StickerStatusBadge";
import { Icons } from "../icons/icons";
import { STICKER_STATUS_KEYS } from "../utils/stickerStatus";

import styles from "./ProductionReportPage.module.scss";

const BATCH_ITEM_COLS = 10;
const BATCH_OPERATION_COLS = 11;
const EMPLOYEE_COLS = 12;
const OPERATION_COLS = 10;
const ORDER_COLS = 12;
const ORDER_BATCH_COLS = 10;
// Без колонки выбора; с правом на правку цены добавляется ещё одна (см. renderStickerTable)
const STICKER_COLS = 16;

const TAB_LOADERS = {
  order: getProductionReportByOrder,
  employee: getProductionReportByEmployee,
  operation: getProductionReportByOperation,
  sticker: getProductionReportBySticker,
  monitoring: getProductionReportMonitoring,
};

// Порядок ключей = порядок вкладок; первая вкладка открывается по умолчанию
const TAB_TITLES = {
  order: "productionReportByOrder",
  employee: "productionReportByEmployee",
  operation: "productionReportByOperation",
  sticker: "productionReportBySticker",
  monitoring: "productionReportMonitoring",
};

// Сотрудники и операции считаются по одному периоду — дате приёма работы, заказы (с партиями) —
// по дате прихода партии, стикеры — по дате печати (у не принятого стикера даты приёма ещё нет),
// мониторинг — и по печати («пришло»), и по приёму («завершено»)
const TAB_HINTS = {
  order: "prodPeriodBatchHint",
  employee: "prodPeriodEmployeeHint",
  operation: "prodPeriodEmployeeHint",
  sticker: "prodPeriodStickerHint",
  monitoring: "prodPeriodMonitoringHint",
};

// Мониторинг: операции — колонки, эти показатели — строки; tone — цвет ячейки
// (в процессе и завершено — как у бейджей статуса стикера)
const MONITORING_METRICS = [
  { field: "arrived_qty", label: "prodMonitoringArrived", tone: "toneArrived" },
  { field: "pending_qty", label: "prodMonitoringInProgress", tone: "tonePending" },
  { field: "done_qty", label: "prodMonitoringDone", tone: "toneDone" },
];

// Вкладка «По стикерам» — единственная постраничная: стикеров тысячи
const DEFAULT_PAGE_SIZE = 50;

const renderChevron = (open) =>
  open ? <ChevronDown size={14} /> : <ChevronRight size={14} />;

// Позиция партии: название + размер, ниже — цвет/пряжа/материал/дизайн
const itemTitle = (item) => [item.product_name, item.size].filter(Boolean).join(" · ") || "—";

const itemAttributes = (item) =>
  [item.color, item.color_variant, item.color_tone, item.yarn_type, item.material, item.design]
    .filter(Boolean)
    .join(" · ");

const fmtQty = (value) =>
  Number(value || 0).toLocaleString("ru-RU", { maximumFractionDigits: 4 });

const fmtMoney = (value) =>
  Number(value || 0).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (value) => (value ? dayjs(value).format("DD.MM.YYYY") : "—");

const fmtDateTime = (value) => (value ? dayjs(value).format("DD.MM.YYYY HH:mm") : "—");

const acceptedPeriodFilters = () => ({
  date_from: dayjs().startOf("month").format("YYYY-MM-DD"),
  date_to: dayjs().format("YYYY-MM-DD"),
  search: "",
  operation_type_id: "",
});

const todayPeriodFilters = () => ({
  date_from: dayjs().format("YYYY-MM-DD"),
  date_to: dayjs().format("YYYY-MM-DD"),
  search: "",
  operation_type_id: "",
});

// Период заказов (и их партий) — по дате прихода партии (по умолчанию за всё время), период
// сотрудников и операций — по дате приёма работы (по умолчанию текущий месяц).
// Стикеры — по дате печати, по умолчанию за всё время: ошибочный стикер ищут по коду.
// Мониторинг — оперативная сводка, по умолчанию за сегодня.
const defaultFilters = () => ({
  order: { date_from: "", date_to: "", search: "", operation_type_id: "" },
  employee: acceptedPeriodFilters(),
  operation: acceptedPeriodFilters(),
  monitoring: todayPeriodFilters(),
  sticker: {
    date_from: "",
    date_to: "",
    search: "",
    operation_type_id: "",
    status: "",
    size: "",
    design: "",
    material: "",
    grammage: "",
  },
});

const sortRows = (rows, field, order) => {
  if (!field) return rows;
  return [...rows].sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];

    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    if (typeof aVal === "number" && typeof bVal === "number") {
      return order === "asc" ? aVal - bVal : bVal - aVal;
    }

    return order === "asc"
      ? String(aVal).localeCompare(String(bVal), "ru")
      : String(bVal).localeCompare(String(aVal), "ru");
  });
};

const ProductionReportPage = () => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  // Отчёт режется по правам логина на сервере; в фильтре — только доступные операции.
  const { filterOperationTypes } = useProductionAccess();
  // Цену принятых стикеров правят только с правом «изменение» на этой странице
  const { canEdit } = usePermissions(window.location.pathname);

  const [tab, setTab] = useState(Object.keys(TAB_TITLES)[0]);
  const [filters, setFilters] = useState(defaultFilters);
  const [operationTypes, setOperationTypes] = useState([]);
  const [stickerAttrFilters, setStickerAttrFilters] = useState({
    sizes: [],
    designs: [],
    materials: [],
    grammages: [],
  });
  const [loading, setLoading] = useState(true);
  // tab хранится рядом с данными: на кадре после переключения вкладки данные
  // старой вкладки не должны рисоваться колонками новой
  const [report, setReport] = useState({ tab: null, data: [], totals: null, pagination: null });
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [expanded, setExpanded] = useState(() => new Set());
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc");
  // Выбранные стикеры «По стикерам»: id → строка отчёта. Выбор живёт между страницами
  // (пачку можно собрать с нескольких), сбрасывается при смене вкладки и фильтров.
  const [selected, setSelected] = useState(() => new Map());
  // Строки в окне правки цены хранятся отдельно от открытия: при закрытии они нужны
  // до конца анимации
  const [rateRows, setRateRows] = useState([]);
  const [rateOpen, setRateOpen] = useState(false);

  const requestRef = useRef(0);
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const current = filters[tab];

  useEffect(() => {
    getOperationTypes({ pageSize: 500 })
      .then((res) => setOperationTypes(res.data || []))
      .catch((error) =>
        console.error("Ошибка при получении типов операций:", error.message),
      );
    getProductionReportStickerItemAttributes()
      .then((data) =>
        setStickerAttrFilters({
          sizes: data?.sizes || [],
          designs: data?.designs || [],
          materials: data?.materials || [],
          grammages: data?.grammages || [],
        }),
      )
      .catch((error) =>
        console.error("Ошибка при получении значений фильтра позиций:", error.message),
      );
  }, []);

  const fetchReport = async (
    nextTab = tab,
    nextFilters = filters[nextTab],
    nextPage = 1,
    nextPageSize = pageSize,
  ) => {
    const requestId = ++requestRef.current;
    setLoading(true);
    try {
      const params = { filters: JSON.stringify(nextFilters) };
      if (nextTab === "sticker") {
        params.page = nextPage;
        params.pageSize = nextPageSize;
      }
      const res = await TAB_LOADERS[nextTab](params);
      if (requestId !== requestRef.current) return;
      setReport({
        tab: nextTab,
        data: res.data || [],
        totals: res.totals || null,
        pagination: res.pagination || null,
      });
    } catch (error) {
      if (requestId !== requestRef.current) return;
      console.error("Ошибка при получении отчёта:", error.message);
      setReport({ tab: nextTab, data: [], totals: null, pagination: null });
      showAlert(t("error"), "error");
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    setExpanded(new Set());
    setSelected(new Map());
    setSortField(null);
    setSortOrder("asc");
    fetchReport(tab);
  }, [tab]);

  const applyFilters = (next) => {
    setFilters((prev) => ({ ...prev, [tab]: next }));
    setExpanded(new Set());
    setSelected(new Map());
    fetchReport(tab, next);
  };

  const handleFilterChange = (e) =>
    applyFilters({ ...current, [e.target.name]: e.target.value });

  const handlePageChange = (nextPage) => {
    if (nextPage < 1 || nextPage > (report.pagination?.totalPages ?? 1)) return;
    setExpanded(new Set());
    fetchReport(tab, current, nextPage);
  };

  const handleChangePageSize = (e) => {
    const size = Number(e.target.value);
    setPageSize(size);
    setExpanded(new Set());
    fetchReport(tab, current, 1, size);
  };

  const setCurrentFilters = (next) =>
    setFilters((prev) => ({ ...prev, [tab]: next }));

  const toggleExpanded = (key) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // «По стикерам»: раскрыт только один — хронология тяжёлая, а раскрытых строк на странице
  // не должно копиться; клик по другому стикеру закрывает прежний
  const toggleExpandedSingle = (key) =>
    setExpanded((prev) => (prev.has(key) ? new Set() : new Set([key])));

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const ready = report.tab === tab;
  const totals = ready ? report.totals : null;
  const pagination = ready ? report.pagination : null;
  const sortedRows = useMemo(
    () => (ready ? sortRows(report.data, sortField, sortOrder) : []),
    [ready, report.data, sortField, sortOrder],
  );

  // Цену правят у принятых стикеров; если основной сотрудник скрыт доступом, сервер такую
  // строку всё равно пропустит — не предлагаем её и в интерфейсе
  const isRateEditable = (row) =>
    canEdit && row.status === "done" && !row.workers[0]?.hidden;

  const editableRows = tab === "sticker" ? sortedRows.filter(isRateEditable) : [];
  const allEditableSelected =
    editableRows.length > 0 && editableRows.every((row) => selected.has(row.id));
  const someEditableSelected = editableRows.some((row) => selected.has(row.id));

  const toggleSelected = (row) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(row.id)) next.delete(row.id);
      else next.set(row.id, row);
      return next;
    });

  // Все выбираемые строки страницы: если выбраны уже все — снимаем
  const toggleAllEditable = () =>
    setSelected((prev) => {
      const next = new Map(prev);
      editableRows.forEach((row) => (allEditableSelected ? next.delete(row.id) : next.set(row.id, row)));
      return next;
    });

  const openRateEdit = (rows) => {
    setRateRows(rows);
    setRateOpen(true);
  };

  const handleRateSaved = () => {
    setSelected(new Map());
    fetchReport(tab, current, pagination?.currentPage ?? 1);
  };

  const renderTh = (field, label, className) => (
    <th className={className} onClick={() => toggleSort(field)}>
      <span className={styles.headerContent}>
        {label}
        <SortArrow active={sortField === field} order={sortOrder} />
      </span>
    </th>
  );

  const totalProgress =
    tab === "order" && totals?.received_qty > 0
      ? Math.round((totals.finished_qty / totals.received_qty) * 1000) / 10
      : 0;

  const exportToExcel = () => {
    const period = [current.date_from, current.date_to].filter(Boolean).join(" — ");
    const title = t(TAB_TITLES[tab]);

    let header;
    let summary;
    let detailHeader;
    let details;

    if (tab === "order") {
      header = [
        t("customerOrderNumber"),
        t("customer"),
        t("prodBatchesCount"),
        t("prodBatchQty"),
        t("workStickerPending"),
        t("prodDoneQty"),
        t("prodProgress"),
        t("prodReworkQty"),
        t("prodScrapQty"),
        t("prodSalary"),
        t("prodEmployeesCount"),
      ];
      summary = sortedRows.map((row) => [
        row.order_number || t("prodNoOrder"),
        row.customers.join(", "),
        row.batches_count,
        row.received_qty,
        row.pending_qty,
        row.finished_qty,
        row.progress,
        row.rework_qty,
        row.scrap_qty,
        row.amount,
        row.employees_count,
      ]);
      detailHeader = [
        t("customerOrderNumber"),
        t("batchNumber"),
        t("lineItems"),
        t("operationType"),
        t("receiptDate"),
        t("prodOperationFinishedAt"),
        t("employee"),
        t("prodStickers"),
        t("prodDoneQty"),
        t("prodSalary"),
      ];
      details = sortedRows.flatMap((row) =>
        row.batches.flatMap((batch) =>
          batch.items.flatMap((item) =>
            item.operations.flatMap((operation) =>
              operation.employees.map((employee) => [
                row.order_number || t("prodNoOrder"),
                batch.batch_number,
                [itemTitle(item), itemAttributes(item)].filter(Boolean).join(" · "),
                operation.name,
                fmtDate(operation.arrived_at),
                fmtDate(operation.finished_at),
                employee.label,
                employee.stickers,
                employee.qty,
                employee.amount,
              ]),
            ),
          ),
        ),
      );
    } else if (tab === "operation") {
      header = [
        t("operationType"),
        t("prodStickers"),
        t("prodDoneQty"),
        t("prodAvgRate"),
        t("prodDeduction"),
        t("prodSalary"),
        t("prodBatchesCount"),
        t("prodEmployeesCount"),
      ];
      summary = sortedRows.map((row) => [
        row.name,
        row.stickers,
        row.qty,
        row.avg_rate,
        row.deduction ?? 0,
        row.amount,
        row.batches_count,
        row.employees_count,
      ]);
      detailHeader = [
        t("operationType"),
        t("employee"),
        t("prodStickers"),
        t("prodDoneQty"),
        t("prodDeduction"),
        t("prodSalary"),
      ];
      details = sortedRows.flatMap((row) =>
        row.employees.map((employee) => [
          row.name,
          employee.label,
          employee.stickers,
          employee.qty,
          employee.deduction ?? 0,
          employee.amount,
        ]),
      );
    } else if (tab === "monitoring") {
      // Как на экране: у каждой операции (и у «Итого») три колонки — пришло / в процессе / завершено
      const groupSources = [...sortedRows, totals || {}];
      header = [...sortedRows.map((row) => row.name), t("total")].flatMap((name) => [name, "", ""]);
      summary = [
        groupSources.flatMap(() => MONITORING_METRICS.map(({ label }) => t(label))),
        groupSources.flatMap((source) => MONITORING_METRICS.map(({ field }) => source[field] ?? 0)),
      ];
      detailHeader = [
        t("operationType"),
        t("batchNumber"),
        t("customerOrderNumber"),
        ...MONITORING_METRICS.map(({ label }) => t(label)),
      ];
      details = sortedRows.flatMap((row) =>
        row.batches.map((batch) => [
          row.name,
          batch.batch_number,
          batch.order_number || t("prodNoOrder"),
          ...MONITORING_METRICS.map(({ field }) => batch[field]),
        ]),
      );
    } else if (tab === "sticker") {
      // Постраничная вкладка: в файл попадает текущая страница, без листа деталей
      header = [
        t("workStickerCode"),
        t("batchNumber"),
        t("operationType"),
        t("status"),
        t("workStickerPlannedQuantity"),
        t("prodDoneQty"),
        t("prodScrapQty"),
        t("prodReworkQty"),
        t("price"),
        t("prodSalary"),
        t("employee"),
        t("workStickerPrevSticker"),
        t("prodStickerPrintedAt"),
        t("prodStickerAcceptedAt"),
        t("prodStickerScannedBy"),
      ];
      summary = sortedRows.map((row) => [
        row.sticker_code,
        row.batch_number || "",
        row.operation_name,
        t(STICKER_STATUS_KEYS[row.status]),
        row.planned_qty,
        row.actual_qty,
        row.defect_qty,
        row.rework_qty,
        row.rate ?? "",
        row.amount ?? "",
        row.workers.map((worker) => worker.label).join(", "),
        row.parent?.sticker_code || "",
        fmtDateTime(row.added_at),
        fmtDateTime(row.scanned_at),
        row.scanned_by || "",
      ]);
    } else {
      header = [
        t("employee"),
        t("prodStickers"),
        t("prodDoneQty"),
        t("prodScrapQty"),
        t("prodReworkQty"),
        t("prodAvgRate"),
        t("prodDeduction"),
        t("prodSalary"),
        t("prodBatchesCount"),
        t("prodOperationsCount"),
      ];
      summary = sortedRows.map((row) => [
        row.label,
        row.stickers,
        row.qty,
        row.defect_qty,
        row.rework_qty,
        row.avg_rate,
        row.deduction ?? 0,
        row.amount,
        row.batches_count,
        row.operations_count,
      ]);
      detailHeader = [
        t("employee"),
        t("batchNumber"),
        t("operationType"),
        t("prodStickers"),
        t("prodDoneQty"),
        t("prodAvgRate"),
        t("prodDeduction"),
        t("prodSalary"),
      ];
      details = sortedRows.flatMap((row) =>
        row.details.map((detail) => [
          row.label,
          detail.batch_number,
          detail.name,
          detail.stickers,
          detail.qty,
          detail.avg_rate,
          detail.deduction ?? 0,
          detail.amount,
        ]),
      );
    }

    const summarySheet = XLSX.utils.aoa_to_sheet([
      [t("production-report")],
      [title, period].filter(Boolean),
      [],
      header,
      ...summary,
    ]);
    summarySheet["!cols"] = header.map((_, i) => ({ wch: i === 0 ? 30 : 16 }));

    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, summarySheet, tab);
    if (details) {
      const detailSheet = XLSX.utils.aoa_to_sheet([detailHeader, ...details]);
      detailSheet["!cols"] = detailHeader.map((_, i) => ({ wch: i === 0 ? 30 : 18 }));
      XLSX.utils.book_append_sheet(book, detailSheet, "details");
    }
    const buffer = XLSX.write(book, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buffer], { type: "application/octet-stream" }),
      `production-report-${tab}-${dayjs().format("YYYY-MM-DD")}.xlsx`,
    );
  };

  // «Удержано» за возврат на исправление: пусто — прочерк, иначе красным
  const renderDeduction = (value) => (
    <td className={value ? styles.negativeCell : ""}>{value ? fmtMoney(value) : "—"}</td>
  );

  const renderProgress = (progress) => (
    <div className={styles.progress}>
      <div className={styles.progressBar} style={{ width: `${Math.min(progress, 100)}%` }} />
      <span>{progress}%</span>
    </div>
  );

  // Партия → позиции → операции → сотрудники операции; каждый уровень раскрывается по клику
  const renderBatchOperation = (op, parentKey) => {
    const operationKey = `${parentKey}/operation-${op.operation_type_id}`;
    const operationOpen = expanded.has(operationKey);
    return (
      <Fragment key={op.operation_type_id}>
        <tr className={styles.clickRow} onClick={() => toggleExpanded(operationKey)}>
          <td>
            <div className={styles.treeToggle}>
              {renderChevron(operationOpen)}
              {op.name}
            </div>
          </td>
          <td>{fmtDate(op.arrived_at)}</td>
          <td>{fmtDate(op.finished_at)}</td>
          <td>{op.stickers_done}</td>
          <td>{fmtQty(op.done_qty)}</td>
          <td>{fmtQty(op.rework_qty)}</td>
          <td className={op.scrap_qty ? styles.negativeCell : ""}>{fmtQty(op.scrap_qty)}</td>
          <td>{fmtQty(op.pending_qty)}</td>
          <td>{renderProgress(op.progress)}</td>
          <td>{fmtMoney(op.amount)}</td>
          <td>{op.employees_count}</td>
        </tr>
        {operationOpen && (
          <tr>
            <td colSpan={BATCH_OPERATION_COLS} className={styles.nestedCell}>
              <table className={styles.detailTable}>
                <thead>
                  <tr>
                    <th>{t("employee")}</th>
                    <th>{t("prodStickers")}</th>
                    <th>{t("prodDoneQty")}</th>
                    <th>{t("prodDeduction")}</th>
                    <th>{t("prodSalary")}</th>
                  </tr>
                </thead>
                <tbody>
                  {op.employees.length > 0 ? (
                    op.employees.map((employee) => (
                      <tr key={employee.employee_id}>
                        <td>
                          <EmployeeCell
                            photo={employee.employeePhoto}
                            fullName={employee.label}
                            id={employee.employee_id}
                            branch={employee.branchName}
                            department={employee.departmentName}
                            active={employee.employee_status !== false}
                          />
                        </td>
                        <td>{employee.stickers}</td>
                        <td>{fmtQty(employee.qty)}</td>
                        {renderDeduction(employee.deduction)}
                        <td>{fmtMoney(employee.amount)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5">{t("noData")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  const renderBatchOperations = (item, itemKey) => (
    <table className={styles.detailTable}>
      <thead>
        <tr>
          <th>{t("operationType")}</th>
          <th title={t("prodOperationArrivedHint")}>{t("receiptDate")}</th>
          <th title={t("prodOperationFinishedHint")}>{t("prodOperationFinishedAt")}</th>
          <th>{t("prodStickers")}</th>
          <th>{t("prodDoneQty")}</th>
          <th>{t("prodReworkQty")}</th>
          <th>{t("prodScrapQty")}</th>
          <th>{t("workStickerPending")}</th>
          <th>{t("prodProgress")}</th>
          <th>{t("prodSalary")}</th>
          <th>{t("prodEmployeesCount")}</th>
        </tr>
      </thead>
      <tbody>
        {item.operations.length > 0 ? (
          item.operations.map((op) => renderBatchOperation(op, itemKey))
        ) : (
          <tr>
            <td colSpan={BATCH_OPERATION_COLS}>{t("noData")}</td>
          </tr>
        )}
      </tbody>
    </table>
  );

  const renderBatchItem = (item, parentKey) => {
    const itemKey = `${parentKey}/${item.key}`;
    const itemOpen = expanded.has(itemKey);
    const attributes = itemAttributes(item);
    return (
      <Fragment key={item.key}>
        <tr className={styles.clickRow} onClick={() => toggleExpanded(itemKey)}>
          <td>
            <div className={styles.treeToggle}>
              {renderChevron(itemOpen)}
              <div>
                <div>{itemTitle(item)}</div>
                {attributes && <div className={styles.batchMeta}>{attributes}</div>}
              </div>
            </div>
          </td>
          <td>{fmtQty(item.received_qty)}</td>
          <td>{item.stickers_done}</td>
          <td style={{ fontWeight: 700 }}>{fmtQty(item.finished_qty)}</td>
          <td>{fmtQty(item.rework_qty)}</td>
          <td className={item.scrap_qty ? styles.negativeCell : ""}>{fmtQty(item.scrap_qty)}</td>
          <td>{fmtQty(item.pending_qty)}</td>
          <td>{renderProgress(item.progress)}</td>
          <td>{fmtMoney(item.amount)}</td>
          <td>{item.employees_count}</td>
        </tr>
        {itemOpen && (
          <tr>
            <td colSpan={BATCH_ITEM_COLS} className={styles.nestedCell}>
              {renderBatchOperations(item, itemKey)}
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  // parentKey — ключ раскрытия партии (партия лежит под заказом)
  const renderBatchDetail = (row, parentKey) => (
    <div className={styles.detailBlock}>
      <table className={styles.detailTable}>
        <thead>
          <tr>
            <th>{t("lineItems")}</th>
            <th>{t("quantity")}</th>
            <th>{t("prodStickers")}</th>
            <th>{t("prodDoneQty")}</th>
            <th>{t("prodReworkQty")}</th>
            <th>{t("prodScrapQty")}</th>
            <th>{t("workStickerPending")}</th>
            <th>{t("prodProgress")}</th>
            <th>{t("prodSalary")}</th>
            <th>{t("prodEmployeesCount")}</th>
          </tr>
        </thead>
        <tbody>
          {row.items.length > 0 ? (
            row.items.map((item) => renderBatchItem(item, parentKey))
          ) : (
            <tr>
              <td colSpan={BATCH_ITEM_COLS}>{t("noData")}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderEmployeeDetail = (row) => (
    <div className={styles.detailBlock}>
      <table className={styles.detailTable}>
        <thead>
          <tr>
            <th>{t("batchNumber")}</th>
            <th>{t("customer")}</th>
            <th>{t("operationType")}</th>
            <th>{t("prodStickers")}</th>
            <th>{t("prodDoneQty")}</th>
            <th>{t("prodAvgRate")}</th>
            <th>{t("prodDeduction")}</th>
            <th>{t("prodSalary")}</th>
          </tr>
        </thead>
        <tbody>
          {row.details.map((detail) => (
            <tr key={`${detail.batch_id}-${detail.operation_type_id}`}>
              <td>{detail.batch_number}</td>
              <td>{detail.customer || "—"}</td>
              <td>{detail.name}</td>
              <td>{detail.stickers}</td>
              <td>{fmtQty(detail.qty)}</td>
              <td>{fmtMoney(detail.avg_rate)}</td>
              {renderDeduction(detail.deduction)}
              <td>{fmtMoney(detail.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderOperationDetail = (row) => (
    <div className={styles.detailWrap}>
      <div className={styles.detailBlock}>
        <div className={styles.detailTitle}>{t("productionReportByEmployee")}</div>
        <table className={styles.detailTable}>
          <thead>
            <tr>
              <th>{t("employee")}</th>
              <th>{t("prodStickers")}</th>
              <th>{t("prodDoneQty")}</th>
              <th>{t("prodDeduction")}</th>
              <th>{t("prodSalary")}</th>
            </tr>
          </thead>
          <tbody>
            {row.employees.map((employee) => (
              <tr key={employee.employee_id}>
                <td>
                  <EmployeeCell
                    photo={employee.employeePhoto}
                    fullName={employee.label}
                    id={employee.employee_id}
                    branch={employee.branchName}
                    department={employee.departmentName}
                    active={employee.employee_status !== false}
                  />
                </td>
                <td>{employee.stickers}</td>
                <td>{fmtQty(employee.qty)}</td>
                {renderDeduction(employee.deduction)}
                <td>{fmtMoney(employee.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.detailBlock}>
        <div className={styles.detailTitle}>{t("productionReportByBatch")}</div>
        <table className={styles.detailTable}>
          <thead>
            <tr>
              <th>{t("batchNumber")}</th>
              <th>{t("receiptDate")}</th>
              <th>{t("customer")}</th>
              <th>{t("prodStickers")}</th>
              <th>{t("prodDoneQty")}</th>
              <th>{t("prodDeduction")}</th>
              <th>{t("prodSalary")}</th>
            </tr>
          </thead>
          <tbody>
            {row.batches.map((batch) => (
              <tr key={batch.batch_id}>
                <td>{batch.batch_number}</td>
                <td>{fmtDate(batch.receipt_date)}</td>
                <td>{batch.customer || "—"}</td>
                <td>{batch.stickers}</td>
                <td>{fmtQty(batch.qty)}</td>
                {renderDeduction(batch.deduction)}
                <td>{fmtMoney(batch.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderEmployeeTable = () => (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.expandCol} />
          <th>№</th>
          {renderTh("label", t("employee"), styles.employeeCol)}
          {renderTh("stickers", t("prodStickers"))}
          {renderTh("qty", t("prodDoneQty"))}
          {renderTh(
            "defect_qty",
            <>
              {t("prodScrapQty")}
              <span
                className={styles.hintIcon}
                title={t("prodEmployeeDefectHint")}
                onClick={(e) => e.stopPropagation()}
              >
                <Info size={12} />
              </span>
            </>,
          )}
          {renderTh(
            "rework_qty",
            <>
              {t("prodReworkQty")}
              <span
                className={styles.hintIcon}
                title={t("prodEmployeeReworkHint")}
                onClick={(e) => e.stopPropagation()}
              >
                <Info size={12} />
              </span>
            </>,
          )}
          {renderTh("avg_rate", t("prodAvgRate"))}
          {renderTh(
            "deduction",
            <>
              {t("prodDeduction")}
              <span className={styles.hintIcon} title={t("prodDeductionHint")} onClick={(e) => e.stopPropagation()}>
                <Info size={12} />
              </span>
            </>,
          )}
          {renderTh("amount", t("prodSalary"))}
          {renderTh("batches_count", t("prodBatchesCount"))}
          {renderTh("operations_count", t("prodOperationsCount"))}
        </tr>
      </thead>
      <tbody>
        {sortedRows.length > 0 ? (
          sortedRows.map((row, i) => (
            <Fragment key={row.key}>
              <tr className={styles.clickRow} onClick={() => toggleExpanded(row.key)}>
                <td className={styles.expandCol}>
                  {expanded.has(row.key) ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </td>
                <td>{i + 1}</td>
                <td className={styles.nameCell}>
                  <EmployeeCell
                    photo={row.employeePhoto}
                    fullName={row.label}
                    id={row.employee_id}
                    branch={row.branchName}
                    department={row.departmentName}
                    active={row.employee_status !== false}
                  />
                </td>
                <td>{row.stickers}</td>
                <td>{fmtQty(row.qty)}</td>
                <td className={row.defect_qty ? styles.negativeCell : ""}>
                  {row.defect_qty ? fmtQty(row.defect_qty) : "—"}
                </td>
                <td>{row.rework_qty ? fmtQty(row.rework_qty) : "—"}</td>
                <td>{fmtMoney(row.avg_rate)}</td>
                {renderDeduction(row.deduction)}
                <td className={styles.amountCell}>{fmtMoney(row.amount)}</td>
                <td>{row.batches_count}</td>
                <td>{row.operations_count}</td>
              </tr>
              {expanded.has(row.key) && (
                <tr className={styles.detailRow}>
                  <td colSpan={EMPLOYEE_COLS}>{renderEmployeeDetail(row)}</td>
                </tr>
              )}
            </Fragment>
          ))
        ) : (
          <tr>
            <td colSpan={EMPLOYEE_COLS}>{t("noData")}</td>
          </tr>
        )}
      </tbody>
      {totals && sortedRows.length > 0 && (
        <tfoot>
          <tr>
            <td colSpan="3">{t("total")}</td>
            <td>{totals.stickers}</td>
            <td>{fmtQty(totals.qty)}</td>
            <td>{fmtQty(totals.defect_qty)}</td>
            <td>{fmtQty(totals.rework_qty)}</td>
            <td>{fmtMoney(totals.qty > 0 ? (totals.amount + (totals.deduction || 0)) / totals.qty : 0)}</td>
            {renderDeduction(totals.deduction)}
            <td>{fmtMoney(totals.amount)}</td>
            <td>{totals.batches_count}</td>
            <td>—</td>
          </tr>
        </tfoot>
      )}
    </table>
  );

  const renderOperationTable = () => (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.expandCol} />
          <th>№</th>
          {renderTh("name", t("operationType"), styles.operationCol)}
          {renderTh("stickers", t("prodStickers"))}
          {renderTh("qty", t("prodDoneQty"))}
          {renderTh("avg_rate", t("prodAvgRate"))}
          {renderTh(
            "deduction",
            <>
              {t("prodDeduction")}
              <span className={styles.hintIcon} title={t("prodDeductionHint")} onClick={(e) => e.stopPropagation()}>
                <Info size={12} />
              </span>
            </>,
          )}
          {renderTh("amount", t("prodSalary"))}
          {renderTh("batches_count", t("prodBatchesCount"))}
          {renderTh("employees_count", t("prodEmployeesCount"))}
        </tr>
      </thead>
      <tbody>
        {sortedRows.length > 0 ? (
          sortedRows.map((row, i) => (
            <Fragment key={row.key}>
              <tr className={styles.clickRow} onClick={() => toggleExpanded(row.key)}>
                <td className={styles.expandCol}>
                  {expanded.has(row.key) ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </td>
                <td>{i + 1}</td>
                <td className={`${styles.nameCell} ${styles.operationCol}`}>{row.name}</td>
                <td>{row.stickers}</td>
                <td>{fmtQty(row.qty)}</td>
                <td>{fmtMoney(row.avg_rate)}</td>
                {renderDeduction(row.deduction)}
                <td className={styles.amountCell}>{fmtMoney(row.amount)}</td>
                <td>{row.batches_count}</td>
                <td>{row.employees_count}</td>
              </tr>
              {expanded.has(row.key) && (
                <tr className={styles.detailRow}>
                  <td colSpan={OPERATION_COLS}>{renderOperationDetail(row)}</td>
                </tr>
              )}
            </Fragment>
          ))
        ) : (
          <tr>
            <td colSpan={OPERATION_COLS}>{t("noData")}</td>
          </tr>
        )}
      </tbody>
      {totals && sortedRows.length > 0 && (
        <tfoot>
          <tr>
            <td colSpan="3">{t("total")}</td>
            <td>{totals.stickers}</td>
            <td>{fmtQty(totals.qty)}</td>
            <td>{fmtMoney(totals.qty > 0 ? (totals.amount + (totals.deduction || 0)) / totals.qty : 0)}</td>
            {renderDeduction(totals.deduction)}
            <td>{fmtMoney(totals.amount)}</td>
            <td>{totals.batches_count}</td>
            <td>{totals.employees_count}</td>
          </tr>
        </tfoot>
      )}
    </table>
  );

  // Ноль в мониторинге — прочерк: движение есть не по каждой операции
  const monitoringQty = (value) => (value ? fmtQty(value) : "—");

  // Цвет только у ячейки с движением — пустая остаётся нейтральной
  const monitoringTone = (tone, value) => (value ? styles[tone] : "");

  // Мониторинг: операция — карточка с тремя ячейками по горизонтали (пришло / в процессе /
  // завершено); карточки не влезают в строку — переносятся на следующую. Последняя — «Итого»
  const renderMonitoringTable = () => {
    if (sortedRows.length === 0) {
      return (
        <table className={styles.table}>
          <tbody>
            <tr>
              <td>{t("noData")}</td>
            </tr>
          </tbody>
        </table>
      );
    }

    const cards = [
      ...sortedRows.map((row) => ({
        key: row.key,
        name: row.name,
        values: row,
        batches: row.batches,
      })),
      { key: "total", name: t("total"), values: totals || {}, total: true },
    ];

    return (
      <div className={styles.monitoringGrid}>
        {cards.map((card) => (
          <div
            key={card.key}
            className={`${styles.monitoringCard} ${card.total ? styles.monitoringTotal : ""}`}
          >
            <div className={styles.monitoringCardTitle}>{card.name}</div>
            <div className={styles.monitoringCells}>
              {MONITORING_METRICS.map(({ field, label, tone }) => (
                <div
                  key={field}
                  className={`${styles.monitoringCell} ${monitoringTone(tone, card.values[field])}`}
                >
                  <div className={styles.monitoringLabel}>{t(label)}</div>
                  <div className={styles.monitoringValue}>{monitoringQty(card.values[field])}</div>
                </div>
              ))}
            </div>
            {card.batches?.length > 0 && (
              <div className={styles.monitoringBatches}>
                {card.batches.map((batch) => (
                  <div key={batch.batch_id} className={styles.monitoringBatch}>
                    <div className={styles.monitoringBatchHead}>
                      <span className={styles.batchNumber}>
                        {t("batchNumber")}: {batch.batch_number}
                      </span>
                      <span className={styles.batchMeta}>
                        {t("customerOrderNumber")}: {batch.order_number || t("prodNoOrder")}
                      </span>
                    </div>
                    <div className={styles.monitoringCells}>
                      {MONITORING_METRICS.map(({ field, tone }) => (
                        <div
                          key={field}
                          className={`${styles.monitoringCell} ${monitoringTone(tone, batch[field])}`}
                        >
                          <div className={styles.monitoringValue}>
                            {monitoringQty(batch[field])}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Партии заказа: та же строка, что в отчёте по партиям, раскрывается до позиций
  // (партия → позиции → операции → сотрудники)
  const renderOrderBatch = (batch, parentKey) => {
    const batchKey = `${parentKey}/${batch.key}`;
    const batchOpen = expanded.has(batchKey);
    return (
      <Fragment key={batch.key}>
        <tr className={styles.clickRow} onClick={() => toggleExpanded(batchKey)}>
          <td>
            <div className={styles.treeToggle}>
              {renderChevron(batchOpen)}
              <div>
                <div>{batch.batch_number}</div>
                <div className={styles.batchMeta}>
                  {[batch.document_number, batch.customer].filter(Boolean).join(" · ")}
                </div>
              </div>
            </div>
          </td>
          <td>{fmtDate(batch.receipt_date)}</td>
          <td>{fmtQty(batch.received_qty)}</td>
          <td>{fmtQty(batch.pending_qty)}</td>
          <td style={{ fontWeight: 700 }}>{fmtQty(batch.finished_qty)}</td>
          <td>{renderProgress(batch.progress)}</td>
          <td>{fmtQty(batch.rework_qty)}</td>
          <td className={batch.scrap_qty ? styles.negativeCell : ""}>{fmtQty(batch.scrap_qty)}</td>
          <td>{fmtMoney(batch.amount)}</td>
          <td>{batch.employees_count}</td>
        </tr>
        {batchOpen && (
          <tr>
            <td colSpan={ORDER_BATCH_COLS} className={styles.nestedCell}>
              {renderBatchDetail(batch, batchKey)}
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  const renderOrderDetail = (row) => (
    <div className={styles.detailBlock}>
      <table className={styles.detailTable}>
        <thead>
          <tr>
            <th>{t("batchNumber")}</th>
            <th>{t("receiptDate")}</th>
            <th>{t("prodBatchQty")}</th>
            <th>{t("workStickerPending")}</th>
            <th>{t("prodDoneQty")}</th>
            <th>{t("prodProgress")}</th>
            <th>{t("prodReworkQty")}</th>
            <th>{t("prodScrapQty")}</th>
            <th>{t("prodSalary")}</th>
            <th>{t("prodEmployeesCount")}</th>
          </tr>
        </thead>
        <tbody>{row.batches.map((batch) => renderOrderBatch(batch, row.key))}</tbody>
      </table>
    </div>
  );

  const renderOrderTable = () => (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.expandCol} />
          <th>№</th>
          {renderTh("order_number", t("customerOrderNumber"), styles.batchCol)}
          {renderTh("batches_count", t("prodBatchesCount"))}
          {renderTh("received_qty", t("prodBatchQty"))}
          {renderTh("pending_qty", t("workStickerPending"))}
          {renderTh("finished_qty", t("prodDoneQty"))}
          {renderTh("progress", t("prodProgress"))}
          {renderTh("rework_qty", t("prodReworkQty"))}
          {renderTh("scrap_qty", t("prodScrapQty"))}
          {renderTh("amount", t("prodSalary"))}
          {renderTh("employees_count", t("prodEmployeesCount"))}
        </tr>
      </thead>
      <tbody>
        {sortedRows.length > 0 ? (
          sortedRows.map((row, i) => (
            <Fragment key={row.key}>
              <tr className={styles.clickRow} onClick={() => toggleExpanded(row.key)}>
                <td className={styles.expandCol}>{renderChevron(expanded.has(row.key))}</td>
                <td>{i + 1}</td>
                <td className={`${styles.nameCell} ${styles.batchCol}`}>
                  <div className={styles.batchNumber}>
                    {row.order_number || t("prodNoOrder")}
                  </div>
                  {row.customers.length > 0 && (
                    <div className={styles.batchMeta}>{row.customers.join(" · ")}</div>
                  )}
                </td>
                <td>{row.batches_count}</td>
                <td>{fmtQty(row.received_qty)}</td>
                <td>{fmtQty(row.pending_qty)}</td>
                <td style={{ fontWeight: 700 }}>{fmtQty(row.finished_qty)}</td>
                <td>{renderProgress(row.progress)}</td>
                <td>{fmtQty(row.rework_qty)}</td>
                <td className={row.scrap_qty ? styles.negativeCell : ""}>
                  {fmtQty(row.scrap_qty)}
                </td>
                <td className={styles.amountCell}>{fmtMoney(row.amount)}</td>
                <td>{row.employees_count}</td>
              </tr>
              {expanded.has(row.key) && (
                <tr className={styles.detailRow}>
                  <td colSpan={ORDER_COLS}>{renderOrderDetail(row)}</td>
                </tr>
              )}
            </Fragment>
          ))
        ) : (
          <tr>
            <td colSpan={ORDER_COLS}>{t("noData")}</td>
          </tr>
        )}
      </tbody>
      {totals && sortedRows.length > 0 && (
        <tfoot>
          <tr>
            <td colSpan="3">{t("total")}</td>
            <td>{totals.batches_count}</td>
            <td>{fmtQty(totals.received_qty)}</td>
            <td>{fmtQty(totals.pending_qty)}</td>
            <td>{fmtQty(totals.finished_qty)}</td>
            <td>{totalProgress}%</td>
            <td>{fmtQty(totals.rework_qty)}</td>
            <td>{fmtQty(totals.scrap_qty)}</td>
            <td>{fmtMoney(totals.amount)}</td>
            <td>{totals.employees_count}</td>
          </tr>
        </tfoot>
      )}
    </table>
  );

  // Строка на стикер; раскрытие — хронология: предыдущие стикеры → этот → дочерние
  const renderStickerTable = () => {
    const offset = ((pagination?.currentPage ?? 1) - 1) * (pagination?.pageSize ?? pageSize);
    const cols = STICKER_COLS + (canEdit ? 1 : 0);
    return (
      <table className={styles.table}>
        <thead>
          <tr>
            {canEdit && (
              <th className={styles.checkCol} title={t("prodRateSelectHint")}>
                <input
                  type="checkbox"
                  checked={allEditableSelected}
                  disabled={editableRows.length === 0}
                  ref={(el) => {
                    if (el) el.indeterminate = someEditableSelected && !allEditableSelected;
                  }}
                  onChange={toggleAllEditable}
                />
              </th>
            )}
            <th className={styles.expandCol} />
            <th>№</th>
            <th className={styles.batchCol}>{t("workStickerCode")}</th>
            <th>{t("operationType")}</th>
            <th>{t("status")}</th>
            <th>{t("workStickerPlannedQuantity")}</th>
            <th>{t("prodDoneQty")}</th>
            <th>{t("prodScrapQty")}</th>
            <th>{t("prodReworkQty")}</th>
            <th>{t("price")}</th>
            <th>{t("prodSalary")}</th>
            <th className={styles.employeeCol}>{t("employee")}</th>
            <th>{t("workStickerPrevSticker")}</th>
            <th>{t("prodStickerPrintedAt")}</th>
            <th>{t("prodStickerAcceptedAt")}</th>
            <th>{t("prodStickerScannedBy")}</th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.length > 0 ? (
            sortedRows.map((row, i) => (
              <Fragment key={row.key}>
                <tr
                  className={`${styles.clickRow} ${selected.has(row.id) ? styles.selectedRow : ""}`}
                  onClick={() => toggleExpandedSingle(row.key)}
                >
                  {canEdit && (
                    <td className={styles.checkCol} onClick={(e) => e.stopPropagation()}>
                      {isRateEditable(row) && (
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          onChange={() => toggleSelected(row)}
                        />
                      )}
                    </td>
                  )}
                  <td className={styles.expandCol}>{renderChevron(expanded.has(row.key))}</td>
                  <td>{offset + i + 1}</td>
                  <td className={`${styles.nameCell} ${styles.batchCol}`}>
                    <div className={styles.batchNumber}>{row.sticker_code}</div>
                    <div className={styles.batchMeta}>
                      {[row.batch_number, row.product_name, row.size].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td>{row.operation_name}</td>
                  <td>
                    <StickerStatusBadge status={row.status} />
                  </td>
                  <td>{fmtQty(row.planned_qty)}</td>
                  <td>{row.status === "done" ? fmtQty(row.actual_qty) : "—"}</td>
                  <td className={row.defect_qty ? styles.negativeCell : ""}>
                    {row.defect_qty ? fmtQty(row.defect_qty) : "—"}
                  </td>
                  <td>{row.rework_qty ? fmtQty(row.rework_qty) : "—"}</td>
                  <td>
                    <div className={styles.rateCell}>
                      {row.rate !== null ? fmtMoney(row.rate) : "—"}
                      {isRateEditable(row) && (
                        <button
                          type="button"
                          className={styles.editRateBtn}
                          title={t("prodRateEdit")}
                          onClick={(e) => {
                            e.stopPropagation();
                            openRateEdit([row]);
                          }}
                        >
                          <Pencil size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className={styles.amountCell}>
                    {row.amount !== null ? fmtMoney(row.amount) : "—"}
                  </td>
                  <td className={`${styles.nameCell} ${styles.employeeCol}`}>
                    {row.workers.length > 0 ? (
                      <div className={styles.workersCell}>
                        {row.workers[0].hidden ? (
                          "—"
                        ) : (
                          <EmployeeCell
                            photo={row.workers[0].employeePhoto}
                            fullName={row.workers[0].label}
                            id={row.workers[0].employee_id}
                            branch={row.workers[0].branchName}
                            department={row.workers[0].departmentName}
                            active={row.workers[0].employee_status !== false}
                          />
                        )}
                        {row.workers.length > 1 && (
                          <span className={styles.moreWorkers}>+{row.workers.length - 1}</span>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {row.parent ? (
                      <>
                        <div className={styles.batchNumber}>{row.parent.sticker_code}</div>
                        <div className={styles.batchMeta}>{row.parent.operation_name}</div>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{fmtDateTime(row.added_at)}</td>
                  <td>{fmtDateTime(row.scanned_at)}</td>
                  <td>{row.scanned_by || "—"}</td>
                </tr>
                {expanded.has(row.key) && (
                  <tr className={styles.detailRow}>
                    <td colSpan={cols}>
                      <StickerChronology stickerId={row.id} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))
          ) : (
            <tr>
              <td colSpan={cols}>{t("noData")}</td>
            </tr>
          )}
        </tbody>
        {totals && sortedRows.length > 0 && (
          <tfoot>
            <tr>
              <td colSpan={cols} className={styles.summaryCell}>
                {t("total")}: {totals.stickers} · {t("workStickerPending")}: {totals.pending} ·{" "}
                {t("workStickerDone")}: {totals.done} · {t("prodScrapQty")}: {totals.scrapped}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    );
  };

  const tableRenderers = {
    monitoring: renderMonitoringTable,
    employee: renderEmployeeTable,
    operation: renderOperationTable,
    order: renderOrderTable,
    sticker: renderStickerTable,
  };

  return (
    <div className={styles.page}>
      <div className={styles.main}>
        <div className={styles.tabs}>
          {Object.keys(TAB_TITLES).map((key) => (
            <button
              key={key}
              type="button"
              className={`${styles.tab} ${tab === key ? styles.tabActive : ""}`}
              onClick={() => setTab(key)}
            >
              {t(TAB_TITLES[key])}
            </button>
          ))}
        </div>

        <div className={styles.mainHeader}>
          <div className={styles.filterWrapper}>
            {/* key: Search держит поиск в ref от первого рендера — на новой вкладке
                он должен начинаться с её фильтров. Debounce уже ушедшей вкладки
                (Search не чистит таймер при unmount) отбрасываем */}
            <Search
              key={tab}
              formData={current}
              setFormData={setCurrentFilters}
              onSearch={(next) => {
                if (tabRef.current === tab) applyFilters(next);
              }}
            />

            <div className={styles.filterField}>
              <label>{t("dateFrom")}</label>
              <input
                type="date"
                name="date_from"
                value={current.date_from}
                onChange={handleFilterChange}
              />
            </div>

            <div className={styles.filterField}>
              <label>{t("dateTo")}</label>
              <input
                type="date"
                name="date_to"
                value={current.date_to}
                onChange={handleFilterChange}
              />
            </div>

            <div className={styles.filterField}>
              <label>{t("operationType")}</label>
              <select
                name="operation_type_id"
                value={current.operation_type_id}
                onChange={handleFilterChange}
              >
                <option value="">{t("all")}</option>
                {filterOperationTypes(operationTypes).map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            {tab === "sticker" && (
              <div className={styles.filterField}>
                <label>{t("status")}</label>
                <select name="status" value={current.status} onChange={handleFilterChange}>
                  <option value="">{t("all")}</option>
                  {Object.entries(STICKER_STATUS_KEYS).map(([status, key]) => (
                    <option key={status} value={status}>
                      {t(key)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {tab === "sticker" && (
              <div className={styles.filterField}>
                <label>{t("size")}</label>
                <select name="size" value={current.size} onChange={handleFilterChange}>
                  <option value="">{t("all")}</option>
                  {stickerAttrFilters.sizes.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {tab === "sticker" && (
              <div className={styles.filterField}>
                <label>{t("design")}</label>
                <select name="design" value={current.design} onChange={handleFilterChange}>
                  <option value="">{t("all")}</option>
                  {stickerAttrFilters.designs.map((design) => (
                    <option key={design} value={design}>
                      {design}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {tab === "sticker" && (
              <div className={styles.filterField}>
                <label>{t("material")}</label>
                <select name="material" value={current.material} onChange={handleFilterChange}>
                  <option value="">{t("all")}</option>
                  {stickerAttrFilters.materials.map((material) => (
                    <option key={material} value={material}>
                      {material}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {tab === "sticker" && (
              <div className={styles.filterField}>
                <label>{t("grammage")}</label>
                <select name="grammage" value={current.grammage} onChange={handleFilterChange}>
                  <option value="">{t("all")}</option>
                  {stickerAttrFilters.grammages.map((grammage) => (
                    <option key={grammage} value={grammage}>
                      {grammage}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {tab === "sticker" && pagination && (
            <Pagination
              currentPage={pagination.currentPage}
              pageSize={pagination.pageSize}
              totalItems={pagination.totalItems}
              totalPages={pagination.totalPages}
              handleChangePageSize={handleChangePageSize}
              handlePageChange={handlePageChange}
            />
          )}

          <div className={styles.buttonsWrapper}>
            <button
              type="button"
              className={styles.exportBtn}
              onClick={exportToExcel}
              disabled={sortedRows.length === 0}
            >
              {Icons.excel}
              {t("exportExcel")}
            </button>
            <div
              className={styles.refreshBtn}
              onClick={() => fetchReport(tab, current, pagination?.currentPage ?? 1)}
            >
              {Icons.refresh}
            </div>
          </div>
        </div>

        <div className={styles.hint}>{t(TAB_HINTS[tab])}</div>

        {tab === "sticker" && selected.size > 0 && (
          <div className={styles.bulkBar}>
            <span className={styles.bulkCount}>
              {t("selected")}: <b>{selected.size}</b>
            </span>
            <div className={styles.bulkActions}>
              <button
                type="button"
                className={styles.bulkAction}
                onClick={() => openRateEdit([...selected.values()])}
              >
                <Pencil size={14} />
                {t("prodRateEdit")}
              </button>
            </div>
            <button type="button" className={styles.bulkClear} onClick={() => setSelected(new Map())}>
              <X size={14} />
              {t("clearSelection")}
            </button>
          </div>
        )}

        {loading || !ready ? (
          <Loading />
        ) : (
          <div className={styles.tableContainer}>{tableRenderers[tab]()}</div>
        )}
      </div>

      <StickerRateModal
        isOpen={rateOpen}
        stickers={rateRows}
        onClose={() => setRateOpen(false)}
        onSaved={handleRateSaved}
      />
    </div>
  );
};

export default ProductionReportPage;
