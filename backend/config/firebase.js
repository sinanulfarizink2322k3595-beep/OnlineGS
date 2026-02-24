/**
 * config/firebase.js - Firebase Admin SDK Initialization
 *
 * This file sets up the Firebase Admin SDK, which gives us privileged access
 * to Firebase services (Firestore, Auth, etc.) from the server side.
 * Unlike the client-side Firebase SDK, this runs with admin privileges and
 * is not subject to Firestore Security Rules.
 */

const admin = require("firebase-admin");

// Check whether Firebase has already been initialized to avoid duplicate-app errors
// when this module is required multiple times (e.g., during hot-reload in dev)
if (!admin.apps.length) {
  // Determine whether we have real Firebase credentials in the environment.
  // In local development without a Firebase project, we skip real initialization
  // so the rest of the server can still start up and be tested without Firebase.
  const hasFirebaseConfig =
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY;

  if (hasFirebaseConfig) {
    /**
     * Build the service-account credential object from environment variables.
     * These values come from the JSON key file you download in:
     *   Firebase Console → Project Settings → Service Accounts → Generate New Private Key
     *
     * SECURITY NOTE: Never commit the actual key values to version control.
     * Store them in .env (which is in .gitignore) or in your hosting platform's
     * secret manager.
     */
    const serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      // The private key is stored with literal "\n" characters in the env var;
      // replace them with real newlines so the PEM format is valid.
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
    };

    // Initialize the app with the service-account credential
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log("✅ Firebase Admin SDK initialized with service account");
  } else {
    /**
     * Fallback: initialize with the application-default credential.
     * This works automatically on Google Cloud environments (Cloud Run,
     * App Engine, GCE) where the runtime service account is already set.
     * In plain local dev without any credentials this will fail at the first
     * Firestore/Auth call, but at least the server boots without crashing.
     */
    try {
      admin.initializeApp();
      console.log(
        "⚠️  Firebase Admin SDK initialized with application-default credentials"
      );
    } catch (err) {
      console.warn(
        "⚠️  Firebase Admin SDK could not be initialized – Firestore calls will fail.",
        err.message
      );
    }
  }
}

// Export the Firestore database instance so routes can import it directly.
// Using admin.firestore() returns the singleton db tied to the app we just initialized.
const db = admin.firestore();

// Also export the admin object itself in case other modules need Auth, Storage, etc.
module.exports = { admin, db };
