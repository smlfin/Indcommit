const API = "https://script.google.com/macros/s/AKfycbz157zrRuJtbov5IbwdvCiCcuIB_jycObURZ7KQDbbLBfMDiiKhCVMZN1-tAJjYgAx2/exec";

let R = { branchName: null, employees: [] };

// ── API ──────────────────────────────────────────────────────
async function api(action, params={}) {
  try {
    const res = await fetch(API, { method:"POST", body: JSON.stringify({ action, ...params }) });
    return await res.json();
  } catch(e) { return { ok:false, error:"NETWORK_ERROR" }; }
}

// ── HELPERS ──────────────────────────────────────────────────
function fmt(n) {
  if(n===null||n===undefined||n==="") return "–";
  const num = Number(n);
  if(isNaN(num)) return "–";
  return num.toLocaleString("en-IN");
}
function pct(a,b) {
  if(!b||b===0) return "–";
  return Math.round(Number(a)/Number(b)*100)+"%";
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function displayDate(iso) {
  if(!iso) return "";
  const [y,m,d] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const dt = new Date(y,m-1,d);
  return `${days[dt.getDay()]}, ${d} ${months[m-1]} ${y}`;
}
function monthName(m) {
  return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m-1]||"";
}
function fyMonths() {
  // FY months: Apr=1 to Mar=12
  return [
    {num:4,label:"April"},{num:5,label:"May"},{num:6,label:"June"},
    {num:7,label:"July"},{num:8,label:"August"},{num:9,label:"September"},
    {num:10,label:"October"},{num:11,label:"November"},{num:12,label:"December"},
    {num:1,label:"January"},{num:2,label:"February"},{num:3,label:"March"},
  ];
}
function populateMonthYear(monthSel, yearSel) {
  const today = new Date();
  fyMonths().forEach(m => {
    const o = document.createElement("option");
    o.value = m.num; o.textContent = m.label;
    monthSel.appendChild(o);
  });
  monthSel.value = today.getMonth()+1;
  for(let y=2026;y<=2030;y++) {
    const o = document.createElement("option");
    o.value = y; o.textContent = y;
    yearSel.appendChild(o);
  }
  yearSel.value = today.getFullYear();
}
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  document.getElementById("screen-"+id).classList.add("active");
}
function progressColor(p) {
  const n = parseInt(p);
  if(n >= 90) return "green";
  if(n >= 60) return "";
  if(n >= 30) return "amber";
  return "red";
}
function gradeClass(pct) {
  if(pct>=90) return "grade-a";
  if(pct>=70) return "grade-b";
  if(pct>=50) return "grade-c";
  return "grade-d";
}
function gradeLabel(pct) {
  if(pct>=90) return "A";
  if(pct>=70) return "B";
  if(pct>=50) return "C";
  return "D";
}

// ── INIT ─────────────────────────────────────────────────────
async function init() {
  const sel = document.getElementById("sel-branch");
  try {
    const res = await api("getPublicBranches");
    if(res.ok && res.branches?.length) {
      sel.innerHTML = '<option value="">— Select Branch —</option>';
      res.branches.forEach(b => {
        const o = document.createElement("option");
        o.value = b; o.textContent = b; sel.appendChild(o);
      });
    } else {
      sel.innerHTML = '<option value="">⚠️ ' + (res.error||"Load failed") + '</option>';
    }
  } catch(e) {
    sel.innerHTML = '<option value="">⚠️ Network error</option>';
  }

  // Populate all month/year selects
  populateMonthYear(document.getElementById("monthly-month"), document.getElementById("monthly-year"));
  populateMonthYear(document.getElementById("emp-month"), document.getElementById("emp-year"));
  populateMonthYear(document.getElementById("tgt-month"), document.getElementById("tgt-year"));
  populateMonthYear(document.getElementById("leave-month"), document.getElementById("leave-year"));

  // Default daily date to today
  document.getElementById("daily-date").value = todayISO();
}

// ── LOGIN ────────────────────────────────────────────────────
document.getElementById("btn-login").addEventListener("click", async () => {
  const branchEl = document.getElementById("sel-branch");
  const branchName = branchEl.value || branchEl.value;
  const pwd = document.getElementById("inp-report-pwd").value.trim();
  const err = document.getElementById("login-err");
  err.style.display = "none";

  if(!branchName) { showErr("Please select your branch."); return; }
  if(!pwd) { showErr("Please enter the report password."); return; }

  const btn = document.getElementById("btn-login");
  btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Verifying…';

  const res = await api("branchReportLogin", { branchName, password: pwd });

  btn.disabled = false; btn.innerHTML = '<span>Access Reports</span>';

  if(!res.ok) { showErr(res.error==="WRONG_PASSWORD"?"Incorrect password. Please try again.":"Error: "+res.error); return; }

  R.branchName = branchName;
  R.employees = res.employees || [];

  // Populate employee selector
  const empSel = document.getElementById("emp-sel");
  empSel.innerHTML = '<option value="">— Select Employee —</option>';
  R.employees.forEach(e => {
    const o = document.createElement("option");
    o.value = e.EmpID; o.textContent = e.FullName;
    empSel.appendChild(o);
  });

  document.getElementById("topbar-branch").textContent = branchName;
  showScreen("main");
  loadTodayPanel();
});

function showErr(msg) {
  const el = document.getElementById("login-err");
  document.getElementById("login-err-msg").textContent = msg;
  el.style.display = "flex";
}

document.getElementById("inp-report-pwd").addEventListener("keydown", e => {
  if(e.key==="Enter") document.getElementById("btn-login").click();
});

// ── NAV ──────────────────────────────────────────────────────
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".report-panel").forEach(p=>p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("panel-"+btn.dataset.panel).classList.add("active");
  });
});

