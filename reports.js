// ══════════════════════════════════════════════════════════════
//  IndividualTrack — Branch Reports  (reports.js)
// ══════════════════════════════════════════════════════════════

const API = "https://script.google.com/macros/s/AKfycbz157zrRuJtbov5IbwdvCiCcuIB_jycObURZ7KQDbbLBfMDiiKhCVMZN1-tAJjYgAx2/exec";

let S = { branch: null, pwd: null, employees: [] };

// ── API call ──────────────────────────────────────────────────
async function api(action, params = {}) {
  try {
    const res = await fetch(API, {
      method: "POST",
      // Change from JSON to text/plain to avoid CORS pre-flight
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
      body: JSON.stringify({ action, branchName: S.branch, ...params })
    });
    return await res.json();
  } catch (e) { 
    return { ok: false, error: "NETWORK_ERROR" }; 
  }
}

// ── Helpers ───────────────────────────────────────────────────
const n  = v => Number(v) || 0;
const fmt = v => {
  const num = n(v);
  if (num === 0) return "0";
  return num.toLocaleString("en-IN");
};
const fmtC = v => "₹" + fmt(v);  // currency

// Balance formatter: shows +X (over) or -X (shortfall) with color class
function fmtBal(bal, isCount = false) {
  // bal = target - achievement
  // negative bal = over-achievement
  // positive bal = shortfall
  const abs = Math.abs(bal);
  const formatted = isCount ? fmt(abs) : fmtC(abs);
  if (bal < 0) {
    return `<span class="over">+${formatted}</span>`;   // exceeded target
  } else if (bal === 0) {
    return `<span class="exact">✓ On Target</span>`;
  } else {
    return `<span class="short">-${formatted}</span>`;  // shortfall
  }
}

function pctBadge(pct) {
  const p = n(pct);
  const cls = p >= 100 ? "badge-over" : p >= 75 ? "badge-green" : p >= 50 ? "badge-amber" : "badge-red";
  const sign = p >= 100 ? "+" : "";
  return `<span class="badge ${cls}">${sign}${p}%</span>`;
}

function achPct(ach, target) {
  if (!target) return 0;
  return Math.round(n(ach) / n(target) * 100);
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function monthName(m) {
  return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Number(m)-1] || "";
}
function empty(msg) {
  return `<div class="empty-state"><div class="empty-icon">📭</div><p>${msg || "No data found"}</p></div>`;
}
function loading() {
  return `<div class="loading-wrap"><div class="spinner-dark spinner"></div> Loading…</div>`;
}
function errBox(msg) {
  return `<div class="alert alert-error"><span class="alert-icon">✕</span> ${msg}</div>`;
}

// Populate month/year selects
function populateMY(mSel, ySel) {
  const months = [
    {n:4,l:"April"},{n:5,l:"May"},{n:6,l:"June"},{n:7,l:"July"},
    {n:8,l:"August"},{n:9,l:"September"},{n:10,l:"October"},{n:11,l:"November"},
    {n:12,l:"December"},{n:1,l:"January"},{n:2,l:"February"},{n:3,l:"March"}
  ];
  const cur = new Date();
  months.forEach(mo => {
    const o = document.createElement("option");
    o.value = mo.n; o.textContent = mo.l; mSel.appendChild(o);
  });
  mSel.value = cur.getMonth() + 1;
  for (let y = cur.getFullYear(); y >= 2024; y--) {
    const o = document.createElement("option");
    o.value = y; o.textContent = y; ySel.appendChild(o);
  }
  ySel.value = cur.getFullYear();
}

// ── LOGIN ─────────────────────────────────────────────────────
async function initBranches() {
  const res = await fetch(API, {
    method: "POST", body: JSON.stringify({ action: "getPublicBranches" })
  }).then(r => r.json()).catch(() => ({ ok: false }));

  const sel = document.getElementById("sel-branch");
  if (res.ok && res.branches?.length) {
    sel.innerHTML = '<option value="">Select branch…</option>';
    res.branches.forEach(b => {
      const o = document.createElement("option");
      // getPublicBranches returns plain strings, not objects
      const name = (typeof b === "string") ? b : (b.BranchName || b.branchName || "");
      o.value = name;
      o.textContent = name;
      sel.appendChild(o);
    });
  } else {
    sel.innerHTML = '<option value="">Could not load branches</option>';
  }
}

document.getElementById("btn-login").addEventListener("click", async () => {
  const branch = document.getElementById("sel-branch").value;
  const pwd    = document.getElementById("inp-report-pwd").value.trim();
  const errEl  = document.getElementById("login-err");
  const errMsg = document.getElementById("login-err-msg");
  errEl.style.display = "none";

  if (!branch) { errEl.style.display="flex"; errMsg.textContent="Please select a branch."; return; }
  if (!pwd)    { errEl.style.display="flex"; errMsg.textContent="Please enter the report password."; return; }

  const btn = document.getElementById("btn-login");
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Verifying…';

  const res = await fetch(API, {
    method: "POST",
    body: JSON.stringify({ action: "branchReportLogin", branchName: branch, password: pwd })
  }).then(r => r.json()).catch(() => ({ ok: false, error: "NETWORK_ERROR" }));

  btn.disabled = false;
  btn.innerHTML = "<span>Access Reports</span>";

  if (!res.ok) {
    errEl.style.display = "flex";
    errMsg.textContent = res.error === "WRONG_PASSWORD" ? "Incorrect report password." : (res.error || "Login failed.");
    return;
  }

  S.branch = branch;
  S.pwd    = pwd;
  S.employees = res.employees || [];

  document.getElementById("screen-login").classList.remove("active");
  document.getElementById("screen-main").classList.add("active");
  document.getElementById("topbar-branch").textContent = branch;

  initReports();
});

