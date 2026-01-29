import express from "express";
import pool from "../../db.js";
import dotenv from "dotenv";
import { deleteUser, deleteUserPhoto } from "../../utils/doorFunctions.js";

dotenv.config();

const username = "admin";
const password = process.env.PASSWORD;
const api_entry_delete_user = process.env.API_ENTRY_DELETE_USER;

const router = express.Router();

// Стандартная структура ответа
const createResponse = (success, message, data = null, error = null) => {
  return {
    success,
    message,
    data,
    error,
  };
};

router.delete("/:id", async (req, res) => {
  const user_id = req.params.id.toString();

  try {
    // Проверка использования пользователя в других таблицах
    const usageCheckResult = await pool.query(
      `
      SELECT 
        EXISTS (SELECT 1 FROM attendance WHERE user_id = $1) AS in_attendance,
        EXISTS (SELECT 1 FROM events WHERE user_id = $1) AS in_events,
        EXISTS (SELECT 1 FROM logins WHERE user_id = $1) AS in_logins
      `,
      [user_id]
    );

    const usage = usageCheckResult.rows[0];

    if (usage.in_attendance || usage.in_events || usage.in_logins) {
      return res
        .status(400)
        .json(
          createResponse(
            false,
            "Невозможно удалить пользователя, так как он используется в других данных"
          )
        );
    }

    // Проверка наличия двери у сотрудника
    const userCheckResult = await pool.query(
      "SELECT door FROM users WHERE user_id = $1",
      [user_id]
    );

    if (userCheckResult.rowCount === 0) {
      return res.status(404).json(createResponse(false, "Сотрудник не найден"));
    }

    const user = userCheckResult.rows[0];
    const hasDoor = user.door !== null && user.door !== ""; // Проверка, есть ли у сотрудника дверь

    // Удаление из базы данных
    const result = await pool.query(
      "DELETE FROM users WHERE user_id = $1 RETURNING *",
      [user_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json(createResponse(false, "Сотрудник не найден"));
    }

    // Если у сотрудника есть дверь, удаляем его из системы Hikvision
    if (hasDoor) {
      try {
        deleteUser("192.168.34.209", user_id);
        deleteUser("192.168.34.210", user_id);
        deleteUserPhoto("192.168.34.209", user_id);
        deleteUserPhoto("192.168.34.210", user_id);
      } catch (error) {
        console.error(
          "Ошибка при удалении пользователя из Hikvision:",
          error.message
        );
        // Ответ в случае ошибки при удалении из Hikvision
        return res
          .status(500)
          .json(
            createResponse(
              false,
              "Ошибка при удалении пользователя из Hikvision",
              null,
              error.message
            )
          );
      }
    }

    // Успешный ответ
    res.status(200).json(
      createResponse(true, "Сотрудник успешно удален", {
        deletedUser: result.rows[0],
      })
    );
  } catch (err) {
    console.error("Ошибка при удалении сотрудника:", err);
    res
      .status(500)
      .json(
        createResponse(
          false,
          "Ошибка при удалении сотрудника",
          null,
          err.message
        )
      );
  }
});

// Изменения данных касаемо работы пользователя
router.delete("/work/:id", async (req, res) => {
  const id = req.params.id;

  try {
    // 1. Найти удаляемую запись
    const { rows: found } = await pool.query(
      "SELECT * FROM user_history WHERE id = $1",
      [id]
    );

    if (found.length === 0) {
      return res.status(404).json({ error: "Запись не найдена" });
    }

    const deletedRecord = found[0];
    const user_id = deletedRecord.user_id;

    // 2. Удалить запись
    await pool.query("DELETE FROM user_history WHERE id = $1", [id]);

    // 3. Проверить: остались ли ещё записи по этому сотруднику
    const { rows: remaining } = await pool.query(
      "SELECT * FROM user_history WHERE user_id = $1 ORDER BY event_date DESC LIMIT 1",
      [user_id]
    );

    if (remaining.length === 0) {
      // 4. Если больше записей нет — сбросить статус
      await pool.query("UPDATE users SET status = NULL WHERE user_id = $1", [
        user_id,
      ]);
    } else {
      // 5. Если остались записи — взять статус из самой последней
      const event_type = remaining[0].event_type;
      let status = "active";

      if (event_type === "leave") {
        status = "vacation";
      } else if (event_type === "termination") {
        status = "terminated";
      }

      await pool.query("UPDATE users SET status = $1 WHERE user_id = $2", [
        status,
        user_id,
      ]);
    }

    res.json({ success: true, message: "Запись удалена и статус обновлён" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка при удалении истории" });
  }
});

export default router;
