export function buildPayload(source_type, eventData) {
  switch (source_type) {
    case "face_pass":
      return {
        employee_id: eventData.employee.id,
        direction: eventData.direction,
        date: eventData.date,
        door_name: eventData.door?.name,
        photo: eventData.photo
          ? `uploads/face-passes/${eventData.photo}`
          : null,
        full_name: [
          eventData.employee?.last_name,
          eventData.employee?.first_name,
          eventData.employee?.middle_name,
        ]
          .filter(Boolean)
          .join(" "),
        branch: eventData.employee?.branch?.name,
        department: eventData.employee?.department?.name,
        position: eventData.employee?.position?.name,
      };

    case "anpr_pass":
      return {
        direction: eventData.direction,
        date: eventData.date,
        plate_number: eventData.plate_number,
        branch_name: eventData.branch?.name,
        gate_name: eventData.gate?.name,
        camera_name: eventData.camera?.name,
        photo: eventData.photo
          ? `uploads/vehicle-passes/${eventData.photo}`
          : null,
      };

    default:
      throw new Error(`Unknown source_type: ${source_type}`);
  }
}
