import { maxUploadFileSize } from "../core/constants";
import multer from "multer";

const storage = multer.memoryStorage();
export const multerUpload = multer({
  storage,
  limits: {
    fileSize: maxUploadFileSize,
  },
});