// ── TODAY PANEL ───────────────────────────────────────────────
async function loadTodayPanel() {
  const today = todayISO();
  document.getElementById("today-date-sub").textContent = displayDate(today);

  const [res, lock] = await Promise.all([
    api("getDayReport", { date: today, branchName: R.branchName }),
    api("getBranchLockStatus", { date: today, branchName: R.branchName }),
  ]);

  // Status tiles
  if(lock.ok) {
    document.getElementById("t-active").textContent  = lock.required ?? "–";
    document.getElementById("t-leave").textContent   = lock.onLeaveCount ?? "–";
    document.getElementById("t-morning").textContent = lock.morningSubmittedCount ?? "–";
    document.getElementById("t-complete").textContent= lock.eveningSubmittedCount ?? "–";
  }

  const wrap = document.getElementById("today-report-wrap");

  if(!res.ok) {
    wrap.innerHTML = `<div class="alert alert-error"><span class="alert-icon">✕</span>${res.error||"Could not load"}</div>`;
    return;
  }

  const rows = (res.rows||[]).filter(r => !r.OnLeave);
  if(!rows.length) {
    wrap.innerHTML = '<div class="loading-wrap" style="padding:30px;color:var(--t3)">No entries yet for today.</div>';
    return;
  }

  // Net achievement calculations
  // Net Inv Ach = Inv_Ach - Inv_Closing
  // Net RD Amt  = RD_Amount_Ach - RD_Mat_EMI
  const invRows = rows.map(r => ({
    ...r,
    netInvAch:  (Number(r.Inv_Ach)||0) - (Number(r.Inv_Closing)||0),
    netRdAmt:   (Number(r.RD_Amount_Ach)||0) - (Number(r.RD_Mat_EMI)||0),
  }));

  // Branch totals
  const totInvCom    = invRows.reduce((s,r)=>s+(Number(r.Inv_Com)||0),0);
  const totNetInvAch = invRows.reduce((s,r)=>s+r.netInvAch,0);
  const totInvBal    = totInvCom - totNetInvAch;
  const totRdCntCom  = invRows.reduce((s,r)=>s+(Number(r.RD_Count_Com)||0),0);
  const totRdCntAch  = invRows.reduce((s,r)=>s+(Number(r.RD_Count_Ach)||0),0);
  const totRdAmtCom  = invRows.reduce((s,r)=>s+(Number(r.RD_Amount_Com)||0),0);
  const totNetRdAmt  = invRows.reduce((s,r)=>s+r.netRdAmt,0);
  const totRdAmtBal  = totRdAmtCom - totNetRdAmt;
  const brPct = totInvCom>0 ? Math.round(totNetInvAch/totInvCom*100) : 0;

  // Helper — drill-down toggle
  const drillId = (id) => `drill-${id}`;

  // Build Investment rows
  const invTableRows = invRows.map((r,i) => {
    const bal     = (Number(r.Inv_Com)||0) - r.netInvAch;
    const balColor = bal < 0 ? "var(--red)" : "var(--amber)";
    const achColor = r.netInvAch < 0 ? "var(--red)" : "var(--green)";
    const did = `inv-${i}`;
    const hasDrill = r.EveningDone && (Number(r.Inv_Ach)||0 + Number(r.Inv_Closing)||0) > 0;
    return `
    <tr>
      <td class="td-name">${r.FullName}${!r.MorningDone?'<span class="badge badge-grey" style="margin-left:6px;font-size:10px">No Entry</span>':""}</td>
      <td class="td-mono">₹${fmt(r.Inv_Com||0)}</td>
      <td class="td-mono">
        <span style="color:${achColor}">₹${fmt(r.netInvAch)}</span>
        ${hasDrill ? `<button onclick="toggleDrill('${did}')" style="margin-left:6px;background:var(--blue-lt);color:var(--blue);border:none;border-radius:6px;padding:1px 7px;font-size:11px;cursor:pointer;font-weight:700">▾</button>` : ""}
      </td>
      <td class="td-mono" style="color:${balColor}">₹${fmt(bal)}</td>
    </tr>
    ${hasDrill ? `<tr id="${drillId(did)}" style="display:none;background:var(--blue-lt)">
      <td colspan="4" style="padding:8px 14px;font-size:12px">
        <span style="color:var(--t3)">Gross Canvassed: <b style="color:var(--blue)">₹${fmt(r.Inv_Ach||0)}</b></span>
        &nbsp;—&nbsp;
        <span style="color:var(--t3)">Closed Today: <b style="color:var(--red)">₹${fmt(r.Inv_Closing||0)}</b></span>
        &nbsp;=&nbsp;
        <span style="color:var(--t3)">Net: <b style="color:${achColor}">₹${fmt(r.netInvAch)}</b></span>
      </td>
    </tr>` : ""}`;
  }).join("");

  // Total row for investment
  const invTotalPc = progressColor(brPct);
  const invTotalRow = `<tr style="font-weight:700;background:var(--bg)">
    <td>TOTAL</td>
    <td class="td-mono">₹${fmt(totInvCom)}</td>
    <td class="td-mono" style="color:${totNetInvAch<0?"var(--red)":"var(--green)"}">₹${fmt(totNetInvAch)} <span class="badge badge-${invTotalPc}" style="font-size:10px">${brPct}%</span></td>
    <td class="td-mono" style="color:${totInvBal<0?"var(--red)":"var(--amber)"}">₹${fmt(totInvBal)}</td>
  </tr>`;

  // Build RD rows
  const rdTableRows = invRows.map((r,i) => {
    const rdBal     = (Number(r.RD_Amount_Com)||0) - r.netRdAmt;
    const rdBalColor = rdBal < 0 ? "var(--red)" : "var(--amber)";
    const rdAchColor = r.netRdAmt < 0 ? "var(--red)" : "var(--teal)";
    const did = `rd-${i}`;
    const hasDrill = r.EveningDone && (Number(r.RD_Amount_Ach)||0 + Number(r.RD_Mat_EMI)||0) > 0;
    const rdLabel = `₹${fmt(r.netRdAmt)} <span style="font-size:11px;color:var(--t3)">(${fmt(r.RD_Count_Ach||0)})</span>`;
    const rdComLabel = `₹${fmt(r.RD_Amount_Com||0)} <span style="font-size:11px;color:var(--t3)">(${fmt(r.RD_Count_Com||0)})</span>`;
    return `
    <tr>
      <td class="td-name">${r.FullName}</td>
      <td class="td-mono">${rdComLabel}</td>
      <td class="td-mono">
        <span style="color:${rdAchColor}">${rdLabel}</span>
        ${hasDrill ? `<button onclick="toggleDrill('${did}')" style="margin-left:6px;background:var(--teal-lt);color:var(--teal);border:none;border-radius:6px;padding:1px 7px;font-size:11px;cursor:pointer;font-weight:700">▾</button>` : ""}
      </td>
      <td class="td-mono" style="color:${rdBalColor}">₹${fmt(rdBal)}</td>
    </tr>
    ${hasDrill ? `<tr id="${drillId(did)}" style="display:none;background:var(--teal-lt)">
      <td colspan="4" style="padding:8px 14px;font-size:12px">
        <span style="color:var(--t3)">Gross RD Amt: <b style="color:var(--teal)">₹${fmt(r.RD_Amount_Ach||0)}</b></span>
        &nbsp;—&nbsp;
        <span style="color:var(--t3)">Maturity EMI: <b style="color:var(--red)">₹${fmt(r.RD_Mat_EMI||0)}</b></span>
        &nbsp;=&nbsp;
        <span style="color:var(--t3)">Net: <b style="color:${rdAchColor}">₹${fmt(r.netRdAmt)}</b></span>
        &nbsp;&nbsp;
        <span style="color:var(--t3)">Count: <b>${fmt(r.RD_Count_Ach||0)}</b></span>
      </td>
    </tr>` : ""}`;
  }).join("");

  const rdTotalRow = `<tr style="font-weight:700;background:var(--bg)">
    <td>TOTAL</td>
    <td class="td-mono">₹${fmt(totRdAmtCom)} <span style="font-size:11px;font-weight:400;color:var(--t3)">(${fmt(totRdCntCom)})</span></td>
    <td class="td-mono" style="color:${totNetRdAmt<0?"var(--red)":"var(--teal)"}">₹${fmt(totNetRdAmt)} <span style="font-size:11px;font-weight:400;color:var(--t3)">(${fmt(totRdCntAch)})</span></td>
    <td class="td-mono" style="color:${totRdAmtBal<0?"var(--red)":"var(--amber)"}">₹${fmt(totRdAmtBal)}</td>
  </tr>`;

  wrap.innerHTML = `
  <!-- Investment Section -->
  <div class="card" style="margin-bottom:12px">
    <div class="card-title"><span class="dot" style="background:var(--blue)"></span>💼 Investment</div>
    <div class="table-wrap"><table>
      <thead><tr>
        <th>Staff</th>
        <th>Commitment</th>
        <th>Net Achievement</th>
        <th>Balance</th>
      </tr></thead>
      <tbody>${invTableRows}${invTotalRow}</tbody>
    </table></div>
  </div>

  <!-- RD Section -->
  <div class="card">
    <div class="card-title"><span class="dot" style="background:var(--teal)"></span>🏦 Recurring Deposit</div>
    <div style="font-size:11px;color:var(--t3);margin-bottom:8px">Amount (Count) — Net = Canvassed − Maturity EMI</div>
    <div class="table-wrap"><table>
      <thead><tr>
        <th>Staff</th>
        <th>Commitment</th>
        <th>Net Achievement</th>
        <th>Balance</th>
      </tr></thead>
      <tbody>${rdTableRows}${rdTotalRow}</tbody>
    </table></div>
  </div>`;
}

