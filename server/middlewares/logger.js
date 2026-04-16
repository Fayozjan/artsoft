import fs from "fs";
import path from "path";

const logDir = path.resolve("./logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

const logFile = path.join(logDir, "requests.log");

function getTashkentTime() {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
}

export function logger(req, _res, next) {
  const line = `[${getTashkentTime()}] ${req.method} ${req.url} ${req.ip}`;

  //  console.log(line);

  fs.appendFile(logFile, line + "\n", (err) => {
    if (err) console.error("Log write error:", err);
  });

  next();
}