document.getElementById("inp-report-pwd").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("btn-login").click();
});

document.getElementById("btn-logout").addEventListener("click", () => {
  S = { branch: null, pwd: null, employees: [] };
  document.getElementById("screen-main").classList.remove("active");
  document.getElementById("screen-login").classList.add("active");
  document.getElementById("inp-report-pwd").value = "";
});

// ── NAV ───────────────────────────────────────────────────────
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".report-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("panel-" + btn.dataset.panel)?.classList.add("active");
  });
});

// ── INIT REPORTS ──────────────────────────────────────────────
function initReports() {
  const today = todayISO();

  // Populate all month/year selects
  populateMY(document.getElementById("monthly-month"), document.getElementById("monthly-year"));
  populateMY(document.getElementById("monthly-month-to"), document.getElementById("monthly-year-to"));
  populateMY(document.getElementById("emp-month"),     document.getElementById("emp-year"));
  populateMY(document.getElementById("tgt-month"),     document.getElementById("tgt-year"));
  populateMY(document.getElementById("leave-month"),   document.getElementById("leave-year"));

  // Daily date default
  document.getElementById("daily-date").value = today;

  // Today date display
  document.getElementById("today-date-sub").textContent =
    new Date().toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"long", year:"numeric" });

  // Populate employee dropdown
  const empSel = document.getElementById("emp-sel");
  empSel.innerHTML = '<option value="">Select employee…</option>';
  S.employees.forEach(e => {
    const o = document.createElement("option");
    o.value = e.EmpID;
    o.textContent = e.FullName + (e.Role === "BRANCH_HEAD" ? " 👑" : "");
    empSel.appendChild(o);
  });

  // Auto-load today's report
  loadToday();
}

// ══════════════════════════════════════════════════════════════
//  TODAY'S REPORT (Updated with RD Commitments)
// ══════════════════════════════════════════════════════════════
async function loadToday() {
  const wrap = document.getElementById("today-report-wrap");
  wrap.innerHTML = loading();

  const date = todayISO();
  const res  = await api("dayReport", { date });

  if (!res.ok) { wrap.innerHTML = errBox(res.error || "Failed to load"); return; }

  const rows = res.rows || [];
  const t    = res.totals || {};
  const bt   = res.branchTarget || {};

  // Header tile counts
  document.getElementById("t-active").textContent  = rows.filter(r => !r.OnLeave).length;
  document.getElementById("t-leave").textContent   = rows.filter(r => r.OnLeave).length;
  document.getElementById("t-morning").textContent = rows.filter(r => r.MorningDone).length;
  document.getElementById("t-complete").textContent= rows.filter(r => r.EveningDone).length;

  const netInvAch  = n(t.Inv_Ach) - n(t.Inv_Closing);
  const netRDAmt   = n(t.Net_RD);
  const invMonthly = n(bt.invMonthly);
  const invPct     = achPct(netInvAch, invMonthly);
  const invBal     = invMonthly - netInvAch;

  wrap.innerHTML = `
  <div class="summary-grid">
    <div class="summary-card inv">
      <div class="summary-label">💼 Inv Commitment</div>
      <div class="summary-value">${fmtC(t.Inv_Com)}</div>
    </div>
    <div class="summary-card inv-ach">
      <div class="summary-label">Net Inv Achievement</div>
      <div class="summary-value">${fmtC(netInvAch)}</div>
      <div class="summary-sub">Gross ${fmtC(t.Inv_Ach)} − Closing ${fmt(t.Inv_Closing)}</div>
    </div>
    <div class="summary-card rd">
      <div class="summary-label">🏦 RD Count</div>
      <div class="summary-value">${fmt(t.RD_Count_Ach)} <span style="font-size:12px;opacity:.7">/ ${fmt(t.RD_Count_Com)}</span></div>
      <div class="summary-sub">Target met by count</div>
    </div>
    <div class="summary-card rd-amt">
      <div class="summary-label">Net RD Amount</div>
      <div class="summary-value">${fmtC(netRDAmt)}</div>
      <div class="summary-sub">Committed: ${fmtC(t.RD_Amount_Com)}</div>
    </div>
  </div>

  ${invMonthly > 0 ? `
  <div class="progress-card">
    <div class="progress-header">
      <span>Today vs Monthly Target</span>
      <span>${pctBadge(invPct)} of ${fmtC(invMonthly)}</span>
    </div>
    <div class="progress-track"><div class="progress-fill ${invPct>=100?'over':invPct>=75?'good':invPct>=50?'warn':'low'}" style="width:${Math.min(invPct,100)}%"></div></div>
    <div class="progress-footer">
      <span>Achieved: ${fmtC(netInvAch)}</span>
      <span>Balance: ${fmtBal(invBal)}</span>
    </div>
  </div>` : ""}

  <div class="emp-list">
    ${rows.length === 0 ? empty("No employees found") : rows.map(r => {
      const netInv = n(r.Inv_Ach) - n(r.Inv_Closing);
      const rdNet  = n(r.Net_RD);
      const onLeave= r.OnLeave;
      const statusClass = onLeave ? "status-leave" : r.EveningDone ? "status-done" : r.MorningDone ? "status-partial" : "status-pending";
      const statusText  = onLeave ? "On Leave" : r.EveningDone ? "Complete" : r.MorningDone ? "Morning ✓" : "Pending";
      
      return `
      <div class="emp-card ${statusClass}">
        <div class="emp-card-header">
          <div class="emp-name">${r.FullName}${r.Role==="BRANCH_HEAD"?" 👑":""}</div>
          <span class="status-pill ${statusClass}">${statusText}</span>
        </div>
        ${onLeave ? "" : `
        <div class="emp-metrics">
          <div class="metric-item">
            <span class="metric-label">Inv Com</span>
            <span class="metric-val">${fmtC(r.Inv_Com)}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Net Inv Ach</span>
            <span class="metric-val ${netInv>0?"green-text":""}">${fmtC(netInv)}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">RD Count (Com → Ach)</span>
            <span class="metric-val">${fmt(r.RD_Count_Com)} → <b>${fmt(r.RD_Count_Ach)}</b></span>
          </div>
          <div class="metric-item">
            <span class="metric-label">RD Amt (Com → Net Ach)</span>
            <span class="metric-val ${rdNet>0?"teal-text":""}">${fmtC(r.RD_Amount_Com)} → <b>${fmtC(rdNet)}</b></span>
          </div>
        </div>`}
      </div>`;
    }).join("")}
  </div>`;
}

