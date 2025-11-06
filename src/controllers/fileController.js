import path from "path";
import fs from "fs";
import multer from "multer";
import sharp from "sharp";
import AppError from "../utils/appError.js";
import catchAsync from "../utils/catchAsync.js";

// Ensure folder exists
const profilePic_DIR = path.join(process.cwd(), "public", "img", "profilePics");
fs.mkdirSync(profilePic_DIR, { recursive: true });

// 1️⃣ Multer: in-memory storage for sharp
const storage = multer.memoryStorage();

// 2️⃣ File filter: only images allowed
const fileFilter = (req, file, cb) => {
  if (file.mimetype?.startsWith("image")) cb(null, true);
  else cb(new AppError("Only image files are allowed.", 400), false);
};

// 3️⃣ Multer setup
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 3 * 1024 * 1024 }, // Max 3 MB
});

// 4️⃣ Middleware: upload single image via field name "profilePic"
export const uploadProfilePic = upload.single("profilePic");

// 5️⃣ Optional: delete previous file
export const deleteProfilePicFile = (filename) => {
  if (!filename) return;
  const fullPath = path.join(profilePic_DIR, filename);
  fs.promises
    .stat(fullPath)
    .then(() => fs.promises.unlink(fullPath).catch(() => {}))
    .catch(() => {});
};

// 6️⃣ Middleware: resize and save uploaded image
export const resizeProfilePic = catchAsync(async (req, res, next) => {
  if (!req.file) return next();

  // Extra guard: ensure it is an image Sharp can read
  await sharp(req.file.buffer).metadata(); // will throw if unsupported

  const baseId = (req.params?.id || req.user?.id || "user").toString();
  const filename = `profilePic-${baseId}-${Date.now()}.png`;

  await sharp(req.file.buffer)
    .resize(600, 600, {
      fit: "cover",
      withoutEnlargement: true,
    })
    .toFormat("png")
    .png({
      compressionLevel: 9,
      palette: true,
      effort: 10,
    })
    .toFile(path.join(profilePic_DIR, filename));

  req.body = req.body || {};
  req.body.profilePic = filename;

  next();
});
