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
    authStatusEl.textContent = `Signed in as ${user.email}`;
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

// Login
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
// LOCAL DATA STORAGE (Money tracker)
// =========================

let transactions = [];
let netWorth = 0;

const STORAGE_KEY = "santi-money-tracker-state";

// DOM for tracker
const form = document.getElementById("tx-form");
const labelInput = document.getElementById("label");
const amountInput = document.getElementById("amount");
const typeInput = document.getElementById("type");
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
    const positive =
      tx.type === "asset" || tx.type === "income";

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

    const sign =
      tx.type === "asset" || tx.type === "income" ? "+" : "-";

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

    const label = labelInput.value.trim();
    const amount = Number(amountInput.value);
    const type = typeInput.value;

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
    typeInput.value = "asset";
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