function toggleDrill(id) {
  const el = document.getElementById("drill-" + id);
  if(!el) return;
  el.style.display = el.style.display === "none" ? "table-row" : "none";
}


// ── DAILY REPORT ──────────────────────────────────────────────
document.getElementById("btn-load-daily").addEventListener("click", async () => {
  const date = document.getElementById("daily-date").value;
  if(!date) return;
  const btn = document.getElementById("btn-load-daily");
  btn.disabled=true; btn.textContent="Loading…";
  const res = await api("dayReport", { date, branchName: R.branchName });
  btn.disabled=false; btn.textContent="Load";

  const el = document.getElementById("daily-result");
  if(!res.ok) { el.innerHTML = `<div class="alert alert-error"><span class="alert-icon">✕</span>${res.error}</div>`; return; }
  if(!res.rows?.length) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>No data for this date</p></div>'; return; }

  const remainingWD = res.remainingWD || 0;
  const activeRows  = res.rows.filter(r => !r.OnLeave);
  const leaveRows   = res.rows.filter(r =>  r.OnLeave);

  function drillBtn(id, color) {
    return `<button onclick="toggleDrill('${id}')" style="margin-left:5px;background:var(--${color}-lt);color:var(--${color});border:none;border-radius:5px;padding:1px 6px;font-size:11px;cursor:pointer;font-weight:700">▾</button>`;
  }

  let totInvCom=0, totRdAmtCom=0, totRdCntCom=0;
  let totMTDInvAch=0, totMTDRdAmtAch=0, totMTDRdCntAch=0;
  let totInvDRR=0, totRdDRR=0;
  let tableRows = "";

  activeRows.forEach((r, i) => {
    const invCom      = Number(r.Inv_Com)        || 0;
    const rdAmtCom    = Number(r.RD_Amount_Com)  || 0;
    const rdCntCom    = Number(r.RD_Count_Com)   || 0;
    const mtdInvAch   = Number(r.MTD_Inv_Ach)    || 0;
    const mtdRdAmtAch = Number(r.MTD_RD_Amt_Ach) || 0;
    const mtdRdCntAch = Number(r.MTD_RD_Cnt_Ach) || 0;
    const invDRR      = Number(r.Inv_DRR)        || 0;
    const rdDRR       = Number(r.RD_Amt_DRR)     || 0;

    totInvCom      += invCom;
    totRdAmtCom    += rdAmtCom;    totRdCntCom    += rdCntCom;
    totMTDInvAch   += mtdInvAch;
    totMTDRdAmtAch += mtdRdAmtAch; totMTDRdCntAch += mtdRdCntAch;
    totInvDRR      += invDRR;      totRdDRR       += rdDRR;

    const invAchColor = mtdInvAch   < 0 ? "var(--red)" : "var(--green)";
    const rdAchColor  = mtdRdAmtAch < 0 ? "var(--red)" : "var(--teal)";
    const statusBadge = !r.MorningDone
      ? `<span class="badge badge-grey"  style="font-size:10px">No Entry</span>`
      : !r.EveningDone
        ? `<span class="badge badge-amber" style="font-size:10px">Morning Only</span>`
        : `<span class="badge badge-green" style="font-size:10px">✓ Done</span>`;

    const did      = `daily-${i}`;
    const hasDrill = r.EveningDone &&
      ((Number(r.Inv_Ach)||0) + (Number(r.Inv_Closing)||0) +
       (Number(r.RD_Amount_Ach)||0) + (Number(r.RD_Mat_EMI)||0)) > 0;

    tableRows += `
    <tr>
      <td class="td-name">${r.FullName}<div style="margin-top:3px">${statusBadge}</div></td>
      <td class="td-mono">₹${fmt(invCom)}</td>
      <td class="td-mono" style="color:var(--amber)">${invDRR > 0 ? "₹"+fmt(invDRR) : `<span style="color:var(--t4)">—</span>`}</td>
      <td class="td-mono">
        <span style="color:${invAchColor}">₹${fmt(mtdInvAch)}</span>
        ${hasDrill ? drillBtn(did+"inv","blue") : ""}
      </td>
      <td class="td-mono">₹${fmt(rdAmtCom)} <span style="font-size:11px;color:var(--t3)">(${fmt(rdCntCom)})</span></td>
      <td class="td-mono">
        <span style="color:${rdAchColor}">₹${fmt(mtdRdAmtAch)}</span>
        <span style="font-size:11px;color:var(--t3)"> (${fmt(mtdRdCntAch)})</span>
        ${hasDrill ? drillBtn(did+"rd","teal") : ""}
      </td>
      <td class="td-mono" style="color:var(--amber)">${rdDRR > 0 ? "₹"+fmt(rdDRR) : `<span style="color:var(--t4)">—</span>`}</td>
    </tr>
    ${hasDrill ? `
    <tr id="drill-${did}inv" style="display:none;background:var(--blue-lt)">
      <td colspan="7" style="padding:7px 14px;font-size:12px;color:var(--t2)">
        <b style="color:var(--blue)">Today:</b>
        Gross&nbsp;<b>₹${fmt(r.Inv_Ach||0)}</b>
        &minus; Closed&nbsp;<b style="color:var(--red)">₹${fmt(r.Inv_Closing||0)}</b>
        = Net Today&nbsp;<b>₹${fmt((r.Inv_Ach||0)-(r.Inv_Closing||0))}</b>
        &emsp;<b style="color:var(--blue)">MTD:</b>
        Gross&nbsp;<b>₹${fmt(r.MTD_Inv_Gross||0)}</b>
        &minus; Closed&nbsp;<b style="color:var(--red)">₹${fmt(r.MTD_Inv_Closing||0)}</b>
        = Net MTD&nbsp;<b style="color:var(--green)">₹${fmt(mtdInvAch)}</b>
      </td>
    </tr>
    <tr id="drill-${did}rd" style="display:none;background:var(--teal-lt)">
      <td colspan="7" style="padding:7px 14px;font-size:12px;color:var(--t2)">
        <b style="color:var(--teal)">Today:</b>
        Gross&nbsp;<b>₹${fmt(r.RD_Amount_Ach||0)}</b>
        &minus; EMI&nbsp;<b style="color:var(--red)">₹${fmt(r.RD_Mat_EMI||0)}</b>
        = Net Today&nbsp;<b>₹${fmt((r.RD_Amount_Ach||0)-(r.RD_Mat_EMI||0))}</b>
        &emsp;<b style="color:var(--teal)">MTD:</b>
        Gross&nbsp;<b>₹${fmt(r.MTD_RD_Gross||0)}</b>
        &minus; EMI&nbsp;<b style="color:var(--red)">₹${fmt(r.MTD_RD_EMI||0)}</b>
        = Net MTD&nbsp;<b style="color:var(--teal)">₹${fmt(mtdRdAmtAch)}</b>
        &emsp;Count MTD:&nbsp;<b>${fmt(mtdRdCntAch)}</b>
      </td>
    </tr>` : ""}`;
  });

  const branchPct = totInvCom > 0 ? Math.round(totMTDInvAch / totInvCom * 100) : 0;
  tableRows += `
  <tr style="background:var(--bg);font-weight:700;border-top:2px solid var(--border)">
    <td>BRANCH TOTAL<div style="margin-top:3px"><span class="badge badge-${progressColor(branchPct)}" style="font-size:10px">${branchPct}% vs today's com</span></div></td>
    <td class="td-mono">₹${fmt(totInvCom)}</td>
    <td class="td-mono" style="color:var(--amber)">${totInvDRR > 0 ? "₹"+fmt(totInvDRR) : "—"}</td>
    <td class="td-mono" style="color:${totMTDInvAch<0?"var(--red)":"var(--green)"}">₹${fmt(totMTDInvAch)}</td>
    <td class="td-mono">₹${fmt(totRdAmtCom)} <span style="font-size:11px;font-weight:400;color:var(--t3)">(${fmt(totRdCntCom)})</span></td>
    <td class="td-mono" style="color:${totMTDRdAmtAch<0?"var(--red)":"var(--teal)"}">₹${fmt(totMTDRdAmtAch)} <span style="font-size:11px;font-weight:400;color:var(--t3)">(${fmt(totMTDRdCntAch)})</span></td>
    <td class="td-mono" style="color:var(--amber)">${totRdDRR > 0 ? "₹"+fmt(totRdDRR) : "—"}</td>
  </tr>`;

  const leaveHtml = leaveRows.length ? `
  <div class="card" style="margin-top:12px;padding:14px">
    <div class="card-title" style="margin-bottom:8px"><span class="dot" style="background:var(--amber)"></span>On Leave Today (${leaveRows.length})</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      ${leaveRows.map(r => `<span class="badge badge-amber">${r.FullName}</span>`).join("")}
    </div>
  </div>` : "";

  el.innerHTML = `
  <div class="date-chip">📅 ${displayDate(date)}</div>
  <div style="font-size:11px;color:var(--t3);margin-bottom:10px">
    📌 Net Ach = MTD cumulative gross &minus; MTD cumulative closed/matured &nbsp;|&nbsp;
    DRR = daily rate needed over ${remainingWD} remaining working day${remainingWD!==1?"s":""} to hit monthly target
  </div>
  <div class="table-wrap"><table>
    <thead><tr>
      <th>Employee</th>
      <th>Inv Com</th>
      <th style="color:var(--amber)">Inv DRR</th>
      <th>Net Inv Ach <span style="font-weight:400;font-size:10px">(MTD)</span></th>
      <th>RD Amt Com <span style="font-weight:400;font-size:10px">(Count)</span></th>
      <th>Net RD Amt <span style="font-weight:400;font-size:10px">MTD (Count)</span></th>
      <th style="color:var(--amber)">RD DRR <span style="font-weight:400;font-size:10px">(Amt)</span></th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
  </table></div>
  ${leaveHtml}`;
});

