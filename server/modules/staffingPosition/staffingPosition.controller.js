import { StaffingPositionService } from "./staffingPosition.service.js";

export const StaffingPositionController = {
  getByDepartment: async (req, res) => {
    try {
      const data = await StaffingPositionService.getByDepartment(req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  },

  bulkUpsert: async (req, res) => {
    try {
      const data = await StaffingPositionService.bulkUpsert(
        req.params.id,
        req.body.positions || [],
        req.user?.id,
      );
      res.json({ success: true, data });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  },
};
