import { FaceDeviceClient } from "../../utils/faceDeviceFunction.js";
import { retry } from "../../utils/utils.js";
import { EmployeeService } from "../employees/employees.service.js";
import { FaceDeviceModel } from "./faceDevices.model.js";

function extractFaceDevices(doors = []) {
  return doors
    .flatMap((door) => door.faceDevices || [])
    .filter((fd) => fd.device_ip);
}

export const FaceDeviceService = {
  async syncEmployee(id) {
    const employee = await EmployeeService.getById(id);

    if (!employee) {
      throw new Error("Сотрудник не найден");
    }

    const fullName = `${employee.last_name} ${employee.first_name}`;
    const photo = employee.photo;

    const currentDevices = extractFaceDevices(employee.doors);

    if (employee.status === false || currentDevices.length === 0) {
      const allFaceDevices = await FaceDeviceModel.findActive();

      for (const device of allFaceDevices) {
        try {
          await retry(
            async () => {
              await FaceDeviceClient.deleteUser(device.device_ip, id);
            },
            { retries: 3, delay: 10000 },
          );
        } catch (error) {
          console.error(
            `Не удалось удалить пользователя с устройства ${device.device_ip} после всех попыток:`,
            error.message,
          );
        }
      }
      return;
    }

    // Сценарий 2: Обновление/Создание на разрешенных устройствах
    for (const device of currentDevices) {
      try {
        await retry(
          async () => {
            await FaceDeviceClient.updateUser(device.device_ip, id, fullName);

            if (photo) {
              await FaceDeviceClient.updateUserPhoto(
                device.device_ip,
                id,
                fullName,
                photo,
              );
            }
          },
          {
            retries: 3,
            delay: 10000,
            onError: (err, attempt) => {
              console.error(
                `FaceDevice ${device.device_ip}, попытка ${attempt}:`,
                err.message,
              );
            },
          },
        );
      } catch (error) {
        console.error(
          `Критическая ошибка синхронизации с устройством ${device.device_ip}:`,
          error.message,
        );
      }
    }
  },
};
