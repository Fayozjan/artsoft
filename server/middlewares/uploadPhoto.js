import multer from "multer";
import path from "path";
import fs from "fs";
import sharp from "sharp";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const uploadPhoto = (typeFolder = "employees") => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const clientFolder = req?.tenant?.subdomain || "default";
      const dir = path.join("uploads", typeFolder, clientFolder);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const id = req.params?.id;
      if (id) {
        cb(null, `${id}${ext}`);
      } else {
        cb(null, `upload_${Date.now()}${ext}`);
      }
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!ALLOWED_MIME.has(file.mimetype) || !ALLOWED_EXT.has(ext)) {
        return cb(new Error("Only image files allowed"));
      }
      cb(null, true);
    },
  });

  const convertToJpg = async (req, res, next) => {
    if (!req.file) return next();

    const clientFolder = req?.tenant?.subdomain || "default";
    const filePath = req.file.path;
    const ext = path.extname(filePath).toLowerCase();
    const maxSize = 200 * 1024;
    const id = req.params?.id;
    const baseName = path.basename(req.file.filename, path.extname(req.file.filename));
    const identifier = id || baseName;

    const newFileName = `${identifier}.jpg`;
    const newPath = path.join(path.dirname(filePath), newFileName);

    try {
      const isAlreadyJpg = ext === ".jpg" || ext === ".jpeg";
      const isSmallEnough = fs.statSync(filePath).size <= maxSize;

      if (isAlreadyJpg && isSmallEnough) {
        if (filePath !== newPath) {
          await fs.promises.rename(filePath, newPath);
        }
      } else {
        let quality = 90;
        let buffer;

        do {
          buffer = await sharp(filePath)
            .resize({
              width: 600,
              height: 600,
              fit: "inside",
              withoutEnlargement: true,
            })
            .jpeg({ quality, mozjpeg: true })
            .toBuffer();
          quality -= 5;
        } while (buffer.length > maxSize && quality > 40);

        // ✅ Пишем во временный файл, потом атомарно переименовываем
        const tmpPath = newPath + ".tmp";
        await fs.promises.writeFile(tmpPath, buffer);

        if (fs.existsSync(newPath)) {
          await fs.promises.unlink(newPath);
        }
        await fs.promises.rename(tmpPath, newPath);

        if (filePath !== newPath && fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath).catch(() => {});
        }
      }

      // ✅ Храним в БД как "artsoft/3175.jpg" — тенант + имя
      req.file.filename = `${clientFolder}/${newFileName}`;
      req.file.path = newPath;

      next();
    } catch (err) {
      // Чистим файл если что-то пошло не так
      await fs.promises.unlink(filePath).catch(() => {});
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