// ── MONTHLY SUMMARY ───────────────────────────────────────────
document.getElementById("btn-load-monthly").addEventListener("click", async () => {
  const month = document.getElementById("monthly-month").value;
  const year = document.getElementById("monthly-year").value;
  const btn = document.getElementById("btn-load-monthly");
  btn.disabled=true; btn.textContent="Loading…";
  const res = await api("monthlyReport", { branchName: R.branchName, year: Number(year), month: Number(month) });
  btn.disabled=false; btn.textContent="Load";

  const el = document.getElementById("monthly-result");
  if(!res.ok) { el.innerHTML = `<div class="alert alert-error"><span class="alert-icon">✕</span>${res.error}</div>`; return; }
  if(!res.rows?.length) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><p>No data for this month</p></div>'; return; }

  let totMInvTgt=0,totMInv=0,totMInvBal=0,totMRdCntTgt=0,totMRdCnt=0,totMRdCntBal=0,totMRdAmtTgt=0,totMRdAmt=0,totMRdAmtBal=0;
  res.rows.forEach(r=>{
    totMInvTgt+=Number(r.InvTarget)||0; totMInv+=Number(r.InvAch)||0; totMInvBal+=Number(r.InvBal)||0;
    totMRdCntTgt+=Number(r.RDCntTarget)||0; totMRdCnt+=Number(r.RDCountAch)||0; totMRdCntBal+=Number(r.RDCntBal)||0;
    totMRdAmtTgt+=Number(r.RDAmtTarget)||0; totMRdAmt+=Number(r.RDAmountAch)||0; totMRdAmtBal+=Number(r.RDAmtBal)||0;
  });
  const bPct = totMInvTgt>0?Math.round(totMInv/totMInvTgt*100):0;
  let html = `<div class="date-chip">📅 ${monthName(month)} ${year}</div>

  <div class="card" style="margin-bottom:14px">
    <div class="card-title"><span class="dot" style="background:var(--blue)"></span>Investment — Branch Total</div>
    <div class="tiles tiles-3">
      <div class="tile"><div class="tile-label">Target</div><div class="tile-value blue">₹${fmt(totMInvTgt)}</div></div>
      <div class="tile"><div class="tile-label">Achievement</div><div class="tile-value green">₹${fmt(totMInv)}</div></div>
      <div class="tile"><div class="tile-label">Balance</div><div class="tile-value amber">₹${fmt(totMInvBal)}</div></div>
    </div>
    <div class="progress-wrap"><div class="progress-bar ${progressColor(bPct)}" style="width:${Math.min(bPct,100)}%"></div></div>
    <div class="progress-label"><span>${bPct}% achieved</span></div>
    <div class="card-title" style="margin-top:14px"><span class="dot" style="background:var(--teal)"></span>RD Count — Branch Total</div>
    <div class="tiles tiles-3">
      <div class="tile"><div class="tile-label">Target</div><div class="tile-value" style="color:var(--teal)">${fmt(totMRdCntTgt)}</div></div>
      <div class="tile"><div class="tile-label">Achievement</div><div class="tile-value green">${fmt(totMRdCnt)}</div></div>
      <div class="tile"><div class="tile-label">Balance</div><div class="tile-value amber">${fmt(totMRdCntBal)}</div></div>
    </div>
    <div class="card-title" style="margin-top:14px"><span class="dot" style="background:var(--purple)"></span>RD Amount — Branch Total</div>
    <div class="tiles tiles-3">
      <div class="tile"><div class="tile-label">Target</div><div class="tile-value" style="color:var(--purple)">₹${fmt(totMRdAmtTgt)}</div></div>
      <div class="tile"><div class="tile-label">Achievement</div><div class="tile-value green">₹${fmt(totMRdAmt)}</div></div>
      <div class="tile"><div class="tile-label">Balance</div><div class="tile-value amber">₹${fmt(totMRdAmtBal)}</div></div>
    </div>
  </div>

  <div class="table-wrap"><table>
    <thead><tr>
      <th>Employee</th>
      <th>Inv Tgt</th><th>Net Inv Ach</th><th>Inv Bal</th><th>Inv DRR</th>
      <th>RD Cnt Tgt</th><th>RD Cnt Ach</th><th>RD Cnt Bal</th><th>RD Cnt DRR</th>
      <th>RD Amt Tgt</th><th>Net RD Amt</th><th>RD Amt Bal</th><th>RD Amt DRR</th>
      <th>Zero Days</th>
    </tr></thead><tbody>`;

  res.rows.forEach(r => {
    const p = r.InvTarget>0?Math.round((r.InvAch||0)/r.InvTarget*100):0;
    const pc = p>=90?"green":p>=60?"blue":p>=30?"amber":"red";
    const noTgt = r.InvTarget===0;
    // DRR for RD Count
    const rdCntDRR = (r.RDCntTarget||0)>0 && (r.RDCntBal||0)>0 ? Math.ceil((r.RDCntBal||0)/Math.max(1,r.RemainingWD||1)) : 0;
    // DRR for RD Amount — use same remainingWD as Inv DRR
    const rdAmtDRR = (r.RDAmtTarget||0)>0 && (r.RDAmtBal||0)>0 ? Math.ceil((r.RDAmtBal||0)/Math.max(1,r.RemainingWD||1)) : 0;
    const invBal = r.InvBal||0;
    const rdAmtBal = r.RDAmtBal||0;
    const invBalColor = invBal < 0 ? "color:var(--red)" : "color:var(--amber)";
    const rdAmtBalColor = rdAmtBal < 0 ? "color:var(--red)" : "color:var(--amber)";
    html += `<tr>
      <td class="td-name">${r.FullName}</td>
      <td class="td-mono">${noTgt?"<span style='color:var(--t4)'>—</span>":"₹"+fmt(r.InvTarget)}</td>
      <td class="td-mono" style="color:var(--green)">₹${fmt(r.InvAch||0)}</td>
      <td class="td-mono" style="${invBalColor}">₹${fmt(invBal)}</td>
      <td class="td-mono" style="color:var(--amber)">${noTgt?"—":"₹"+fmt(r.DRR)}</td>
      <td class="td-mono">${fmt(r.RDCntTarget||0)}</td>
      <td class="td-mono" style="color:var(--teal)">${fmt(r.RDCountAch||0)}</td>
      <td class="td-mono" style="color:var(--amber)">${fmt(r.RDCntBal||0)}</td>
      <td class="td-mono" style="color:var(--amber)">${r.RDCntTarget>0&&r.RDCntBal>0?fmt(r.RDCntDRR||0):"—"}</td>
      <td class="td-mono">₹${fmt(r.RDAmtTarget||0)}</td>
      <td class="td-mono" style="color:var(--teal)">₹${fmt(r.RDAmountAch||0)}</td>
      <td class="td-mono" style="${rdAmtBalColor}">₹${fmt(rdAmtBal)}</td>
      <td class="td-mono" style="color:var(--amber)">${r.RDAmtTarget>0&&rdAmtBal>0?"₹"+fmt(r.RDAmtDRR||0):"—"}</td>
      <td><span class="badge badge-${r.ZeroDays>3?"red":r.ZeroDays>0?"amber":"green"}">${r.ZeroDays??0}d</span></td>
    </tr>`;
  });
  html += "</tbody></table></div>";
  el.innerHTML = html;
});

