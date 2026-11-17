// =========================================================
// 1. EINSTELLUNGEN
// =========================================================
// Kategorien mit ihrer Farbe. Neue Kategorie? Einfach hier eine Zeile ergänzen,
// sie taucht dann automatisch im Formular, im Filter und in der Übersicht auf.
const CATEGORIES = {
  Essen: "#E9A23B",
  Miete: "#2F6690",
  Transport: "#5AA9E6",
  Freizeit: "#8E7DBE",
  Shopping: "#D66BA0",
  Abos: "#3A9E8F",
  Gehalt: "#4C9F70",
  Sonstiges: "#8A97A5",
};

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const MONTHS_SHORT = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

// =========================================================
// 2. KLEINE HILFSFUNKTIONEN
// =========================================================
const $ = (id) => document.getElementById(id); // Abkürzung für document.getElementById

// Erstellt ein HTML-Element in einer Zeile: el("span", "klasse", "Text")
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function pad(number) { return String(number).padStart(2, "0"); } // 5 -> "05"

// Heutiges Datum als "2026-09-20" (in deiner Zeitzone)
function todayString() {
  const d = new Date();
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}
function currentMonth() { return todayString().slice(0, 7); } // "2026-09"

function monthOf(t) { return t.date.slice(0, 7); }
function categoryOf(t) { return CATEGORIES[t.category] ? t.category : "Sonstiges"; }

function formatEuro(number) {
  return number.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}
// Mit Vorzeichen: 50 -> "+50,00 €", -50 -> "−50,00 €"
function formatSigned(number) {
  return (number >= 0 ? "+" : "−") + formatEuro(Math.abs(number));
}
function formatDate(dateString) { // "2026-09-20" -> "20.09.2026"
  const [y, m, d] = dateString.split("-");
  return d + "." + m + "." + y;
}

// Monat verschieben: shiftMonth("2026-01", -1) -> "2025-12"
function shiftMonth(month, delta) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1);
}
function monthLabel(month) { // "2026-09" -> "September 2026"
  const [y, m] = month.split("-");
  return MONTHS[Number(m) - 1] + " " + y;
}

// =========================================================
// 3. DATEN (laden & speichern)
// =========================================================
// JSON.parse kann bei kaputtem Text abstürzen, deshalb try/catch:
// Wenn etwas schiefgeht, starten wir einfach mit dem Ersatzwert.
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

let transactions = load("transactions-v3", []);
let budget = load("budget-v3", 1000);
let selectedMonth = currentMonth();
let editingId = null; // null = neuer Eintrag, sonst die id des Eintrags, den wir bearbeiten

function save() {
  localStorage.setItem("transactions-v3", JSON.stringify(transactions));
  localStorage.setItem("budget-v3", JSON.stringify(budget));
}

// Summe eines Monats für einen Typ ("income" oder "expense")
function sumFor(month, type) {
  return transactions
    .filter((t) => monthOf(t) === month && t.type === type)
    .reduce((sum, t) => sum + t.amount, 0);
}

// =========================================================
// 4. ANZEIGE
// =========================================================
function changeText(current, previous) {
  if (previous === 0) return "Kein Vergleich zum Vormonat";
  const percent = Math.round(((current - previous) / previous) * 100);
  return (percent >= 0 ? "▲ " : "▼ ") + Math.abs(percent) + " % zum Vormonat";
}

