// IMPORT EXTRA AUTH HELPERS (email + phone)
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

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

// Finish redirect login if popup was blocked
getRedirectResultFn(auth).catch((err) => {
  console.error("Google redirect error:", err);
});

// Watch for user login/logout
onAuthStateChangedFn(auth, (user) => {
  currentUser = user || null;

  if (user) {
    authStatusEl.textContent = `Signed in as ${user.email || user.phoneNumber}`;
    googleLoginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    authedArea.style.display = "block";

    // when user is ready, load their local data
    loadState();
    renderAll();
  } else {
    authStatusEl.textContent = "Not signed in";
    googleLoginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    authedArea.style.display = "none";
  }
});

// Login with Google
googleLoginBtn.addEventListener("click", async () => {
  try {
    await signInWithPopupFn(auth, googleProvider);
  } catch (err) {
    console.error("Google sign-in error:", err);

    if (err?.code === "auth/popup-blocked") {
      await signInWithRedirectFn(auth, googleProvider);
      return;
    }

    alert("Google sign-in failed. Enable popups and try again.");
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
// EMAIL / PASSWORD AUTH
// =========================

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const emailSignupBtn = document.getElementById("email-signup");
const emailLoginBtn = document.getElementById("email-login");

if (emailSignupBtn) {
  emailSignupBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      alert("Enter email and password.");
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      alert("Account created and logged in.");
    } catch (err) {
      console.error("Email signup error:", err);
      alert(err.message || "Email sign-up failed.");
    }
  });
}

if (emailLoginBtn) {
  emailLoginBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      alert("Enter email and password.");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // auth observer will handle UI
    } catch (err) {
      console.error("Email login error:", err);
      alert(err.message || "Email login failed.");
    }
  });
}

// =========================
// PHONE AUTH
// =========================

const phoneInput = document.getElementById("phone");
const sendCodeBtn = document.getElementById("send-code");
const codeInput = document.getElementById("code");
const verifyCodeBtn = document.getElementById("verify-code");

let recaptchaVerifier = null;
let confirmationResultGlobal = null;

function setupRecaptcha() {
  if (recaptchaVerifier) return;

  // Keep a reference on window so Firebase doesn't GC it
  recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
    size: "invisible",
    callback: (response) => {
      console.log("reCAPTCHA resolved:", response);
    },
  });

  window.recaptchaVerifier = recaptchaVerifier;
}

if (sendCodeBtn) {
  sendCodeBtn.addEventListener("click", async () => {
    const phoneNumber = phoneInput.value.trim();
    if (!phoneNumber) {
      alert("Enter a phone number with country code (e.g. +1...).");
      return;
    }

    try {
      setupRecaptcha();
      confirmationResultGlobal = await signInWithPhoneNumber(
        auth,
        phoneNumber,
        recaptchaVerifier
      );
      alert("Code sent. Check your SMS.");
    } catch (err) {
      console.error("Phone sign-in error:", err);
      alert(err.message || "Failed to send code.");
    }
  });
}

if (verifyCodeBtn) {
  verifyCodeBtn.addEventListener("click", async () => {
    const code = codeInput.value.trim();
    if (!code) {
      alert("Enter the verification code.");
      return;
    }

    if (!confirmationResultGlobal) {
      alert("Send the code first.");
      return;
    }

    try {
      await confirmationResultGlobal.confirm(code);
      // auth observer will update UI
    } catch (err) {
      console.error("Code verify error:", err);
      alert(err.message || "Failed to verify code.");
    }
  });
}

// =========================
// LOCAL DATA STORAGE (Money tracker)
// =========================

let transactions = [];
let netWorth = 0;

const STORAGE_KEY = "santi-money-tracker-state";

// DOM for tracker
const form = document.getElementById("tx-form");
const labelInput2 = document.getElementById("label");
const amountInput2 = document.getElementById("amount");
const typeInput2 = document.getElementById("type");
const netWorthEl = document.getElementById("net-worth");
const txListEl = document.getElementById("tx-list");
const resetBtn = document.getElementById("reset-data");

// Load from localStorage
function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data.transactions)) {
      transactions = data.transactions;
    }
  } catch (err) {
    console.error("Failed to parse saved state:", err);
  }
}

// Save to localStorage
function saveState() {
  const data = { transactions };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Recalculate net worth from transactions
function computeNetWorth() {
  netWorth = transactions.reduce((sum, tx) => {
    const amt = Number(tx.amount) || 0;
    const positive = tx.type === "asset" || tx.type === "income";

    return sum + (positive ? amt : -amt);
  }, 0);
}

// Render list + net worth
function renderAll() {
  computeNetWorth();

  // Net worth text
  netWorthEl.textContent = `$${netWorth.toFixed(2)}`;

  // List
  txListEl.innerHTML = "";
  transactions.forEach((tx) => {
    const li = document.createElement("li");
    li.className = "tx-row";

    const sign = tx.type === "asset" || tx.type === "income" ? "+" : "-";

    li.innerHTML = `
      <span class="tx-label">${tx.label}</span>
      <span class="tx-type">${tx.type}</span>
      <span class="tx-amount">${sign}$${Number(tx.amount).toFixed(2)}</span>
    `;

    txListEl.appendChild(li);
  });
}

// Handle new transaction
if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const label = labelInput2.value.trim();
    const amount = Number(amountInput2.value);
    const type = typeInput2.value;

    if (!label || isNaN(amount)) {
      alert("Enter a label and a valid amount.");
      return;
    }

    transactions.push({
      id: Date.now(),
      label,
      amount,
      type,
    });

    saveState();
    renderAll();

    form.reset();
    typeInput2.value = "asset";
  });
}

// Handle reset
if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    if (!confirm("Reset all data?")) return;

    transactions = [];
    netWorth = 0;
    localStorage.removeItem(STORAGE_KEY);
    renderAll();
  });
}
