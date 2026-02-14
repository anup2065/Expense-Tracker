const STORAGE_KEY = "anup_expense_tracker_v1";

const defaultState = {
  pinHash: null,
  currentCycle: [],
  history: [],
  highestSpendEver: 0,
  highestBalanceEver: 0
};

let state = loadState();
let unlocked = false;

const el = {
  pinGate: document.getElementById("pinGate"),
  appContent: document.getElementById("appContent"),
  pinHint: document.getElementById("pinHint"),
  pinForm: document.getElementById("pinForm"),
  pinInput: document.getElementById("pinInput"),
  pinConfirmInput: document.getElementById("pinConfirmInput"),
  pinError: document.getElementById("pinError"),
  entryForm: document.getElementById("entryForm"),
  dateInput: document.getElementById("dateInput"),
  remainingInput: document.getElementById("remainingInput"),
  resetCycleBtn: document.getElementById("resetCycleBtn"),
  entriesBody: document.getElementById("entriesBody"),
  historyBody: document.getElementById("historyBody"),
  avgMetric: document.getElementById("avgMetric"),
  highestSpendMetric: document.getElementById("highestSpendMetric"),
  highestBalanceMetric: document.getElementById("highestBalanceMetric"),
  highestSpendEverMetric: document.getElementById("highestSpendEverMetric"),
  highestBalanceEverMetric: document.getElementById("highestBalanceEverMetric"),
  exportJsonBtn: document.getElementById("exportJsonBtn"),
  exportCsvBtn: document.getElementById("exportCsvBtn"),
  tabs: Array.from(document.querySelectorAll(".tab"))
};

init();

function init() {
  if (!state.pinHash) {
    el.pinHint.textContent = "Create a 4-6 digit PIN to lock your data.";
    el.pinConfirmInput.classList.remove("hidden");
    el.pinConfirmInput.disabled = false;
    el.pinConfirmInput.required = true;
  } else {
    el.pinHint.textContent = "Enter your PIN to unlock.";
    el.pinConfirmInput.classList.add("hidden");
    el.pinConfirmInput.disabled = true;
    el.pinConfirmInput.required = false;
  }

  el.dateInput.value = todayISO();
  bindEvents();
  registerServiceWorker();
}

function bindEvents() {
  el.pinForm.addEventListener("submit", handlePinSubmit);
  el.entryForm.addEventListener("submit", handleAddEntry);
  el.resetCycleBtn.addEventListener("click", handleResetCycle);
  el.exportJsonBtn.addEventListener("click", exportJson);
  el.exportCsvBtn.addEventListener("click", exportCsv);

  el.tabs.forEach((tab) => {
    tab.addEventListener("click", () => setView(tab.dataset.view));
  });
}

async function handlePinSubmit(event) {
  event.preventDefault();
  el.pinError.textContent = "";

  const pin = el.pinInput.value.trim();
  if (!/^\d{4,6}$/.test(pin)) {
    el.pinError.textContent = "PIN must be 4 to 6 digits.";
    return;
  }

  if (!state.pinHash) {
    const confirmPin = el.pinConfirmInput.value.trim();
    if (pin !== confirmPin) {
      el.pinError.textContent = "PIN and confirmation do not match.";
      return;
    }
    state.pinHash = await hashText(pin);
    saveState();
  } else {
    const isValid = (await hashText(pin)) === state.pinHash;
    if (!isValid) {
      el.pinError.textContent = "Invalid PIN.";
      return;
    }
  }

  unlocked = true;
  el.pinInput.value = "";
  el.pinConfirmInput.value = "";
  el.pinGate.classList.add("hidden");
  el.appContent.classList.remove("hidden");
  renderAll();
}

function handleAddEntry(event) {
  event.preventDefault();
  if (!unlocked) {
    return;
  }

  const date = el.dateInput.value;
  const remaining = Number(el.remainingInput.value);

  if (!date || Number.isNaN(remaining) || remaining < 0) {
    alert("Please provide a valid date and non-negative remaining amount.");
    return;
  }

  const existingIndex = state.currentCycle.findIndex((entry) => entry.date === date);
  if (existingIndex >= 0) {
    const shouldReplace = confirm("An entry for this date already exists. Do you want to replace the existing amount?");
    if (!shouldReplace) {
      return;
    }
    state.currentCycle[existingIndex].remaining_amount = round2(remaining);
  } else {
    state.currentCycle.push({
      date,
      remaining_amount: round2(remaining),
      expenditure: 0
    });
  }

  recalculateCycleExpenditures();
  updateAllTimeMaxesFromCurrentCycle();
  saveState();
  renderAll();
  el.remainingInput.value = "";
  el.dateInput.value = todayISO();
}

function handleResetCycle() {
  if (!unlocked || state.currentCycle.length === 0) {
    alert("No current-cycle data to reset.");
    return;
  }
  const shouldReset = confirm("Are you sure?");
  if (!shouldReset) {
    return;
  }

  const metrics = getCycleMetrics(state.currentCycle);
  const startDate = state.currentCycle[0].date;
  const endDate = state.currentCycle[state.currentCycle.length - 1].date;

  const cycleSummary = {
    startDate,
    endDate,
    average: metrics.dailyAverage,
    highestSpend: metrics.highestSpend,
    highestBalance: metrics.highestBalance
  };

  state.history.push(cycleSummary);
  updateAllTimeMaxesFromCurrentCycle();
  state.currentCycle = [];

  saveState();
  renderAll();
}

