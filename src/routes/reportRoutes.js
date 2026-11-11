const router = require("express").Router();
const auth = require("../middlewares/authMiddleware");
const role = require("../middlewares/roleMiddleware");
const { getReportSummary } = require("../controllers/reportController");
router.get("/summary", auth, role("CENTER_MANAGER"), getReportSummary);
module.exports = router;
