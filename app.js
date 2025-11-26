// app.js - Santi Money Tracker with Firebase Auth, Firestore, and Plaid accounts

// =========================
// IMPORT EXTRA AUTH HELPERS (email + phone)
// =========================
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// =========================
// CONSTANTS – BACKEND ENDPOINTS
// =========================
const CREATE_LINK_URL = "https://createlinktoken-ot47thhs2a-uc.a.run.app"; // createLinkToken
const EXCHANGE_PUBLIC_TOKEN_URL = "https://exchangepublictoken-ot47thhs2a-uc.a.run.app"; // exchangePublicToken
const GET_ACCOUNTS_URL = "https://getplaidaccounts-ot47thhs2a-uc.a.run.app"; // getPlaidAccounts

// =========================
// AUTH SETUP
// =========================

// Firebase instances exposed from index.html
const auth = window.firebaseAuth;
const db = window.firebaseDb;
const GoogleAuthProviderCtor = window.GoogleAuthProvider;
const signInWithPopupFn = window.signInWithPopup;
const signInWithRedirectFn = window.signInWithRedirect;
const getRedirectResultFn = window.getRedirectResult;
const signOutFn = window.signOutFirebase;
const onAuthStateChangedFn = window.onFirebaseAuthStateChanged;

// DOM references – auth + layout
const authStatusEl = document.getElementById("auth-status");
const googleLoginBtn = document.getElementById("google-login");
const logoutBtn = document.getElementById("logout");
const authedArea = document.getElementById("authed-area");
const authExtraEl = document.querySelector(".auth-extra");
const connectBankBtn = document.getElementById("connect-bank");

// DOM references – Plaid accounts
const accountsListEl = document.getElementById("accounts-list");
const accountsTotalEl = document.getElementById("accounts-total");
const refreshAccountsBtn = document.getElementById("refresh-accounts");

// Track logged-in Firebase user
let currentUser = null;

// Google provider instance
const googleProvider = new GoogleAuthProviderCtor();

// Handle redirect-based Google sign-in resolution
getRedirectResultFn(auth).catch((err) => {
  console.error("Google redirect error:", err);
});

// =========================
// USER PROFILE + SESSION
// =========================

async function ensureUserDoc(user) {
  if (!user) return false;

  // Only allow Google or email/password as profile creators
  const providers = (user.providerData || []).map((p) => p.providerId);
  const allowed =
    providers.includes("google.com") || providers.includes("password");

  if (!allowed) {
    // Phone-only login -> don't let them create a profile yet
    alert(
      "Phone-only sign-ins can't create a profile yet. Please log in with Google or email."
    );
    await signOutFn(auth);
    return false;
  }

  const userDocRef = doc(db, "users", user.uid);
  const snap = await getDoc(userDocRef);

  if (!snap.exists()) {
    // First time: create the user doc with profile + empty transactions
    await setDoc(userDocRef, {
      profile: {
        uid: user.uid,
        email: user.email || null,
        phoneNumber: user.phoneNumber || null,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      },
      transactions: [],
    });
  } else {
    // Existing user: just refresh profile + last login
    await setDoc(
      userDocRef,
      {
        profile: {
          uid: user.uid,
          email: user.email || null,
          phoneNumber: user.phoneNumber || null,
          lastLoginAt: serverTimestamp(),
        },
      },
      { merge: true }
    );
  }

  return true;
}

// Watch login/logout state
onAuthStateChangedFn(auth, async (user) => {
  currentUser = user || null;

  if (user) {
    const displayLabel = user.email || user.phoneNumber || "User";
    authStatusEl.textContent = `Signed in as ${displayLabel}`;
    googleLoginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    authedArea.style.display = "block";
    if (authExtraEl) authExtraEl.style.display = "none";

    const ok = await ensureUserDoc(user);
    if (!ok) return; // ensureUserDoc handles sign-out if needed

    // Load Firestore transactions + Plaid accounts for this user
    await loadState();
    await loadAccounts();
  } else {
    authStatusEl.textContent = "Not signed in";
    googleLoginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    authedArea.style.display = "none";
    if (authExtraEl) authExtraEl.style.display = "flex";

    // Clear session-only state
    transactions = [];
    netWorth = 0;
    renderAll();

    if (accountsListEl) accountsListEl.innerHTML = "";
    if (accountsTotalEl) accountsTotalEl.textContent = "Total (Banks): $0.00";
  }
});