// ── EMPLOYEE CARD ─────────────────────────────────────────────
document.getElementById("btn-load-emp").addEventListener("click", async () => {
  const empId = document.getElementById("emp-sel").value;
  const month = document.getElementById("emp-month").value;
  const year = document.getElementById("emp-year").value;
  if(!empId) return;
  const btn = document.getElementById("btn-load-emp");
  btn.disabled=true; btn.textContent="Loading…";
  const res = await api("empHistory", { empId, year: Number(year), month: Number(month) });
  btn.disabled=false; btn.textContent="Load";

  const el = document.getElementById("emp-result");
  if(!res.ok) { el.innerHTML = `<div class="alert alert-error"><span class="alert-icon">✕</span>${res.error}</div>`; return; }

  const emp = R.employees.find(e=>String(e.EmpID)===String(empId));
  const name = emp?.FullName || empId;
  const rows = res.rows || [];
  const totInvAch = rows.reduce((s,r)=>s+(Number(r.Inv_Ach)||0),0);
  const totRdAch = rows.reduce((s,r)=>s+(Number(r.RD_Count_Ach)||0),0);
  const activeDays = rows.filter(r=>r.Inv_Ach!==undefined&&r.Inv_Ach!==null).length;
  const zeroDays = rows.filter(r=>(Number(r.Inv_Ach)||0)===0 && r.Inv_Ach!==undefined).length;
  const initials = name.split(" ").map(w=>w[0]).join("").substring(0,2).toUpperCase();

  const empInvTarget = res.invMonthly || res.invTarget || 0;
  const empRdCntTarget = res.rdCntMonthly || 0;
  const empRdAmtTarget = res.rdAmtMonthly || 0;
  const pctVal = empInvTarget>0?Math.round(totInvAch/empInvTarget*100):0;

  let html = `
  <div class="card">
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
      <div class="emp-avatar" style="width:56px;height:56px;font-size:20px">${initials}</div>
      <div>
        <div style="font-size:18px;font-weight:700;color:var(--navy)">${name}</div>
        <div style="font-size:13px;color:var(--t3)">${emp?.Designation||""} · ${monthName(month)} ${year}</div>
      </div>
      <div class="health-grade ${gradeClass(pctVal)}" style="margin-left:auto">${gradeLabel(pctVal)}</div>
    </div>

    <!-- Investment -->
    <div class="card-title" style="margin-top:8px"><span class="dot" style="background:var(--blue)"></span>Investment</div>
    <div class="tiles tiles-3">
      <div class="tile"><div class="tile-label">Yearly Target</div><div class="tile-value blue">₹${fmt(res.invYearly||0)}</div></div>
      <div class="tile"><div class="tile-label">Monthly Target</div><div class="tile-value blue">₹${fmt(empInvTarget)}</div></div>
      <div class="tile"><div class="tile-label">Month Ach</div><div class="tile-value green">₹${fmt(res.invMonthAch||0)}</div></div>
    </div>
    <div class="tiles tiles-3">
      <div class="tile"><div class="tile-label">Month Balance</div><div class="tile-value amber">₹${fmt(res.invMonthBal||0)}</div></div>
      <div class="tile"><div class="tile-label">Yearly Ach</div><div class="tile-value green">₹${fmt(res.invYearAch||0)}</div></div>
      <div class="tile"><div class="tile-label">Yearly Balance</div><div class="tile-value amber">₹${fmt(res.invYearBal||0)}</div></div>
    </div>
    <div class="progress-wrap"><div class="progress-bar ${progressColor(pctVal)}" style="width:${Math.min(pctVal,100)}%"></div></div>
    <div class="progress-label" style="margin-top:4px"><span>${pctVal}% of monthly target</span><span>DRR: ₹${fmt(res.drr)}</span></div>

    <!-- RD Count -->
    <div class="card-title" style="margin-top:16px"><span class="dot" style="background:var(--teal)"></span>RD Count</div>
    <div class="tiles tiles-3">
      <div class="tile"><div class="tile-label">Yearly Target</div><div class="tile-value" style="color:var(--teal)">${fmt(res.rdCntYearly||0)}</div></div>
      <div class="tile"><div class="tile-label">Monthly Target</div><div class="tile-value" style="color:var(--teal)">${fmt(empRdCntTarget)}</div></div>
      <div class="tile"><div class="tile-label">Month Ach</div><div class="tile-value green">${fmt(res.rdCntMonthAch||0)}</div></div>
    </div>
    <div class="tiles tiles-3">
      <div class="tile"><div class="tile-label">Month Balance</div><div class="tile-value amber">${fmt(res.rdCntMonthBal||0)}</div></div>
      <div class="tile"><div class="tile-label">Yearly Ach</div><div class="tile-value green">${fmt(res.rdCntYearAch||0)}</div></div>
      <div class="tile"><div class="tile-label">Yearly Balance</div><div class="tile-value amber">${fmt(res.rdCntYearBal||0)}</div></div>
    </div>

    <!-- RD Amount -->
    <div class="card-title" style="margin-top:16px"><span class="dot" style="background:var(--purple)"></span>RD Amount</div>
    <div class="tiles tiles-3">
      <div class="tile"><div class="tile-label">Yearly Target</div><div class="tile-value" style="color:var(--purple)">₹${fmt(res.rdAmtYearly||0)}</div></div>
      <div class="tile"><div class="tile-label">Monthly Target</div><div class="tile-value" style="color:var(--purple)">₹${fmt(empRdAmtTarget)}</div></div>
      <div class="tile"><div class="tile-label">Month Ach</div><div class="tile-value green">₹${fmt(res.rdAmtMonthAch||0)}</div></div>
    </div>
    <div class="tiles tiles-3">
      <div class="tile"><div class="tile-label">Month Balance</div><div class="tile-value amber">₹${fmt(res.rdAmtMonthBal||0)}</div></div>
      <div class="tile"><div class="tile-label">Yearly Ach</div><div class="tile-value green">₹${fmt(res.rdAmtYearAch||0)}</div></div>
      <div class="tile"><div class="tile-label">Yearly Balance</div><div class="tile-value amber">₹${fmt(res.rdAmtYearBal||0)}</div></div>
    </div>

    <div style="margin-top:16px">
      <div class="perf-metric"><span class="perf-label">Working Days with Entry</span><span class="perf-val">${activeDays}</span></div>
      <div class="perf-metric"><span class="perf-label">Zero Achievement Days</span><span class="perf-val" style="color:var(--${zeroDays>3?"red":"t1"})">${zeroDays}</span></div>
      <div class="perf-metric"><span class="perf-label">Inv Closing Count (Month)</span><span class="perf-val">${fmt(res.invMonthClosing||0)}</span></div>
    </div>
  </div>`;

  if(rows.length) {
    html += `<div class="card"><div class="card-title"><span class="dot" style="background:var(--blue)"></span>Daily Log</div>
    <div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Inv Com</th><th>Inv Ach</th><th>RD Count</th><th>RD Amount</th></tr></thead><tbody>`;
    rows.forEach(r => {
      const p = r.Inv_Com>0?Math.round((r.Inv_Ach||0)/r.Inv_Com*100):0;
      const pc = p>=100?"green":p>=60?"blue":"amber";
      html += `<tr>
        <td>${displayDate(r.Date)}</td>
        <td class="td-mono">₹${fmt(r.Inv_Com)}</td>
        <td class="td-mono"><span style="color:var(--${pc})">₹${fmt(r.Inv_Ach)}</span></td>
        <td class="td-mono">${fmt(r.RD_Count_Ach)}</td>
        <td class="td-mono">₹${fmt(r.RD_Amount_Ach)}</td>
      </tr>`;
    });
    html += "</tbody></table></div></div>";
  }

  el.innerHTML = html;
});

