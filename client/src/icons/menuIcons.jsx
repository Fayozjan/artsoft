import {
  AlarmClock,
  Banknote,
  Bot,
  Briefcase,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarOff,
  CalendarRange,
  Camera,
  Car,
  ChartColumn,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  Cog,
  DoorOpen,
  FileBarChart2,
  FileSignature,
  FileText,
  Home,
  LayoutGrid,
  ListChecks,
  Monitor,
  Network,
  Package,
  ScanFace,
  ScrollText,
  Settings,
  Settings2,
  Timer,
  UserCog,
  Users,
  Utensils,
  UtensilsCrossed,
  Video,
  Wallet,
} from "lucide-react";

import { Icons } from "./icons";

// Иконка есть в сайдбаре — берём её, чтобы значок раздела был один и тот же
// везде. Для остальных пунктов — штриховая иконка того же монохромного вида.
const FALLBACK_ICONS = {
  home: Home,
  hr: Users,
  tasks: ListChecks,
  finance: CircleDollarSign,
  "vehicle-passes": Car,
  canteen: UtensilsCrossed,
  settings: Settings,

  departments: Network,
  staffing: ClipboardList,
  employees: Users,
  "employment-orders": FileSignature,
  attendance: CalendarCheck,
  "late-employees": AlarmClock,
  timesheet: CalendarRange,
  "time-off": CalendarOff,
  "face-passes": ScanFace,
  "production-calendar": CalendarDays,
  "work-schedules": CalendarClock,
  positions: Briefcase,
  "asset-assignments": Package,

  "salary-settings": Settings2,
  payroll: Wallet,
  "salary-payouts": Banknote,

  "canteen-allowances": Utensils,
  "canteen-display": Monitor,
  "canteen-report": FileText,

  operations: Cog,
  "work-acceptance": ClipboardCheck,
  "production-report": ChartColumn,

  "stock-pickings": FileText,
  "stock-report": FileBarChart2,

  gates: Car,
  "vehicle-cameras": Video,

  users: UserCog,
  branches: Building2,
  doors: DoorOpen,
  "face-devices": Camera,
  "telegram-bots": Bot,
  "audit-logs": ScrollText,
  "cron-tasks": Timer,
};

export const getMenuIcon = (name, size = 20) => {
  const sidebarIcon = Icons[name];
  if (sidebarIcon) return sidebarIcon;

  const Fallback = FALLBACK_ICONS[name] || LayoutGrid;
  return <Fallback size={size} strokeWidth={1.8} />;
};
