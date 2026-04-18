import admin from "firebase-admin";

const db = admin.firestore();

export function getUserPreferencesRef(uid) {
  return db.doc(`users/${uid}/preferences/main`);
}

export function getUserRecommendationStateRef(uid) {
  return db.doc(`users/${uid}/recommendation_state/main`);
}

export async function saveBaseLocation(uid, location) {
  const ref = getUserPreferencesRef(uid);

  await ref.set(
    {
      base_location: {
        label: location.label,
        address: location.address || "",
        lat: location.lat,
        lng: location.lng,
      },
    },
    { merge: true }
  );
}

export async function saveTemporaryLocation(uid, location) {
  const ref = getUserRecommendationStateRef(uid);

  await ref.set(
    {
      temporary_location: {
        label: location.label,
        address: location.address || "",
        lat: location.lat,
        lng: location.lng,
      },
    },
    { merge: true }
  );
}

export async function getUserPreferences(uid) {
  const ref = getUserPreferencesRef(uid);
  const snap = await ref.get();

  return snap.exists ? snap.data() : {};
}

export async function getUserRecommendationState(uid) {
  const ref = getUserRecommendationStateRef(uid);
  const snap = await ref.get();

  return snap.exists ? snap.data() : {};
}