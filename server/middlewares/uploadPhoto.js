import multer from "multer";
import path from "path";
import fs from "fs";
import sharp from "sharp";

const uploadPhoto = (typeFolder = "employees") => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const clientFolder = req?.tenant?.subdomain || "default";
      const dir = path.join("uploads", typeFolder, clientFolder);
      fs.mkdirSync(dir, { recursive: true }); // existsSync не нужен перед mkdirSync({ recursive })
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      // Сохраняем сразу под финальным именем — без temp
      const ext = path.extname(file.originalname).toLowerCase();
      const pinfl = req.body.pinfl || `upload_${Date.now()}`;
      cb(null, `${pinfl}${ext}`);
    },
  });

  const upload = multer({ storage });

  const convertToJpg = async (req, res, next) => {
    if (!req.file) return next();

    const clientFolder = req?.tenant?.subdomain || "default";
    const filePath = req.file.path;
    const ext = path.extname(filePath).toLowerCase();
    const maxSize = 200 * 1024;
    const pinfl = req.body.pinfl || Date.now();

    const newFileName = `${pinfl}.jpg`;
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
