import multer from "multer";

const storage = multer.diskStorage({
  // Functionality Flow:
  // create a storage config using multer.diskStorage for handling file uploads
  // set destination function where uploaded files will be stored
  // set filename function for each uploaded file to retain its original name when stored in destination directory

  destination: function (req, file, cb) {
    cb(null, "./public/temp");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

export const upload = multer({
  storage,
});