// ── BRANCH VS TARGET ──────────────────────────────────────────
document.getElementById("btn-load-tgt").addEventListener("click", async () => {
  const month = document.getElementById("tgt-month").value;
  const year = document.getElementById("tgt-year").value;
  const btn = document.getElementById("btn-load-tgt");
  btn.disabled=true; btn.textContent="Loading…";
  const y = Number(year);
  const m2 = Number(month);
  const dynFY = m2 >= 4 ? `${y}-${String(y+1).slice(-2)}` : `${y-1}-${String(y).slice(-2)}`;
  const res = await api("getBranchTargetSummary", { branchName: R.branchName, FY: dynFY, year: y, month: m2 });
  btn.disabled=false; btn.textContent="Load";

  const el = document.getElementById("tgt-result");
  if(!res.ok) { el.innerHTML = `<div class="alert alert-error"><span class="alert-icon">✕</span>${res.error||"Error loading targets"}</div>`; return; }

  const rows = res.rows || [];
  if(!rows.length) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">🎯</div><p>No target data available. Contact admin to set targets.</p></div>'; return; }

  let totInvTgt=0,totInvAch=0,totInvBal=0,totRdCntTgt=0,totRdCntAch=0,totRdCntBal=0,totRdAmtTgt=0,totRdAmtAch=0,totRdAmtBal=0;
  rows.forEach(r=>{
    totInvTgt+=Number(r.InvTarget)||0; totInvAch+=Number(r.InvAch)||0; totInvBal+=Number(r.InvBal)||0;
    totRdCntTgt+=Number(r.RDCntTarget)||0; totRdCntAch+=Number(r.RDCountAch)||0; totRdCntBal+=Number(r.RDCntBal)||0;
    totRdAmtTgt+=Number(r.RDAmtTarget)||0; totRdAmtAch+=Number(r.RDAmountAch)||0; totRdAmtBal+=Number(r.RDAmtBal)||0;
  });
  const branchPct = totInvTgt>0?Math.round(totInvAch/totInvTgt*100):0;
  const noTargets = totInvTgt===0 && totRdCntTgt===0 && totRdAmtTgt===0;

  let html = `
  <div class="card">
    <div class="card-title"><span class="dot" style="background:var(--teal)"></span>Branch Total — ${monthName(m2)} ${y}</div>
    ${noTargets ? '<div class="alert alert-info"><span class="alert-icon">ℹ️</span>Targets not set. Contact admin to set targets for this FY.</div>' : `
    <div class="card-title" style="margin-top:4px"><span class="dot" style="background:var(--blue)"></span>Investment</div>
    <div class="tiles tiles-3">
      <div class="tile"><div class="tile-label">Monthly Target</div><div class="tile-value blue">₹${fmt(totInvTgt)}</div></div>
      <div class="tile"><div class="tile-label">Achievement</div><div class="tile-value green">₹${fmt(totInvAch)}</div></div>
      <div class="tile"><div class="tile-label">Balance</div><div class="tile-value amber">₹${fmt(totInvBal)}</div></div>
    </div>
    <div class="progress-wrap"><div class="progress-bar ${progressColor(branchPct)}" style="width:${Math.min(branchPct,100)}%"></div></div>
    <div class="progress-label"><span>${branchPct}% achieved</span><span>₹${fmt(totInvBal)} remaining</span></div>
    <div class="card-title" style="margin-top:14px"><span class="dot" style="background:var(--teal)"></span>RD Count</div>
    <div class="tiles tiles-3">
      <div class="tile"><div class="tile-label">Monthly Target</div><div class="tile-value" style="color:var(--teal)">${fmt(totRdCntTgt)}</div></div>
      <div class="tile"><div class="tile-label">Achievement</div><div class="tile-value green">${fmt(totRdCntAch)}</div></div>
      <div class="tile"><div class="tile-label">Balance</div><div class="tile-value amber">${fmt(totRdCntBal)}</div></div>
    </div>
    <div class="card-title" style="margin-top:14px"><span class="dot" style="background:var(--purple)"></span>RD Amount</div>
    <div class="tiles tiles-3">
      <div class="tile"><div class="tile-label">Monthly Target</div><div class="tile-value" style="color:var(--purple)">₹${fmt(totRdAmtTgt)}</div></div>
      <div class="tile"><div class="tile-label">Achievement</div><div class="tile-value green">₹${fmt(totRdAmtAch)}</div></div>
      <div class="tile"><div class="tile-label">Balance</div><div class="tile-value amber">₹${fmt(totRdAmtBal)}</div></div>
    </div>`}
  </div>

  <div class="table-wrap"><table>
    <thead><tr>
      <th>Employee</th>
      <th>Inv Tgt</th><th>Inv Ach</th><th>Inv Bal</th>
      <th>RD Cnt Tgt</th><th>RD Cnt Ach</th><th>RD Cnt Bal</th>
      <th>RD Amt Tgt</th><th>RD Amt Ach</th><th>RD Amt Bal</th>
      <th>DRR</th>
    </tr></thead><tbody>`;

  rows.forEach(r => {
    const invTgt = Number(r.InvTarget)||0;
    const p = invTgt>0?Math.round((Number(r.InvAch)||0)/invTgt*100):0;
    const pc = progressColor(p);
    html += `<tr>
      <td class="td-name">${r.FullName||r.name}</td>
      <td class="td-mono">${invTgt>0?"₹"+fmt(invTgt):"<span style='color:var(--t4)'>—</span>"}</td>
      <td class="td-mono" style="color:var(--green)">₹${fmt(r.InvAch||0)}</td>
      <td class="td-mono" style="color:var(--amber)">₹${fmt(r.InvBal||0)}</td>
      <td class="td-mono">${fmt(r.RDCntTarget||0)}</td>
      <td class="td-mono" style="color:var(--teal)">${fmt(r.RDCountAch||0)}</td>
      <td class="td-mono" style="color:var(--amber)">${fmt(r.RDCntBal||0)}</td>
      <td class="td-mono">₹${fmt(r.RDAmtTarget||0)}</td>
      <td class="td-mono" style="color:var(--teal)">₹${fmt(r.RDAmountAch||0)}</td>
      <td class="td-mono" style="color:var(--amber)">₹${fmt(r.RDAmtBal||0)}</td>
      <td class="td-mono" style="color:var(--amber)">${invTgt>0?"₹"+fmt(r.DRR):"—"}</td>
    </tr>`;
  });
  html += "</tbody></table></div>";
  el.innerHTML = html;
});

