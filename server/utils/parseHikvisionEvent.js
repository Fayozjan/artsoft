import { parseStringPromise } from "xml2js";

export async function parseHikvisionEvent(files = []) {
  const xmlFile = files.find((f) => f.originalname?.includes("anpr"));
  const imgFile = files.find((f) =>
    f.originalname?.includes("detectionPicture"),
  );

  if (!xmlFile) throw new Error("anpr.xml not found in request");

  const parsed = await parseStringPromise(xmlFile.buffer.toString("utf8"), {
    explicitArray: false,
  });

  const alert = parsed["EventNotificationAlert"];
  const licensePlate = alert?.ANPR?.licensePlate ?? "";
  const dateTime = alert?.dateTime ?? "";

  return { licensePlate, dateTime, imageBuffer: imgFile?.buffer ?? null };
}

export function formatLicensePlate(plate) {
  const m1 = plate.match(/^(\d{2})([A-Z])(\d{3})([A-Z]{2})$/i);
  if (m1) return `${m1[1]} ${m1[2]} ${m1[3]} ${m1[4]}`.toUpperCase();

  const m2 = plate.match(/^(\d{2})(\d{3})([A-Z]{3})$/i);
  if (m2) return `${m2[1]} ${m2[2]} ${m2[3]}`.toUpperCase();

  return plate.toUpperCase();
}