function renderOverview() {
  const income = sumFor(selectedMonth, "income");
  const expense = sumFor(selectedMonth, "expense");
  const previous = shiftMonth(selectedMonth, -1);
  const net = income - expense;

  // Kontostand = ALLE Einnahmen minus ALLE Ausgaben (nicht nur dieser Monat)
  let total = 0;
  transactions.forEach((t) => {
    total += t.type === "income" ? t.amount : -t.amount;
  });

  $("balance").textContent = formatEuro(total);
  $("month-net").textContent =
    "Saldo " + monthLabel(selectedMonth) + ": " + (net >= 0 ? "+" : "−") + formatEuro(Math.abs(net));

  $("income").textContent = formatEuro(income);
  $("expense").textContent = formatEuro(expense);
  $("income-change").textContent = changeText(income, sumFor(previous, "income"));
  $("expense-change").textContent = changeText(expense, sumFor(previous, "expense"));
  $("savings").textContent = income > 0 ? Math.round((net / income) * 100) + " %" : "–";

  // Budget-Balken
  $("budget-input").value = budget;
  const fill = $("progress-fill");
  fill.style.width = budget > 0 ? Math.min(100, (expense / budget) * 100) + "%" : "0%";
  fill.classList.toggle("over", budget > 0 && expense > budget);

  let text = "Kein Limit gesetzt";
  if (budget > 0 && expense <= budget) {
    text = formatEuro(budget - expense) + " noch verfügbar (" + Math.round((expense / budget) * 100) + " % genutzt)";
  } else if (budget > 0) {
    text = formatEuro(expense - budget) + " über dem Limit";
  }
  $("budget-text").textContent = text;
}

function renderChart() {
  const year = selectedMonth.slice(0, 4);
  $("chart-title").textContent = "Jahresübersicht " + year;

  // Für jeden der 12 Monate Einnahmen und Ausgaben berechnen
  const data = MONTHS_SHORT.map((name, i) => {
    const month = year + "-" + pad(i + 1);
    return { name, month, income: sumFor(month, "income"), expense: sumFor(month, "expense") };
  });

  // Der größte Wert bekommt 100 % Höhe, alle anderen werden dazu ins Verhältnis gesetzt
  const max = Math.max(...data.map((d) => Math.max(d.income, d.expense)));
  $("chart-scale").textContent = max > 0 ? "Skala bis " + formatEuro(max) : "";

  const chart = $("chart");
  chart.innerHTML = "";

  data.forEach((d) => {
    const column = el("button", "col" + (d.month === selectedMonth ? " active" : ""));
    column.type = "button";
    const description = d.name + ": Einnahmen " + formatEuro(d.income) + ", Ausgaben " + formatEuro(d.expense);
    column.title = description;
    column.setAttribute("aria-label", description);

    const bars = el("span", "bars");
    const incomeBar = el("span", "bar income");
    const expenseBar = el("span", "bar expense");
    incomeBar.style.height = max > 0 ? (d.income / max) * 100 + "%" : "0%";
    expenseBar.style.height = max > 0 ? (d.expense / max) * 100 + "%" : "0%";
    bars.append(incomeBar, expenseBar);

    column.append(bars, el("span", "col-label", d.name));
    column.addEventListener("click", () => {
      selectedMonth = d.month; // Klick auf einen Monat wählt ihn aus
      render();
    });
    chart.append(column);
  });
}

function renderCategories() {
  // Ausgaben des Monats pro Kategorie sammeln, z.B. { Essen: 145, Miete: 780 }
  const sums = {};
  let total = 0;
  transactions.forEach((t) => {
    if (t.type === "expense" && monthOf(t) === selectedMonth) {
      const category = categoryOf(t);
      sums[category] = (sums[category] || 0) + t.amount;
      total += t.amount;
    }
  });

  const names = Object.keys(sums).sort((a, b) => sums[b] - sums[a]); // größte zuerst
  const stack = $("category-bar");
  const list = $("category-list");
  stack.innerHTML = "";
  list.innerHTML = "";

  if (names.length === 0) {
    list.append(el("li", "empty", "Keine Ausgaben in diesem Monat."));
    return;
  }

  names.forEach((name) => {
    const percent = (sums[name] / total) * 100;

    const segment = el("span", "seg");
    segment.style.width = percent + "%";
    segment.style.background = CATEGORIES[name];
    segment.title = name;
    stack.append(segment);

    const dot = el("span", "dot");
    dot.style.background = CATEGORIES[name];
    const row = el("li", "cat");
    row.append(dot, el("span", "cat-name", name), el("span", "cat-amount", formatEuro(sums[name])), el("span", "cat-percent", Math.round(percent) + " %"));
    list.append(row);
  });
}

