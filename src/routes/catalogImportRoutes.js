const express = require("express");
const multer = require("multer");
const auth = require("../middlewares/authMiddleware");
const role = require("../middlewares/roleMiddleware");
const { downloadTemplate, importCatalog } = require("../controllers/catalogImportController");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
}).single("file");

router.use(auth, role("CENTER_MANAGER"));
router.get("/template", downloadTemplate);
router.post("/", (req, res, next) => {
  upload(req, res, error => {
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.code === "LIMIT_FILE_SIZE" ? "Tệp tối đa 5 MB." : "Không thể nhận tệp Excel.",
      });
    }
    next();
  });
}, importCatalog);

module.exports = router;
