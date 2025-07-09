const db = require("../firebaseAdmin");

// Save a choice
exports.saveChoice = async (req, res) => {
  const { userId, missionId, blockId, choiceText, tag } = req.body;
  const userRef = db.collection("users").doc(userId);

  const userDoc = await userRef.get();
  let data = userDoc.exists ? userDoc.data() : { user_id: userId, missions_completed: [], traits: {} };

  // Find or create mission
  let mission = data.missions_completed.find(m => m.mission_id === missionId);
  if (!mission) {
    mission = { mission_id: missionId, completed_at: null, choices: [], final_summary: "" };
    data.missions_completed.push(mission);
  }
  mission.choices.push({ block_id: blockId, choice: choiceText, tag });

  // Update traits
  data.traits[tag] = (data.traits[tag] || 0) + 1;

  await userRef.set(data);
  res.json({ success: true });
};

// Get user traits
exports.getUserTraits = async (req, res) => {
  const { userId } = req.params;
  const userDoc = await db.collection("users").doc(userId).get();
  res.json(userDoc.exists ? userDoc.data().traits : {});
};

// Get mission history
exports.getMissionHistory = async (req, res) => {
  const { userId } = req.params;
  const userDoc = await db.collection("users").doc(userId).get();
  res.json(userDoc.exists ? userDoc.data().missions_completed : []);
};

// Save final summary
exports.saveFinalSummary = async (req, res) => {
  const { userId, missionId, summary } = req.body;
  const userRef = db.collection("users").doc(userId);
  const userDoc = await userRef.get();
  if (!userDoc.exists) return res.status(404).json({ error: "User not found" });

  let data = userDoc.data();
  let mission = data.missions_completed.find(m => m.mission_id === missionId);
  if (mission) {
    mission.final_summary = summary;
    mission.completed_at = new Date().toISOString();
    await userRef.set(data);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Mission not found" });
  }
};

// Bonus: canUnlock
exports.canUnlock = async (req, res) => {
  const { userId, requiredMissionId } = req.query;
  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists) return res.json({ canUnlock: false });
  const completed = userDoc.data().missions_completed || [];
  const found = completed.some(m => m.mission_id === requiredMissionId);
  res.json({ canUnlock: found });
}; 