// ══════════════════════════════════════════════════════════════
//  DAILY REPORT (Updated to include RD Commitments)
// ══════════════════════════════════════════════════════════════
document.getElementById("btn-load-daily").addEventListener("click", async () => {
  const date = document.getElementById("daily-date").value;
  const el   = document.getElementById("daily-result");
  if (!date) { el.innerHTML = errBox("Please select a date."); return; }
  el.innerHTML = loading();

  const res = await api("dayReport", { date });
  if (!res.ok) { el.innerHTML = errBox(res.error || "Failed to load"); return; }

  const rows = res.rows || [];
  const t    = res.totals || {};
  const bt   = res.branchTarget || {};

  const netInvAch = n(t.Inv_Ach) - n(t.Inv_Closing);
  const netRDAmt  = n(t.Net_RD);
  const invPct    = achPct(netInvAch, bt.invMonthly);
  const invBal    = n(bt.invMonthly) - netInvAch;

  if (!rows.length) { el.innerHTML = empty("No data for this date"); return; }

  el.innerHTML = `
  <div class="report-date-header">${new Date(date+"T00:00:00").toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>

  <div class="summary-grid">
    <div class="summary-card inv">
      <div class="summary-label">💼 Inv Commitment</div>
      <div class="summary-value">${fmtC(t.Inv_Com)}</div>
    </div>
    <div class="summary-card inv-ach">
      <div class="summary-label">Net Inv Achievement</div>
      <div class="summary-value">${fmtC(netInvAch)}</div>
      <div class="summary-sub">Gross ${fmtC(t.Inv_Ach)} − Closing ${fmt(t.Inv_Closing)}</div>
    </div>
    <div class="summary-card rd">
      <div class="summary-label">🏦 RD Count</div>
      <div class="summary-value">${fmt(t.RD_Count_Ach)} <span style="font-size:12px;opacity:.7">/ ${fmt(t.RD_Count_Com)}</span></div>
    </div>
    <div class="summary-card rd-amt">
      <div class="summary-label">Net RD Amount</div>
      <div class="summary-value">${fmtC(netRDAmt)}</div>
      <div class="summary-sub">Committed: ${fmtC(t.RD_Amount_Com)}</div>
    </div>
  </div>

  ${n(bt.invMonthly)>0?`
  <div class="progress-card">
    <div class="progress-header">
      <span>Today vs Monthly Target (${fmtC(bt.invMonthly)})</span>
      <span>${pctBadge(invPct)}</span>
    </div>
    <div class="progress-track"><div class="progress-fill ${invPct>=100?'over':invPct>=75?'good':invPct>=50?'warn':'low'}" style="width:${Math.min(invPct,100)}%"></div></div>
    <div class="progress-footer">
      <span>${fmtC(netInvAch)} achieved</span>
      <span>Balance: ${fmtBal(invBal)}</span>
    </div>
  </div>`:""}

  <div class="emp-list">
    ${rows.map(r => {
      const netInv = n(r.Inv_Ach) - n(r.Inv_Closing);
      const rdNet  = n(r.Net_RD);
      const onLeave= r.OnLeave;
      const statusClass = onLeave ? "status-leave" : r.EveningDone ? "status-done" : r.MorningDone ? "status-partial" : "status-pending";
      const statusText  = onLeave ? "On Leave" : r.EveningDone ? "Complete" : r.MorningDone ? "Morning ✓" : "Pending";
      
      return `
      <div class="emp-card ${statusClass}">
        <div class="emp-card-header">
          <div class="emp-name">${r.FullName}${r.Role==="BRANCH_HEAD"?" 👑":""}</div>
          <span class="status-pill ${statusClass}">${statusText}</span>
        </div>
        ${onLeave ? "" : `
        <div class="emp-metrics">
          <div class="metric-item">
            <span class="metric-label">Inv Com</span>
            <span class="metric-val">${fmtC(r.Inv_Com)}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Net Inv Ach</span>
            <span class="metric-val ${netInv>0?"green-text":""}">${fmtC(netInv)}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">RD Count (Com → Ach)</span>
            <span class="metric-val">${fmt(r.RD_Count_Com)} → <b>${fmt(r.RD_Count_Ach)}</b></span>
          </div>
          <div class="metric-item">
            <span class="metric-label">RD Amt (Com → Net Ach)</span>
            <span class="metric-val ${rdNet>0?"teal-text":""}">${fmtC(r.RD_Amount_Com)} → <b>${fmtC(rdNet)}</b></span>
          </div>
        </div>`}
      </div>`;
    }).join("")}
  </div>`;
});