// Welche Einträge sind sichtbar? Monat + Suche + Kategorie + Typ
function getVisible() {
  const query = $("search").value.trim().toLowerCase();
  const category = $("filter-category").value; // "" = alle
  const type = $("filter-type").value;         // "" = alle

  return transactions
    .filter((t) =>
      monthOf(t) === selectedMonth &&
      (!query || t.description.toLowerCase().includes(query)) &&
      (!category || categoryOf(t) === category) &&
      (!type || t.type === type)
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id); // neueste zuerst
}

function renderList() {
  const monthCount = transactions.filter((t) => monthOf(t) === selectedMonth).length;
  const visible = getVisible();
  const list = $("list");
  list.innerHTML = "";

  visible.forEach((t) => {
    const dot = el("span", "dot");
    dot.style.background = CATEGORIES[categoryOf(t)];

    const info = el("div", "tx-info");
    info.append(el("span", "tx-title", t.description), el("span", "tx-meta", categoryOf(t) + " · " + formatDate(t.date)));

    const amount = el("span", "tx-amount " + t.type, (t.type === "income" ? "+" : "−") + formatEuro(t.amount));

    const editBtn = el("button", "link-btn", "Bearbeiten");
    editBtn.type = "button";
    editBtn.setAttribute("aria-label", "Bearbeiten: " + t.description);
    editBtn.addEventListener("click", () => openDialog(t.id));

    const deleteBtn = el("button", "link-btn danger", "Löschen");
    deleteBtn.type = "button";
    deleteBtn.setAttribute("aria-label", "Löschen: " + t.description);
    deleteBtn.addEventListener("click", () => deleteTransaction(t.id));

    const actions = el("div", "tx-actions");
    actions.append(editBtn, deleteBtn);

    const row = el("li", "tx");
    row.append(dot, info, amount, actions);
    list.append(row);
  });

  $("count").textContent = visible.length + (visible.length === 1 ? " Eintrag" : " Einträge");

  // Passende Meldung, wenn nichts zu sehen ist
  let message = "";
  if (transactions.length === 0) message = "Noch keine Transaktionen. Lege deine erste an oder lade unten Demo-Daten.";
  else if (monthCount === 0) message = "In diesem Monat gibt es keine Einträge.";
  else if (visible.length === 0) message = "Keine Treffer für diese Filter.";
  $("empty").textContent = message;
  $("empty").hidden = message === "";
}

