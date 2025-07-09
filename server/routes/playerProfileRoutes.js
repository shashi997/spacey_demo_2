const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/playerProfileController");

router.post("/saveChoice", ctrl.saveChoice);
router.get("/traits/:userId", ctrl.getUserTraits);
router.get("/missions/:userId", ctrl.getMissionHistory);
router.post("/saveFinalSummary", ctrl.saveFinalSummary);
router.get("/canUnlock", ctrl.canUnlock);

module.exports = router; 