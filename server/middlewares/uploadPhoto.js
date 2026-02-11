import multer from "multer";
import path from "path";
import fs from "fs";
import sharp from "sharp";

// Универсальный аплоадер фото
const uploadPhoto = (typeFolder = "employee") => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = `uploads/${typeFolder}`;
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      // сохраняем временно с оригинальным расширением
      const ext = path.extname(file.originalname);
      cb(null, `temp_${Date.now()}${ext}`);
    },
  });

  const upload = multer({ storage });

  // middleware для конвертации после загрузки
  const convertToJpg = async (req, res, next) => {
    try {
      if (!req.file) return next();

      const filePath = req.file.path;
      const ext = path.extname(filePath).toLowerCase();

      // если уже jpg/jpeg — ничего не делаем
      if (ext === ".jpg" || ext === ".jpeg") {
        req.file.finalPath = filePath;
        return next();
      }

      const newPath = filePath.replace(ext, ".jpg");

      await sharp(filePath).jpeg({ quality: 80 }).toFile(newPath);

      // удалить оригинальный файл
      fs.unlinkSync(filePath);

      // обновляем данные файла, чтобы дальше использовать .jpg
      req.file.filename = path.basename(newPath);
      req.file.path = newPath;
      req.file.finalPath = newPath;
      next();
    } catch (err) {
      console.error("❌ Ошибка при конвертации в JPG:", err);
      next(err);
    }
  };

  return {
    upload: upload.single("photo"),
    convertToJpg,
  };
};

export default uploadPhoto;
