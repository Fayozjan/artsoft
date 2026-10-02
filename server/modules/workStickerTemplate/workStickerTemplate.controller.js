import { WorkStickerTemplateService } from "./workStickerTemplate.service.js";
import { assertCanEditSticker } from "../../utils/productionAccess.js";

const CLIENT_ERROR_STATUS = {
  INVALID_SIZE: 400,
  INVALID_ELEMENTS: 400,
  ACTIVE_TEMPLATE: 400,
  NOT_FOUND: 404,
  STICKER_EDIT_FORBIDDEN: 400,
};

const sendError = (res, err, logMessage, fallbackMessage) => {
  const status = CLIENT_ERROR_STATUS[err.code];
  if (status) return res.status(status).json({ error: err.message });
  console.error(logMessage, err);
  return res.status(500).json({ error: fallbackMessage });
};

export const WorkStickerTemplateController = {
  // Активный вариант — по нему печатаются стикеры.
  get: async (req, res) => {
    try {
      const data = await WorkStickerTemplateService.get();
      res.status(200).json({ success: true, data });
    } catch (err) {
      sendError(res, err, "Ошибка при получении шаблона стикера:", "Ошибка при получении данных");
    }
  },

  list: async (req, res) => {
    try {
      const data = await WorkStickerTemplateService.list();
      res.status(200).json({ success: true, data });
    } catch (err) {
      sendError(res, err, "Ошибка при получении списка шаблонов стикера:", "Ошибка при получении данных");
    }
  },

  create: async (req, res) => {
    try {
      await assertCanEditSticker(req.user.id);
      const data = await WorkStickerTemplateService.create(req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      sendError(res, err, "Ошибка при создании шаблона стикера:", "Ошибка при сохранении");
    }
  },

  update: async (req, res) => {
    try {
      await assertCanEditSticker(req.user.id);
      const data = await WorkStickerTemplateService.update(Number(req.params.id), req.body);
      res.status(200).json({ success: true, data });
    } catch (err) {
      sendError(res, err, "Ошибка при сохранении шаблона стикера:", "Ошибка при сохранении");
    }
  },

  activate: async (req, res) => {
    try {
      await assertCanEditSticker(req.user.id);
      const data = await WorkStickerTemplateService.activate(Number(req.params.id));
      res.status(200).json({ success: true, data });
    } catch (err) {
      sendError(res, err, "Ошибка при выборе шаблона стикера:", "Ошибка при сохранении");
    }
  },

  remove: async (req, res) => {
    try {
      await assertCanEditSticker(req.user.id);
      await WorkStickerTemplateService.remove(Number(req.params.id));
      res.status(200).json({ success: true });
    } catch (err) {
      sendError(res, err, "Ошибка при удалении шаблона стикера:", "Ошибка при удалении");
    }
  },
};