// Cashflow = Einnahmen minus Ausgaben. Positiv = Überschuss, negativ = Defizit.
function renderCashflow() {
  const year = selectedMonth.slice(0, 4);
  $("cashflow-title").textContent = "Cashflow " + year;

  // Für jeden Monat des Jahres den Cashflow berechnen
  const data = MONTHS_SHORT.map((name, i) => {
    const month = year + "-" + pad(i + 1);
    return {
      name,
      month,
      net: sumFor(month, "income") - sumFor(month, "expense"),
      hasData: transactions.some((t) => monthOf(t) === month),
    };
  });

  // Größter Betrag (egal ob plus oder minus) = 100 % Höhe
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.net)));

  const chart = $("cashflow-chart");
  chart.innerHTML = "";

  data.forEach((d) => {
    const column = el("button", "col" + (d.month === selectedMonth ? " active" : ""));
    column.type = "button";
    const description = d.name + ": Cashflow " + formatSigned(d.net);
    column.title = description;
    column.setAttribute("aria-label", description);

    // Obere Hälfte für Plus, untere Hälfte für Minus, dazwischen die Nulllinie
    const up = el("span", "cf-up");
    const down = el("span", "cf-down");
    if (d.net !== 0 && maxAbs > 0) {
      const bar = el("span", "cf-bar " + (d.net > 0 ? "up" : "down"));
      bar.style.height = (Math.abs(d.net) / maxAbs) * 100 + "%";
      (d.net > 0 ? up : down).append(bar);
    }
    const bars = el("span", "cf-bars");
    bars.append(up, down);

    column.append(bars, el("span", "col-label", d.name));
    column.addEventListener("click", () => {
      selectedMonth = d.month;
      render();
    });
    chart.append(column);
  });

  // Kennzahlen über dem Diagramm
  const current = data.find((d) => d.month === selectedMonth);
  const withData = data.filter((d) => d.hasData);
  const yearTotal = data.reduce((sum, d) => sum + d.net, 0);
  // Durchschnitt nur über Monate mit Einträgen, sonst würden leere Monate ihn nach unten ziehen
  const average = withData.length > 0 ? yearTotal / withData.length : 0;

  function show(id, value, visible) {
    $(id).textContent = visible ? formatSigned(value) : "–";
    $(id).className = "stat-value " + (visible ? (value >= 0 ? "income" : "expense") : "");
  }
  $("cf-month-label").textContent = monthLabel(selectedMonth);
  show("cf-month", current.net, current.hasData);
  show("cf-average", average, withData.length > 0);
  show("cf-year", yearTotal, withData.length > 0);
}

// Alles neu zeichnen. Diese Funktion rufen wir nach JEDER Änderung auf.
function render() {
  $("month-label").textContent = monthLabel(selectedMonth);
  renderOverview();
  renderChart();
  renderCashflow();
  renderCategories();
  renderList();
}

// =========================================================
// 5. HINZUFÜGEN, BEARBEITEN, LÖSCHEN
// =========================================================
function openDialog(id) {
  editingId = id || null;
  const t = id ? transactions.find((x) => x.id === id) : null;

  $("dialog-title").textContent = t ? "Transaktion bearbeiten" : "Neue Transaktion";
  $("f-description").value = t ? t.description : "";
  $("f-amount").value = t ? t.amount : "";
  $("f-category").value = t ? categoryOf(t) : "Essen";
  // Neuer Eintrag: heute, wenn wir im aktuellen Monat sind, sonst der 1. des gewählten Monats
  $("f-date").value = t ? t.date : (selectedMonth === currentMonth() ? todayString() : selectedMonth + "-01");
  (t && t.type === "income" ? $("type-income") : $("type-expense")).checked = true;

  $("dialog").showModal();
  $("f-description").focus();
}

$("form").addEventListener("submit", (event) => {
  event.preventDefault(); // Seite soll nicht neu laden

  const data = {
    description: $("f-description").value.trim(),
    amount: Math.round(parseFloat($("f-amount").value) * 100) / 100, // auf 2 Nachkommastellen runden
    type: $("form").elements["type"].value,
    category: $("f-category").value,
    date: $("f-date").value,
  };
  if (!data.description || !(data.amount > 0) || !data.date) return;

  if (editingId) {
    // Bearbeiten: den Eintrag über seine id finden und die Werte überschreiben
    Object.assign(transactions.find((t) => t.id === editingId), data);
  } else {
    // Neu: id dazu und an die Liste hängen ("...data" kopiert alle Felder von data hinein)
    transactions.push({ id: Date.now(), ...data });
  }

  selectedMonth = data.date.slice(0, 7); // zum Monat des Eintrags springen
  save();
  $("dialog").close();
  render();
});

function deleteTransaction(id) {
  if (!confirm("Diesen Eintrag löschen?")) return;
  transactions = transactions.filter((t) => t.id !== id);
  save();
  render();
}

