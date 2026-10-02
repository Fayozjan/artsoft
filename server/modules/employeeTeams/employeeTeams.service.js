import { EmployeeTeamModel } from "./employeeTeams.model.js";
import { OperationTypeModel } from "../operationTypes/operationTypes.model.js";

const trim = (value, max) =>
  typeof value === "string" && value.trim() !== "" ? value.trim().slice(0, max) : null;

const toInt = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isInteger(num) ? num : null;
};

const assertOperationType = async (operationTypeId) => {
  const type = await OperationTypeModel.findUnique(operationTypeId);
  if (!type) {
    const err = new Error("Тип операции не найден");
    err.code = "OPERATION_TYPE_NOT_FOUND";
    throw err;
  }
  return type;
};

// Участники команды — только сотрудники, допущенные к типу операции (пустой
// список допущенных = допущены все, тогда ограничения нет).
const parseMemberIds = async (value, operationTypeId) => {
  if (!Array.isArray(value) || value.length === 0) {
    const err = new Error("Не выбраны участники команды");
    err.code = "MEMBERS_REQUIRED";
    throw err;
  }

  const ids = [...new Set(value.map(toInt))];
  if (ids.some((id) => !id)) {
    const err = new Error("Некорректный список участников");
    err.code = "INVALID_MEMBERS";
    throw err;
  }

  if ((await EmployeeTeamModel.countEmployees(ids)) !== ids.length) {
    const err = new Error("Сотрудник не найден");
    err.code = "EMPLOYEE_NOT_FOUND";
    throw err;
  }

  const allowed = await EmployeeTeamModel.findAllowedEmployeeIds(operationTypeId);
  if (allowed.length > 0) {
    const allowedSet = new Set(allowed);
    if (ids.some((id) => !allowedSet.has(id))) {
      const err = new Error("Участник не допущен к этому типу операции");
      err.code = "MEMBER_NOT_ALLOWED";
      throw err;
    }
  }

  return ids;
};

const assertUniqueName = async (operationTypeId, name, excludeId) => {
  const teams = await EmployeeTeamModel.findByOperationType(operationTypeId);
  const taken = teams.find(
    (team) => team.name.toLowerCase() === name.toLowerCase() && team.id !== excludeId,
  );
  if (taken) {
    const err = new Error("Команда с таким названием уже есть у этого типа операции");
    err.code = "NAME_TAKEN";
    throw err;
  }
};

export const EmployeeTeamsService = {
  getByOperationType: async (operationTypeId) => {
    await assertOperationType(operationTypeId);
    return EmployeeTeamModel.findByOperationType(operationTypeId);
  },

  create: async (body, userId) => {
    const operationTypeId = toInt(body.operation_type_id);
    if (!operationTypeId) {
      const err = new Error("Не указан тип операции");
      err.code = "OPERATION_TYPE_REQUIRED";
      throw err;
    }
    await assertOperationType(operationTypeId);

    const name = trim(body.name, 100);
    if (!name) {
      const err = new Error("Не заполнено название команды");
      err.code = "NAME_REQUIRED";
      throw err;
    }
    await assertUniqueName(operationTypeId, name, null);

    const memberIds = await parseMemberIds(body.employee_ids, operationTypeId);

    return EmployeeTeamModel.create(
      { name, operation_type_id: operationTypeId, added_by: Number(userId) },
      memberIds,
    );
  },

  update: async (id, body) => {
    const old = await EmployeeTeamModel.findUnique(id);
    if (!old) return null;

    const name = trim(body.name, 100);
    if (!name) {
      const err = new Error("Не заполнено название команды");
      err.code = "NAME_REQUIRED";
      throw err;
    }
    await assertUniqueName(old.operation_type_id, name, old.id);

    const memberIds = await parseMemberIds(body.employee_ids, old.operation_type_id);

    return EmployeeTeamModel.update(id, { name }, memberIds);
  },

  delete: async (id) => {
    const old = await EmployeeTeamModel.findUnique(id);
    if (!old) return null;
    return EmployeeTeamModel.delete(id);
  },
};
