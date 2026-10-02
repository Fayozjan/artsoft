import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { getStockLocations } from "../api";

import Badge from "../components/Badge";
import Loading from "../components/Loading";
import Pagination from "../components/Pagination";
import TableFilter from "../components/TableFilter";
import Search from "../components/Search";
import { Icons } from "../icons/icons";
import {
  FolderTree,
  Package,
  Truck,
  Users,
  Factory,
  Receipt,
  ClipboardList,
  ArrowLeftRight,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

import styles from "./StockPage.module.scss";

const usageLabelKey = (type) =>
  `locationUsage${type.charAt(0).toUpperCase()}${type.slice(1)}`;

const TYPE_STYLE = {
  view: { icon: FolderTree, color: "#6b7280" },
  internal: { icon: Package, color: "#2563eb" },
  supplier: { icon: Truck, color: "#16a34a" },
  customer: { icon: Users, color: "#7c3aed" },
  production: { icon: Factory, color: "#ea580c" },
  expense: { icon: Receipt, color: "#dc2626" },
  inventory: { icon: ClipboardList, color: "#0d9488" },
  transit: { icon: ArrowLeftRight, color: "#4f46e5" },
};

// Только для ознакомления — весь список локаций всех типов, без создания/
// редактирования/удаления. Временная страница (менеджер уберёт из меню сам,
// когда появятся выделенные разделы "Склады" и т.д.).
const StockLocationsPage = () => {
  const [data, setData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ search: "", status: "" });
  const [expandedIds, setExpandedIds] = useState(new Set());

  const { t } = useTranslation();

  const fetchData = async (page = currentPage, filters = formData, size = pageSize) => {
    setLoading(true);
    try {
      const { data, pagination } = await getStockLocations({ page, pageSize: size, filters });
      setData(data);
      setTotalPages(pagination?.totalPages);
      setCurrentPage(pagination?.currentPage ?? currentPage);
      setTotalItems(pagination?.totalItems);
    } catch (error) {
      console.error("Ошибка при получении данных:", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(currentPage);
  }, [currentPage, pageSize]);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const handleChangePageSize = (e) => {
    const size = parseInt(e.target.value, 10);
    setPageSize(size);
    setCurrentPage((prev) => Math.min(prev, Math.ceil(totalItems / size)));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    await fetchData(1, formData);
  };

  const handleSearch = (data = formData) => {
    setCurrentPage(1);
    fetchData(1, data, pageSize);
  };

  // Глубина через цепочку parent_id, НЕ через split(complete_name, " / ") —
  // имя локации само может содержать " / " (напр. "Расходы / Офис"), что ломало
  // подсчёт сегментов и визуально вкладывало такую запись на уровень глубже.
  const idToParent = new Map(data.map((d) => [d.id, d.parent_id]));
  const depthOf = (item) => {
    let depth = 0;
    let parentId = item.parent_id;
    while (parentId != null) {
      depth++;
      parentId = idToParent.get(parentId);
    }
    return depth;
  };

  // Иерархическая нумерация (1, 1.1, 1.2, 2, ...) — своя у каждого уровня вложенности.
  const buildNumbering = (items) => {
    const counters = [];
    return items.map((item) => {
      const depth = depthOf(item);
      counters[depth] = (counters[depth] || 0) + 1;
      counters.length = depth + 1;
      return counters.join(".");
    });
  };
  const numbering = buildNumbering(data);

  // Раскрытие по клику: видна строка только если ВСЕ её предки развёрнуты.
  const hasChildrenSet = new Set(data.map((d) => d.parent_id).filter((id) => id != null));
  const isVisible = (item) => {
    let parentId = item.parent_id;
    while (parentId != null) {
      if (!expandedIds.has(parentId)) return false;
      parentId = idToParent.get(parentId);
    }
    return true;
  };
  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className={styles.page}>
      {loading ? (
        <Loading />
      ) : (
        <div className={styles.main}>
          <div className={styles.mainHeader}>
            <div className={styles.filterWrapper}>
              <Search formData={formData} setFormData={setFormData} onSearch={handleSearch} />
              <TableFilter formData={formData} setFormData={setFormData} onSubmit={handleFormSubmit} t={t} />
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
              <div className={styles.refreshBtn} onClick={() => fetchData()}>
                {Icons.refresh}
              </div>
            </div>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>№</th>
                  <th>{t("name")}</th>
                  <th>{t("locationType")}</th>
                  <th>{t("branch")}</th>
                  <th>{t("locationCode")}</th>
                  <th>{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {data?.length > 0 ? (
                  data.map((item, i) => {
                    if (!isVisible(item)) return null;

                    const depth = depthOf(item);
                    const typeInfo = TYPE_STYLE[item.type] || TYPE_STYLE.internal;
                    const TypeIcon = typeInfo.icon;
                    const expandable = hasChildrenSet.has(item.id);
                    const expanded = expandedIds.has(item.id);

                    return (
                      <tr key={item.id} className={depth === 0 ? styles.treeRootRow : undefined}>
                        <td>{numbering[i]}</td>
                        <td style={{ textAlign: "left" }}>
                          <span
                            className={styles.treeCell}
                            style={{ paddingLeft: depth * 20, cursor: expandable ? "pointer" : "default" }}
                            onClick={() => expandable && toggleExpand(item.id)}
                          >
                            {expandable ? (
                              expanded ? (
                                <ChevronDown size={14} style={{ flexShrink: 0 }} />
                              ) : (
                                <ChevronRight size={14} style={{ flexShrink: 0 }} />
                              )
                            ) : (
                              <span style={{ width: 14, flexShrink: 0 }} />
                            )}
                            <TypeIcon size={14} color={typeInfo.color} style={{ flexShrink: 0 }} />
                            <span className={depth === 0 || item.type === "view" ? styles.treeNameBold : undefined}>
                              {item.name}
                            </span>
                          </span>
                        </td>
                        <td>
                          {item.type !== "view" && (
                            <span className={styles.statusBadge} style={{ background: typeInfo.color + "18", color: typeInfo.color }}>
                              {t(usageLabelKey(item.type))}
                            </span>
                          )}
                        </td>
                        <td>{item.branch?.name || "—"}</td>
                        <td>{item.code || "—"}</td>
                        <td>
                          <Badge text={item.status} />
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6">{t("noData")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockLocationsPage;
