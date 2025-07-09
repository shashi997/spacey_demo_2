const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(), // For local dev, use GOOGLE_APPLICATION_CREDENTIALS env var
  });
}

const db = admin.firestore();
module.exports = db; 