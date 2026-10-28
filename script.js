/* ---------- State & Storage ---------- */
const TX_KEY = "et_transactions", CAT_KEY = "et_categories";
const DEFAULT_CATS = ["Salary", "Food", "Transport", "Rent", "Shopping", "Bills", "Health", "Entertainment", "Other"];
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
let transactions = load(TX_KEY, []);
let categories = load(CAT_KEY, DEFAULT_CATS);
let editId = null;
const save = () => {
  localStorage.setItem(TX_KEY, JSON.stringify(transactions));
  localStorage.setItem(CAT_KEY, JSON.stringify(categories));
};
const $ = id => document.getElementById(id);
const fmt = n => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- Categories ---------- */
function renderCategories() {
  const opts = categories.map(c => `<option>${esc(c)}</option>`).join("");
  const cur = $("category").value, curF = $("fCategory").value;
  $("category").innerHTML = opts;
  $("fCategory").innerHTML = `<option value="">All Categories</option>` + opts;
  if (categories.includes(cur)) $("category").value = cur;
  if (categories.includes(curF)) $("fCategory").value = curF;
  $("catList").innerHTML = categories.map((c, i) =>
    `<span class="chip">${esc(c)}<button title="Delete" onclick="deleteCategory(${i})">×</button></span>`).join("");
}
function addCategory() {
  const name = $("newCat").value.trim();
  if (!name) return;
  if (categories.some(c => c.toLowerCase() === name.toLowerCase())) return alert("Category already exists.");
  categories.push(name); $("newCat").value = "";
  save(); renderCategories();
}
function deleteCategory(i) {
  const name = categories[i];
  if (transactions.some(t => t.category === name)) return alert("Category is used by transactions and cannot be deleted.");
  if (categories.length === 1) return alert("At least one category is required.");
  categories.splice(i, 1); save(); renderCategories();
}

/* ---------- Transactions (CRUD) ---------- */
function saveTransaction() {
  const t = {
    type: $("type").value, amount: parseFloat($("amount").value), date: $("date").value,
    category: $("category").value, description: $("description").value.trim()
  };
  if (!(t.amount > 0) || !t.date || !t.description) {
    $("msg").textContent = "Please enter a valid amount, date and description."; return;
  }
  $("msg").textContent = "";
  if (editId) { transactions = transactions.map(x => x.id === editId ? { ...x, ...t } : x); }
  else { transactions.push({ id: Date.now().toString(), ...t }); }
  save(); resetForm(); renderAll();
}
function editTransaction(id) {
  const t = transactions.find(x => x.id === id); if (!t) return;
  editId = id;
  $("type").value = t.type; $("amount").value = t.amount; $("date").value = t.date;
  $("category").value = t.category; $("description").value = t.description;
  $("formTitle").textContent = "Edit Transaction"; $("saveBtn").textContent = "Update";
  $("cancelBtn").hidden = false; window.scrollTo({ top: 0, behavior: "smooth" });
}
function deleteTransaction(id) {
  if (!confirm("Delete this transaction?")) return;
  transactions = transactions.filter(t => t.id !== id);
  save(); renderAll();
}
function resetForm() {
  editId = null;
  $("amount").value = ""; $("description").value = ""; $("type").value = "expense";
  $("date").value = new Date().toISOString().slice(0, 10);
  $("formTitle").textContent = "Add Transaction"; $("saveBtn").textContent = "Add";
  $("cancelBtn").hidden = true; $("msg").textContent = "";
}

