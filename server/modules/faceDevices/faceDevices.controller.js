import * as faceDevicesModel from "./faceDevices.model.js";

export const getAll = async (req, res) => {
  try {
    const { page, pageSize, filters } = req.query;

    const result = await faceDevicesModel.getFaceDevices(
      page,
      pageSize,
      filters
    );
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("Ошибка при получении face-устройств:", err);
    res.status(500).json({ error: "Ошибка при получении face-устройств" });
  }
};

export const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const device = await faceDevicesModel.getFaceDeviceById(id);

    if (!device) {
      return res.status(404).json({ error: "Face-устройство не найдено" });
    }

    res.status(200).json({ success: true, data: device });
  } catch (err) {
    console.error("Ошибка при получении face-устройства:", err);
    res.status(500).json({ error: "Ошибка при получении face-устройства" });
  }
};

export const create = async (req, res) => {
  try {
    const {
      name,
      direction,
      device_ip,
      port,
      door_id,
      status = true,
    } = req.body;

    const device = await faceDevicesModel.createFaceDevice({
      name,
      direction,
      device_ip,
      port: Number(port),
      port: port ? Number(port) : null,
      door_id: door_id ? Number(door_id) : null,
    });
    res.status(201).json({ success: true, result: device });
  } catch (err) {
    console.error("Ошибка при добавлении face-устройства:", err);
    res.status(500).json({ error: "Ошибка при добавлении face-устройства" });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, direction, device_ip, port, door_id, status } = req.body;

    const device = await faceDevicesModel.updateFaceDevice(id, {
      name,
      direction,
      device_ip,
      port: port ? Number(port) : null,
      door_id: door_id ? Number(door_id) : null,
      status: status === true ? true : status === "true" ? true : false,
    });

    res.status(200).json({ success: true, result: device });
  } catch (err) {
    console.error("Ошибка при обновлении face-устройства:", err);
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Face-устройство не найдено" });
    }
    res.status(500).json({ error: "Ошибка при обновлении face-устройства" });
  }
};