// ══════════════════════════════════════════════════════════════
//  MONTHLY SUMMARY (with from–to period selector)
// ══════════════════════════════════════════════════════════════
document.getElementById("btn-load-monthly").addEventListener("click", async () => {
  const mFrom = Number(document.getElementById("monthly-month").value);
  const yFrom = Number(document.getElementById("monthly-year").value);
  const mTo   = Number(document.getElementById("monthly-month-to").value);
  const yTo   = Number(document.getElementById("monthly-year-to").value);
  const el    = document.getElementById("monthly-result");

  el.innerHTML = loading();

  // Build list of month/year pairs in range
  const periods = [];
  let cy = yFrom, cm = mFrom;
  while (cy < yTo || (cy === yTo && cm <= mTo)) {
    periods.push({ m: cm, y: cy });
    cm++;
    if (cm > 12) { cm = 1; cy++; }
    if (periods.length > 24) break; // safety cap
  }

  if (!periods.length) {
    el.innerHTML = errBox("'From' period must be before or equal to 'To' period.");
    return;
  }

  // Fetch all periods in parallel
  const results = await Promise.all(
    periods.map(p => api("monthlyReport", { year: p.y, month: p.m }))
  );

  // If single month — show detailed per-employee table
  if (periods.length === 1) {
    const res = results[0];
    if (!res.ok) { el.innerHTML = errBox(res.error || "Failed"); return; }
    const rows = res.rows || [];
    if (!rows.length) { el.innerHTML = empty("No data for this period"); return; }
    renderMonthlyDetail(el, rows, periods[0]);
    return;
  }

  // Multi-month — aggregate per employee across periods
  renderMonthlyRange(el, results, periods);
});