// =========================================================
// 6. DEMO-DATEN, RESET
// =========================================================
// Füllt die App mit realistischen Beispieldaten der letzten 6 Monate (ideal zum Vorzeigen)
function loadDemoData() {
  if (transactions.length > 0 && !confirm("Deine vorhandenen Einträge werden durch Demo-Daten ersetzt. Fortfahren?")) return;

  const todayDay = new Date().getDate();
  const demo = [];
  let id = 1;

  for (let i = 5; i >= 0; i--) {
    const month = shiftMonth(currentMonth(), -i);

    // Beträge schwanken leicht von Monat zu Monat (deterministisch, kein Zufall)
    const add = (day, description, base, spread, type, category) => {
      if (i === 0 && day > todayDay) return; // keine Einträge in der Zukunft
      const amount = Math.round((base + ((i * 7 + day * 3) % spread)) * 100) / 100;
      demo.push({ id: id++, description, amount, type, category, date: month + "-" + pad(day) });
    };

    add(1, "Gehalt", 1950, 1, "income", "Gehalt");
    add(2, "Miete", 620, 1, "expense", "Miete");
    add(3, "Deutschlandticket", 58, 1, "expense", "Transport");
    add(4, "Wocheneinkauf", 45, 25, "expense", "Essen");
    add(5, "Streaming & Musik", 17.98, 1, "expense", "Abos");
    add(11, "Wocheneinkauf", 50, 30, "expense", "Essen");
    add(14, "Restaurant", 28, 20, "expense", "Essen");
    add(16, "Kino & Freizeit", 22, 25, "expense", "Freizeit");
    add(19, "Wocheneinkauf", 48, 28, "expense", "Essen");
    add(21, "Kleidung", 35, 90, "expense", "Shopping");
    add(25, "Nebenjob", 280, 120, "income", "Gehalt");
  }

  transactions = demo;
  budget = 1100;
  selectedMonth = currentMonth();
  save();
  render();
}

function resetAll() {
  if (!confirm("Wirklich ALLE Einträge löschen? Das geht nicht rückgängig.")) return;
  transactions = [];
  localStorage.removeItem("transactions-v3");
  render();
}

// =========================================================
// 7. DESIGN (hell / dunkel)
// =========================================================
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme; // setzt data-theme="dark" am <html>-Tag
  $("theme-btn").textContent = theme === "dark" ? "Hell" : "Dunkel";
  localStorage.setItem("theme", theme);
}

// =========================================================
// 8. EVENTS (was passiert bei welchem Klick?)
// =========================================================
$("add-btn").addEventListener("click", () => openDialog());
$("cancel-btn").addEventListener("click", () => $("dialog").close());
// Klick auf den dunklen Hintergrund neben dem Fenster schließt es
$("dialog").addEventListener("click", (event) => {
  if (event.target === $("dialog")) $("dialog").close();
});

$("prev-month").addEventListener("click", () => { selectedMonth = shiftMonth(selectedMonth, -1); render(); });
$("next-month").addEventListener("click", () => { selectedMonth = shiftMonth(selectedMonth, 1); render(); });

// Filter: bei jeder Eingabe nur die Liste neu zeichnen
["search", "filter-category", "filter-type"].forEach((id) => $(id).addEventListener("input", renderList));

$("budget-input").addEventListener("change", (event) => {
  const value = parseFloat(event.target.value);
  budget = value >= 0 ? value : 0;
  save();
  render();
});

$("theme-btn").addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});
$("demo-btn").addEventListener("click", loadDemoData);
$("reset-btn").addEventListener("click", resetAll);

// =========================================================
// 9. START
// =========================================================
// Dropdowns mit den Kategorien füllen (einmal für Formular, einmal für Filter)
$("filter-category").append(new Option("Alle Kategorien", ""));
Object.keys(CATEGORIES).forEach((name) => {
  $("f-category").append(new Option(name, name));
  $("filter-category").append(new Option(name, name));
});

// Design: gespeicherte Wahl, sonst die Systemeinstellung des Geräts
applyTheme(localStorage.getItem("theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

render();