// ── LEAVE CALENDAR ────────────────────────────────────────────
document.getElementById("btn-load-leave").addEventListener("click", async () => {
  const month = Number(document.getElementById("leave-month").value);
  const year = Number(document.getElementById("leave-year").value);
  const btn = document.getElementById("btn-load-leave");
  btn.disabled=true; btn.textContent="Loading…";
  const res = await api("leaveReport", { branchName: R.branchName, year, month });
  btn.disabled=false; btn.textContent="Load";

  const el = document.getElementById("leave-result");
  if(!res.ok) { el.innerHTML = `<div class="alert alert-error"><span class="alert-icon">✕</span>${res.error}</div>`; return; }

  const rows = res.rows || [];
  const daysInMonth = new Date(year, month, 0).getDate();
  const leaveTypeClass = { CL:"leave-cl", SL:"leave-sl", LWP:"leave-lwp", HD:"leave-hd", WFH:"leave-wfh" };

  // Build per-employee per-day leave map
  const leaveMap = {};
  rows.forEach(r => {
    const day = new Date(r.Date).getDate();
    if(!leaveMap[r.EmpID]) leaveMap[r.EmpID] = {};
    leaveMap[r.EmpID][day] = r.LeaveType;
  });

  const isSunday = (d) => new Date(year, month-1, d).getDay() === 0;

  // Header
  let html = `<div class="card" style="overflow-x:auto">
    <div class="leave-calendar">
      <div class="cal-header">
        <div class="cal-header-cell" style="text-align:left">Employee</div>
        ${Array.from({length:daysInMonth},(_,i)=>{
          const d = i+1;
          return `<div class="cal-header-cell" style="${isSunday(d)?"opacity:.4":""}">${d}</div>`;
        }).join("")}
      </div>`;

  R.employees.forEach(emp => {
    const leaves = leaveMap[emp.EmpID] || {};
    html += `<div class="cal-row">
      <div class="cal-name">${emp.FullName}</div>
      ${Array.from({length:daysInMonth},(_,i)=>{
        const d = i+1;
        const lt = leaves[d];
        const cls = isSunday(d)?"sun":(lt?leaveTypeClass[lt]||"leave-cl":"empty");
        return `<div class="cal-cell ${cls}">${lt||""}</div>`;
      }).join("")}
    </div>`;
  });

  html += `</div></div>`;

  // Summary table
  const empTotals = {};
  rows.forEach(r => {
    if(!empTotals[r.EmpID]) empTotals[r.EmpID] = { name: R.employees.find(e=>e.EmpID===r.EmpID)?.FullName||r.EmpID, CL:0, SL:0, LWP:0, HD:0, WFH:0, total:0 };
    empTotals[r.EmpID][r.LeaveType] = (empTotals[r.EmpID][r.LeaveType]||0)+1;
    empTotals[r.EmpID].total++;
  });

  if(Object.keys(empTotals).length) {
    html += `<div class="table-wrap" style="margin-top:14px"><table>
      <thead><tr><th>Employee</th><th>CL</th><th>SL</th><th>LWP</th><th>HD</th><th>WFH</th><th>Total</th></tr></thead><tbody>`;
    Object.values(empTotals).sort((a,b)=>b.total-a.total).forEach(e => {
      html += `<tr>
        <td class="td-name">${e.name}</td>
        <td class="td-mono">${e.CL||0}</td><td class="td-mono">${e.SL||0}</td>
        <td class="td-mono">${e.LWP||0}</td><td class="td-mono">${e.HD||0}</td>
        <td class="td-mono">${e.WFH||0}</td>
        <td><span class="badge badge-${e.total>5?"red":e.total>2?"amber":"green"}">${e.total}d</span></td>
      </tr>`;
    });
    html += "</tbody></table></div>";
  }

  el.innerHTML = html;
});