/* ---------- Filtering ---------- */
function filtered() {
  const q = $("fSearch").value.toLowerCase(), c = $("fCategory").value, ty = $("fType").value;
  const from = $("fFrom").value, to = $("fTo").value;
  return transactions.filter(t =>
    (!q || t.description.toLowerCase().includes(q)) && (!c || t.category === c) &&
    (!ty || t.type === ty) && (!from || t.date >= from) && (!to || t.date <= to))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/* ---------- Rendering ---------- */
function renderTable() {
  const list = filtered();
  $("txBody").innerHTML = list.length ? list.map(t => `<tr>
    <td>${t.date}</td><td>${t.type}</td><td>${esc(t.category)}</td><td>${esc(t.description)}</td>
    <td class="${t.type}-amt">${t.type === "income" ? "+" : "-"}${fmt(t.amount)}</td>
    <td><button class="edit" onclick="editTransaction('${t.id}')">Edit</button>
        <button class="del" onclick="deleteTransaction('${t.id}')">Delete</button></td></tr>`).join("")
    : `<tr><td colspan="6" class="empty">No transactions found.</td></tr>`;
}
function renderTotals() {
  const inc = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const exp = transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  $("totalIncome").textContent = fmt(inc); $("totalExpense").textContent = fmt(exp);
  $("balance").textContent = fmt(inc - exp);
  $("balance").style.color = inc - exp < 0 ? "#e04848" : "#1e9e5a";
}
function monthlyData() {
  const m = {};
  transactions.forEach(t => {
    const k = t.date.slice(0, 7); m[k] = m[k] || { income: 0, expense: 0 };
    m[k][t.type] += t.amount;
  });
  return Object.keys(m).sort().reverse().map(k => ({ month: k, ...m[k] }));
}
function renderMonthly() {
  const d = monthlyData();
  $("monthBody").innerHTML = d.length ? d.map(r => `<tr><td>${r.month}</td>
    <td class="income-amt">${fmt(r.income)}</td><td class="expense-amt">${fmt(r.expense)}</td>
    <td>${fmt(r.income - r.expense)}</td></tr>`).join("")
    : `<tr><td colspan="4" class="empty">No data yet.</td></tr>`;
}
function renderChart() {
  const cv = $("chart"), ctx = cv.getContext("2d"), W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  let data;
  if ($("chartMode").value === "category") {
    const m = {};
    transactions.filter(t => t.type === "expense").forEach(t => m[t.category] = (m[t.category] || 0) + t.amount);
    data = Object.entries(m).map(([l, v]) => ({ l, v })).sort((a, b) => b.v - a.v);
  } else {
    data = monthlyData().reverse().map(r => ({ l: r.month, v: r.expense }));
  }
  ctx.font = "14px Segoe UI, Arial"; ctx.textAlign = "center";
  if (!data.length || data.every(d => d.v === 0)) { ctx.fillStyle = "#6b7488"; ctx.fillText("No expense data to display", W / 2, H / 2); return; }
  const colors = ["#2f6fed", "#e04848", "#1e9e5a", "#f5a623", "#8e44ad", "#16a6b6", "#d35400", "#7f8c8d"];
  const pad = 40, bw = Math.min(60, (W - pad * 2) / data.length - 12), max = Math.max(...data.map(d => d.v));
  const step = (W - pad * 2) / data.length;
  ctx.strokeStyle = "#ccd3e0"; ctx.beginPath(); ctx.moveTo(pad, 20); ctx.lineTo(pad, H - 50); ctx.lineTo(W - 10, H - 50); ctx.stroke();
  data.forEach((d, i) => {
    const h = (d.v / max) * (H - 90), x = pad + i * step + (step - bw) / 2, y = H - 50 - h;
    ctx.fillStyle = colors[i % colors.length]; ctx.fillRect(x, y, bw, h);
    ctx.fillStyle = "#1d2433"; ctx.font = "12px Segoe UI, Arial";
    ctx.fillText(fmt(d.v), x + bw / 2, y - 5);
    ctx.fillText(d.l.length > 9 ? d.l.slice(0, 8) + "…" : d.l, x + bw / 2, H - 32);
  });
}
function renderAll() { renderTable(); renderTotals(); renderMonthly(); renderChart(); }

/* ---------- Events ---------- */
$("saveBtn").onclick = saveTransaction;
$("cancelBtn").onclick = resetForm;
$("addCatBtn").onclick = addCategory;
$("chartMode").onchange = renderChart;
["fSearch", "fCategory", "fType", "fFrom", "fTo"].forEach(id => $(id).addEventListener("input", renderTable));
$("clearBtn").onclick = () => { ["fSearch", "fCategory", "fType", "fFrom", "fTo"].forEach(id => $(id).value = ""); renderTable(); };

renderCategories(); resetForm(); renderAll();
