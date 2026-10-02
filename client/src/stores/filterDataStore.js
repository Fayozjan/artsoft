import { create } from "zustand";
import {
  getActiveBranches,
  getActiveDepartments,
  getActivePositions,
  EmployeeService,
} from "../api";

export const useFilterDataStore = create((set, get) => ({
  branches: [],
  departments: [],
  positions: [],
  employees: [],

  fetchAllData: async () => {
    try {
      const [branchesRes, departmentsRes, positionsRes, employeesRes] =
        await Promise.all([
          getActiveBranches(),
          getActiveDepartments(),
          getActivePositions(),
          EmployeeService.getActive(),
        ]);

      set({
        branches: branchesRes?.data || [],
        departments: departmentsRes?.data || [],
        positions: positionsRes?.data || [],
        employees: employeesRes?.data || [],
      });
    } catch (error) {
      console.error("Ошибка при загрузке данных:", error);
    }
  },

  // Список сотрудников/отделов зависит от выбранного филиала логина —
  // после его смены закэшированные данные устарели. Если ещё ничего не
  // загружали, ничего не делаем: данные загрузит первый потребитель.
  refresh: async () => {
    const { branches, employees } = get();
    if (!branches.length && !employees.length) return;
    await get().fetchAllData();
  },

  deleteUser: (id) => {
    set((state) => ({
      // Проверь, чтобы имя массива совпадало с тем, что в state
      employees: state.employees.filter((e) => e.employee_id !== id),
    }));
  },

  updateUser: (updatedUser) => {
    set((state) => ({
      employees: state.employees.map((u) =>
        // Исправлена опечатка с 'e' на 'u' и консистентность ID
        u.employee_id === updatedUser.employee_id ? updatedUser : u,
      ),
    }));
  },
}));
