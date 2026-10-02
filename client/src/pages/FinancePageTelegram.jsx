import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../stores/authStore";
import { useScreenStack } from "../context/ScreenStackContext";
import { payrollApi } from "../api/payroll";
import { salaryHistoryApi } from "../api/salaryHistory";
import Loading from "../components/LoadingTelegram";
import EmployeeCell from "../components/EmployeeCell";
import styles from "./FinancePageTelegram.module.scss";

// ─── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n) =>
  n == null
    ? "—"
    : String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const fullName = (...parts) => parts.filter(Boolean).join(" ") || "—";

const toMonthStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const currentMonthStr = () => toMonthStr(new Date());

const monthLabel = (m) => {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });
};

const shiftMonth = (m, delta) => {
  const [y, mo] = m.split("-").map(Number);
  return toMonthStr(new Date(y, mo - 1 + delta, 1));
};

// ─── Icons ─────────────────────────────────────────────────────────────────────

const IconSettings = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.1 4.9a9 9 0 0 1 0 12.73M4.9 4.9a9 9 0 0 0 0 12.73M12 2v2m0 16v2M2 12h2m16 0h2" />
  </svg>
);

const IconPayroll = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20M6 15h2m4 0h2" />
  </svg>
);

const IconPayouts = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const IconChevronRight = () => (
  <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
    <path
      d="M1 1l5 5-5 5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconChevronLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconChevronRightNav = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── Shared UI ─────────────────────────────────────────────────────────────────

function MenuItem({ icon, iconClass, title, sub, onPress }) {
  return (
    <div
      className={styles.listItem}
      role="button"
      tabIndex={0}
      onClick={onPress}
      onKeyDown={(e) => e.key === "Enter" && onPress()}
    >
      <div className={`${styles.itemIcon} ${iconClass}`}>{icon}</div>
      <div className={styles.itemBody}>
        <p className={styles.itemTitle}>{title}</p>
        <p className={styles.itemSub}>{sub}</p>
      </div>
      <div className={styles.itemChevron}>
        <IconChevronRight />
      </div>
    </div>
  );
}

function MonthNav({ month, onChange }) {
  const now = currentMonthStr();
  return (
    <div className={styles.monthNav}>
      <button
        className={styles.monthBtn}
        onClick={() => onChange(shiftMonth(month, -1))}
      >
        <IconChevronLeft />
      </button>
      <span className={styles.monthLabel}>{monthLabel(month)}</span>
      <button
        className={styles.monthBtn}
        onClick={() => onChange(shiftMonth(month, 1))}
        disabled={month >= now}
      >
        <IconChevronRightNav />
      </button>
    </div>
  );
}

function StatRow({ label, value, color }) {
  return (
    <div className={styles.statRow}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue} style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}

function SubHeader({ title, onBack }) {
  return (
    <div className={styles.subHeader}>
      <button className={styles.backBtn} onClick={onBack}>
        <IconChevronLeft />
      </button>
      <h2 className={styles.subTitle}>{title}</h2>
    </div>
  );
}

// ─── Telegram back button ──────────────────────────────────────────────────────

function useTelegramBackButton(onBack) {
  useEffect(() => {
    const bb = window.Telegram?.WebApp?.BackButton;
    if (!bb) return;
    bb.show();
    bb.onClick(onBack);
    return () => {
      bb.offClick(onBack);
      bb.hide();
    };
  }, [onBack]);
}

// ─── Salary type label ─────────────────────────────────────────────────────────

function useSalaryTypeLabel() {
  const { t } = useTranslation();
  return (type) => {
    if (type === "monthly") return t("salaryTypeMonthly");
    if (type === "hourly") return t("salaryTypeHourly");
    if (type === "piecework") return t("salaryTypePiecework");
    return type || "—";
  };
}

// ─── Branch ID helper ──────────────────────────────────────────────────────────

function useBranchId() {
  const { access } = useAuthStore();
  const { activeBranchId } = useAuthStore((s) => s.userSettings);
  return activeBranchId || access?.branches?.[0]?.id || undefined;
}

// ─── Admin sub-screen: Salary Settings ────────────────────────────────────────

function SalarySettingsScreen() {
  const { t } = useTranslation();
  const { popScreen } = useScreenStack();
  const typeLabel = useSalaryTypeLabel();
  const branchId = useBranchId();
  useTelegramBackButton(popScreen);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    salaryHistoryApi
      .getEmployeesWithSalary({
        page: 1,
        limit: 500,
        status: "true",
        branch_id: branchId || undefined,
      })
      .then((res) => {
        if (res.success) setData(res.data || []);
      })
      .finally(() => setLoading(false));
  }, [branchId]);

  const q = search.toLowerCase();
  const filtered = q
    ? data.filter((emp) => {
        const name = fullName(emp.last_name, emp.first_name, emp.middle_name);
        const pos = emp.position?.name || "";
        const id = String(emp.id || "");
        const empNum = String(emp.employee_number || "");
        return (
          name.toLowerCase().includes(q) ||
          pos.toLowerCase().includes(q) ||
          id.includes(q) ||
          empNum.includes(q)
        );
      })
    : data;

  return (
    <div className={styles.subPage}>
      <div className={styles.subMain}>
        <div className={styles.stickySearch}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder={t("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className={styles.loadingWrap}>
            <Loading />
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.card}>
            <p className={styles.emptyText}>{t("noData")}</p>
          </div>
        ) : (
          <div className={styles.empList}>
            {filtered.map((emp) => {
              const salary = emp.employeeSalaryHistory?.[0];
              return (
                <div key={emp.id} className={styles.empItem}>
                  <EmployeeCell
                    photo={emp.photo}
                    lastName={emp.last_name}
                    firstName={emp.first_name}
                    middleName={emp.middle_name}
                    id={emp.id}
                    branch={emp.branch?.name}
                    department={emp.department?.name}
                    active={emp.status}
                  />
                  <div className={styles.empSalary}>
                    {salary ? (
                      <>
                        <p className={styles.salaryAmount}>
                          {fmt(salary.amount)}
                        </p>
                        <p className={styles.salaryType}>
                          {typeLabel(salary.salary_type)}
                        </p>
                      </>
                    ) : (
                      <p className={styles.salaryType}>{t("notSet")}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Admin sub-screen: Payroll ────────────────────────────────────────────────

function PayrollScreen() {
  const { t } = useTranslation();
  const { popScreen } = useScreenStack();
  const branchId = useBranchId();
  useTelegramBackButton(popScreen);

  const [month, setMonth] = useState(currentMonthStr());
  const [sheet, setSheet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    setSheet(null);
    payrollApi
      .getOrGenerate(month, { branch_id: branchId || undefined })
      .then((res) => {
        if (res.success) setSheet(res.data);
      })
      .catch(() => setSheet(null))
      .finally(() => setLoading(false));
  }, [month, branchId]);

  const st = sheet?.stats;
  const q = search.toLowerCase();
  const items = (sheet?.items || []).filter((item) => {
    if (!q) return true;
    const emp = item.employee || item;
    const name = fullName(emp.last_name, emp.first_name, emp.middle_name);
    const id = String(emp.id || "");
    const empNum = String(emp.employee_number || "");
    return (
      name.toLowerCase().includes(q) || id.includes(q) || empNum.includes(q)
    );
  });

  return (
    <div className={styles.subPage}>
      <div className={styles.subMain}>
        <MonthNav month={month} onChange={setMonth} />

        {loading ? (
          <div className={styles.loadingWrap}>
            <Loading />
          </div>
        ) : (
          <>
            {st && (
              <div className={styles.card}>
                <StatRow label={t("statsTotal")} value={st.total} />
                <StatRow
                  label={t("statsApproved")}
                  value={st.approved}
                  color="#16a34a"
                />
                <StatRow
                  label={t("statsRemaining")}
                  value={st.remaining}
                  color="#f59e0b"
                />
                <StatRow
                  label={t("statsApprovedNet")}
                  value={fmt(st.approved_net)}
                  color="#16a34a"
                />
              </div>
            )}

            <div className={styles.stickySearch}>
              <input
                className={styles.searchInput}
                type="text"
                placeholder={t("search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {items.length > 0 ? (
              <div className={styles.empList}>
                {items.map((item) => {
                  const emp = item.employee || item;
                  const approved = item.status === "approved";
                  return (
                    <div key={item.id} className={styles.empItem}>
                      <EmployeeCell
                        photo={emp.photo}
                        lastName={emp.last_name}
                        firstName={emp.first_name}
                        middleName={emp.middle_name}
                        id={emp.id}
                        branch={emp.branch?.name}
                        department={emp.department?.name}
                      />
                      <div className={styles.empSalary}>
                        <p className={styles.salaryAmount}>{fmt(item.net)}</p>
                        <p
                          className={styles.salaryType}
                          style={{ color: approved ? "#16a34a" : "#f59e0b" }}
                        >
                          {approved ? t("approved") : t("draft")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.card}>
                <p className={styles.emptyText}>{t("noData")}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Admin sub-screen: Payouts ────────────────────────────────────────────────

function PayoutsScreen() {
  const { t } = useTranslation();
  const { popScreen } = useScreenStack();
  const branchId = useBranchId();
  useTelegramBackButton(popScreen);

  const [month, setMonth] = useState(currentMonthStr());
  const [sheet, setSheet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    setSheet(null);
    payrollApi
      .getPayouts(month, { branch_id: branchId || undefined })
      .then((res) => {
        if (res.success) setSheet(res.data);
      })
      .catch(() => setSheet(null))
      .finally(() => setLoading(false));
  }, [month, branchId]);

  const st = sheet?.stats;
  const q = search.toLowerCase();
  const items = (sheet?.items || []).filter((item) => {
    if (!q) return true;
    const emp = item.employee || item;
    const name = fullName(emp.last_name, emp.first_name, emp.middle_name);
    const id = String(emp.id || "");
    const empNum = String(emp.employee_number || "");
    return (
      name.toLowerCase().includes(q) || id.includes(q) || empNum.includes(q)
    );
  });

  return (
    <div className={styles.subPage}>
      <div className={styles.subMain}>
        <MonthNav month={month} onChange={setMonth} />

        {loading ? (
          <div className={styles.loadingWrap}>
            <Loading />
          </div>
        ) : (
          <>
            {st && (
              <div className={styles.card}>
                <StatRow
                  label={t("statsPaid")}
                  value={st.paid_count}
                  color="#16a34a"
                />
                <StatRow
                  label={t("statsPending")}
                  value={st.pending_count}
                  color="#f59e0b"
                />
                <StatRow
                  label={t("statsPaidSum")}
                  value={fmt(st.paid_sum)}
                  color="#16a34a"
                />
                <StatRow
                  label={t("statsPendingSum")}
                  value={fmt(st.pending_sum)}
                  color="#f59e0b"
                />
              </div>
            )}

            <div className={styles.stickySearch}>
              <input
                className={styles.searchInput}
                type="text"
                placeholder={t("search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {items.length > 0 ? (
              <div className={styles.empList}>
                {items.map((item) => {
                  const emp = item.employee || item;
                  const paid = item.payout_status === "paid";
                  return (
                    <div key={item.id} className={styles.empItem}>
                      <EmployeeCell
                        photo={emp.photo}
                        lastName={emp.last_name}
                        firstName={emp.first_name}
                        middleName={emp.middle_name}
                        id={emp.id}
                        branch={emp.branch?.name}
                        department={emp.department?.name}
                      />
                      <div className={styles.empSalary}>
                        <p className={styles.salaryAmount}>{fmt(item.net)}</p>
                        <p
                          className={styles.salaryType}
                          style={{ color: paid ? "#16a34a" : "#f59e0b" }}
                        >
                          {paid ? t("paid") : t("pendingPayout")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.card}>
                <p className={styles.emptyText}>{t("noData")}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Подэкраны финансов по имени пункта меню — их же открывает страница «Меню»,
// чтобы подпункты финансов лежали в своём разделе.
export const FINANCE_SCREENS = {
  "salary-settings": SalarySettingsScreen,
  payroll: PayrollScreen,
  "salary-payouts": PayoutsScreen,
};

// ─── Admin view ────────────────────────────────────────────────────────────────

function AdminFinancePage() {
  const { t } = useTranslation();
  const { pushScreen } = useScreenStack();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.headerTitle}>{t("finance")}</h1>
      </div>
      <div className={styles.main}>
        <div className={styles.cardList}>
          <div className={styles.list}>
            <MenuItem
              icon={<IconSettings />}
              iconClass={styles.iconBlue}
              title={t("salary-settings")}
              sub={t("salaryHistory")}
              onPress={() =>
                pushScreen("salary-settings", <SalarySettingsScreen />)
              }
            />
            <MenuItem
              icon={<IconPayroll />}
              iconClass={styles.iconGreen}
              title={t("payroll")}
              sub={t("accrued")}
              onPress={() => pushScreen("payroll", <PayrollScreen />)}
            />
            <MenuItem
              icon={<IconPayouts />}
              iconClass={styles.iconAmber}
              title={t("salary-payouts")}
              sub={t("payouts")}
              onPress={() => pushScreen("payouts", <PayoutsScreen />)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Employee personal view ────────────────────────────────────────────────────

function EmployeeFinancePage({ employeeId }) {
  const { t } = useTranslation();
  const typeLabel = useSalaryTypeLabel();

  const [month, setMonth] = useState(currentMonthStr());
  const [salary, setSalary] = useState(null);
  const [payrollItem, setPayrollItem] = useState(null);
  const [payrollLoading, setPayrollLoading] = useState(false);

  // Current salary (latest active record)
  useEffect(() => {
    if (!employeeId) return;
    salaryHistoryApi.getByEmployee(employeeId).then((res) => {
      if (res.success && res.data?.length) {
        const sorted = [...res.data].sort(
          (a, b) => new Date(b.date_from) - new Date(a.date_from),
        );
        setSalary(sorted[0]);
      }
    });
  }, [employeeId]);

  // Payroll item for selected month
  useEffect(() => {
    if (!employeeId) return;
    setPayrollLoading(true);
    setPayrollItem(null);
    payrollApi
      .getOrGenerate(month, { employee_id: employeeId })
      .then((res) => {
        if (res.success) {
          const items = res.data?.items || [];
          setPayrollItem(items[0] ?? null);
        }
      })
      .catch(() => setPayrollItem(null))
      .finally(() => setPayrollLoading(false));
  }, [employeeId, month]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.headerTitle}>{t("finance")}</h1>
      </div>

      <div className={styles.main}>
        {/* Current salary */}
        <div className={styles.section}>
          <p className={styles.sectionTitle}>{t("salaryHistory")}</p>
          <div className={styles.card}>
            <StatRow
              label={t("amount")}
              value={salary ? fmt(salary.amount) : "—"}
            />
            <StatRow
              label={t("salaryType")}
              value={salary ? typeLabel(salary.salary_type) : "—"}
            />
          </div>
        </div>

        {/* Monthly payroll */}
        <div className={styles.section}>
          <p className={styles.sectionTitle}>{t("payroll")}</p>
          <MonthNav month={month} onChange={setMonth} />

          {payrollLoading ? (
            <div className={styles.loadingWrap}>
              <Loading />
            </div>
          ) : payrollItem ? (
            <div className={styles.card}>
              <StatRow label={t("accrued")} value={fmt(payrollItem.accrued)} />
              <StatRow
                label={t("net")}
                value={fmt(payrollItem.net)}
                color="#16a34a"
              />
              <StatRow
                label={t("status")}
                value={
                  payrollItem.status === "approved" ? t("approved") : t("draft")
                }
                color={
                  payrollItem.status === "approved" ? "#16a34a" : "#f59e0b"
                }
              />
            </div>
          ) : (
            <div className={styles.card}>
              <p className={styles.emptyText}>{t("noData")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

const FinancePageTelegram = () => {
  const { access } = useAuthStore();

  if (!access) return <Loading />;

  const isEmployee =
    access?.access_level === "employee" ||
    access?.personal_menus?.includes("finance");

  if (isEmployee) {
    return <EmployeeFinancePage employeeId={access.employee_id} />;
  }

  return <AdminFinancePage />;
};

export default FinancePageTelegram;
