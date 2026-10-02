import { Fragment, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";
import { ChevronDown, ChevronRight } from "lucide-react";

import { useAlertStore } from "../stores/alertStore";
import {
  getActiveBranches,
  getActiveStockLocations,
  getActiveStockPickingTypes,
  getStockReportBalanceLots,
  getStockReportBalances,
  getStockReportMovements,
  getStockReportTurnover,
  getStockReportTurnoverLots,
} from "../api";

import Loading from "../components/Loading";
import Pagination from "../components/Pagination";
import Search from "../components/Search";
import { Icons } from "../icons/icons";

import styles from "./StockPage.module.scss";

const TAB_TITLES = {
  balances: "stockReportBalances",
  movements: "stockReportMovements",
  turnover: "stockReportTurnover",
};

const LOADERS = {
  balances: getStockReportBalances,
  movements: getStockReportMovements,
  turnover: getStockReportTurnover,
};

const defaultFilters = () => ({
  search: "",
  location_id: "",
  branch_id: "",
  show_zero: false,
  date_from: dayjs().startOf("month").format("YYYY-MM-DD"),
  date_to: dayjs().format("YYYY-MM-DD"),
  picking_type_id: "",
});

const fmtQty = (value) =>
  Number(value || 0).toLocaleString("ru-RU", { maximumFractionDigits: 4 });

const fmtDateTime = (value) => (value ? dayjs(value).format("DD.MM.YYYY HH:mm") : "—");

const fmtMoney = (value) =>
  value === null || value === undefined
    ? "—"
    : Number(value).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const unitLabel = (unit) => unit?.short_name || unit?.name || "—";

const balanceRowKey = (row) => `${row.product_id}-${row.location_id}`;

const StockReportPage = () => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();

  const [tab, setTab] = useState("balances");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  const [formData, setFormData] = useState(defaultFilters);
  const [turnoverLocation, setTurnoverLocation] = useState(null);
  const [expandedBalances, setExpandedBalances] = useState(() => new Set());
  const [balanceLots, setBalanceLots] = useState(() => new Map());
  const [balanceLotsLoading, setBalanceLotsLoading] = useState(() => new Set());
  const [expandedTurnover, setExpandedTurnover] = useState(() => new Set());
  const [turnoverLots, setTurnoverLots] = useState(() => new Map());
  const [turnoverLotsLoading, setTurnoverLotsLoading] = useState(() => new Set());

  const [locations, setLocations] = useState([]);
  const [branches, setBranches] = useState([]);
  const [pickingTypes, setPickingTypes] = useState([]);

  useEffect(() => {
    getActiveStockLocations()
      .then((res) => setLocations((res.data || []).filter((l) => l.type === "internal")))
      .catch((error) => console.error("Ошибка при получении локаций:", error.message));
    getActiveBranches()
      .then((res) => setBranches(res.data || []))
      .catch((error) => console.error("Ошибка при получении филиалов:", error.message));
    getActiveStockPickingTypes()
      .then((res) => setPickingTypes(res.data || []))
      .catch((error) => console.error("Ошибка при получении типов документов:", error.message));
  }, []);

  const fetchData = async (
    nextTab = tab,
    filters = formData,
    page = 1,
    size = pageSize,
  ) => {
    setLoading(true);
    setExpandedBalances(new Set());
    setExpandedTurnover(new Set());
    try {
      const res = await LOADERS[nextTab]({ page, pageSize: size, filters: JSON.stringify(filters) });
      setData(res.data || []);
      setTotalPages(res.pagination?.totalPages ?? 1);
      setCurrentPage(res.pagination?.currentPage ?? page);
      setTotalItems(res.pagination?.totalItems ?? 0);
      setTurnoverLocation(nextTab === "turnover" ? res.location ?? null : null);
    } catch (error) {
      console.error("Ошибка при получении отчёта по складу:", error.message);
      setData([]);
      showAlert(t("error"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(tab, formData, 1, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const applyFilters = (next) => {
    setFormData(next);
    fetchData(tab, next, 1, pageSize);
  };

  const handleFilterChange = (e) => {
    const { name, type, checked, value } = e.target;
    applyFilters({ ...formData, [name]: type === "checkbox" ? checked : value });
  };

  const handleSearch = (next = formData) => applyFilters(next);

  const toggleBalanceRow = async (row) => {
    const key = balanceRowKey(row);
    setExpandedBalances((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    if (balanceLots.has(key)) return;

    setBalanceLotsLoading((prev) => new Set(prev).add(key));
    try {
      const res = await getStockReportBalanceLots(row.product_id, row.location_id);
      setBalanceLots((prev) => new Map(prev).set(key, res.data || []));
    } catch (error) {
      console.error("Ошибка при получении партий остатка:", error.message);
      setBalanceLots((prev) => new Map(prev).set(key, []));
    } finally {
      setBalanceLotsLoading((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const toggleTurnoverRow = async (row) => {
    const key = row.product_id;
    setExpandedTurnover((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    if (turnoverLots.has(key)) return;

    setTurnoverLotsLoading((prev) => new Set(prev).add(key));
    try {
      const res = await getStockReportTurnoverLots({
        locationId: formData.location_id,
        dateFrom: formData.date_from,
        dateTo: formData.date_to,
        productId: row.product_id,
      });
      setTurnoverLots((prev) => new Map(prev).set(key, res.data || []));
    } catch (error) {
      console.error("Ошибка при получении партий оборота:", error.message);
      setTurnoverLots((prev) => new Map(prev).set(key, []));
    } finally {
      setTurnoverLotsLoading((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    fetchData(tab, formData, page, pageSize);
  };

  const handleChangePageSize = (e) => {
    const size = parseInt(e.target.value, 10);
    setPageSize(size);
    fetchData(tab, formData, 1, size);
  };

  const exportToExcel = () => {
    const title = t(TAB_TITLES[tab]);
    let header;
    let rows;
    let subtitle = [];

    if (tab === "balances") {
      header = [t("product"), t("sku"), t("location"), t("branch"), t("quantity"), t("unit")];
      rows = data.map((row) => [
        row.product?.name || "—",
        row.product?.sku || "",
        row.location?.complete_name || row.location?.name || "—",
        row.location?.branch?.name || "—",
        Number(row.qty || 0),
        unitLabel(row.product?.unit),
      ]);
    } else if (tab === "turnover") {
      subtitle = [
        [turnoverLocation?.complete_name || turnoverLocation?.name || "", `${formData.date_from} — ${formData.date_to}`],
      ];
      header = [
        t("product"),
        t("sku"),
        t("stockOpeningBalance"),
        t("stockIncoming"),
        t("stockOutgoing"),
        t("stockClosingBalance"),
        t("unit"),
      ];
      rows = data.map((row) => [
        row.product?.name || "—",
        row.product?.sku || "",
        Number(row.opening || 0),
        Number(row.incoming || 0),
        Number(row.outgoing || 0),
        Number(row.closing || 0),
        unitLabel(row.product?.unit),
      ]);
    } else {
      header = [
        t("date"),
        t("documentNumber"),
        t("pickingType"),
        t("product"),
        t("pickingFrom"),
        t("pickingTo"),
        t("quantity"),
        t("unit"),
      ];
      rows = data.map((row) => [
        fmtDateTime(row.picking?.date_done),
        row.picking?.name || "—",
        row.picking?.type?.name || "—",
        row.product?.name || "—",
        row.locationSrc?.complete_name || row.locationSrc?.name || "—",
        row.locationDest?.complete_name || row.locationDest?.name || "—",
        Number(row.qty_done || 0),
        unitLabel(row.unit),
      ]);
    }

    const sheet = XLSX.utils.aoa_to_sheet([[title], ...subtitle, [], header, ...rows]);
    sheet["!cols"] = header.map((_, i) => ({ wch: i === 0 ? 24 : 18 }));

    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, tab);
    const buffer = XLSX.write(book, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buffer], { type: "application/octet-stream" }),
      `stock-report-${tab}-${dayjs().format("YYYY-MM-DD")}.xlsx`,
    );
  };

  const renderBalanceLotsDetail = (row) => {
    const key = balanceRowKey(row);
    const lots = balanceLots.get(key) || [];
    const isLoading = balanceLotsLoading.has(key);

    return (
      <table className={styles.detailTable}>
        <thead>
          <tr>
            <th>{t("attributes")}</th>
            <th>{t("note")}</th>
            <th>{t("price")}</th>
            <th>{t("quantity")}</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan="4">{t("loading")}</td>
            </tr>
          ) : lots.length > 0 ? (
            lots.map((lot) => (
              <tr key={lot.quant_id}>
                <td>
                  {lot.attributes.length > 0
                    ? lot.attributes.map((a) => `${a.attribute}: ${a.value}`).join(" · ")
                    : "—"}
                </td>
                <td>{lot.note || "—"}</td>
                <td>{fmtMoney(lot.price_unit)}</td>
                <td>{fmtQty(lot.qty)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="4">{t("noData")}</td>
            </tr>
          )}
        </tbody>
      </table>
    );
  };

  const renderBalancesTable = () => (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.expandCol} />
          <th>№</th>
          <th className={styles.nameCell}>{t("product")}</th>
          <th className={styles.nameCell}>{t("location")}</th>
          <th>{t("branch")}</th>
          <th>{t("quantity")}</th>
          <th>{t("unit")}</th>
        </tr>
      </thead>
      <tbody>
        {data.length > 0 ? (
          data.map((row, i) => {
            const key = balanceRowKey(row);
            const isOpen = expandedBalances.has(key);
            return (
              <Fragment key={key}>
                <tr className={styles.clickRow} onClick={() => toggleBalanceRow(row)}>
                  <td className={styles.expandCol}>
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </td>
                  <td>{(currentPage - 1) * pageSize + i + 1}</td>
                  <td className={styles.nameCell}>
                    <div>{row.product?.name || "—"}</div>
                    {row.product?.sku && <div className={styles.cellMeta}>{row.product.sku}</div>}
                  </td>
                  <td className={styles.nameCell}>
                    {row.location?.complete_name || row.location?.name || "—"}
                  </td>
                  <td>{row.location?.branch?.name || "—"}</td>
                  <td style={{ fontWeight: 700 }}>{fmtQty(row.qty)}</td>
                  <td>{unitLabel(row.product?.unit)}</td>
                </tr>
                {isOpen && (
                  <tr className={styles.detailRow}>
                    <td colSpan="7">{renderBalanceLotsDetail(row)}</td>
                  </tr>
                )}
              </Fragment>
            );
          })
        ) : (
          <tr>
            <td colSpan="7">{t("noData")}</td>
          </tr>
        )}
      </tbody>
    </table>
  );

  const renderTurnoverLotsDetail = (row) => {
    const key = row.product_id;
    const lots = turnoverLots.get(key) || [];
    const isLoading = turnoverLotsLoading.has(key);

    return (
      <table className={styles.detailTable}>
        <thead>
          <tr>
            <th>{t("attributes")}</th>
            <th>{t("note")}</th>
            <th>{t("price")}</th>
            <th>{t("stockOpeningBalance")}</th>
            <th>{t("stockIncoming")}</th>
            <th>{t("stockOutgoing")}</th>
            <th>{t("stockClosingBalance")}</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan="7">{t("loading")}</td>
            </tr>
          ) : lots.length > 0 ? (
            lots.map((lot) => (
              <tr key={lot.lot_id ?? "none"}>
                <td>
                  {lot.attributes.length > 0
                    ? lot.attributes.map((a) => `${a.attribute}: ${a.value}`).join(" · ")
                    : "—"}
                </td>
                <td>{lot.note || "—"}</td>
                <td>{fmtMoney(lot.price_unit)}</td>
                <td>{fmtQty(lot.opening)}</td>
                <td className={lot.incoming ? styles.positiveCell : undefined}>
                  {lot.incoming ? `+${fmtQty(lot.incoming)}` : "—"}
                </td>
                <td className={lot.outgoing ? styles.negativeCell : undefined}>
                  {lot.outgoing ? `-${fmtQty(lot.outgoing)}` : "—"}
                </td>
                <td style={{ fontWeight: 700 }}>{fmtQty(lot.closing)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="7">{t("noData")}</td>
            </tr>
          )}
        </tbody>
      </table>
    );
  };

  const renderTurnoverTable = () => (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.expandCol} />
          <th>№</th>
          <th className={styles.nameCell}>{t("product")}</th>
          <th>{t("stockOpeningBalance")}</th>
          <th>{t("stockIncoming")}</th>
          <th>{t("stockOutgoing")}</th>
          <th>{t("stockClosingBalance")}</th>
          <th>{t("unit")}</th>
        </tr>
      </thead>
      <tbody>
        {data.length > 0 ? (
          data.map((row, i) => {
            const isOpen = expandedTurnover.has(row.product_id);
            return (
              <Fragment key={row.product_id}>
                <tr className={styles.clickRow} onClick={() => toggleTurnoverRow(row)}>
                  <td className={styles.expandCol}>
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </td>
                  <td>{(currentPage - 1) * pageSize + i + 1}</td>
                  <td className={styles.nameCell}>
                    <div>{row.product?.name || "—"}</div>
                    {row.product?.sku && <div className={styles.cellMeta}>{row.product.sku}</div>}
                  </td>
                  <td>{fmtQty(row.opening)}</td>
                  <td className={row.incoming ? styles.positiveCell : undefined}>
                    {row.incoming ? `+${fmtQty(row.incoming)}` : "—"}
                  </td>
                  <td className={row.outgoing ? styles.negativeCell : undefined}>
                    {row.outgoing ? `-${fmtQty(row.outgoing)}` : "—"}
                  </td>
                  <td style={{ fontWeight: 700 }}>{fmtQty(row.closing)}</td>
                  <td>{unitLabel(row.product?.unit)}</td>
                </tr>
                {isOpen && (
                  <tr className={styles.detailRow}>
                    <td colSpan="8">{renderTurnoverLotsDetail(row)}</td>
                  </tr>
                )}
              </Fragment>
            );
          })
        ) : (
          <tr>
            <td colSpan="8">{t("noData")}</td>
          </tr>
        )}
      </tbody>
    </table>
  );

  const renderMovementsTable = () => (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>№</th>
          <th>{t("date")}</th>
          <th className={styles.nameCell}>{t("documentNumber")}</th>
          <th className={styles.nameCell}>{t("product")}</th>
          <th className={styles.nameCell}>{t("pickingFrom")}</th>
          <th className={styles.nameCell}>{t("pickingTo")}</th>
          <th>{t("quantity")}</th>
          <th>{t("unit")}</th>
        </tr>
      </thead>
      <tbody>
        {data.length > 0 ? (
          data.map((row, i) => (
            <tr key={row.id}>
              <td>{(currentPage - 1) * pageSize + i + 1}</td>
              <td>{fmtDateTime(row.picking?.date_done)}</td>
              <td className={styles.nameCell}>
                <div>{row.picking?.name || "—"}</div>
                {row.picking?.type?.name && (
                  <div className={styles.cellMeta}>{row.picking.type.name}</div>
                )}
              </td>
              <td className={styles.nameCell}>{row.product?.name || "—"}</td>
              <td className={styles.nameCell}>
                {row.locationSrc?.complete_name || row.locationSrc?.name || "—"}
              </td>
              <td className={styles.nameCell}>
                {row.locationDest?.complete_name || row.locationDest?.name || "—"}
              </td>
              <td style={{ fontWeight: 700 }}>{fmtQty(row.qty_done)}</td>
              <td>{unitLabel(row.unit)}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan="8">{t("noData")}</td>
          </tr>
        )}
      </tbody>
    </table>
  );

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
            <Search formData={formData} setFormData={setFormData} onSearch={handleSearch} />

            <div className={styles.filterField}>
              <label>{t("location")}</label>
              <select name="location_id" value={formData.location_id} onChange={handleFilterChange}>
                <option value="">{t("all")}</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.complete_name || location.name}
                  </option>
                ))}
              </select>
            </div>

            {tab === "balances" && (
              <>
                <div className={styles.filterField}>
                  <label>{t("branch")}</label>
                  <select name="branch_id" value={formData.branch_id} onChange={handleFilterChange}>
                    <option value="">{t("all")}</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>

                <label className={styles.filterCheckbox}>
                  <input
                    type="checkbox"
                    name="show_zero"
                    checked={formData.show_zero}
                    onChange={handleFilterChange}
                  />
                  {t("showZeroBalances")}
                </label>
              </>
            )}

            {(tab === "movements" || tab === "turnover") && (
              <>
                <div className={styles.filterField}>
                  <label>{t("dateFrom")}</label>
                  <input
                    type="date"
                    name="date_from"
                    value={formData.date_from}
                    onChange={handleFilterChange}
                  />
                </div>

                <div className={styles.filterField}>
                  <label>{t("dateTo")}</label>
                  <input
                    type="date"
                    name="date_to"
                    value={formData.date_to}
                    onChange={handleFilterChange}
                  />
                </div>
              </>
            )}

            {tab === "movements" && (
              <div className={styles.filterField}>
                <label>{t("pickingType")}</label>
                <select
                  name="picking_type_id"
                  value={formData.picking_type_id}
                  onChange={handleFilterChange}
                >
                  <option value="">{t("all")}</option>
                  {pickingTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {tab === "turnover" && (
              <label className={styles.filterCheckbox}>
                <input
                  type="checkbox"
                  name="show_zero"
                  checked={formData.show_zero}
                  onChange={handleFilterChange}
                />
                {t("showZeroBalances")}
              </label>
            )}
          </div>

          <Pagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={totalItems}
            totalPages={totalPages}
            handleChangePageSize={handleChangePageSize}
            handlePageChange={handlePageChange}
          />

          <div className={styles.buttonsWrapper}>
            <button
              type="button"
              className={styles.exportBtn}
              onClick={exportToExcel}
              disabled={data.length === 0}
            >
              {Icons.excel}
              {t("exportExcel")}
            </button>
            <div
              className={styles.refreshBtn}
              onClick={() => fetchData(tab, formData, currentPage, pageSize)}
            >
              {Icons.refresh}
            </div>
          </div>
        </div>

        {tab === "turnover" && !formData.location_id && (
          <div className={styles.hint}>{t("stockTurnoverChooseLocationHint")}</div>
        )}

        {loading ? (
          <Loading />
        ) : (
          <div className={styles.tableContainer}>
            {tab === "balances" && renderBalancesTable()}
            {tab === "movements" && renderMovementsTable()}
            {tab === "turnover" && renderTurnoverTable()}
          </div>
        )}
      </div>
    </div>
  );
};

export default StockReportPage;