function renderMonthlyDetail(el, rows, period) {
  // Totals
  let totInvTgt=0, totInvAch=0, totRdCntTgt=0, totRdCntAch=0, totRdAmtTgt=0, totRdAmtAch=0;
  rows.forEach(r => {
    totInvTgt   += n(r.InvTarget);  totInvAch   += n(r.InvAch);
    totRdCntTgt += n(r.RDCntTarget);totRdCntAch += n(r.RDCountAch);
    totRdAmtTgt += n(r.RDAmtTarget);totRdAmtAch += n(r.RDAmountAch);
  });
  const invTotBal    = totInvTgt - totInvAch;
  const rdCntTotBal  = totRdCntTgt - totRdCntAch;
  const rdAmtTotBal  = totRdAmtTgt - totRdAmtAch;
  const invTotPct    = achPct(totInvAch, totInvTgt);
  const rdCntTotPct  = achPct(totRdCntAch, totRdCntTgt);
  const rdAmtTotPct  = achPct(totRdAmtAch, totRdAmtTgt);

  el.innerHTML = `
  <div class="report-date-header">${monthName(period.m)} ${period.y} — Detailed Report</div>

  <div class="summary-grid four-col">
    <div class="summary-card inv">
      <div class="summary-label">💼 Inv Target</div>
      <div class="summary-value">${fmtC(totInvTgt)}</div>
    </div>
    <div class="summary-card inv-ach">
      <div class="summary-label">Net Inv Achievement</div>
      <div class="summary-value">${fmtC(totInvAch)}</div>
      <div class="summary-sub">${pctBadge(invTotPct)} · Balance: ${fmtBal(invTotBal)}</div>
    </div>
    <div class="summary-card rd">
      <div class="summary-label">🏦 RD Count</div>
      <div class="summary-value">${fmt(totRdCntAch)} <span style="font-size:12px;opacity:.7">/ ${fmt(totRdCntTgt)}</span></div>
      <div class="summary-sub">${pctBadge(rdCntTotPct)} · ${fmtBal(rdCntTotBal, true)}</div>
    </div>
    <div class="summary-card rd-amt">
      <div class="summary-label">RD Amount</div>
      <div class="summary-value">${fmtC(totRdAmtAch)}</div>
      <div class="summary-sub">${pctBadge(rdAmtTotPct)} · ${fmtBal(rdAmtTotBal)}</div>
    </div>
  </div>

  <div class="table-wrap">
    <table>
      <thead><tr>
        <th>Employee</th>
        <th>Inv Target</th><th>Net Inv Ach</th><th>Ach %</th><th>Balance</th><th>DRR</th>
        <th>RD Cnt Tgt</th><th>RD Cnt Ach</th><th>Cnt %</th>
        <th>RD Amt Tgt</th><th>RD Amt Ach</th><th>Amt %</th>
        <th>Zero Days</th>
      </tr></thead>
      <tbody>
        ${rows.map(r => {
          const invP = achPct(r.InvAch, r.InvTarget);
          const cntP = achPct(r.RDCountAch, r.RDCntTarget);
          const amtP = achPct(r.RDAmountAch, r.RDAmtTarget);
          return `<tr>
            <td class="td-name">${r.FullName}</td>
            <td class="td-mono">${fmtC(r.InvTarget)}</td>
            <td class="td-mono green-text">${fmtC(r.InvAch)}</td>
            <td>${pctBadge(invP)}</td>
            <td class="td-mono">${fmtBal(n(r.InvBal))}</td>
            <td class="td-mono amber-text">${fmtC(r.DRR)}</td>
            <td class="td-mono">${fmt(r.RDCntTarget)}</td>
            <td class="td-mono teal-text">${fmt(r.RDCountAch)}</td>
            <td>${pctBadge(cntP)}</td>
            <td class="td-mono">${fmtC(r.RDAmtTarget)}</td>
            <td class="td-mono teal-text">${fmtC(r.RDAmountAch)}</td>
            <td>${pctBadge(amtP)}</td>
            <td><span class="badge ${n(r.ZeroDays)>5?"badge-red":n(r.ZeroDays)>0?"badge-amber":"badge-green"}">${r.ZeroDays||0}d</span></td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  </div>`;
}

function renderMonthlyRange(el, results, periods) {
  // Aggregate data: per employee, sum across all periods
  const empMap = {};
  periods.forEach((p, i) => {
    const res = results[i];
    if (!res.ok) return;
    (res.rows || []).forEach(r => {
      if (!empMap[r.EmpID]) {
        empMap[r.EmpID] = {
          EmpID: r.EmpID, FullName: r.FullName,
          InvTarget: 0, InvAch: 0, RDCntTarget: 0, RDCountAch: 0,
          RDAmtTarget: 0, RDAmountAch: 0, ZeroDays: 0
        };
      }
      const e = empMap[r.EmpID];
      e.InvTarget    += n(r.InvTarget);
      e.InvAch       += n(r.InvAch);
      e.RDCntTarget  += n(r.RDCntTarget);
      e.RDCountAch   += n(r.RDCountAch);
      e.RDAmtTarget  += n(r.RDAmtTarget);
      e.RDAmountAch  += n(r.RDAmountAch);
      e.ZeroDays     += n(r.ZeroDays);
    });
  });

  const rows = Object.values(empMap);
  if (!rows.length) { el.innerHTML = empty("No data for selected range"); return; }

  const label = `${monthName(periods[0].m)} ${periods[0].y} → ${monthName(periods[periods.length-1].m)} ${periods[periods.length-1].y}`;

  let totIT=0,totIA=0,totRCT=0,totRCA=0,totRAT=0,totRAA=0;
  rows.forEach(r => { totIT+=r.InvTarget;totIA+=r.InvAch;totRCT+=r.RDCntTarget;totRCA+=r.RDCountAch;totRAT+=r.RDAmtTarget;totRAA+=r.RDAmountAch; });

  el.innerHTML = `
  <div class="report-date-header">${label} — ${periods.length}-Month Summary</div>

  <div class="summary-grid four-col">
    <div class="summary-card inv">
      <div class="summary-label">💼 Total Inv Target</div>
      <div class="summary-value">${fmtC(totIT)}</div>
    </div>
    <div class="summary-card inv-ach">
      <div class="summary-label">Total Net Inv Ach</div>
      <div class="summary-value">${fmtC(totIA)}</div>
      <div class="summary-sub">${pctBadge(achPct(totIA,totIT))} · ${fmtBal(totIT-totIA)}</div>
    </div>
    <div class="summary-card rd">
      <div class="summary-label">🏦 RD Count</div>
      <div class="summary-value">${fmt(totRCA)} / ${fmt(totRCT)}</div>
      <div class="summary-sub">${pctBadge(achPct(totRCA,totRCT))} · ${fmtBal(totRCT-totRCA,true)}</div>
    </div>
    <div class="summary-card rd-amt">
      <div class="summary-label">RD Amount</div>
      <div class="summary-value">${fmtC(totRAA)}</div>
      <div class="summary-sub">${pctBadge(achPct(totRAA,totRAT))} · ${fmtBal(totRAT-totRAA)}</div>
    </div>
  </div>

  <div class="table-wrap">
    <table>
      <thead><tr>
        <th>Employee</th>
        <th>Inv Target</th><th>Net Inv Ach</th><th>Ach %</th><th>Balance</th>
        <th>RD Cnt Tgt</th><th>RD Cnt Ach</th><th>Cnt %</th>
        <th>RD Amt Tgt</th><th>RD Amt Ach</th><th>Amt %</th>
      </tr></thead>
      <tbody>
        ${rows.map(r => `<tr>
          <td class="td-name">${r.FullName}</td>
          <td class="td-mono">${fmtC(r.InvTarget)}</td>
          <td class="td-mono green-text">${fmtC(r.InvAch)}</td>
          <td>${pctBadge(achPct(r.InvAch,r.InvTarget))}</td>
          <td class="td-mono">${fmtBal(r.InvTarget-r.InvAch)}</td>
          <td class="td-mono">${fmt(r.RDCntTarget)}</td>
          <td class="td-mono teal-text">${fmt(r.RDCountAch)}</td>
          <td>${pctBadge(achPct(r.RDCountAch,r.RDCntTarget))}</td>
          <td class="td-mono">${fmtC(r.RDAmtTarget)}</td>
          <td class="td-mono teal-text">${fmtC(r.RDAmountAch)}</td>
          <td>${pctBadge(achPct(r.RDAmountAch,r.RDAmtTarget))}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>`;
}

// ══════════════════════════════════════════════════════════════
//  EMPLOYEE PERFORMANCE CARD
// ══════════════════════════════════════════════════════════════
document.getElementById("btn-load-emp").addEventListener("click", async () => {
  const empId = document.getElementById("emp-sel").value;
  const month = Number(document.getElementById("emp-month").value);
  const year  = Number(document.getElementById("emp-year").value);
  const el    = document.getElementById("emp-result");
  if (!empId) { el.innerHTML = errBox("Please select an employee."); return; }
  el.innerHTML = loading();

  const isBH = S.employees.find(e => String(e.EmpID) === String(empId))?.Role === "BRANCH_HEAD";
  const res  = await api("empHistory", { empId, year, month, isBH, branchName: S.branch });

  if (!res.ok) { el.innerHTML = errBox(res.error || "Failed to load"); return; }

  const emp     = S.employees.find(e => String(e.EmpID) === String(empId)) || {};
  const rows    = res.rows || [];
  const invPct  = achPct(res.invMonthAch, res.invMonthly);
  const cntPct  = achPct(res.rdCntMonthAch, res.rdCntMonthly);
  const amtPct  = achPct(res.rdAmtMonthAch, res.rdAmtMonthly);
  const yInvPct = achPct(res.invYearAch, res.invYearly);

  el.innerHTML = `
  <div class="emp-profile-header">
    <div class="emp-avatar">${emp.FullName?.split(" ").map(w=>w[0]).join("").substring(0,2)||"?"}</div>
    <div class="emp-profile-info">
      <div class="emp-profile-name">${emp.FullName||empId}${isBH?" 👑":""}</div>
      <div class="emp-profile-sub">${emp.Designation||""} · ${monthName(month)} ${year}</div>
    </div>
  </div>

  <!-- Monthly KPIs -->
  <div class="kpi-section-title">📅 This Month</div>
  <div class="summary-grid four-col">
    <div class="summary-card inv">
      <div class="summary-label">Inv Target</div>
      <div class="summary-value">${fmtC(res.invMonthly)}</div>
    </div>
    <div class="summary-card inv-ach">
      <div class="summary-label">Net Inv Achievement</div>
      <div class="summary-value">${fmtC(res.invMonthAch)}</div>
      <div class="summary-sub">${pctBadge(invPct)} · ${fmtBal(n(res.invMonthBal))}</div>
    </div>
    <div class="summary-card rd">
      <div class="summary-label">RD Count</div>
      <div class="summary-value">${fmt(res.rdCntMonthAch)} / ${fmt(res.rdCntMonthly)}</div>
      <div class="summary-sub">${pctBadge(cntPct)} · ${fmtBal(n(res.rdCntMonthBal),true)}</div>
    </div>
    <div class="summary-card rd-amt">
      <div class="summary-label">RD Amount</div>
      <div class="summary-value">${fmtC(res.rdAmtMonthAch)}</div>
      <div class="summary-sub">${pctBadge(amtPct)} · ${fmtBal(n(res.rdAmtMonthBal))}</div>
    </div>
  </div>

  <div class="progress-card">
    <div class="progress-header"><span>Investment Progress</span><span>${pctBadge(invPct)}</span></div>
    <div class="progress-track"><div class="progress-fill ${invPct>=100?'over':invPct>=75?'good':invPct>=50?'warn':'low'}" style="width:${Math.min(invPct,100)}%"></div></div>
    <div class="progress-footer"><span>${fmtC(res.invMonthAch)} achieved</span><span>DRR: ${fmtC(res.drr)}/day</span></div>
  </div>

  <!-- Yearly KPIs -->
  <div class="kpi-section-title">📊 Year-to-Date (FY ${res.fy || year})</div>
  <div class="summary-grid four-col">
    <div class="summary-card inv">
      <div class="summary-label">Annual Inv Target</div>
      <div class="summary-value">${fmtC(res.invYearly)}</div>
    </div>
    <div class="summary-card inv-ach">
      <div class="summary-label">YTD Inv Achievement</div>
      <div class="summary-value">${fmtC(res.invYearAch)}</div>
      <div class="summary-sub">${pctBadge(yInvPct)} · ${fmtBal(n(res.invYearBal))}</div>
    </div>
    <div class="summary-card rd">
      <div class="summary-label">YTD RD Count</div>
      <div class="summary-value">${fmt(res.rdCntYearAch)} / ${fmt(res.rdCntYearly)}</div>
      <div class="summary-sub">${pctBadge(achPct(res.rdCntYearAch,res.rdCntYearly))}</div>
    </div>
    <div class="summary-card rd-amt">
      <div class="summary-label">YTD RD Amount</div>
      <div class="summary-value">${fmtC(res.rdAmtYearAch)}</div>
      <div class="summary-sub">${pctBadge(achPct(res.rdAmtYearAch,res.rdAmtYearly))}</div>
    </div>
  </div>

  <!-- Day-by-day table -->
  ${rows.length ? `
  <div class="kpi-section-title">📅 Day-by-Day</div>
  <div class="table-wrap">
    <table>
      <thead><tr>
        <th>Date</th>
        <th>Inv Com</th><th>Inv Ach (Net)</th>
        <th>RD Cnt Com</th><th>RD Cnt Ach</th>
        <th>RD Amt Ach (Net)</th>
      </tr></thead>
      <tbody>
        ${rows.map(r => {
          const netInv = n(r.Inv_Ach);  // empHistory already returns net
          const netRD  = n(r.RD_Amount_Ach);
          const isZero = netInv === 0 && r.Inv_Ach !== null;
          return `<tr${isZero?' class="zero-row"':''}>
            <td class="td-mono">${r.Date||""}</td>
            <td class="td-mono">${fmtC(r.Inv_Com)}</td>
            <td class="td-mono ${netInv>0?"green-text":isZero?"dim":""}">${r.Inv_Ach!==null?fmtC(netInv):"—"}</td>
            <td class="td-mono">${fmt(r.RD_Count_Com)}</td>
            <td class="td-mono teal-text">${fmt(r.RD_Count_Ach)}</td>
            <td class="td-mono teal-text">${fmtC(netRD)}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  </div>` : ""}`;
});

// ══════════════════════════════════════════════════════════════
//  BRANCH VS TARGET
// ══════════════════════════════════════════════════════════════
document.getElementById("btn-load-tgt").addEventListener("click", async () => {
  const month = Number(document.getElementById("tgt-month").value);
  const year  = Number(document.getElementById("tgt-year").value);
  const el    = document.getElementById("tgt-result");
  el.innerHTML = loading();

  const res = await api("monthlyReport", { year, month });
  if (!res.ok) { el.innerHTML = errBox(res.error || "Failed to load"); return; }
  const rows = res.rows || [];
  if (!rows.length) { el.innerHTML = empty("No target data for this period"); return; }

  el.innerHTML = `
  <div class="report-date-header">${monthName(month)} ${year} — Branch vs Target</div>
  <div class="table-wrap">
    <table>
      <thead><tr>
        <th>Employee</th>
        <th>Inv Target</th><th>Net Inv Ach</th><th>%</th><th>Balance</th><th>DRR</th>
        <th>RD Cnt Tgt</th><th>RD Cnt Ach</th><th>%</th><th>Balance</th>
        <th>RD Amt Tgt</th><th>RD Amt Ach</th><th>%</th><th>Balance</th>
        <th>Zero Days</th>
      </tr></thead>
      <tbody>
        ${rows.map(r => {
          const invP = achPct(r.InvAch, r.InvTarget);
          const cntP = achPct(r.RDCountAch, r.RDCntTarget);
          const amtP = achPct(r.RDAmountAch, r.RDAmtTarget);
          return `<tr>
            <td class="td-name">${r.FullName}</td>
            <td class="td-mono">${fmtC(r.InvTarget)}</td>
            <td class="td-mono green-text">${fmtC(r.InvAch)}</td>
            <td>${pctBadge(invP)}</td>
            <td class="td-mono">${fmtBal(n(r.InvBal))}</td>
            <td class="td-mono amber-text">${fmtC(r.DRR)}</td>
            <td class="td-mono">${fmt(r.RDCntTarget)}</td>
            <td class="td-mono teal-text">${fmt(r.RDCountAch)}</td>
            <td>${pctBadge(cntP)}</td>
            <td class="td-mono">${fmtBal(n(r.RDCntBal),true)}</td>
            <td class="td-mono">${fmtC(r.RDAmtTarget)}</td>
            <td class="td-mono teal-text">${fmtC(r.RDAmountAch)}</td>
            <td>${pctBadge(amtP)}</td>
            <td class="td-mono">${fmtBal(n(r.RDAmtBal))}</td>
            <td><span class="badge ${n(r.ZeroDays)>5?"badge-red":n(r.ZeroDays)>0?"badge-amber":"badge-green"}">${r.ZeroDays||0}d</span></td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  </div>`;
});

// ══════════════════════════════════════════════════════════════
//  LEAVE CALENDAR
// ══════════════════════════════════════════════════════════════
document.getElementById("btn-load-leave").addEventListener("click", async () => {
  const month = Number(document.getElementById("leave-month").value);
  const year  = Number(document.getElementById("leave-year").value);
  const el    = document.getElementById("leave-result");
  el.innerHTML = loading();

  const res = await api("leaveReport", { year, month });
  if (!res.ok) { el.innerHTML = errBox(res.error || "Failed to load"); return; }
  const rows = res.rows || [];
  if (!rows.length) { el.innerHTML = empty(`No leave records for ${monthName(month)} ${year}`); return; }

  // Group by employee
  const empMap = {};
  rows.forEach(r => {
    if (!empMap[r.EmpID]) empMap[r.EmpID] = { name: r.FullName, days: [] };
    empMap[r.EmpID].days.push(r.Date);
  });

  el.innerHTML = `
  <div class="report-date-header">${monthName(month)} ${year} — Leave Calendar (${rows.length} records)</div>
  <div class="leave-grid">
    ${Object.values(empMap).map(emp => `
      <div class="leave-emp-card">
        <div class="leave-emp-name">${emp.name}</div>
        <div class="leave-days">
          ${emp.days.map(d => `<span class="leave-day-chip">${d.substring(8,10)}</span>`).join("")}
        </div>
        <div class="leave-count">${emp.days.length} day${emp.days.length!==1?"s":""}</div>
      </div>`).join("")}
  </div>
  <div class="table-wrap" style="margin-top:16px">
    <table>
      <thead><tr><th>Employee</th><th>Date</th><th>Marked By</th></tr></thead>
      <tbody>
        ${rows.map(r => `<tr>
          <td class="td-name">${r.FullName}</td>
          <td class="td-mono">${r.Date}</td>
          <td style="font-size:12px;color:var(--t3)">${r.MarkedBy||""}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>`;
});

// ══════════════════════════════════════════════════════════════
//  DOWNLOAD
// ══════════════════════════════════════════════════════════════
document.getElementById("btn-dl-load").addEventListener("click", async () => {
  const fy   = document.getElementById("dl-fy").value;
  const type = document.getElementById("dl-type").value;
  const el   = document.getElementById("dl-result");
  el.innerHTML = loading();

  const res = await api("downloadReport", { FY: fy, type });
  if (!res.ok) { el.innerHTML = errBox(res.error || "Failed to load"); return; }
  if (!res.rows?.length) { el.innerHTML = empty("No data for selected criteria"); return; }

  const months  = res.fyMonthDefs.map(d => d.label);
  const isInv   = (type === "investment");

  const csvHdr  = isInv
    ? ["Employee", ...months.flatMap(m=>[m+" Target",m+" Ach",m+" Closing"]), "Total Ach"]
    : ["Employee", ...months.flatMap(m=>[m+" Cnt Tgt",m+" Cnt Ach",m+" Amt Tgt",m+" Amt Ach"]), "Total Cnt", "Total Amt"];
  const csvRows = [csvHdr];

  const thCells = isInv
    ? months.map(m=>`<th>${m} Tgt</th><th>${m} Ach</th><th>${m} Close</th>`).join("")
    : months.map(m=>`<th>${m} CntT</th><th>${m} CntA</th><th>${m} AmtT</th><th>${m} AmtA</th>`).join("");

  let tableRows = "";
  res.rows.forEach(r => {
    let totAch=0,totCnt=0,totAmt=0;
    let cells=""; const csvCells=[r.FullName];
    r.months.forEach(m=>{
      if(isInv){
        totAch+=n(m.invAch);
        cells+=`<td class="td-mono">${fmtC(m.invTarget||0)}</td><td class="td-mono green-text">${fmtC(m.invAch||0)}</td><td class="td-mono dim">${fmt(m.invClosing||0)}</td>`;
        csvCells.push(m.invTarget||0,m.invAch||0,m.invClosing||0);
      } else {
        totCnt+=n(m.rdCntAch);totAmt+=n(m.rdAmtAch);
        cells+=`<td class="td-mono">${fmt(m.rdCntTarget||0)}</td><td class="td-mono teal-text">${fmt(m.rdCntAch||0)}</td><td class="td-mono">${fmtC(m.rdAmtTarget||0)}</td><td class="td-mono teal-text">${fmtC(m.rdAmtAch||0)}</td>`;
        csvCells.push(m.rdCntTarget||0,m.rdCntAch||0,m.rdAmtTarget||0,m.rdAmtAch||0);
      }
    });
    const totCell = isInv
      ? `<td class="td-mono green-text" style="font-weight:700">${fmtC(totAch)}</td>`
      : `<td class="td-mono teal-text" style="font-weight:700">${fmt(totCnt)}</td><td class="td-mono teal-text">${fmtC(totAmt)}</td>`;
    isInv ? csvCells.push(totAch) : csvCells.push(totCnt,totAmt);
    tableRows += `<tr><td class="td-name">${r.FullName}</td>${cells}${totCell}</tr>`;
    csvRows.push(csvCells);
  });

  const csv   = csvRows.map(r=>r.join(",")).join("\n");
  const url   = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  const fname = `IndividualTrack_${isInv?"Investment":"RD"}_${fy}.csv`;

  el.innerHTML = `
  <div class="dl-header">
    <span><b>${isInv?"💼 Investment":"🏦 RD"}</b> — FY ${fy} — ${res.rows.length} employees</span>
    <a href="${url}" download="${fname}" class="btn-dl-csv">⬇️ Download CSV</a>
  </div>
  <div class="table-wrap" style="overflow-x:auto">
    <table style="white-space:nowrap;font-size:12px">
      <thead><tr><th>Employee</th>${thCells}${isInv?"<th>Total Ach</th>":"<th>Total Cnt</th><th>Total Amt</th>"}</tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>`;
});

// ── Bootstrap ─────────────────────────────────────────────────
initBranches();
