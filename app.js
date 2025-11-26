// ==== AUTH SETUP ====

// grab Firebase stuff exposed from index.html
const auth = window.firebaseAuth;
const GoogleAuthProviderCtor = window.GoogleAuthProvider;
const signInWithPopupFn = window.signInWithPopup;
const signOutFn = window.signOutFirebase;
const onAuthStateChangedFn = window.onFirebaseAuthStateChanged;

// DOM elements for auth bar + authed area
const authStatusEl = document.getElementById("auth-status");
const googleLoginBtn = document.getElementById("google-login");
const logoutBtn = document.getElementById("logout");
const authedArea = document.getElementById("authed-area");

// this will hold the currently logged in user (or null)
let currentUser = null;

// provider for Google login
const googleProvider = new GoogleAuthProviderCtor();

// listen for login / logout changes
onAuthStateChangedFn(auth, (user) => {
  currentUser = user || null;

  if (user) {
    // logged in
    authStatusEl.textContent = `Signed in as ${user.email}`;
    googleLoginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    authedArea.style.display = "block";   // <-- show tracker
    console.log("Signed in:", user.uid, user.email);
  } else {
    // logged out
    authStatusEl.textContent = "Not signed in";
    googleLoginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    authedArea.style.display = "none";    // <-- hide tracker
    console.log("Signed out");
  }
});

// click = sign in with Google
googleLoginBtn.addEventListener("click", async () => {
  try {
    await signInWithPopupFn(auth, googleProvider);
  } catch (err) {
    console.error("Google sign-in error:", err);
    alert("Error signing in. Check console for details.");
  }
});

// click = log out
logoutBtn.addEventListener("click", async () => {
  try {
    await signOutFn(auth);
  } catch (err) {
    console.error("Sign-out error:", err);
    alert("Error signing out. Check console for details.");
  }
});

// ==== END AUTH SETUP ====
// basic in-memory data for now
let transactions = [];
let netWorth = 0;
...

// Key for saving data in the browser
const STORAGE_KEY = "santi-money-tracker-state";

// app state
let transactions = [];
let netWorth = 0;

// DOM elements
const form = document.getElementById("tx-form");
const amountInput = document.getElementById("amount");
const typeInput = document.getElementById("type");
const walletInput = document.getElementById("wallet");
const tagInput = document.getElementById("tag");
const txList = document.getElementById("tx-list");
const netWorthDisplay = document.getElementById("net-worth");
const resetButton = document.getElementById("reset-data");

// ---- persistence helpers ----
function saveState() {
  const data = {
    transactions,
    netWorth,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error("Error saving state:", err);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const data = JSON.parse(raw);

    if (Array.isArray(data.transactions)) {
      transactions = data.transactions;
    }

    if (typeof data.netWorth === "number") {
      netWorth = data.netWorth;
    }
  } catch (err) {
    console.error("Error loading state:", err);
  }
}

// ---- rendering ----
function renderTransactions() {
  txList.innerHTML = "";

  transactions
    .slice()
    .reverse()
    .forEach((tx) => {
      const li = document.createElement("li");
      li.className = "tx-item";

      const sideA = document.createElement("span");
      sideA.textContent = `${tx.amount > 0 ? "+" : ""}${tx.amount.toFixed(
        2
      )} (${tx.wallet})`;

      const sideB = document.createElement("span");
      sideB.textContent = tx.tag;

      li.appendChild(sideA);
      li.appendChild(sideB);
      txList.appendChild(li);
    });
}

function renderNetWorth() {
  netWorthDisplay.textContent = `$${netWorth.toFixed(2)}`;
}

// ---- event handlers ----
form.addEventListener("submit", (e) => {
  e.preventDefault();

  const amount = parseFloat(amountInput.value);
  const type = typeInput.value;
  const wallet = walletInput.value;
  const tag = tagInput.value.trim();

  if (isNaN(amount) || amount <= 0) {
    alert("Put a real amount, king.");
    return;
  }

  const signedAmount = type === "income" ? amount : -amount;

  const tx = {
    id: Date.now(),
    amount: signedAmount,
    wallet,
    tag: tag || "untagged",
  };

  transactions.push(tx);
  netWorth += signedAmount;

  renderTransactions();
  renderNetWorth();
  saveState();

  form.reset();
});

resetButton.addEventListener("click", () => {
  if (!confirm("Wipe all data?")) return;

  transactions = [];
  netWorth = 0;
  saveState();
  renderTransactions();
  renderNetWorth();
});

// ---- initial boot ----
loadState();
renderTransactions();
renderNetWorth();
