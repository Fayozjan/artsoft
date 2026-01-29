import * as facePassesModel from "./facePasses.model.js";
import * as facePassesService from "./facePasses.service.js";

export const getFacePasses = async (req, res) => {
  const userId = req.user.id;

  try {
    const { page, pageSize, filters } = req.query;

    const result = await facePassesService.getFacePasses({
      userId,
      page,
      pageSize,
      filters,
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error("Ошибка при получении FacePass:", err);
    res.status(500).json({ error: "Ошибка при получении FacePass" });
  }
};

export const getFacePassById = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await facePassesModel.getFacePassById(id);

    if (!record) return res.status(404).json({ error: "FacePass не найден" });

    res.json({ success: true, data: record });
  } catch (err) {
    console.error("Ошибка при получении FacePass:", err);
    res.status(500).json({ error: "Ошибка при получении FacePass" });
  }
};

export const editFacePass = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await facePassesModel.updateFacePass(id, req.body);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error("Ошибка при обновлении FacePass:", err);
    res.status(500).json({ error: "Ошибка при обновлении FacePass" });
  }
};

export const removeFacePass = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await facePassesModel.deleteFacePass(id);
    res.json({ success: true, data: deleted });
  } catch (err) {
    console.error("Ошибка при удалении FacePass:", err);
    res.status(500).json({ error: "Ошибка при удалении FacePass" });
  }
};