// Google login button
if (googleLoginBtn) {
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
}

// Logout button
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOutFn(auth);
    } catch (err) {
      console.error("Sign-out error:", err);
    }
  });
}

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
      // onAuthStateChanged takes care of the rest
    } catch (err) {
      console.error("Email login error:", err);
      alert(err.message || "Email login failed.");
    }
  });
}

// =========================
// PHONE AUTH (EXISTING USERS)
// =========================

const phoneInput = document.getElementById("phone");
const sendBtn = document.getElementById("send");
const codeInput = document.getElementById("code");
const verifyBtn = document.getElementById("verify");

let recaptchaVerifier = null;
let confirmationResultGlobal = null;

function setupRecaptcha() {
  if (recaptchaVerifier) return;

  recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
    size: "invisible",
    callback: (response) => {
      console.log("reCAPTCHA resolved:", response);
    },
  });

  window.recaptchaVerifier = recaptchaVerifier;
}

if (sendBtn) {
  sendBtn.addEventListener("click", async () => {
    const phoneNumber = phoneInput.value.trim();
    if (!phoneNumber) {
      alert("Enter a phone number.");
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

if (verifyBtn) {
  verifyBtn.addEventListener("click", async () => {
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
      // onAuthStateChanged will handle loading data
    } catch (err) {
      console.error("Code verify error:", err);
      alert(err.message || "Failed to verify code.");
    }
  });
}

// =========================
// FIRESTORE-BACKED MONEY TRACKER (MANUAL CASH/PLAYS)
// =========================

let transactions = [];
let netWorth = 0; // this is only from manual transactions, NOT Plaid

// DOM for tracker
const form = document.getElementById("tx-form");
const labelInput2 = document.getElementById("label");
const amountInput2 = document.getElementById("amount");
const typeInput2 = document.getElementById("type");
const netWorthEl = document.getElementById("net-worth");
const txListEl = document.getElementById("tx-list");
const resetBtn = document.getElementById("reset-data");

// Load manual transactions from Firestore
async function loadState() {
  if (!currentUser) {
    transactions = [];
    netWorth = 0;
    renderAll();
    return;
  }

  const userDocRef = doc(db, "users", currentUser.uid);

  try {
    const snap = await getDoc(userDocRef);

    if (snap.exists()) {
      const data = snap.data();
      transactions = Array.isArray(data.transactions) ? data.transactions : [];
    } else {
      transactions = [];
      await setDoc(
        userDocRef,
        { transactions: [] },
        { merge: true }
      );
    }
  } catch (err) {
    console.error("Failed to load state from Firestore:", err);
    transactions = [];
  }

  renderAll();
}

// Save manual transactions to Firestore
async function saveState() {
  if (!currentUser) return;

  const userDocRef = doc(db, "users", currentUser.uid);

  try {
    await setDoc(
      userDocRef,
      { transactions },
      { merge: true }
    );
  } catch (err) {
    console.error("Failed to save state to Firestore:", err);
  }
}

// Compute net worth from manual transactions only
function computeNetWorth() {
  netWorth = transactions.reduce((sum, tx) => {
    const amt = Number(tx.amount) || 0;
    const positive = tx.type === "asset" || tx.type === "income";
    return sum + (positive ? amt : -amt);
  }, 0);
}

// Render manual transactions + manual net worth
function renderAll() {
  if (!netWorthEl || !txListEl) return;

  computeNetWorth();
  netWorthEl.textContent = `$${netWorth.toFixed(2)}`;

  txListEl.innerHTML = "";
  transactions.forEach((tx) => {
    const li = document.createElement("li");
    li.className = "tx-row";

    const isPositive = tx.type === "asset" || tx.type === "income";
    const sign = isPositive ? "+" : "-";
    const amountClass = `tx-amount ${isPositive ? "pos" : "neg"}`;

    li.innerHTML = `
      <span class="tx-label">${tx.label}</span>
      <span class="tx-type">${tx.type}</span>
      <span class="${amountClass}">${sign}$${Number(tx.amount).toFixed(
        2
      )}</span>
    `;

    txListEl.appendChild(li);
  });
}

// Handle new manual transaction
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const label = labelInput2.value.trim();
    const amount = Number(amountInput2.value);
    const type = typeInput2.value;

    if (!currentUser) {
      alert("You must be logged in to save transactions.");
      return;
    }

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

    renderAll();
    await saveState();

    form.reset();
    typeInput2.value = "asset";
  });
}

