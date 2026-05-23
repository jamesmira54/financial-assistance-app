import { Router } from "express";
import multer from "multer";
import { ResponseHandler } from "../response";
import { extractUserFromToken, FileTypeResponse, SUCCESS_MESSAGES, VALIDATION_MESSAGES } from "../utils";
import path from "path";
import { fileDelete, fileUpload, findFileTypeId, getAllFileType, imageUpload } from "./service";
import { validateFileId, validateStudentId } from "../middleware/validation";



export default () => {

  const storage = multer.diskStorage({
      destination: (req, file, cb) => {
          cb(null, "uploads/docs/");
        },
        filename: (req, file, cb) => {
          const epochMilliseconds = Date.now();
          cb(null, `${epochMilliseconds}-${file.originalname}`);
      }
  });
    
  const fileFilter = (req: any, file: any, cb: any) => {
    const allowedTypes = /pdf|docx?|png|jpe?g/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const allowedMimes = /application\/pdf|application\/vnd\.openxmlformats|application\/msword|image\/(png|jpe?g)/;
    const mimetype = allowedMimes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      return cb(new Error(VALIDATION_MESSAGES.INVALID_FILE_TYPE), false);
    }
  };
    
  const upload = multer({
      storage,
      fileFilter,
      limits: { fileSize: 10 * 1024 * 1024 },
  }).single("applicationForm");

  const storageImage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/images/");
      },
      filename: (req, file, cb) => {
        const epochMilliseconds = Date.now();
        cb(null, `${epochMilliseconds}-${file.originalname}`);
    }
  });
  
  const fileFilterImage = (req: any, file: any, cb: any) => {
    const allowedTypes = /png|JPEG|jpg?/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
  
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      return cb(new Error(VALIDATION_MESSAGES.INVALID_IMG_TYPE), false);
    }
  };
  
  const uploadImage = multer({
    storage: storageImage, 
    fileFilter: fileFilterImage,
    limits: { fileSize: 10 * 1024 * 1024 },
  }).single("profilePic");

    const fileAPI = Router();

    fileAPI.post('/:studentId', validateStudentId, async (req, res) => {
      upload(req, res, async (err: any) => {
        if (err) {
          console.error("File upload error:", err);
          ResponseHandler.invalidRequest(req, res, { message: err.message });
          
        } else if (!req.file) {
          ResponseHandler.invalidRequest(req, res, { message: "No file uploaded" });
        } else {

          const authHeader = req.headers.authorization;
          const userDetails = extractUserFromToken(authHeader);
          
          const { studentId } = req.params;
          const { fileTypeId } = req.body;

          if(!fileTypeId) {
            ResponseHandler.invalidRequest(req, res, {"errors": [ {"type": "field", "value": fileTypeId, "msg": VALIDATION_MESSAGES.MISSING_FILE_TYPE_ID, "path": "fileTypeId", "location": "body"}]})
          }

          const exists = await findFileTypeId(fileTypeId);
          if (!exists) {
            ResponseHandler.invalidRequest(req, res, {"errors": [ {"type": "field", "value": fileTypeId, "msg": VALIDATION_MESSAGES.INVALID_FILE_TYPE_ID, "path": "fileTypeId", "location": "body"}]})
          }
        
          await fileUpload(studentId, req.file.filename, req.file.mimetype, fileTypeId,  req.file.path, userDetails.userId);
          ResponseHandler.created(req, res, SUCCESS_MESSAGES.FILE_SAVED);
        }
      });
    });

    fileAPI.put('/image', async (req, res) => {
      uploadImage(req, res, async (err: any) => {
        if (err) {
          console.error("Image upload error:", err);
          ResponseHandler.invalidRequest(req, res, { message: err.message });
          
        } else if (!req.file) {
          ResponseHandler.invalidRequest(req, res, { message: "No image uploaded" });
        } else {
          
          const authHeader = req.headers.authorization;
          const userDetails = extractUserFromToken(authHeader);
          
          await imageUpload(userDetails.userId, req.file.filename);
          ResponseHandler.created(req, res, SUCCESS_MESSAGES.IMAGE_SAVED);
        }
      });
    });

    fileAPI.get('/file-type',async ( req, res) => {
       try {
          const data: FileTypeResponse[] = await getAllFileType( );
          ResponseHandler.ok(req, res, data);
        } catch (err) {
            ResponseHandler.invalidRequest(req,res , err.message);
        }
    })

    fileAPI.delete('/:fileId', validateFileId, async (req, res) => {
      const { fileId } = req.params;
      await fileDelete( fileId );
      ResponseHandler.deleted(req, res, SUCCESS_MESSAGES.FILE_DELETED);
    })

    return fileAPI;
}


