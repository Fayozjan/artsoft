import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import {
  addStockPicking,
  editStockPickingById,
  getStockPickingById,
  getStockPickingOrigins,
  getStockPickingBalance,
  getActiveStockPickingTypes,
  getActiveStockLocations,
  getActiveBranches,
  getActivePartners,
  getActiveProducts,
  getActiveUnits,
  getActiveCurrencies,
  getCurrencyRecommendedRate,
  getAttributeValues,
  EmployeeService,
} from "../api";

import Button from "./Button";
import Loading from "./Loading";
import SearchableSelect from "./SearchableSelect";
import AddMultipleProductsModal from "./AddMultipleProductsModal";
import { Icons } from "../icons/icons";
import styles from "./AddStockPicking.module.scss";

const emptyRow = () => ({
  product_id: "",
  lot_id: "",
  unit_id: "",
  qty_demand: "",
  qty_packages: "",
  price_unit: "",
  note: "",
  attributes: {},
});

// Характеристики партии — отдельной мелкой строкой под названием, вместо
// категории товара (категория там не несёт пользы при выборе на расход).
const lotAttributesText = (lot) =>
  (lot?.attributeValues || []).map((av) => `${av.attribute?.name}: ${av.attributeValue?.value}`).join(", ");

// datetime-local ждёт локальное "YYYY-MM-DDTHH:mm" без таймзоны — new Date().toISOString()
// тут не годится, он в UTC и сдвинет время показа.
const nowForDatetimeInput = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Примечание маленькое, пока пусто/коротко, само растёт под текст — до кап
// высоты, дальше уже прокрутка, а не разбухание страницы.
const NOTE_MAX_HEIGHT = 200;
const autoResizeNote = (el) => {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, NOTE_MAX_HEIGHT)}px`;
};

// "000 000" — разряды пробелом, копейки только если реально есть.
const fmtMoney = (n) => Number(n || 0).toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const rowTotal = (row) => (Number(row.qty_demand) || 0) * (Number(row.price_unit) || 0);

// Кол-во/цена — текстовые инпуты (не number: там пробелы не отобразить),
// в стейте всегда сырое "1234.5" без пробелов, пробелами разбиваем только показ.
const parseNumericInput = (raw) => {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  return cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
};
const formatNumberInput = (raw) => {
  if (raw === "" || raw === null || raw === undefined) return "";
  const [intPart, decPart] = String(raw).split(".");
  const groupedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return decPart !== undefined ? `${groupedInt}.${decPart}` : groupedInt;
};

// Документ склада — отдельная страница на всю ширину (?picking=new / ?picking=ID&edit=1),
// как "Производство / Типы операций". При выборе типа документа подставляем его
// "прошитые" локации (stockPickingTypes: default_location_src/dest) — вторую
// сторону (обычно физический склад) пользователь выбирает сам.
const AddStockPicking = ({ id, typeId, handleClose, onSuccess }) => {
  const isEdit = Boolean(id);
  // Тип уже выбран в модалке до перехода сюда (typeId в URL) — пока справочник
  // типов не подгрузился и presetType не разрешился, держим лоадер, а не
  // мелькаем полем ручного выбора типа (заметно на холодной перезагрузке).
  const [loading, setLoading] = useState(isEdit || Boolean(typeId));
  const [saving, setSaving] = useState(false);
  const [pickingTypes, setPickingTypes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchSrcId, setBranchSrcId] = useState("");
  const [branchDestId, setBranchDestId] = useState("");
  const [transferScope, setTransferScope] = useState("same");
  const scopeInitialized = useRef(false);
  const noteRef = useRef(null);
  const [partners, setPartners] = useState([]);
  const [products, setProducts] = useState([]);
  const [units, setUnits] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [rateLoading, setRateLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [origins, setOrigins] = useState([]);
  const [attributeValuesCache, setAttributeValuesCache] = useState({});
  // Остаток склада по партиям (не по товару) — массив строк от getStockPickingBalance.
  const [stockBalance, setStockBalance] = useState([]);
  const [formData, setFormData] = useState({
    type_id: "",
    src_partner_id: "",
    dest_partner_id: "",
    location_src_id: "",
    location_dest_id: "",
    origin: "",
    scheduled_date: isEdit ? "" : nowForDatetimeInput(),
    note: "",
    currency_id: "",
    rate: "",
    payment_method: "",
    manager_id: "",
    transport: "",
    driver: "",
    vehicle_number: "",
  });
  const [moves, setMoves] = useState([emptyRow()]);
  const [docName, setDocName] = useState("");
  const [showAdditional, setShowAdditional] = useState(false);
  // Индекс строки, для которой открыто окно выбора товара (AddMultipleProductsModal);
  // null — окно закрыто. Открывается кликом по товару в конкретной строке —
  // модалка нужна и для одиночного, и для множественного добавления разом.
  const [multiModalRowIndex, setMultiModalRowIndex] = useState(null);

  const { showAlert } = useAlertStore();
  const { t } = useTranslation();

  useEffect(() => {
    Promise.all([
      getActiveStockPickingTypes(),
      getActiveStockLocations(),
      getActiveBranches(),
      getActivePartners(),
      getActiveProducts(),
      getActiveUnits(),
      getActiveCurrencies(),
      EmployeeService.getActive(),
      getStockPickingOrigins(),
    ]).then(([typesRes, locationsRes, branchesRes, partnersRes, productsRes, unitsRes, currenciesRes, employeesRes, originsRes]) => {
      const loadedTypes = typesRes.data || [];
      const loadedCurrencies = currenciesRes.data || [];
      setPickingTypes(loadedTypes);
      setLocations(locationsRes.data || []);
      setBranches(branchesRes.data || []);
      setPartners(partnersRes.data || []);
      setProducts(productsRes.data || []);
      setUnits(unitsRes.data || []);
      setCurrencies(loadedCurrencies);
      setEmployees(employeesRes.data || []);
      setOrigins(originsRes.data || []);

      // Тип уже выбран в модалке (StockPickingTypeModal) перед созданием —
      // подставляем его локации по умолчанию, само поле типа тогда не рендерим.
      if (typeId && !isEdit) {
        const type = loadedTypes.find((tp) => String(tp.id) === String(typeId));
        if (type) {
          setFormData((prev) => ({
            ...prev,
            type_id: String(type.id),
            location_src_id: type.default_location_src_id ? String(type.default_location_src_id) : "",
            location_dest_id: type.default_location_dest_id ? String(type.default_location_dest_id) : "",
          }));
        }
      }

      // Новый документ — валюта по умолчанию базовая (сум), курс 1.
      if (!isEdit) {
        const base = loadedCurrencies.find((c) => c.is_base);
        if (base) {
          setFormData((prev) => ({ ...prev, currency_id: String(base.id), rate: "1" }));
        }
      }
    }).finally(() => {
      // Для isEdit лоадером управляет второй эффект (грузит сам документ) — тут его не трогаем.
      if (!isEdit) setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    getStockPickingById(id)
      .then((res) => {
        if (!res.success) return;
        const d = res.data;
        setDocName(d.name || "");
        setFormData({
          type_id: d.type_id ?? "",
          src_partner_id: d.src_partner_id ?? "",
          dest_partner_id: d.dest_partner_id ?? "",
          location_src_id: d.location_src_id ?? "",
          location_dest_id: d.location_dest_id ?? "",
          origin: d.origin || "",
          scheduled_date: d.scheduled_date ? d.scheduled_date.slice(0, 16) : "",
          note: d.note || "",
          currency_id: d.currency_id ?? "",
          rate: d.rate ?? "",
          payment_method: d.payment_method || "",
          manager_id: d.manager_id ?? "",
          transport: d.transport || "",
          driver: d.driver || "",
          vehicle_number: d.vehicle_number || "",
        });
        if (d.origin || d.payment_method || d.transport || d.driver || d.vehicle_number || d.note) {
          setShowAdditional(true);
        }
        setMoves(
          (d.moves || []).map((m) => ({
            product_id: m.product_id ?? "",
            lot_id: m.lot_id ?? "",
            unit_id: m.unit_id ?? "",
            qty_demand: m.qty_demand ?? "",
            qty_packages: m.qty_packages ?? "",
            price_unit: m.price_unit ?? "",
            note: m.note || "",
            attributes: Object.fromEntries(
              (m.attributeValues || []).map((av) => [String(av.attribute_id), String(av.attribute_value_id)]),
            ),
            // Партия могла выпасть из свежего остатка (весь расход уже списан) —
            // снэпшот с документа держит пикер рабочим при повторном открытии черновика.
            _lotSnapshot: m.lot
              ? { product_id: m.product_id, lot_id: m.lot_id, qty: null, lot: m.lot }
              : null,
          })) || [emptyRow()],
        );
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Филиал — чисто UI-фильтр складов, в документе не хранится: подтягиваем
  // его из branch_id уже выбранной локации (важно при редактировании, когда
  // локации и филиалы могут догрузиться в любом порядке).
  useEffect(() => {
    if (!locations.length) return;
    if (formData.location_src_id && !branchSrcId) {
      const loc = locations.find((l) => String(l.id) === String(formData.location_src_id));
      if (loc?.branch_id) setBranchSrcId(String(loc.branch_id));
    }
    if (formData.location_dest_id && !branchDestId) {
      const loc = locations.find((l) => String(l.id) === String(formData.location_dest_id));
      if (loc?.branch_id) setBranchDestId(String(loc.branch_id));
    }
  }, [locations, formData.location_src_id, formData.location_dest_id]);

  // Режим перемещения при редактировании определяем один раз по факту:
  // одинаковые филиалы src/dest — "внутри филиала", разные — "между филиалами".
  useEffect(() => {
    if (!isEdit || scopeInitialized.current) return;
    if (pickingTypes.find((tp) => String(tp.id) === String(formData.type_id))?.code !== "internal") return;
    if (branchSrcId && branchDestId) {
      setTransferScope(branchSrcId === branchDestId ? "same" : "between");
      scopeInitialized.current = true;
    }
  }, [isEdit, pickingTypes, formData.type_id, branchSrcId, branchDestId]);

  // Подгоняем высоту и при вводе (onChange ниже), и когда текст пришёл не от
  // печати, а загрузился с документом при редактировании.
  useEffect(() => {
    autoResizeNote(noteRef.current);
  }, [formData.note]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Рекомендованный курс ЦБ — подтягиваем только если поле курса пустое
  // (не переписываем то, что пользователь уже ввёл руками); force=true
  // (кнопка "обновить курс") переписывает в любом случае.
  const fetchRecommendedRate = async (currencyId, date, force = false) => {
    if (!currencyId) return;
    setRateLoading(true);
    try {
      const res = await getCurrencyRecommendedRate(currencyId, date || undefined);
      if (res.success) {
        setFormData((prev) => (force || !prev.rate ? { ...prev, rate: String(res.data.rate) } : prev));
      }
    } catch (error) {
      showAlert(error.response?.data?.error || t("cbuRateUnavailable"), "error");
    } finally {
      setRateLoading(false);
    }
  };

  const handleCurrencyChange = (e) => {
    const currencyId = e.target.value;
    const currency = currencies.find((c) => String(c.id) === String(currencyId));
    if (currency?.is_base) {
      setFormData((prev) => ({ ...prev, currency_id: currencyId, rate: "1" }));
    } else {
      setFormData((prev) => ({ ...prev, currency_id: currencyId, rate: "" }));
      fetchRecommendedRate(currencyId, formData.scheduled_date);
    }
  };

  const handleScheduledDateChange = (e) => {
    // max на инпуте не мешает стрелками времени прокрутить за "сейчас" —
    // только помечает поле невалидным. Дожимаем клампом вручную.
    const now = nowForDatetimeInput();
    const value = e.target.value > now ? now : e.target.value;
    setFormData((prev) => ({ ...prev, scheduled_date: value }));
    const currency = currencies.find((c) => String(c.id) === String(formData.currency_id));
    if (currency && !currency.is_base && !formData.rate) {
      fetchRecommendedRate(formData.currency_id, value);
    }
  };

  const handleRefreshRate = () => {
    if (!formData.currency_id) return;
    fetchRecommendedRate(formData.currency_id, formData.scheduled_date, true);
  };

  // Смена типа документа сбрасывает всё, что от него зависит: локация — либо
  // "прошита" (default_location_*), либо снова пустая на выбор пользователя;
  // партнёр-источник имеет смысл только у incoming, партнёр-получатель — только
  // у outgoing, у internal (перемещение между складами) не нужен ни один.
  const handleTypeChange = (e) => {
    const typeId = e.target.value;
    const type = pickingTypes.find((t) => String(t.id) === String(typeId));
    setFormData((prev) => ({
      ...prev,
      type_id: typeId,
      location_src_id: type?.default_location_src_id ? String(type.default_location_src_id) : "",
      location_dest_id: type?.default_location_dest_id ? String(type.default_location_dest_id) : "",
      src_partner_id: type?.code === "incoming" ? prev.src_partner_id : "",
      dest_partner_id: type?.code === "outgoing" ? prev.dest_partner_id : "",
      manager_id: "",
    }));
    setBranchSrcId("");
    setBranchDestId("");
    setTransferScope("same");
  };

  // Филиал выбирается до склада и просто сужает список складов на выбор;
  // при "внутри филиала" один филиал сразу задаёт обе стороны.
  const handleBranchSrcChange = (value) => {
    setBranchSrcId(value);
    setFormData((prev) => ({ ...prev, location_src_id: "" }));
  };
  const handleBranchDestChange = (value) => {
    setBranchDestId(value);
    setFormData((prev) => ({ ...prev, location_dest_id: "" }));
  };
  const handleBranchSameChange = (value) => {
    setBranchSrcId(value);
    setBranchDestId(value);
    setFormData((prev) => ({ ...prev, location_src_id: "", location_dest_id: "" }));
  };
  const handleTransferScopeChange = (e) => {
    const value = e.target.value;
    setTransferScope(value);
    if (value === "same") setBranchDestId(branchSrcId);
    setFormData((prev) => ({ ...prev, location_src_id: "", location_dest_id: "" }));
  };

  const selectedType = pickingTypes.find((tp) => String(tp.id) === String(formData.type_id));
  const selectedCurrency = currencies.find((c) => String(c.id) === String(formData.currency_id));
  const isBaseCurrency = Boolean(selectedCurrency?.is_base);
  const srcLocked = Boolean(selectedType?.default_location_src_id);
  const destLocked = Boolean(selectedType?.default_location_dest_id);
  const showSrcPartner = selectedType?.code === "incoming";
  const showDestPartner = selectedType?.code === "outgoing";
  // Тип уже выбран заранее в StockPickingTypeModal — поле выбора типа тогда
  // не рендерим, название типа показывает шапка страницы.
  const presetType = !isEdit && typeId ? pickingTypes.find((tp) => String(tp.id) === String(typeId)) : null;
  // Незафиксированная сторона документа — всегда физический склад (виртуальные
  // локации — поставщик/клиент/цех/расходы — уже "прошиты" в типе), поэтому
  // в выборе показываем только их, а не всё дерево локаций.
  const warehouses = locations.filter((l) => l.type === "internal");
  // incoming → источник это поставщик, outgoing → получатель это клиент;
  // "both" годится для обеих сторон.
  // Название + id рядом — у партнёров бывают одинаковые названия, id разруливает.
  const withId = (p) => ({ ...p, name: `${p.name} (${p.id})` });
  const suppliers = partners.filter((p) => p.type === "supplier" || p.type === "both").map(withId);
  const customers = partners.filter((p) => p.type === "client" || p.type === "both").map(withId);
  // Категория товара — подпись в списке выбора, чтобы искать/различать товары с одинаковыми названиями.
  const productOptions = products.map(({ description, ...p }) => ({ ...p, categoryName: p.category?.name || "" }));
  // Расход/перемещение со склада — выбор не товара, а конкретной ПАРТИИ (см.
  // stockBalance ниже, по одной строке на партию): одинаковые/пустые партии
  // товара — одна позиция в списке, разные по цене/описанию/характеристикам —
  // отдельные. Плюс партии, уже выбранные в строках документа, но выпавшие из
  // свежего остатка (_lotSnapshot, см. загрузку на редактирование) — чтобы
  // строка не "пропадала" при повторном открытии черновика.
  const freshLotIds = new Set(stockBalance.map((r) => String(r.lot_id)));
  const staleLotRows = moves
    .filter((r) => r.lot_id && !freshLotIds.has(String(r.lot_id)))
    .map((r) => r._lotSnapshot)
    .filter(Boolean);
  const lotRows = [...stockBalance, ...staleLotRows];
  const productNameById = (productId) => products.find((p) => String(p.id) === String(productId))?.name || "";
  const availableProductOptions =
    !srcLocked && formData.location_src_id
      ? lotRows.map((r) => ({
          id: r.lot_id,
          product_id: r.product_id,
          name: productNameById(r.product_id),
          inlineNote: r.lot?.note || "",
          categoryName: lotAttributesText(r.lot),
          // Остаток/упаковки — отдельные колонки в окне выбора
          // (AddMultipleProductsModal), а не текст внутри названия; maxQty/
          // maxPackages те же числа, но как клэмп для вводимого там количества,
          // чтобы не улетело выше реально доступного ещё на этапе выбора.
          stockQty: r.qty ?? null,
          stockPackages: r.qty_packages ?? null,
          maxQty: r.qty ?? null,
          maxPackages: r.qty_packages ?? null,
        }))
      : productOptions;
  // Расход/перемещение — сколько ещё можно списать с этой партии: остаток
  // минус то, что уже "занято" другими строками документа с той же партией
  // (сервер при проведении проверяет то же самое суммарно по строкам, см.
  // assertStockAvailable).
  const remainingStockForRow = (index) => {
    const row = moves[index];
    if (srcLocked || !row.lot_id) return null;
    const fresh = stockBalance.find((r) => String(r.lot_id) === String(row.lot_id));
    if (!fresh) return null;
    const usedByOthers = moves.reduce(
      (sum, r, i) => (i !== index && String(r.lot_id) === String(row.lot_id) ? sum + (Number(r.qty_demand) || 0) : sum),
      0,
    );
    return Math.max(0, Number(fresh.qty) - usedByOthers);
  };
  // Кол-во упаковок — отдельный, но такой же честный остаток (вводится на
  // приходе наравне с qty, см. applyQuantDelta), не оценочный коэффициент.
  const remainingPackagesForRow = (index) => {
    const row = moves[index];
    if (srcLocked || !row.lot_id) return null;
    const fresh = stockBalance.find((r) => String(r.lot_id) === String(row.lot_id));
    if (!fresh) return null;
    const usedByOthers = moves.reduce(
      (sum, r, i) => (i !== index && String(r.lot_id) === String(row.lot_id) ? sum + (Number(r.qty_packages) || 0) : sum),
      0,
    );
    return Math.max(0, Number(fresh.qty_packages) - usedByOthers);
  };
  const managerOptions = employees.map((e) => ({ id: e.id, name: e.employeeFullName }));
  const isInternal = selectedType?.code === "internal";
  // В списке филиалов только те, где вообще есть физический склад — иначе
  // выбор упрётся в пустой список складов.
  const branchesWithWarehouse = branches.filter((b) => warehouses.some((w) => String(w.branch_id) === String(b.id)));
  const warehousesForBranch = (branchId) =>
    warehouses.filter((w) => !branchId || String(w.branch_id) === String(branchId));

  // Низ (строки товаров) показываем только когда физический склад реально
  // выбран с каждой незафиксированной стороны (виртуальные src/dest — поставщик/
  // клиент/цех — не в счёт, они "прошиты" типом).
  const warehouseChosen = (srcLocked || Boolean(formData.location_src_id)) && (destLocked || Boolean(formData.location_dest_id));
  // Как только в строках реально есть выбранный товар — склад больше не трогаем
  // (иначе остаток/партии под строками перестанут соответствовать выбору).
  // Пустые строки (товар ещё не выбран) не считаются — тогда склад можно менять свободно.
  const hasChosenProducts = moves.some((row) => row.product_id || row.lot_id);
  const warehouseLocked = warehouseChosen && hasChosenProducts;

  // Характеристики строки товара (напр. "Цвет") — набор, отмеченный как
  // применимый прямо у товара (AddProduct/EditProduct); значения для них
  // заводятся заранее (AttributeValues), здесь только выбор из уже существующих,
  // догружаем по мере появления новых характеристик в строках.
  const rowAttributeIds = moves.flatMap(
    (row) => (products.find((p) => String(p.id) === String(row.product_id))?.productAttributes || []).map((pa) => pa.attribute_id),
  );
  const attributeIdsKey = [...new Set(rowAttributeIds)].sort((a, b) => a - b).join(",");

  useEffect(() => {
    if (!attributeIdsKey) return;
    const attributeIds = attributeIdsKey.split(",").map(Number);
    attributeIds.forEach((attributeId) => {
      if (attributeValuesCache[attributeId]) return;
      getAttributeValues(attributeId).then((vres) => {
        setAttributeValuesCache((prev) => ({ ...prev, [attributeId]: vres.data || [] }));
      });
    });
  }, [attributeIdsKey]);

  // Единственный вариант — выбирать не из чего, подставляем сразу.
  useEffect(() => {
    if (!formData.type_id || branchesWithWarehouse.length !== 1) return;
    const onlyBranchId = String(branchesWithWarehouse[0].id);
    const needSrc = isInternal ? true : !srcLocked;
    const needDest = isInternal ? transferScope === "between" : !destLocked;
    if (needSrc && !branchSrcId) setBranchSrcId(onlyBranchId);
    if (needDest && !branchDestId) setBranchDestId(onlyBranchId);
    if (isInternal && transferScope === "same" && !branchDestId) setBranchDestId(onlyBranchId);
  }, [formData.type_id, isInternal, transferScope, srcLocked, destLocked, branchesWithWarehouse, branchSrcId, branchDestId]);

  useEffect(() => {
    if (srcLocked || formData.location_src_id) return;
    const opts = warehousesForBranch(branchSrcId);
    if (opts.length === 1) setFormData((prev) => ({ ...prev, location_src_id: String(opts[0].id) }));
  }, [srcLocked, branchSrcId, warehouses, formData.location_src_id]);

  useEffect(() => {
    if (destLocked || formData.location_dest_id) return;
    const opts = warehousesForBranch(branchDestId);
    if (opts.length === 1) setFormData((prev) => ({ ...prev, location_dest_id: String(opts[0].id) }));
  }, [destLocked, branchDestId, warehouses, formData.location_dest_id]);

  // Расход (outgoing/internal) — источник физический склад, выбирать товар
  // можно только из того, что на нём реально есть, по партиям (как в
  // документе, так и на складе — сервер при проведении перепроверяет то же самое).
  useEffect(() => {
    if (srcLocked || !formData.location_src_id) {
      setStockBalance([]);
      return;
    }
    let cancelled = false;
    getStockPickingBalance(formData.location_src_id).then((res) => {
      if (cancelled) return;
      setStockBalance(
        (res.data || []).map((row) => ({ ...row, qty: Number(row.qty), qty_packages: Number(row.qty_packages) })),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [srcLocked, formData.location_src_id]);

  const updateMove = (index, field, value) => {
    setMoves((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, [field]: value };
        if (field === "product_id") {
          const product = products.find((p) => String(p.id) === String(value));
          if (product?.unit?.id) next.unit_id = String(product.unit.id);
          // характеристики зависят от категории — при смене товара старые значения теряют смысл
          next.attributes = {};
        }
        return next;
      }),
    );
  };

  const updateMoveAttribute = (index, attributeId, valueId) => {
    setMoves((prev) =>
      prev.map((row, i) =>
        i !== index ? row : { ...row, attributes: { ...row.attributes, [attributeId]: valueId } },
      ),
    );
  };

  const addMove = () => setMoves((prev) => [...prev, emptyRow()]);
  // Единственную строку не убираем совсем (пустой список прячет кнопку "Добавить
  // строку" в другой код-путь, UX хуже) — вместо этого просто очищаем её поля.
  const removeMove = (index) =>
    setMoves((prev) => (prev.length === 1 ? [emptyRow()] : prev.filter((_, i) => i !== index)));

  // Строит строку документа из id, выбранного в окне товара
  // (AddMultipleProductsModal) — единственный путь, которым товар/партия
  // теперь попадают в строку (клик на товар всегда открывает это окно).
  const buildRowFromSelection = (id) => {
    if (!srcLocked) {
      const lotRow = lotRows.find((r) => String(r.lot_id) === String(id));
      if (!lotRow) return null;
      const product = products.find((p) => String(p.id) === String(lotRow.product_id));
      const lot = lotRow.lot || {};
      return {
        ...emptyRow(),
        product_id: String(lotRow.product_id),
        lot_id: String(lotRow.lot_id),
        unit_id: product?.unit?.id ? String(product.unit.id) : "",
        price_unit: lot.price_unit ?? "",
        note: lot.note || "",
        attributes: Object.fromEntries(
          (lot.attributeValues || []).map((av) => [String(av.attribute_id), String(av.attribute_value_id)]),
        ),
        _lotSnapshot: lotRow,
      };
    }
    const product = products.find((p) => String(p.id) === String(id));
    if (!product) return null;
    return { ...emptyRow(), product_id: String(id), unit_id: product.unit?.id ? String(product.unit.id) : "" };
  };

  // Открыта по клику на товар конкретной строки (multiModalRowIndex) — первая
  // отмеченная позиция занимает эту строку (даже если там уже что-то было
  // выбрано, это и есть "сменить товар"), остальные отмеченные дописываются
  // в конец отдельными строками. Количество уже введено в самой модалке
  // (см. AddMultipleProductsModal) — не заставляем вводить его ещё раз в строке.
  const handleAddMultiple = (selections) => {
    const newRows = selections
      .map(({ id, qty, packages }) => {
        const row = buildRowFromSelection(id);
        if (!row) return null;
        return {
          ...row,
          ...(qty ? { qty_demand: qty } : {}),
          ...(packages ? { qty_packages: packages } : {}),
        };
      })
      .filter(Boolean);
    if (!newRows.length) return setMultiModalRowIndex(null);
    const [firstRow, ...restRows] = newRows;
    setMoves((prev) => {
      if (multiModalRowIndex === null) return [...prev, ...newRows];
      const next = prev.map((row, i) => (i === multiModalRowIndex ? firstRow : row));
      return [...next, ...restRows];
    });
    setMultiModalRowIndex(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Товар в строке теперь выбирается кликом (открывает AddMultipleProductsModal),
    // не через SearchableSelect — его скрытый required-инпут раньше ловил это
    // нативной валидацией формы, проверяем явно.
    const missingProduct = moves.some((row) => (srcLocked ? !row.product_id : !row.lot_id));
    if (missingProduct) {
      showAlert(t("pickingSelectProductError"), "error");
      return;
    }

    setSaving(true);

    const payload = {
      ...formData,
      moves: moves.map(({ attributes, _lotSnapshot, ...row }) => ({
        ...row,
        attributes: Object.entries(attributes || {})
          .filter(([, valueId]) => valueId)
          .map(([attributeId, valueId]) => ({ attribute_id: attributeId, attribute_value_id: valueId })),
      })),
    };

    try {
      const res = isEdit ? await editStockPickingById(id, payload) : await addStockPicking(payload);

      if (res.success) {
        showAlert(t("success"), "success");
        onSuccess(res.data?.id);
      } else {
        showAlert(t("error"), "error");
      }
    } catch (error) {
      console.error("Ошибка при сохранении документа:", error.response?.data || error.message);
      showAlert(error.response?.data?.error || t("error"), "error");
    } finally {
      setSaving(false);
    }
  };

  // Строка, для которой сейчас открыто окно выбора товара — модалка стартует
  // с уже стоящим в строке выбором и количеством (если есть), а не с нуля.
  const editingRow = multiModalRowIndex !== null ? moves[multiModalRowIndex] : null;
  const editingRowId = editingRow ? (!srcLocked ? editingRow.lot_id : editingRow.product_id) : null;
  const editingRowSelectionIds = editingRowId ? [editingRowId] : [];
  const editingRowQtyById = editingRowId && editingRow.qty_demand ? { [editingRowId]: editingRow.qty_demand } : {};
  const editingRowPackagesById =
    editingRowId && editingRow.qty_packages ? { [editingRowId]: editingRow.qty_packages } : {};

  return (
    <form className={styles.page} onSubmit={handleSubmit}>
      {loading && <Loading />}

      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={handleClose}>
          {Icons.arrowBack}
          <span>{t("back")}</span>
        </button>
        <div className={styles.headerText}>
          <span className={styles.eyebrow}>{presetType?.name || selectedType?.name || t("pickingType")}</span>
          <h2>{isEdit ? docName || t("editStockPicking") : t("addStockPicking")}</h2>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.grid}>
          {!presetType && (
            <div>
              <label>{t("pickingType")}</label>
              <select name="type_id" value={formData.type_id} onChange={handleTypeChange} required disabled={saving}>
                <option value="">{t("notSelected")}</option>
                {pickingTypes.map((tp) => (
                  <option key={tp.id} value={tp.id}>
                    {tp.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {formData.type_id && (
            <>
              <div>
                <label>{t("pickingScheduledDate")}</label>
                <input
                  type="datetime-local"
                  name="scheduled_date"
                  value={formData.scheduled_date}
                  onChange={handleScheduledDateChange}
                  disabled={saving}
                  max={nowForDatetimeInput()}
                />
              </div>

              <div>
                <label>{t("currency")}</label>
                <select name="currency_id" value={formData.currency_id} onChange={handleCurrencyChange} required disabled={saving}>
                  <option value="">{t("notSelected")}</option>
                  {currencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>{t("exchangeRate")}</label>
                <div className={styles.rateField}>
                  <input
                    type="number"
                    min="0"
                    step="0.000001"
                    value={formData.rate}
                    onChange={handleChange}
                    name="rate"
                    disabled={saving || isBaseCurrency}
                    required
                  />
                  {!isBaseCurrency && (
                    <button
                      type="button"
                      className={styles.refreshRateBtn}
                      onClick={handleRefreshRate}
                      disabled={saving || rateLoading || !formData.currency_id}
                      title={t("exchangeRateRefresh")}
                    >
                      {Icons.refresh}
                    </button>
                  )}
                </div>
              </div>

              {isInternal && (
                <div>
                  <label>{t("pickingTransferScope")}</label>
                  <select value={transferScope} onChange={handleTransferScopeChange} disabled={saving || warehouseLocked}>
                    <option value="same">{t("pickingTransferScopeSame")}</option>
                    <option value="between">{t("pickingTransferScopeBetween")}</option>
                  </select>
                </div>
              )}

              {/* Пара "откуда": филиал сразу рядом со своим складом, чтобы было видно, к чему он относится. */}
              {isInternal && transferScope === "same" && (
                <div>
                  <label>{t("branch")}</label>
                  <SearchableSelect
                    value={branchSrcId}
                    options={branchesWithWarehouse}
                    onChange={handleBranchSameChange}
                    placeholder={t("notSelected")}
                    disabled={saving || warehouseLocked}
                  />
                </div>
              )}
              {((isInternal && transferScope === "between") || (!isInternal && !srcLocked)) && (
                <div>
                  <label>{t("branch")}</label>
                  <SearchableSelect
                    value={branchSrcId}
                    options={
                      isInternal && transferScope === "between"
                        ? branchesWithWarehouse.filter((b) => String(b.id) !== String(branchDestId))
                        : branchesWithWarehouse
                    }
                    onChange={handleBranchSrcChange}
                    placeholder={t("notSelected")}
                    disabled={saving || warehouseLocked}
                  />
                </div>
              )}
              {!srcLocked && (
                <div>
                  <label>{t("warehouse")}</label>
                  <SearchableSelect
                    value={formData.location_src_id}
                    options={warehousesForBranch(branchSrcId)}
                    onChange={(value) => setFormData((prev) => ({ ...prev, location_src_id: value }))}
                    placeholder={t("notSelected")}
                    required
                    disabled={saving || warehouseLocked}
                  />
                </div>
              )}

              {/* Пара "куда" — только когда это отдельная сторона (внутри филиала склад-получатель уже под тем же филиалом выше). */}
              {((isInternal && transferScope === "between") || (!isInternal && !destLocked)) && (
                <div>
                  <label>{isInternal ? t("pickingDestBranch") : t("branch")}</label>
                  <SearchableSelect
                    value={branchDestId}
                    options={
                      isInternal && transferScope === "between"
                        ? branchesWithWarehouse.filter((b) => String(b.id) !== String(branchSrcId))
                        : branchesWithWarehouse
                    }
                    onChange={handleBranchDestChange}
                    placeholder={t("notSelected")}
                    disabled={saving || warehouseLocked}
                  />
                </div>
              )}
              {!destLocked && (
                <div>
                  <label>{isInternal ? t("pickingDestWarehouse") : t("warehouse")}</label>
                  <SearchableSelect
                    value={formData.location_dest_id}
                    options={warehousesForBranch(branchDestId)}
                    onChange={(value) => setFormData((prev) => ({ ...prev, location_dest_id: value }))}
                    placeholder={t("notSelected")}
                    required
                    disabled={saving || warehouseLocked}
                  />
                </div>
              )}

              {showSrcPartner && (
                <div>
                  <label>{t("partner")}</label>
                  <SearchableSelect
                    value={formData.src_partner_id}
                    options={suppliers}
                    onChange={(value) => setFormData((prev) => ({ ...prev, src_partner_id: value }))}
                    placeholder={t("notSelected")}
                    required
                    disabled={saving}
                  />
                </div>
              )}
              {showDestPartner && (
                <div>
                  <label>{t("partner")}</label>
                  <SearchableSelect
                    value={formData.dest_partner_id}
                    options={customers}
                    onChange={(value) => setFormData((prev) => ({ ...prev, dest_partner_id: value }))}
                    placeholder={t("notSelected")}
                    required
                    disabled={saving}
                  />
                </div>
              )}
              {(showSrcPartner || showDestPartner) && (
                <div>
                  <label>{showSrcPartner ? t("pickingPurchaseManager") : t("pickingSalesManager")}</label>
                  <SearchableSelect
                    value={formData.manager_id}
                    options={managerOptions}
                    onChange={(value) => setFormData((prev) => ({ ...prev, manager_id: value }))}
                    placeholder={t("notSelected")}
                    disabled={saving}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {formData.type_id && (
          <div className={styles.additional}>
            <button
              type="button"
              className={styles.additionalToggle}
              onClick={() => setShowAdditional((v) => !v)}
            >
              <span className={`${styles.additionalChevron} ${showAdditional ? styles.additionalChevronOpen : ""}`}>
                {Icons.chevronDown}
              </span>
              <span>{t("pickingAdditional")}</span>
            </button>

            {showAdditional && (
              <div className={styles.grid}>
                <div>
                  <label>{t("pickingOrigin")}</label>
                  <input
                    type="text"
                    name="origin"
                    value={formData.origin}
                    onChange={handleChange}
                    disabled={saving}
                    list="picking-origins-list"
                    autoComplete="off"
                  />
                  <datalist id="picking-origins-list">
                    {origins.map((o) => (
                      <option key={o} value={o} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label>{t("paymentMethod")}</label>
                  <select name="payment_method" value={formData.payment_method} onChange={handleChange} disabled={saving}>
                    <option value="">{t("notSelected")}</option>
                    <option value="cash">{t("paymentMethodCash")}</option>
                    <option value="card">{t("paymentMethodCard")}</option>
                    <option value="transfer">{t("paymentMethodTransfer")}</option>
                  </select>
                </div>

                <div>
                  <label>{t("pickingTransport")}</label>
                  <input type="text" name="transport" value={formData.transport} onChange={handleChange} disabled={saving} />
                </div>
                <div>
                  <label>{t("pickingVehicleNumber")}</label>
                  <input type="text" name="vehicle_number" value={formData.vehicle_number} onChange={handleChange} disabled={saving} />
                </div>
                <div>
                  <label>{t("pickingDriver")}</label>
                  <input type="text" name="driver" value={formData.driver} onChange={handleChange} disabled={saving} />
                </div>

                <div className={styles.fullRow}>
                  <label>{t("note")}</label>
                  <textarea
                    ref={noteRef}
                    name="note"
                    value={formData.note}
                    onChange={(e) => {
                      handleChange(e);
                      autoResizeNote(e.target);
                    }}
                    disabled={saving}
                    rows={1}
                    className={styles.note}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {!formData.type_id ? (
          <div className={styles.selectTypeHint}>{t("pickingSelectTypeHint")}</div>
        ) : !warehouseChosen ? (
          <div className={styles.selectTypeHint}>{t("pickingSelectWarehouseHint")}</div>
        ) : (
        <div className={styles.items}>
          <div className={styles.itemsHeader}>
            <span>{t("pickingMoves")}</span>
            <button type="button" className={styles.addBtn} onClick={addMove} disabled={saving}>
              {Icons.plus}
              <span>{t("addRow")}</span>
            </button>
          </div>

          {moves.length === 0 ? (
            <div className={styles.empty}>{t("noData")}</div>
          ) : (
            <>
              <div className={styles.itemsColHeader}>
                <span>№</span>
                <span>{t("product")}</span>
                <span>{t("description")}</span>
                <span>{t("unit")}</span>
                <span>{t("quantity")}</span>
                <span>{t("pickingQtyPackages")}</span>
                <span>{t("price")}</span>
                <span>{t("amount")}</span>
                <span></span>
              </div>
              {moves.map((row, i) => {
                const rowProduct = products.find((p) => String(p.id) === String(row.product_id));
                const rowAttributes = rowProduct?.productAttributes || [];
                const remainingStock = remainingStockForRow(i);
                const remainingPackages = remainingPackagesForRow(i);
                return (
                <div className={styles.itemRowWrap} key={i}>
                  <div className={styles.itemRow}>
                    <div className={styles.rowNumber}>{i + 1}</div>
                    <button
                      type="button"
                      className={styles.productPicker}
                      onClick={() => setMultiModalRowIndex(i)}
                      disabled={saving}
                    >
                      <span className={rowProduct ? styles.productPickerValue : styles.productPickerPlaceholder}>
                        {rowProduct?.name || t("product")}
                      </span>
                    </button>
                    <input
                      type="text"
                      className={styles.descriptionInput}
                      placeholder={t("description")}
                      value={row.note}
                      onChange={(e) => updateMove(i, "note", e.target.value)}
                      disabled={saving || (!srcLocked && Boolean(row.lot_id))}
                      maxLength={500}
                    />
                    <select
                      value={row.unit_id}
                      onChange={(e) => updateMove(i, "unit_id", e.target.value)}
                      disabled={saving}
                    >
                      <option value="">{t("unit")}</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.short_name || u.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={remainingStock !== null ? t("pickingStockBalance", { qty: formatNumberInput(remainingStock) }) : t("quantity")}
                      value={formatNumberInput(row.qty_demand)}
                      onChange={(e) => {
                        const raw = parseNumericInput(e.target.value);
                        const next = remainingStock !== null && Number(raw) > remainingStock ? String(remainingStock) : raw;
                        updateMove(i, "qty_demand", next);
                      }}
                      disabled={saving}
                      required
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={remainingPackages !== null ? t("pickingStockBalance", { qty: formatNumberInput(remainingPackages) }) : t("pickingQtyPackages")}
                      value={formatNumberInput(row.qty_packages)}
                      onChange={(e) => {
                        const raw = parseNumericInput(e.target.value);
                        const next = remainingPackages !== null && Number(raw) > remainingPackages ? String(remainingPackages) : raw;
                        updateMove(i, "qty_packages", next);
                      }}
                      disabled={saving}
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={selectedCurrency ? `${t("price")}, ${selectedCurrency.code}` : t("price")}
                      value={formatNumberInput(row.price_unit)}
                      onChange={(e) => updateMove(i, "price_unit", parseNumericInput(e.target.value))}
                      disabled={saving || (!srcLocked && Boolean(row.lot_id))}
                    />
                    <div className={styles.rowTotal} title={t("amount")}>
                      {fmtMoney(rowTotal(row))}
                    </div>
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={() => removeMove(i)}
                      disabled={saving}
                      title={t("delete")}
                    >
                      {Icons.delete}
                    </button>
                  </div>
                  {rowAttributes.length > 0 && (
                    <div className={styles.itemAttributes}>
                      {rowAttributes.map((pa) => (
                        <div className={styles.itemAttributeField} key={pa.attribute_id}>
                          <label>{pa.attribute.name}</label>
                          <SearchableSelect
                            value={row.attributes?.[pa.attribute_id] || ""}
                            options={(attributeValuesCache[pa.attribute_id] || []).map((v) => ({ id: v.id, name: v.value }))}
                            onChange={(value) => updateMoveAttribute(i, pa.attribute_id, value)}
                            placeholder={t("notSelected")}
                            required
                            disabled={saving || (!srcLocked && Boolean(row.lot_id))}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                );
              })}
            </>
          )}

          {moves.length > 0 && (
            <div className={styles.totalRow}>
              <span>{t("total")}</span>
              <span>
                {fmtMoney(moves.reduce((sum, row) => sum + rowTotal(row), 0))}
                {selectedCurrency ? ` ${selectedCurrency.code}` : ""}
              </span>
            </div>
          )}
        </div>
        )}
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.cancelBtn} onClick={handleClose}>
          {t("cancel")}
        </button>
        <Button text={t("save")} type="submit" loading={saving} />
      </div>

      <AddMultipleProductsModal
        isOpen={multiModalRowIndex !== null}
        onClose={() => setMultiModalRowIndex(null)}
        onConfirm={handleAddMultiple}
        options={availableProductOptions}
        initialSelectedIds={editingRowSelectionIds}
        initialQtyById={editingRowQtyById}
        initialPackagesById={editingRowPackagesById}
      />
    </form>
  );
};

export default AddStockPicking;
