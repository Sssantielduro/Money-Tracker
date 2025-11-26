// basic in-memory data for now
let transactions = [];
let netWorth = 0;

const form = document.getElementById("tx-form");
const amountInput = document.getElementById("amount");
const typeInput = document.getElementById("type");
const walletInput = document.getElementById("wallet");
const tagInput = document.getElementById("tag");
const txList = document.getElementById("tx-list");
const netWorthDisplay = document.getElementById("net-worth");

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

  form.reset();
});

function renderTransactions() {
  txList.innerHTML = "";

  transactions.slice().reverse().forEach((tx) => {
    const li = document.createElement("li");
    li.className = "tx-item";

    const sideA = document.createElement("span");
    sideA.textContent = `${tx.amount > 0 ? "+" : ""}${tx.amount.toFixed(2)} (${tx.wallet})`;

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

// initial render
renderNetWorth();
