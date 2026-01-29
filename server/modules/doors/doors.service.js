import * as doorsModel from "./doors.model.js";

export const updateDoor = async (id, data) => {
  return doorsModel.updateDoor(id, {
    name: data.name?.trim(),
    status: data.status === "true",
  });
};
