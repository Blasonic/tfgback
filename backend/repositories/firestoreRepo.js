const admin = require("../models/firebaseAdmin");
const db = admin.firestore();
const { FieldValue } = admin.firestore;

function userRef(uid) {
  return db.collection("users").doc(uid);
}

async function getUserPreferences(uid) {
  const snap = await userRef(uid).collection("preferences").doc("main").get();
  return snap.exists ? snap.data() : {};
}

async function updateBaseLocation(uid, baseLocation) {
  await userRef(uid)
    .collection("preferences")
    .doc("main")
    .set(
      {
        base_location: baseLocation,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

async function getUserSavedItems(uid, limit = 100) {
  const snap = await userRef(uid)
    .collection("saved_items")
    .limit(limit)
    .get();

  return snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

async function saveFavorite(uid, fiestaId) {
  await userRef(uid)
    .collection("saved_items")
    .doc(`fiesta_${fiestaId}`)
    .set(
      {
        fiestaId,
        savedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

async function deleteFavorite(uid, fiestaId) {
  await userRef(uid)
    .collection("saved_items")
    .doc(`fiesta_${fiestaId}`)
    .delete();
}

async function getRecentInteractions(uid, limit = 200) {
  const snap = await userRef(uid)
    .collection("interactions")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

async function saveInteraction(uid, payload) {
  const ref = await userRef(uid)
    .collection("interactions")
    .add({
      ...payload,
      createdAt: FieldValue.serverTimestamp(),
    });

  return { id: ref.id };
}

async function saveRecommendationState(uid, payload) {
  await userRef(uid)
    .collection("recommendation_state")
    .doc("main")
    .set(
      {
        ...payload,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

async function getRecommendationState(uid) {
  const snap = await userRef(uid)
    .collection("recommendation_state")
    .doc("main")
    .get();

  return snap.exists ? snap.data() : {};
}

module.exports = {
  getUserPreferences,
  updateBaseLocation,
  getUserSavedItems,
  saveFavorite,
  deleteFavorite,
  getRecentInteractions,
  saveInteraction,
  saveRecommendationState,
  getRecommendationState,
};