function getCycleMetrics(cycle) {
  if (!cycle.length) {
    return {
      dailyAverage: 0,
      highestSpend: 0,
      highestBalance: 0
    };
  }

  const totalExpenditure = cycle.reduce((sum, item) => sum + item.expenditure, 0);
  const highestSpend = Math.max(...cycle.map((item) => item.expenditure));
  const highestBalance = Math.max(...cycle.map((item) => item.remaining_amount));
  const expenseDays = Math.max(cycle.length - 1, 0);

  return {
    dailyAverage: expenseDays > 0 ? round2(totalExpenditure / expenseDays) : 0,
    highestSpend: round2(highestSpend),
    highestBalance: round2(highestBalance)
  };
}

function recalculateCycleExpenditures() {
  state.currentCycle.sort((a, b) => a.date.localeCompare(b.date));

  let previousRemaining = null;
  state.currentCycle = state.currentCycle.map((entry) => {
    const expenditure = previousRemaining === null ? 0 : round2(previousRemaining - entry.remaining_amount);
    previousRemaining = entry.remaining_amount;
    return {
      ...entry,
      expenditure
    };
  });
}

function updateAllTimeMaxesFromCurrentCycle() {
  if (!state.currentCycle.length) {
    return;
  }

  const metrics = getCycleMetrics(state.currentCycle);
  state.highestSpendEver = Math.max(state.highestSpendEver, metrics.highestSpend);
  state.highestBalanceEver = Math.max(state.highestBalanceEver, metrics.highestBalance);
}

function renderAll() {
  const metrics = getCycleMetrics(state.currentCycle);
  el.avgMetric.textContent = formatCurrency(metrics.dailyAverage);
  el.highestSpendMetric.textContent = formatCurrency(metrics.highestSpend);
  el.highestBalanceMetric.textContent = formatCurrency(metrics.highestBalance);
  el.highestSpendEverMetric.textContent = formatCurrency(state.highestSpendEver);
  el.highestBalanceEverMetric.textContent = formatCurrency(state.highestBalanceEver);

  renderEntries();
  renderHistory();
}

function renderEntries() {
  el.entriesBody.innerHTML = "";

  if (!state.currentCycle.length) {
    const row = document.createElement("tr");
    row.innerHTML = '<td colspan="3">No entries yet.</td>';
    el.entriesBody.appendChild(row);
    return;
  }

  state.currentCycle.forEach((item) => {
    const tr = document.createElement("tr");
    const expClass = item.expenditure < 0 ? "negative" : "positive";

    tr.innerHTML = `
      <td>${item.date}</td>
      <td>${formatCurrency(item.remaining_amount)}</td>
      <td class="${expClass}">${formatSignedCurrency(item.expenditure)}</td>
    `;

    el.entriesBody.appendChild(tr);
  });
}

function renderHistory() {
  el.historyBody.innerHTML = "";

  if (!state.history.length) {
    const row = document.createElement("tr");
    row.innerHTML = '<td colspan="5">No past cycles yet.</td>';
    el.historyBody.appendChild(row);
    return;
  }

  const historyCopy = [...state.history].reverse();
  historyCopy.forEach((cycle) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${cycle.startDate}</td>
      <td>${cycle.endDate}</td>
      <td>${formatCurrency(cycle.average)}</td>
      <td>${formatCurrency(cycle.highestSpend)}</td>
      <td>${formatCurrency(cycle.highestBalance)}</td>
    `;
    el.historyBody.appendChild(tr);
  });
}

function setView(viewId) {
  el.tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === viewId);
  });

  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === viewId);
  });
}

function exportJson() {
  const payload = JSON.stringify(state, null, 2);
  downloadFile("anup-expense-backup.json", payload, "application/json");
}

function exportCsv() {
  const lines = [
    "startDate,endDate,average,highestSpend,highestBalance",
    ...state.history.map((cycle) =>
      [
        cycle.startDate,
        cycle.endDate,
        cycle.average,
        cycle.highestSpend,
        cycle.highestBalance
      ].join(",")
    )
  ];

  downloadFile("anup-expense-history.csv", lines.join("\n"), "text/csv;charset=utf-8");
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...defaultState };
    }

    const parsed = JSON.parse(raw);
    return {
      ...defaultState,
      ...parsed,
      currentCycle: Array.isArray(parsed.currentCycle) ? parsed.currentCycle : [],
      history: Array.isArray(parsed.history) ? parsed.history : []
    };
  } catch {
    return { ...defaultState };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function hashText(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function formatCurrency(value) {
  const num = Number(value) || 0;
  return `Rs ${num.toFixed(2)}`;
}

function formatSignedCurrency(value) {
  const num = Number(value) || 0;
  const prefix = num > 0 ? "+" : "";
  return `${prefix}${formatCurrency(num)}`;
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}