// Handle reset of manual data
if (resetBtn) {
  resetBtn.addEventListener("click", async () => {
    if (!currentUser) return;
    if (!confirm("Reset all data?")) return;

    transactions = [];
    netWorth = 0;
    renderAll();
    await saveState();
  });
}

// =========================
// PLAID LINK + ACCOUNTS
// =========================

async function callFunction(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Function error: ${res.status} ${txt}`);
  }

  return res.json();
}

// Load linked Plaid accounts + balances and render them
async function loadAccounts() {
  if (!currentUser || !accountsListEl || !accountsTotalEl) return;

  accountsListEl.innerHTML = "<li>Loading accounts...</li>";

  try {
    const data = await callFunction(GET_ACCOUNTS_URL, {
      uid: currentUser.uid,
    });

    const accounts = Array.isArray(data.accounts) ? data.accounts : [];

    accountsListEl.innerHTML = "";
    let total = 0;

    accounts.forEach((acc) => {
      const bal = Number(acc.balance) || 0;
      total += bal;

      const li = document.createElement("li");
      li.className = "account-row";
      li.innerHTML = `
        <span class="account-name">
          ${acc.name}
          ${acc.subtype ? ` (${acc.subtype})` : ""}
          ${acc.mask ? ` ••••${acc.mask}` : ""}
        </span>
        <span class="account-balance">$${bal.toFixed(2)}</span>
      `;

      accountsListEl.appendChild(li);
    });

    if (accounts.length === 0) {
      accountsListEl.innerHTML = "<li>No linked accounts yet.</li>";
    }

    accountsTotalEl.textContent = `Total (Banks): $${total.toFixed(2)}`;
  } catch (err) {
    console.error("loadAccounts error:", err);
    accountsListEl.innerHTML = "<li>Failed to load accounts.</li>";
    accountsTotalEl.textContent = "Total (Banks): $0.00";
  }
}

// Refresh accounts button
if (refreshAccountsBtn) {
  refreshAccountsBtn.addEventListener("click", async () => {
    if (!currentUser) {
      alert("Log in first.");
      return;
    }

    await loadAccounts();
  });
}

// Connect Bank (Plaid Link)
if (connectBankBtn) {
  connectBankBtn.addEventListener("click", async () => {
    if (!currentUser) {
      alert("Log in first.");
      return;
    }

    try {
      const { link_token } = await callFunction(CREATE_LINK_URL, {
        uid: currentUser.uid,
      });

      const handler = Plaid.create({
        token: link_token,
        onSuccess: async (public_token, metadata) => {
          try {
            await callFunction(EXCHANGE_PUBLIC_TOKEN_URL, {
              uid: currentUser.uid,
              public_token,
            });

            alert("Bank linked successfully (sandbox).");
            await loadAccounts();
          } catch (err) {
            console.error("exchangePublicToken error:", err);
            alert("Failed to save Plaid link.");
          }
        },
        onExit: (err, metadata) => {
          if (err) console.error("Plaid exit error:", err);
        },
      });

      handler.open();
    } catch (err) {
      console.error("createLinkToken error:", err);
      alert("Failed to start bank connection.");
    }
  });
}