// ── DOWNLOAD ─────────────────────────────────────────────────
document.getElementById("btn-dl-load").addEventListener("click", async () => {
  const fy   = document.getElementById("dl-fy").value;
  const type = document.getElementById("dl-type").value;
  const btn  = document.getElementById("btn-dl-load");
  btn.disabled=true; btn.textContent="Loading…";
  const res = await api("downloadReport", { branchName: R.branchName, FY: fy, type });
  btn.disabled=false; btn.textContent="Load";

  const el = document.getElementById("dl-result");
  if(!res.ok){ el.innerHTML=`<div class="alert alert-error"><span class="alert-icon">✕</span>${res.error||"Error"}</div>`; return; }
  if(!res.rows?.length){ el.innerHTML='<div class="empty-state"><div class="empty-icon">📊</div><p>No data</p></div>'; return; }

  const months = res.fyMonthDefs.map(d=>d.label);
  const isInv  = type === "investment";

  // Build table
  let csvRows = [];
  let hdr, csvHdr;
  if (isInv) {
    hdr = `<tr><th>Employee</th>${months.map(m=>`<th>${m} Target</th><th>${m} Ach</th><th>${m} Close</th>`).join("")}<th>Total Ach</th><th>Total Close</th></tr>`;
    csvHdr = ["Employee","Branch",...months.flatMap(m=>[m+" Target",m+" Ach",m+" Close"]),"Total Ach","Total Close"];
  } else {
    hdr = `<tr><th>Employee</th>${months.map(m=>`<th>${m} CntTgt</th><th>${m} CntAch</th><th>${m} AmtTgt</th><th>${m} AmtAch</th>`).join("")}<th>Tot Cnt</th><th>Tot Amt</th></tr>`;
    csvHdr = ["Employee","Branch",...months.flatMap(m=>[m+" CntTgt",m+" CntAch",m+" AmtTgt",m+" AmtAch"]),"Total Cnt","Total Amt"];
  }
  csvRows.push(csvHdr);

  let tableRows = "";
  res.rows.forEach(r => {
    let totAch=0, totClose=0, totCnt=0, totAmt=0;
    let cells = "";
    let csvCells = [r.FullName, r.BranchName];
    r.months.forEach(m => {
      if (isInv) {
        totAch   += m.invAch||0; totClose += m.invClosing||0;
        cells    += `<td class="td-mono">${fmt(m.invTarget)}</td><td class="td-mono" style="color:var(--green)">${fmt(m.invAch)}</td><td class="td-mono">${fmt(m.invClosing)}</td>`;
        csvCells.push(m.invTarget||0, m.invAch||0, m.invClosing||0);
      } else {
        totCnt += m.rdCntAch||0; totAmt += m.rdAmtAch||0;
        cells  += `<td class="td-mono">${fmt(m.rdCntTarget)}</td><td class="td-mono" style="color:var(--teal)">${fmt(m.rdCntAch)}</td><td class="td-mono">${fmt(m.rdAmtTarget)}</td><td class="td-mono" style="color:var(--teal)">₹${fmt(m.rdAmtAch)}</td>`;
        csvCells.push(m.rdCntTarget||0,m.rdCntAch||0,m.rdAmtTarget||0,m.rdAmtAch||0);
      }
    });
    if (isInv) {
      cells += `<td class="td-mono" style="font-weight:700;color:var(--green)">₹${fmt(totAch)}</td><td class="td-mono">${fmt(totClose)}</td>`;
      csvCells.push(totAch, totClose);
    } else {
      cells += `<td class="td-mono" style="font-weight:700;color:var(--teal)">${fmt(totCnt)}</td><td class="td-mono">₹${fmt(totAmt)}</td>`;
      csvCells.push(totCnt, totAmt);
    }
    tableRows += `<tr><td class="td-name">${r.FullName}</td>${cells}</tr>`;
    csvRows.push(csvCells);
  });

  const csvContent = csvRows.map(r=>r.join(",")).join("\n");
  const blob = new Blob([csvContent], {type:"text/csv"});
  const url  = URL.createObjectURL(blob);
  const fname = `IndividualTrack_${type}_${fy}_${R.branchName}.csv`;

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <span class="date-chip">📊 ${isInv?"Investment":"RD"} — FY ${fy} — ${R.branchName}</span>
      <a href="${url}" download="${fname}" class="btn btn-teal btn-sm" style="text-decoration:none">⬇️ Download CSV</a>
    </div>
    <div class="table-wrap" style="overflow-x:auto"><table>
      <thead>${hdr}</thead><tbody>${tableRows}</tbody>
    </table></div>`;
});

// ── LOGOUT ────────────────────────────────────────────────────
document.getElementById("btn-logout").addEventListener("click", () => {
  R = { branchName: null, employees: [] };
  document.getElementById("inp-report-pwd").value = "";
  showScreen("login");
});

init();