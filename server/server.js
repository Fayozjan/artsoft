import app from "./app.js";
import { config } from "./config.js";

import {
  events_checker,
  scheduleEventsChecker,
} from "./utils/hikEventChecker.js";
import { startNotificationsWorker } from "./workers/notificationsWorker.js";

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

app.listen(config.port, "0.0.0.0", () => {
  console.log(`Server running on port ${config.port}`);
  // scheduleEventsChecker();
  // events_checker(-20);
  // startNotificationsWorker();
});
