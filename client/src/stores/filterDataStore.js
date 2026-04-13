import { create } from "zustand";
import {
  getActiveBranches,
  getActiveDepartments,
  getActivePositions,
} from "../api";

export const useFilterDataStore = create((set, get) => ({
  branches: [],
  departments: [],
  positions: [],
  employees: [],

  fetchAllData: async () => {
    try {
      const [branchesRes, departmentsRes, positionsRes] = await Promise.all([
        getActiveBranches(),
        getActiveDepartments(),
        getActivePositions(),
      ]);

      set({
        branches: branchesRes?.data || [],
        departments: departmentsRes?.data || [],
        positions: positionsRes?.data || [],
      });
    } catch (error) {
      console.error("Ошибка при загрузке данных:", error);
    }
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
