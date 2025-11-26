ogs

app.js
+20
-1

// =========================
// AUTH SETUP
// =========================

// Firebase exposed from index.html
const auth = window.firebaseAuth;
const GoogleAuthProviderCtor = window.GoogleAuthProvider;
const signInWithPopupFn = window.signInWithPopup;
const signInWithRedirectFn = window.signInWithRedirect;
const getRedirectResultFn = window.getRedirectResult;
const signOutFn = window.signOutFirebase;
const onAuthStateChangedFn = window.onFirebaseAuthStateChanged;

// DOM
const authStatusEl = document.getElementById("auth-status");
const googleLoginBtn = document.getElementById("google-login");
const logoutBtn = document.getElementById("logout");
const authedArea = document.getElementById("authed-area");

// Track logged user
let currentUser = null;

// Provider
const googleProvider = new GoogleAuthProviderCtor();

// Complete redirect-based login if popup was blocked
getRedirectResultFn(auth).catch((err) => {
  console.error("Google redirect error:", err);
});

// Watch login changes
onAuthStateChangedFn(auth, (user) => {
  currentUser = user || null;

  if (user) {
    authStatusEl.textContent = `Signed in as ${user.email}`;
    googleLoginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    authedArea.style.display = "block";
  } else {
    authStatusEl.textContent = "Not signed in";
    googleLoginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    authedArea.style.display = "none";
  }
});

// Login
googleLoginBtn.addEventListener("click", async () => {
  try {
    await signInWithPopupFn(auth, googleProvider);
  } catch (err) {
    console.error("Google sign-in error:", err);
    alert("Google popup blocked or misconfigured.");

    if (err?.code === "auth/popup-blocked") {
      try {
        await signInWithRedirectFn(auth, googleProvider);
        return;
      } catch (redirectErr) {
        console.error("Google redirect error:", redirectErr);
        alert("Google sign-in failed: redirect blocked. Please allow popups for this site.");
        return;
      }
    }

    alert("Google sign-in failed. Please allow popups or try again.");
  }
});

// Logout
logoutBtn.addEventListener("click", async () => {
  try {
    await signOutFn(auth);
  } catch (err) {
    console.error("Sign-out error:", err);
  }
});

// =========================
// LOCAL DATA STORAGE
// =========================

let transactions = [];
let netWorth = 0;

const STORAGE_KEY = "santi-money-tracker-state";

// DOM
const form = document.getElementById("tx-form");
const amountInput = document.getElementById("amount");
const typeInput = document.getElementById("type");