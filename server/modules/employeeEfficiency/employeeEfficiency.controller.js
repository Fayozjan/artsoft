import { EmployeeEfficiencyService } from "./employeeEfficiency.service.js";

export const EmployeeEfficiencyController = {
  get: async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { months } = req.query;

      const data = await EmployeeEfficiencyService.get(employeeId, { months });

      if (!data) {
        return res.status(404).json({ message: "Employee not found" });
      }

      res.json({ success: true, data });
    } catch (err) {
      console.error("Error in getEmployeeEfficiency:", err);
      res.status(500).json({ message: err.message || "Internal error" });
    }
  },
};
