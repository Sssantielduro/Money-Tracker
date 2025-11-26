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
const walletInput = document.getElementById("wallet");
const tagInput = document.getElementById("tag");
const txList = document.getElementById("tx-list");
const netWorthDisplay = document.getElementById("net-worth");
const resetButton = document.getElementById("reset-data");

// Load saved data
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const data = JSON.parse(raw);
    transactions = Array.isArray(data.transactions) ? data.transactions : [];
    netWorth = typeof data.netWorth === "number" ? data.netWorth : 0;
  } catch (err) {
    console.error("Error loading:", err);
  }
}

// Save
function saveState() {
  const data = { transactions, netWorth };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Render
function renderTransactions() {
  txList.innerHTML = "";
  [...transactions].reverse().forEach((tx) => {
    const li = document.createElement("li");
    li.textContent = `${tx.amount > 0 ? "+" : ""}${tx.amount.toFixed(2)} (${tx.wallet}) — ${tx.tag}`;
    txList.appendChild(li);
  });
}

function renderNetWorth() {
  netWorthDisplay.textContent = `$${netWorth.toFixed(2)}`;
}

// Add transaction
form.addEventListener("submit", (e) => {
  e.preventDefault();

  const amount = parseFloat(amountInput.value);
  const type = typeInput.value;
  const wallet = walletInput.value;
  const tag = tagInput.value.trim() || "untagged";

  if (isNaN(amount) || amount <= 0) {
    alert("Put a real amount, king.");
    return;
  }

  const signedAmount = type === "income" ? amount : -amount;

  const tx = {
    id: Date.now(),
    amount: signedAmount,
    wallet,
    tag,
  };

  transactions.push(tx);
  netWorth += signedAmount;

  saveState();
  renderTransactions();
  renderNetWorth();

  form.reset();
});

// Reset all
resetButton.addEventListener("click", () => {
  if (!confirm("Wipe all data?")) return;

  transactions = [];
  netWorth = 0;

  saveState();
  renderTransactions();
  renderNetWorth();
});

// Startup
loadState();
renderTransactions();
renderNetWorth();
