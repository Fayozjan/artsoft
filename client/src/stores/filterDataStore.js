import { create } from "zustand";
import {
  getActiveBranches,
  getActiveDepartments,
  getActivePositions,
} from "../api";

export const useFilterDataStore = create((set) => ({
  branches: [],
  departments: [],
  positions: [],

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
        loading: false,
      });
    } catch (error) {
      console.error("Ошибка при загрузке данных:", error);
      set({ loading: false });
    }
  },

  deleteUser: (id) => {
    set((state) => ({
      employees: state.employees.filter((e) => e.employee_id !== id),
    }));
  },

  updateUser: (updatedUser) => {
    set((state) => ({
      employees: state.users.map((u) =>
        e.employee_id === updatedUser.user_id ? updatedUser : u
      ),
    }));
  },
}));
