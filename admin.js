const API = "https://script.google.com/macros/s/AKfycbz157zrRuJtbov5IbwdvCiCcuIB_jycObURZ7KQDbbLBfMDiiKhCVMZN1-tAJjYgAx2/exec";
let A = { pwd: null, branches: [], employees: [] };

// ── API ──────────────────────────────────────────────────────
async function api(action, params={}) {
  try {
    const res = await fetch(API, { method:"POST", body: JSON.stringify({ action, adminPassword: A.pwd, ...params }) });
    return await res.json();
  } catch(e) { return { ok:false, error:"NETWORK_ERROR" }; }
}

// ── HELPERS ──────────────────────────────────────────────────
function fmt(n) {
  if(n===null||n===undefined||n==="") return "–";
  const num = Number(n); if(isNaN(num)) return "–";
  return num.toLocaleString("en-IN");
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function displayDate(iso) {
  if(!iso) return "";
  const [y,m,d] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const dt = new Date(y,m-1,d);
  return `${d} ${months[m-1]} ${y}`;
}
function monthName(m) { return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Number(m)-1]||""; }
function progressColor(p) { const n=parseInt(p); return n>=90?"green":n>=60?"":n>=30?"amber":"red"; }
function showPanel(id) {
  document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));
  document.querySelectorAll(".sidebar-btn").forEach(b=>b.classList.remove("active"));
  document.getElementById("panel-"+id)?.classList.add("active");
  document.querySelector(`[data-panel="${id}"]`)?.classList.add("active");
  if(window.innerWidth <= 768) document.getElementById("sidebar").classList.remove("open");
  if(id === "holidays") loadHolidays();
  if(id === "r-monitor") {
    document.getElementById("monitor-date").value = todayISO();
  }
}
function openModal(id) { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }
function populateMonthYear(mSel, ySel) {
  const months = [{n:4,l:"April"},{n:5,l:"May"},{n:6,l:"June"},{n:7,l:"July"},{n:8,l:"August"},{n:9,l:"September"},{n:10,l:"October"},{n:11,l:"November"},{n:12,l:"December"},{n:1,l:"January"},{n:2,l:"February"},{n:3,l:"March"}];
  months.forEach(m=>{ const o=document.createElement("option"); o.value=m.n; o.textContent=m.l; mSel.appendChild(o); });
  const today = new Date(); mSel.value = today.getMonth()+1;
  for(let y=2026;y<=2030;y++){ const o=document.createElement("option"); o.value=y; o.textContent=y; ySel.appendChild(o); }
  ySel.value = today.getFullYear();
}
function populateBranchSelects(...selIds) {
  selIds.forEach(id => {
    const sel = document.getElementById(id); if(!sel) return;
    const cur = sel.value;
    while(sel.options.length > 1) sel.remove(1);
    A.branches.forEach(b => {
      const o=document.createElement("option"); o.value=b.BranchName||b.branchName; o.textContent=b.BranchName||b.branchName; sel.appendChild(o);
    });
    if(cur) sel.value = cur;
  });
}
function populateEmpSelect(selId) {
  const sel = document.getElementById(selId); if(!sel) return;
  sel.innerHTML = '<option value="">— Select Employee —</option>';
  A.employees.forEach(e => {
    const o=document.createElement("option"); o.value=e.EmpID; o.textContent=`${e.FullName} (${e.BranchID||e.branchName||""})`;
    sel.appendChild(o);
  });
}
function setBtn(id, loading, text) {
  const b=document.getElementById(id); if(!b) return;
  if(loading){b.disabled=true;b.innerHTML=`<div class="spinner"></div> ${text||"Loading…"}`;}
  else{b.disabled=false;b.innerHTML=text||b.textContent;}
}
function showAlert(id,type,msg){const e=document.getElementById(id);if(!e)return;e.className=`alert alert-${type}`;e.innerHTML=`<span>${type==="success"?"✓":"✕"}</span><span>${msg}</span>`;e.style.display="flex";}
function hideAlert(id){const e=document.getElementById(id);if(e)e.style.display="none";}
function empty(msg){return `<div style="text-align:center;padding:40px;color:var(--t4)"><div style="font-size:40px;margin-bottom:12px">📭</div><p style="font-size:14px">${msg||"No data found"}</p></div>`;}

// ── LOGIN ────────────────────────────────────────────────────
document.getElementById("btn-admin-login").addEventListener("click", async () => {
  const pwd = document.getElementById("inp-admin-pwd").value.trim();
  if(!pwd){ showErr("Please enter the admin password."); return; }
  const btn = document.getElementById("btn-admin-login");
  btn.disabled=true; btn.innerHTML='<div class="spinner"></div> Verifying…';
  const res = await fetch(API,{method:"POST",body:JSON.stringify({action:"adminLogin",password:pwd})}).then(r=>r.json()).catch(()=>({ok:false}));
  btn.disabled=false; btn.innerHTML='<span>Access Admin Panel</span>';
  if(!res.ok){ showErr(res.error==="WRONG_PASSWORD"?"Incorrect admin password.":"Error: "+(res.error||"Unknown")); return; }
  A.pwd = pwd;
  document.getElementById("screen-login").classList.remove("active");
  document.getElementById("app").classList.add("active");
  await loadAdminData();
});
function showErr(msg){const e=document.getElementById("login-err");document.getElementById("login-err-msg").textContent=msg;e.style.display="flex";}
document.getElementById("inp-admin-pwd").addEventListener("keydown",e=>{if(e.key==="Enter")document.getElementById("btn-admin-login").click();});

// ── LOAD ADMIN DATA ──────────────────────────────────────────
async function loadAdminData() {
  const [brRes, empRes] = await Promise.all([
    api("getBranches"),
    api("getEmployees", { status: "" }),
  ]);
  if(brRes.ok) A.branches = brRes.branches || [];
  if(empRes.ok) A.employees = empRes.employees || [];

  populateBranchSelects("emp-filter-branch","ae-branch","tgt-branch-filter","tgt-sum-branch","rdaily-branch","rmon-branch","ryear-branch","rlb-branch","rdis-branch","audit-branch","adl-branch","ano-branch");

  // Populate month/year selects
  [["rmon-month","rmon-year"],["rlb-month","rlb-year"],["rdis-month","rdis-year"],["rsum-month","rsum-year"],["ano-month","ano-year"]].forEach(([m,y])=>{
    populateMonthYear(document.getElementById(m),document.getElementById(y));
  });

  // Populate search year select
  const searchYearSel = document.getElementById("search-emp-year");
  if(searchYearSel) {
    searchYearSel.innerHTML = "";
    const curYear = new Date().getFullYear();
    for(let y = curYear; y >= 2024; y--) {
      const o = document.createElement("option"); o.value = y; o.textContent = y; searchYearSel.appendChild(o);
    }
  }

  // Populate employee datalist for search
  const dl = document.getElementById("search-emp-datalist");
  if(dl) {
    dl.innerHTML = "";
    A.employees.forEach(e => {
      const o = document.createElement("option");
      o.value = e.FullName;
      o.setAttribute("data-empid", e.EmpID);
      dl.appendChild(o);
      // Also add by EmpID
      const o2 = document.createElement("option");
      o2.value = e.EmpID;
      dl.appendChild(o2);
    });
  }

  // Default dates
  document.getElementById("rdaily-date").value = todayISO();
  // Default audit range: last 30 days
  const auditTo = new Date();
  const auditFrom = new Date(); auditFrom.setDate(auditFrom.getDate() - 30);
  const fmt2 = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  document.getElementById("audit-from").value = fmt2(auditFrom);
  document.getElementById("audit-to").value = fmt2(auditTo);

  // Populate target employee selects
  populateEmpSelect("tgt-emp-sel");

  loadEmployees();
  loadBranches();
}

// ── SIDEBAR NAV ──────────────────────────────────────────────
// ── HOLIDAYS ──────────────────────────────────────────────────
async function loadHolidays() {
  const list = document.getElementById("holidays-list");
  if(!list) return;
  list.innerHTML = "<div style='padding:16px;text-align:center;color:var(--t4)'>Loading…</div>";
  const now = new Date();
  const res = await api("getHolidays", { year: now.getFullYear() });
  if(!res.ok || !res.holidays?.length) {
    list.innerHTML = "<p style='padding:16px;color:var(--t4);text-align:center'>No holidays set for this year.</p>";
    return;
  }
  const names = res.names || {};
  list.innerHTML = `<table style="width:100%;border-collapse:collapse">
    <thead><tr style="background:var(--bg)">
      <th style="padding:10px;text-align:left;font-size:12px;color:var(--t3)">DATE</th>
      <th style="padding:10px;text-align:left;font-size:12px;color:var(--t3)">HOLIDAY NAME</th>
      <th style="padding:10px;text-align:right;font-size:12px;color:var(--t3)">ACTION</th>
    </tr></thead>
    <tbody>${res.holidays.map(d=>`
      <tr style="border-top:1px solid var(--border)">
        <td style="padding:10px;font-family:'DM Mono',monospace;font-size:13px">${d}</td>
        <td style="padding:10px;font-size:14px;color:var(--t1)">${names[d]||"Holiday"}</td>
        <td style="padding:10px;text-align:right">
          <button class="btn btn-grey btn-sm btn-del-holiday" data-date="${d}" style="color:var(--red)">Delete</button>
        </td>
      </tr>`).join("")}
    </tbody></table>`;
  list.querySelectorAll(".btn-del-holiday").forEach(btn=>{
    btn.addEventListener("click", async()=>{
      if(!confirm(`Delete holiday on ${btn.dataset.date}?`)) return;
      const r = await api("deleteHoliday",{adminPassword:A.pwd,date:btn.dataset.date});
      if(r.ok) loadHolidays();
      else alert("Error: "+r.error);
    });
  });
}
document.getElementById("btn-add-holiday")?.addEventListener("click", async()=>{
  const date = document.getElementById("hl-date").value;
  const name = (document.getElementById("hl-name").value||"").trim();
  const alert_el = document.getElementById("hl-alert");
  alert_el.style.display="none";
  if(!date){alert_el.className="alert alert-error";alert_el.innerHTML="<span>Pick a date.</span>";alert_el.style.display="flex";return;}
  const r = await api("setHoliday",{adminPassword:A.pwd,date,name:name||"Holiday"});
  if(r.ok) { document.getElementById("hl-date").value=""; document.getElementById("hl-name").value=""; loadHolidays(); }
  else { alert_el.className="alert alert-error";alert_el.innerHTML=`<span>${r.error==="DUPLICATE_HOLIDAY"?"That date is already a holiday.":"Error: "+r.error}</span>`;alert_el.style.display="flex"; }
});

document.querySelectorAll(".sidebar-btn").forEach(btn => {
  btn.addEventListener("click", () => showPanel(btn.dataset.panel));
});
document.getElementById("menu-toggle").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

// ── EMPLOYEES ────────────────────────────────────────────────
async function loadEmployees() {
  const branch = document.getElementById("emp-filter-branch").value;
  const status = document.getElementById("emp-filter-status").value;
  const res = await api("getEmployees", { branchName: branch||undefined, status: status||undefined });
  const el = document.getElementById("emp-list");
  if(!res.ok){ el.innerHTML=`<div class="alert alert-error"><span>✕</span>${res.error}</div>`; return; }
  const emps = res.employees || [];
  if(!emps.length){ el.innerHTML=empty("No employees found"); return; }

  el.innerHTML = emps.map(e => {
    const initials = e.FullName.split(" ").map(w=>w[0]).join("").substring(0,2).toUpperCase();
    const statusBadge = {ACTIVE:"badge-green",ON_LEAVE:"badge-amber",RESIGNED:"badge-red",INACTIVE:"badge-grey"}[e.Status]||"badge-grey";
    return `<div class="emp-row">
      <div class="emp-avatar ${e.Role==="BRANCH_HEAD"?"bh":""}">${initials}</div>
      <div style="flex:1">
        <div style="font-weight:600;color:var(--t1)">${e.FullName} <span style="font-size:11px;color:var(--t4)">${e.EmpID}</span></div>
        <div style="font-size:12px;color:var(--t3)">${e.BranchID||e.BranchName||""} · ${e.Designation||""} · ${e.Role==="BRANCH_HEAD"?"Branch Head":"Employee"}</div>
      </div>
      <span class="badge ${statusBadge}">${e.Status}</span>
      <button class="btn-xs btn-grey" onclick="openStatusModal('${e.EmpID}','${e.FullName}','${e.Status}')">Status</button>
      <button class="btn-xs btn-grey" onclick="openEditEmp('${e.EmpID}')">Edit</button>
    </div>`;
  }).join("");
}

document.getElementById("btn-load-emps").addEventListener("click", loadEmployees);

// Add Employee
document.getElementById("btn-add-emp").addEventListener("click", () => {
  document.getElementById("modal-emp-title").textContent = "Add Employee";
  document.getElementById("edit-emp-id").value = "";
  ["ae-empid","ae-name","ae-designation","ae-phone","ae-notes"].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=""; });
  document.getElementById("ae-role").value = "EMPLOYEE";
  document.getElementById("ae-joindate").value = todayISO();
  hideAlert("ae-alert");
  openModal("modal-add-emp");
});
document.getElementById("btn-ae-cancel").addEventListener("click", () => closeModal("modal-add-emp"));
document.getElementById("btn-ae-save").addEventListener("click", async () => {
  const editId = document.getElementById("edit-emp-id").value;
  const empId = document.getElementById("ae-empid").value.trim();
  const name = document.getElementById("ae-name").value.trim();
  const branch = document.getElementById("ae-branch").value;
  const role = document.getElementById("ae-role").value;
  const joinDate = document.getElementById("ae-joindate").value;
  if(!empId||!name||!branch||!joinDate){ showAlert("ae-alert","error","Please fill all required fields."); return; }

  setBtn("btn-ae-save",true,"Saving…");
  let res;
  if(editId) {
    res = await api("updateEmployee",{ EmpID:editId, updates:{FullName:name,Designation:document.getElementById("ae-designation").value,Phone:document.getElementById("ae-phone").value,Notes:document.getElementById("ae-notes").value}});
  } else {
    res = await api("addEmployee",{ emp:{EmpID:empId,FullName:name,BranchName:branch,Designation:document.getElementById("ae-designation").value,Role:role,JoinDate:joinDate,Phone:document.getElementById("ae-phone").value,Notes:document.getElementById("ae-notes").value}});
  }
  setBtn("btn-ae-save",false,"Save Employee");
  if(!res.ok){ showAlert("ae-alert","error",res.error||"Error saving employee."); return; }
  closeModal("modal-add-emp");
  await loadAdminData();
});

function openEditEmp(empId) {
  const emp = A.employees.find(e=>e.EmpID===empId); if(!emp) return;
  document.getElementById("modal-emp-title").textContent = "Edit Employee";
  document.getElementById("edit-emp-id").value = empId;
  document.getElementById("ae-empid").value = empId;
  document.getElementById("ae-name").value = emp.FullName;
  document.getElementById("ae-designation").value = emp.Designation||"";
  document.getElementById("ae-phone").value = emp.Phone||"";
  document.getElementById("ae-notes").value = emp.Notes||"";
  document.getElementById("ae-branch").value = emp.BranchID||emp.BranchName||"";
  document.getElementById("ae-role").value = emp.Role;
  document.getElementById("ae-joindate").value = emp.JoinDate||"";
  hideAlert("ae-alert");
  openModal("modal-add-emp");
}

// Status Modal
function openStatusModal(empId, name, currentStatus) {
  document.getElementById("modal-status-title").textContent = `Update Status — ${name}`;
  document.getElementById("modal-status-sub").textContent = `Current status: ${currentStatus}`;
  document.getElementById("status-empid").value = empId;
  document.getElementById("status-sel").value = currentStatus;
  document.getElementById("resign-date-wrap").style.display = currentStatus==="RESIGNED"?"block":"none";
  hideAlert("status-alert");
  openModal("modal-status");
}
document.getElementById("status-sel").addEventListener("change", function() {
  document.getElementById("resign-date-wrap").style.display = this.value==="RESIGNED"?"block":"none";
});
document.getElementById("btn-status-cancel").addEventListener("click", ()=>closeModal("modal-status"));
document.getElementById("btn-status-save").addEventListener("click", async () => {
  const empId = document.getElementById("status-empid").value;
  const status = document.getElementById("status-sel").value;
  const resignDate = document.getElementById("resign-date").value;
  if(status==="RESIGNED"&&!resignDate){ showAlert("status-alert","error","Please enter resignation date."); return; }
  setBtn("btn-status-save",true,"Updating…");
  const res = await api("updateEmployeeStatus",{ EmpID:empId, status, resignDate:resignDate||undefined });
  setBtn("btn-status-save",false,"Update Status");
  if(!res.ok){ showAlert("status-alert","error",res.error||"Error updating status."); return; }
  closeModal("modal-status");
  loadEmployees();
});

// ── BRANCHES ─────────────────────────────────────────────────
async function loadBranches() {
  const res = await api("getBranches");
  const el = document.getElementById("branch-list");
  if(!res.ok){ el.innerHTML=`<div class="alert alert-error"><span>✕</span>${res.error}</div>`; return; }
  const branches = res.branches || [];
  if(!branches.length){ el.innerHTML=empty("No branches found"); return; }

  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Branch ID</th><th>Branch Name</th><th>Branch Head</th><th>Active</th></tr></thead>
    <tbody>${branches.map(b=>`<tr>
      <td class="td-mono">${b.BranchID||b.branchId||""}</td>
      <td class="td-name">${b.BranchName||b.branchName||""}</td>
      <td>${b.BranchHeadName||b.bhName||"—"}</td>
      <td><span class="badge badge-${b.Active===false||b.active===false?"red":"green"}">${b.Active===false||b.active===false?"Inactive":"Active"}</span></td>
    </tr>`).join("")}</tbody>
  </table></div>`;
}

document.getElementById("btn-add-branch").addEventListener("click", () => {
  ["ab-id","ab-name","ab-pwd","ab-rpwd"].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=""; });
  hideAlert("ab-alert"); openModal("modal-add-branch");
});
document.getElementById("btn-ab-cancel").addEventListener("click", ()=>closeModal("modal-add-branch"));
document.getElementById("btn-ab-save").addEventListener("click", async () => {
  const id=document.getElementById("ab-id").value.trim(), name=document.getElementById("ab-name").value.trim();
  const pwd=document.getElementById("ab-pwd").value.trim(), rpwd=document.getElementById("ab-rpwd").value.trim();
  if(!id||!name||!pwd||!rpwd){showAlert("ab-alert","error","All fields are required.");return;}
  setBtn("btn-ab-save",true,"Creating…");
  const res=await api("addBranch",{branch:{BranchID:id,BranchName:name,EntryPassword:pwd,ReportPassword:rpwd,Active:true}});
  setBtn("btn-ab-save",false,"Create Branch");
  if(!res.ok){showAlert("ab-alert","error",res.error||"Error creating branch.");return;}
  closeModal("modal-add-branch"); await loadAdminData();
});

// ══════════════════════════════════════════════════════════════
// TARGETS
// ══════════════════════════════════════════════════════════════

// ── Branch filter → populate employee dropdown ──
document.getElementById("tgt-branch-filter").addEventListener("change", async function() {
  const branch = this.value;
  const sel = document.getElementById("tgt-emp-sel");
  sel.innerHTML = '<option value="">— Loading… —</option>';
  sel.disabled = true;
  if(!branch) {
    sel.innerHTML = '<option value="">— Select Employee —</option>';
    sel.disabled = false;
    return;
  }
  // Always fetch fresh from API for the selected branch
  const res = await api("getEmployees", { branchName: branch, status: "" });
  sel.disabled = false;
  sel.innerHTML = '<option value="">— Select Employee —</option>';
  if(!res.ok || !res.employees?.length) {
    const o = document.createElement("option");
    o.disabled = true;
    o.textContent = res.ok ? "No employees in this branch" : "Error: " + res.error;
    sel.appendChild(o);
    return;
  }
  res.employees
    .filter(e => e.Status !== "RESIGNED" && e.Status !== "INACTIVE")
    .forEach(e => {
      const o = document.createElement("option");
      o.value = e.EmpID;
      o.textContent = e.FullName + (e.Role === "BRANCH_HEAD" ? " 👑" : "");
      sel.appendChild(o);
    });
});

// ── Bulk: All Branch Heads ──
document.getElementById("btn-bulk-bh-save").addEventListener("click", async () => {
  const inv    = document.getElementById("bh-inv").value;
  const rdCnt  = document.getElementById("bh-rd-count").value;
  const rdAmt  = document.getElementById("bh-rd-amt").value;
  if (!inv) { showAlert("bulk-bh-alert","error","Enter at least the Yearly Inv Target."); return; }
  const bhs = A.employees.filter(e => e.Role === "BRANCH_HEAD" && e.Status !== "RESIGNED" && e.Status !== "INACTIVE");
  if (!bhs.length) { showAlert("bulk-bh-alert","error","No active Branch Heads found."); return; }
  hideAlert("bulk-bh-alert");
  setBtn("btn-bulk-bh-save", true, `Saving targets for ${bhs.length} BHs…`);
  const entries = bhs.map(e => ({
    EmpID: e.EmpID,
    yearlyInv:      Number(inv)   || 0,
    yearlyRDCount:  Number(rdCnt) || 0,
    yearlyRDAmount: Number(rdAmt) || 0,
  }));
  const res = await api("setBulkTargets", { entries });
  setBtn("btn-bulk-bh-save", false, "Apply to All Branch Heads");
  if (!res.ok) { showAlert("bulk-bh-alert","error", res.error||"Error."); return; }
  showAlert("bulk-bh-alert","success", `✓ Targets set for ${res.saved} Branch Head(s).`);
  loadTargetSummary();
});

// ── Bulk: All Other Staff ──
document.getElementById("btn-bulk-staff-save").addEventListener("click", async () => {
  const inv   = document.getElementById("staff-inv").value;
  const rdCnt = document.getElementById("staff-rd-count").value;
  const rdAmt = document.getElementById("staff-rd-amt").value;
  if (!inv) { showAlert("bulk-staff-alert","error","Enter at least the Yearly Inv Target."); return; }
  const staff = A.employees.filter(e => e.Role !== "BRANCH_HEAD" && e.Status !== "RESIGNED" && e.Status !== "INACTIVE");
  if (!staff.length) { showAlert("bulk-staff-alert","error","No active staff found."); return; }
  hideAlert("bulk-staff-alert");
  setBtn("btn-bulk-staff-save", true, `Saving targets for ${staff.length} employees…`);
  const entries = staff.map(e => ({
    EmpID: e.EmpID,
    yearlyInv:      Number(inv)   || 0,
    yearlyRDCount:  Number(rdCnt) || 0,
    yearlyRDAmount: Number(rdAmt) || 0,
  }));
  const res = await api("setBulkTargets", { entries });
  setBtn("btn-bulk-staff-save", false, "Apply to All Other Staff");
  if (!res.ok) { showAlert("bulk-staff-alert","error", res.error||"Error."); return; }
  showAlert("bulk-staff-alert","success", `✓ Targets set for ${res.saved} staff member(s).`);
  loadTargetSummary();
});

// ── Individual override ──
document.getElementById("btn-set-target").addEventListener("click", async () => {
  const empId = document.getElementById("tgt-emp-sel").value;
  const inv   = document.getElementById("tgt-inv").value;
  const rdCnt = document.getElementById("tgt-rd-count").value;
  const rdAmt = document.getElementById("tgt-rd-amt").value;
  if (!empId) { showAlert("tgt-set-alert","error","Please select an employee."); return; }
  if (!inv)   { showAlert("tgt-set-alert","error","Enter at least the Yearly Inv Target."); return; }
  hideAlert("tgt-set-alert");
  setBtn("btn-set-target", true, "Saving…");
  const res = await api("setYearlyTargets", {
    EmpID:          empId,
    yearlyInv:      Number(inv)   || 0,
    yearlyRDCount:  Number(rdCnt) || 0,
    yearlyRDAmount: Number(rdAmt) || 0,
  });
  setBtn("btn-set-target", false, "Save Individual Target");
  if (!res.ok) { showAlert("tgt-set-alert","error", res.error||"Error."); return; }
  showAlert("tgt-set-alert","success","✓ Target saved.");
  loadTargetSummary();
});

// ── Summary table ──
async function loadTargetSummary() {
  const branch = document.getElementById("tgt-sum-branch").value;
  const res = await api("getTargets", { branchName: branch||undefined });
  const el  = document.getElementById("tgt-summary-list");
  if (!res.ok) { el.innerHTML=`<div class="alert alert-error"><span>✕</span>${res.error||"Error"}</div>`; return; }
  const tgts = res.targets || [];
  if (!tgts.length) { el.innerHTML=empty("No targets set yet."); return; }
  const rows = tgts.map(t => {
    const emp = A.employees.find(e => String(e.EmpID) === String(t.EmpID));
    return { ...t, FullName: emp?.FullName||t.EmpID, BranchName: emp?.BranchName||"", Role: emp?.Role||"" };
  }).sort((a,b) => (a.BranchName).localeCompare(b.BranchName) || a.FullName.localeCompare(b.FullName));
  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Employee</th><th>Branch</th><th>Yearly Inv (₹)</th><th>Monthly Inv (₹)</th><th>Yearly RD Count</th><th>Yearly RD Amt (₹)</th></tr></thead>
    <tbody>${rows.map(r=>`<tr>
      <td class="td-name">${r.FullName}${r.Role==="BRANCH_HEAD"?" 👑":""}</td>
      <td>${r.BranchName}</td>
      <td class="td-mono">₹${fmt(r.InvYearlyTarget)}</td>
      <td class="td-mono">₹${fmt(Math.round((r.InvYearlyTarget||0)/12))}</td>
      <td class="td-mono">${fmt(r.RDCountYearlyTarget)}</td>
      <td class="td-mono">₹${fmt(r.RDAmountYearlyTarget)}</td>
    </tr>`).join("")}</tbody>
  </table></div>`;
}
document.getElementById("btn-load-tgt-sum").addEventListener("click", loadTargetSummary);

// Populate branch dropdowns for bulk filters when panel loads
function populateBulkBranchDropdown() {
  const sel = document.getElementById("bulk-all-branch");
  if (!sel) return;
  sel.innerHTML = '<option value="">All Branches</option>';
  [...new Set(A.employees.map(e=>e.BranchName||e.BranchID).filter(Boolean))].sort().forEach(b => {
    const o = document.createElement("option"); o.value = b; o.textContent = b; sel.appendChild(o);
  });
}

// ── AUDIT LOG ─────────────────────────────────────────────────
document.getElementById("btn-load-audit").addEventListener("click", async () => {
  const branch = document.getElementById("audit-branch").value;
  const from = document.getElementById("audit-from").value;
  const to = document.getElementById("audit-to").value;
  const el = document.getElementById("audit-list");
  el.innerHTML = '<div class="loading-wrap"><div class="spinner-dark spinner"></div> Loading…</div>';
  const res = await api("getAuditLog",{ branchName:branch||undefined, from, to });
  if(!res.ok){el.innerHTML=`<div class="alert alert-error"><span>✕</span>${res.error||"Error loading audit log"}</div>`;return;}
  const rows = res.rows||[];
  if(!rows.length){el.innerHTML=empty("No audit entries for this period");return;}

  // Summary counts by action
  const counts={};
  rows.forEach(r=>{ counts[r.Action]=(counts[r.Action]||0)+1; });
  const summaryHtml = Object.entries(counts).sort((a,b)=>b[1]-a[1])
    .map(([k,v])=>`<span style="background:var(--bg);border:1px solid var(--border);border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700;margin:2px;display:inline-block">${k} <b style="color:var(--blue)">${v}</b></span>`)
    .join("");

  const colMap={EMP_MORNING:"#1a56db",EMP_EVENING:"#0e7c7b",BH_MORNING:"#1a56db",BH_EVENING:"#0e7c7b",
    MARK_LEAVE:"#c2770a",CANCEL_LEAVE:"#0a6640",SET_TARGETS:"#0a6640",SET_BULK_TARGETS:"#0a6640",
    ADD_EMPLOYEE:"#0a6640",UPDATE_EMPLOYEE:"#1a56db",STATUS_CHANGE:"#c2770a",
    MARK_RESIGNED:"#c0392b",DELETE_HOLIDAY:"#c0392b",SET_HOLIDAY:"#0a6640"};

  el.innerHTML = `<div style="padding:10px 12px;background:var(--bg);border-radius:10px;margin-bottom:12px">
    <div style="font-size:11px;font-weight:700;color:var(--t4);margin-bottom:6px">SUMMARY — ${rows.length} entries</div>
    <div>${summaryHtml}</div>
  </div>` + rows.map(r=>{
    const col = colMap[r.Action]||"#64748b";
    return `<div class="audit-row" style="border-left:3px solid ${col};padding-left:10px;margin-bottom:2px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="audit-action" style="color:${col}">${r.Action||""}</span>
        <span class="audit-time">${r.Timestamp||""}</span>
      </div>
      <div style="font-size:12px;color:var(--t3);margin-top:2px;display:flex;gap:14px;flex-wrap:wrap">
        <span>👤 ${r.ActorID||"–"}</span>
        <span>🏢 ${r.BranchName||"–"}</span>
        ${r.TargetSheet?`<span>📋 ${r.TargetSheet}${r.TargetKey?" · "+r.TargetKey:""}</span>`:""}
      </div>
      ${r.Details?`<div style="font-size:12px;color:var(--t2);margin-top:2px">${r.Details}</div>`:""}
    </div>`;
  }).join("");
});

// ── REPORTS ──────────────────────────────────────────────────
// Daily Report
document.getElementById("btn-load-rdaily").addEventListener("click", async () => {
  const date   = document.getElementById("rdaily-date").value;
  const branch = document.getElementById("rdaily-branch").value;
  const el     = document.getElementById("rdaily-result");
  el.innerHTML = '<div class="loading-wrap"><div class="spinner-dark spinner"></div> Loading…</div>';

  // ── SPECIFIC BRANCH — employee level ─────────────────────
  if (branch) {
    const res = await api("dayReport", { date, branchName: branch });
    if(!res.ok){el.innerHTML=`<div class="alert alert-error"><span>✕</span>${res.error}</div>`;return;}
    const rows = res.rows||[];
    if(!rows.length){el.innerHTML=empty("No data for this date");return;}

    const t = res.totals || {};
    const invPct = t.Inv_Com>0 ? Math.round(t.Inv_Ach/t.Inv_Com*100) : 0;
    const pc = progressColor(invPct);

    el.innerHTML = `
    <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:12px">${branch} — ${date}</div>

    <div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:800;color:var(--t4);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">💼 Investment</div>
      <div class="tiles tiles-4">
        <div class="tile"><div class="tile-label">Commitment</div><div class="tile-value blue">₹${fmt(t.Inv_Com||0)}</div></div>
        <div class="tile"><div class="tile-label">Achievement</div><div class="tile-value green">₹${fmt(t.Inv_Ach||0)}</div></div>
        <div class="tile"><div class="tile-label">Ach %</div><div class="tile-value ${pc}">${invPct}%</div></div>
        <div class="tile"><div class="tile-label">Closing Count</div><div class="tile-value">${fmt(t.Inv_Closing||0)}</div></div>
      </div>
      <div style="font-size:11px;font-weight:800;color:var(--t4);letter-spacing:1px;text-transform:uppercase;margin:12px 0 8px">🏦 RD</div>
      <div class="tiles tiles-4">
        <div class="tile"><div class="tile-label">Count Com</div><div class="tile-value blue">${fmt(t.RD_Count_Com||0)}</div></div>
        <div class="tile"><div class="tile-label">Count Ach</div><div class="tile-value green">${fmt(t.RD_Count_Ach||0)}</div></div>
        <div class="tile"><div class="tile-label">Amt Com</div><div class="tile-value blue">₹${fmt(t.RD_Amount_Com||0)}</div></div>
        <div class="tile"><div class="tile-label">Amt Ach</div><div class="tile-value green">₹${fmt(t.RD_Amount_Ach||0)}</div></div>
      </div>
    </div>

    <div class="table-wrap"><table>
      <thead><tr>
        <th>Employee</th><th>Status</th>
        <th>Inv Com</th><th>Inv Ach</th><th>%</th>
        <th>RD Cnt Com</th><th>RD Cnt Ach</th>
        <th>RD Amt Com</th><th>RD Amt Ach</th>
      </tr></thead>
      <tbody>${rows.map(r => {
        const p  = r.Inv_Com>0 ? Math.round((r.Inv_Ach||0)/r.Inv_Com*100) : 0;
        const pc2= progressColor(p);
        const status = r.OnLeave
          ? '<span class="badge badge-amber">On Leave</span>'
          : r.EveningDone ? '<span class="badge badge-green">Complete</span>'
          : r.MorningDone ? '<span class="badge badge-blue">Morning ✓</span>'
          : '<span class="badge badge-grey">Pending</span>';
        return `<tr>
          <td class="td-name">${r.FullName}</td>
          <td>${status}</td>
          <td class="td-mono">₹${fmt(r.Inv_Com)}</td>
          <td class="td-mono">₹${fmt(r.Inv_Ach)}</td>
          <td><span class="badge badge-${pc2}">${p}%</span></td>
          <td class="td-mono">${fmt(r.RD_Count_Com)}</td>
          <td class="td-mono">${fmt(r.RD_Count_Ach)}</td>
          <td class="td-mono">₹${fmt(r.RD_Amount_Com)}</td>
          <td class="td-mono">₹${fmt(r.RD_Amount_Ach)}</td>
        </tr>`;
      }).join("")}</tbody>
    </table></div>`;
    return;
  }

  // ── ALL BRANCHES — branch level summary ──────────────────
  const res = await api("allBranchesDayReport", { date });
  if(!res.ok){el.innerHTML=`<div class="alert alert-error"><span>✕</span>${res.error}</div>`;return;}
  const branches = res.branches||[];
  if(!branches.length){el.innerHTML=empty("No data for this date");return;}

  // Grand totals
  let gInvCom=0,gInvAch=0,gRdCntCom=0,gRdCntAch=0,gRdAmtCom=0,gRdAmtAch=0;
  branches.forEach(b=>{
    gInvCom+=b.totals.Inv_Com; gInvAch+=b.totals.Inv_Ach;
    gRdCntCom+=b.totals.RD_Count_Com; gRdCntAch+=b.totals.RD_Count_Ach;
    gRdAmtCom+=b.totals.RD_Amount_Com; gRdAmtAch+=b.totals.RD_Amount_Ach;
  });
  const gPct = gInvCom>0 ? Math.round(gInvAch/gInvCom*100) : 0;

  el.innerHTML = `
  <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:12px">All Branches — ${date}</div>

  <div style="margin-bottom:20px">
    <div style="font-size:11px;font-weight:800;color:var(--t4);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">💼 Investment — Grand Total</div>
    <div class="tiles tiles-4">
      <div class="tile"><div class="tile-label">Total Commitment</div><div class="tile-value blue">₹${fmt(gInvCom)}</div></div>
      <div class="tile"><div class="tile-label">Total Achievement</div><div class="tile-value green">₹${fmt(gInvAch)}</div></div>
      <div class="tile"><div class="tile-label">Overall %</div><div class="tile-value ${progressColor(gPct)}">${gPct}%</div></div>
      <div class="tile"><div class="tile-label">Balance</div><div class="tile-value amber">₹${fmt(Math.max(0,gInvCom-gInvAch))}</div></div>
    </div>
    <div style="font-size:11px;font-weight:800;color:var(--t4);letter-spacing:1px;text-transform:uppercase;margin:12px 0 8px">🏦 RD — Grand Total</div>
    <div class="tiles tiles-4">
      <div class="tile"><div class="tile-label">Count Com</div><div class="tile-value blue">${fmt(gRdCntCom)}</div></div>
      <div class="tile"><div class="tile-label">Count Ach</div><div class="tile-value green">${fmt(gRdCntAch)}</div></div>
      <div class="tile"><div class="tile-label">Amt Com</div><div class="tile-value blue">₹${fmt(gRdAmtCom)}</div></div>
      <div class="tile"><div class="tile-label">Amt Ach</div><div class="tile-value green">₹${fmt(gRdAmtAch)}</div></div>
    </div>
  </div>

  <div class="table-wrap"><table>
    <thead><tr>
      <th>Branch</th><th>Staff</th>
      <th>Inv Com</th><th>Inv Ach</th><th>Ach %</th>
      <th>RD Cnt Com</th><th>RD Cnt Ach</th>
      <th>RD Amt Com</th><th>RD Amt Ach</th>
      <th>Morning</th><th>Evening</th>
    </tr></thead>
    <tbody>${branches.map(b => {
      const p  = b.totals.Inv_Com>0 ? Math.round(b.totals.Inv_Ach/b.totals.Inv_Com*100) : 0;
      const pc = progressColor(p);
      return `<tr>
        <td class="td-name" style="font-weight:700">${b.branchName}</td>
        <td class="td-mono" style="color:var(--t3)">${b.required}</td>
        <td class="td-mono">₹${fmt(b.totals.Inv_Com)}</td>
        <td class="td-mono" style="color:var(--green)">₹${fmt(b.totals.Inv_Ach)}</td>
        <td><span class="badge badge-${pc}">${p}%</span></td>
        <td class="td-mono">${fmt(b.totals.RD_Count_Com)}</td>
        <td class="td-mono" style="color:var(--teal)">${fmt(b.totals.RD_Count_Ach)}</td>
        <td class="td-mono">₹${fmt(b.totals.RD_Amount_Com)}</td>
        <td class="td-mono" style="color:var(--teal)">₹${fmt(b.totals.RD_Amount_Ach)}</td>
        <td><span class="badge badge-${b.mDone===b.required?'green':b.mDone>0?'blue':'grey'}">${b.mDone}/${b.required}</span></td>
        <td><span class="badge badge-${b.eDone===b.required?'green':b.eDone>0?'blue':'grey'}">${b.eDone}/${b.required}</span></td>
      </tr>`;
    }).join("")}</tbody>
  </table></div>`;
});


// Monthly Detail Report
let _rmonData = null;
document.getElementById("btn-load-rmon").addEventListener("click", async () => {
  const month=document.getElementById("rmon-month").value;
  const year=document.getElementById("rmon-year").value;
  const branch=document.getElementById("rmon-branch").value;
  const el=document.getElementById("rmon-result");
  el.innerHTML='<div class="loading-wrap"><div class="spinner-dark spinner"></div> Loading…</div>';
  const res=await api("monthlyReport",{branchName:branch||undefined,year:Number(year),month:Number(month)});
  if(!res.ok){el.innerHTML=`<div class="alert alert-error"><span>✕</span>${res.error}</div>`;return;}
  const rows=res.rows||[];
  if(!rows.length){el.innerHTML=empty("No data for this period");return;}
  _rmonData = { rows, month, year, branch };
  document.getElementById("btn-download-rmon").style.display="inline-flex";

  // Branch totals
  let totInvTgt=0,totInvAch=0,totInvBal=0;
  let totRdCntTgt=0,totRdCntAch=0,totRdCntBal=0;
  let totRdAmtTgt=0,totRdAmtAch=0,totRdAmtBal=0;
  rows.forEach(r=>{
    totInvTgt+=Number(r.InvTarget)||0;   totInvAch+=Number(r.InvAch)||0;     totInvBal+=Number(r.InvBal)||0;
    totRdCntTgt+=Number(r.RDCntTarget)||0; totRdCntAch+=Number(r.RDCountAch)||0; totRdCntBal+=Number(r.RDCntBal)||0;
    totRdAmtTgt+=Number(r.RDAmtTarget)||0; totRdAmtAch+=Number(r.RDAmountAch)||0; totRdAmtBal+=Number(r.RDAmtBal)||0;
  });
  const invPct=totInvTgt>0?Math.round(totInvAch/totInvTgt*100):0;
  const rdCntPct=totRdCntTgt>0?Math.round(totRdCntAch/totRdCntTgt*100):0;
  const rdAmtPct=totRdAmtTgt>0?Math.round(totRdAmtAch/totRdAmtTgt*100):0;
  const pc=progressColor(invPct)||"blue";

  el.innerHTML=`
  <!-- Branch summary tiles -->
  <div style="font-size:11px;font-weight:800;color:var(--t4);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">💼 Investment</div>
  <div class="tiles tiles-3" style="margin-bottom:14px">
    <div class="tile"><div class="tile-label">Total Target</div><div class="tile-value blue">₹${fmt(totInvTgt)}</div></div>
    <div class="tile"><div class="tile-label">Total Achievement</div><div class="tile-value green">₹${fmt(totInvAch)}</div></div>
    <div class="tile"><div class="tile-label">Shortfall</div><div class="tile-value ${totInvBal<0?"green":"amber"}">₹${fmt(Math.abs(totInvBal))}</div></div>
  </div>
  <div style="font-size:11px;font-weight:800;color:var(--t4);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">🏦 RD Count</div>
  <div class="tiles tiles-3" style="margin-bottom:14px">
    <div class="tile"><div class="tile-label">Total Target</div><div class="tile-value blue">${fmt(totRdCntTgt)}</div></div>
    <div class="tile"><div class="tile-label">Total Achievement</div><div class="tile-value green">${fmt(totRdCntAch)}</div></div>
    <div class="tile"><div class="tile-label">Shortfall</div><div class="tile-value ${totRdCntBal<=0?"green":"amber"}">${fmt(Math.abs(totRdCntBal))}</div></div>
  </div>
  <div style="font-size:11px;font-weight:800;color:var(--t4);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">🏦 RD Amount</div>
  <div class="tiles tiles-3" style="margin-bottom:18px">
    <div class="tile"><div class="tile-label">Total Target</div><div class="tile-value blue">₹${fmt(totRdAmtTgt)}</div></div>
    <div class="tile"><div class="tile-label">Total Achievement</div><div class="tile-value green">₹${fmt(totRdAmtAch)}</div></div>
    <div class="tile"><div class="tile-label">Shortfall</div><div class="tile-value ${totRdAmtBal<0?"green":"amber"}">₹${fmt(Math.abs(totRdAmtBal))}</div></div>
  </div>

  <!-- Employee detail table -->
  <div class="table-wrap" style="overflow-x:auto"><table style="font-size:13px;white-space:nowrap">
    <thead><tr>
      <th>Employee</th><th>Branch</th>
      <th>Inv Target</th><th>Net Inv Ach</th><th>Shortfall</th><th>Inv %</th><th>Inv DRR</th>
      <th>RD Cnt Tgt</th><th>RD Cnt Ach</th><th>RD Cnt Bal</th><th>RD Cnt DRR</th>
      <th>RD Amt Tgt</th><th>Net RD Amt</th><th>RD Amt Bal</th><th>RD Amt DRR</th>
      <th>Zero Days</th>
    </tr></thead>
    <tbody>${rows.map(r=>{
      const p=r.InvTarget>0?Math.round((r.InvAch||0)/r.InvTarget*100):0;
      const pc2=progressColor(p)||"blue";
      const invShortfall=Math.max(0,(r.InvTarget||0)-(r.InvAch||0));
      const rdAmtBal=r.RDAmtBal||0;
      return`<tr>
        <td class="td-name">${r.FullName}</td>
        <td style="font-size:12px;color:var(--t3)">${r.BranchName||""}</td>
        <td class="td-mono">₹${fmt(r.InvTarget)}</td>
        <td class="td-mono" style="color:var(--green)">₹${fmt(r.InvAch||0)}</td>
        <td class="td-mono" style="color:var(--${invShortfall>0?"red":"green"})">₹${fmt(invShortfall)}</td>
        <td><span class="badge badge-${pc2}">${p}%</span></td>
        <td class="td-mono" style="color:var(--amber)">₹${fmt(r.DRR||0)}</td>
        <td class="td-mono">${fmt(r.RDCntTarget||0)}</td>
        <td class="td-mono" style="color:var(--teal)">${fmt(r.RDCountAch||0)}</td>
        <td class="td-mono" style="color:var(--amber)">${fmt(r.RDCntBal||0)}</td>
        <td class="td-mono" style="color:var(--amber)">${fmt(r.RDCntDRR||0)}</td>
        <td class="td-mono">₹${fmt(r.RDAmtTarget||0)}</td>
        <td class="td-mono" style="color:var(--teal)">₹${fmt(r.RDAmountAch||0)}</td>
        <td class="td-mono" style="color:var(--${rdAmtBal<0?"red":"amber"})">₹${fmt(rdAmtBal)}</td>
        <td class="td-mono" style="color:var(--amber)">₹${fmt(r.RDAmtDRR||0)}</td>
        <td><span class="badge badge-${(r.ZeroDays||0)>3?"red":(r.ZeroDays||0)>0?"amber":"green"}">${r.ZeroDays||0}d</span></td>
      </tr>`;}).join("")}
    </tbody>
  </table></div>`;
});

document.getElementById("btn-download-rmon").addEventListener("click", () => {
  if(!_rmonData) return;
  const { rows, month, year, branch } = _rmonData;
  const hdr = ["Employee","Branch","Inv Target","Net Inv Ach","Shortfall","Inv %","Inv DRR","RD Cnt Tgt","RD Cnt Ach","RD Cnt Bal","RD Cnt DRR","RD Amt Tgt","Net RD Amt","RD Amt Bal","RD Amt DRR","Zero Days"];
  const csvRows = [hdr, ...rows.map(r => {
    const p = r.InvTarget>0?Math.round((r.InvAch||0)/r.InvTarget*100):0;
    return [r.FullName,r.BranchName||"",r.InvTarget||0,r.InvAch||0,Math.max(0,(r.InvTarget||0)-(r.InvAch||0)),p+"%",r.DRR||0,r.RDCntTarget||0,r.RDCountAch||0,r.RDCntBal||0,r.RDCntDRR||0,r.RDAmtTarget||0,r.RDAmountAch||0,r.RDAmtBal||0,r.RDAmtDRR||0,r.ZeroDays||0];
  })];
  const csv = csvRows.map(r=>r.join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  const a = document.createElement("a"); a.href=url; a.download=`MonthlyDetail_${monthName(month)}_${year}_${branch||"ALL"}.csv`; a.click();
});

// Yearly Report
let _ryearData = null;
document.getElementById("btn-load-ryear").addEventListener("click", async () => {
  const branch=document.getElementById("ryear-branch").value;
  const el=document.getElementById("ryear-result");
  el.innerHTML='<div class="loading-wrap"><div class="spinner-dark spinner"></div> Loading…</div>';
  const res=await api("yearlyReport",{branchName:branch||undefined});
  if(!res.ok){el.innerHTML=`<div class="alert alert-error"><span>✕</span>${res.error}</div>`;return;}
  const months=res.months||[];
  if(!months.length){el.innerHTML=empty("No yearly data available");return;}
  _ryearData = { res, branch };
  document.getElementById("btn-download-ryear").style.display="inline-flex";

  const fyLabels=["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];

  // YTD summary tiles
  const invPct  = res.annualInvTarget   > 0 ? Math.round(res.ytdInvAch   / res.annualInvTarget   * 100) : 0;
  const rdCntPct= res.annualRdCntTarget > 0 ? Math.round(res.ytdRdCntAch / res.annualRdCntTarget * 100) : 0;
  const rdAmtPct= res.annualRdAmtTarget > 0 ? Math.round(res.ytdRdAmtAch / res.annualRdAmtTarget * 100) : 0;

  el.innerHTML=`
  <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:12px">FY ${res.FY||""} — Yearly Progress</div>

  <!-- YTD summary -->
  <div style="font-size:11px;font-weight:800;color:var(--t4);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">💼 Investment — YTD</div>
  <div class="tiles tiles-3" style="margin-bottom:14px">
    <div class="tile"><div class="tile-label">Annual Target</div><div class="tile-value blue">₹${fmt(res.annualInvTarget||0)}</div></div>
    <div class="tile"><div class="tile-label">YTD Achievement</div><div class="tile-value green">₹${fmt(res.ytdInvAch||0)}</div></div>
    <div class="tile"><div class="tile-label">YTD Progress</div><div class="tile-value ${progressColor(invPct)||"blue"}">${invPct}%</div></div>
  </div>
  <div style="font-size:11px;font-weight:800;color:var(--t4);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">🏦 RD Count — YTD</div>
  <div class="tiles tiles-3" style="margin-bottom:14px">
    <div class="tile"><div class="tile-label">Annual Target</div><div class="tile-value blue">${fmt(res.annualRdCntTarget||0)}</div></div>
    <div class="tile"><div class="tile-label">YTD Achievement</div><div class="tile-value green">${fmt(res.ytdRdCntAch||0)}</div></div>
    <div class="tile"><div class="tile-label">YTD Progress</div><div class="tile-value ${progressColor(rdCntPct)||"blue"}">${rdCntPct}%</div></div>
  </div>
  <div style="font-size:11px;font-weight:800;color:var(--t4);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">🏦 RD Amount — YTD</div>
  <div class="tiles tiles-3" style="margin-bottom:18px">
    <div class="tile"><div class="tile-label">Annual Target</div><div class="tile-value blue">₹${fmt(res.annualRdAmtTarget||0)}</div></div>
    <div class="tile"><div class="tile-label">YTD Achievement</div><div class="tile-value green">₹${fmt(res.ytdRdAmtAch||0)}</div></div>
    <div class="tile"><div class="tile-label">YTD Progress</div><div class="tile-value ${progressColor(rdAmtPct)||"blue"}">${rdAmtPct}%</div></div>
  </div>

  <!-- Month-by-month table -->
  <div class="table-wrap" style="overflow-x:auto"><table style="font-size:13px;white-space:nowrap">
    <thead><tr>
      <th>Month</th>
      <th>Inv Target</th><th>Net Inv Ach</th><th>Inv Shortfall</th><th>Inv %</th>
      <th>RD Cnt Tgt</th><th>RD Cnt Ach</th><th>RD Cnt Bal</th><th>RD Cnt %</th>
      <th>RD Amt Tgt</th><th>Net RD Amt</th><th>RD Amt Bal</th><th>RD Amt %</th>
      <th>Running YTD %</th>
    </tr></thead>
    <tbody>${months.map((m,i)=>{
      const isFuture = !m.isPast;
      const invPctM  = m.InvPct  !== null ? m.InvPct  : null;
      const rdCntPctM= m.RDCntPct!== null ? m.RDCntPct: null;
      const rdAmtPctM= m.RDAmtPct!== null ? m.RDAmtPct: null;
      const dash     = `<span style="color:var(--t4)">—</span>`;
      const pBadge   = p => p !== null ? `<span class="badge badge-${progressColor(p)||"blue"}">${p}%</span>` : dash;
      const invBal   = m.InvBal  !== null ? Math.max(0, m.InvBal)  : null;
      const rdCntBal = m.RDCntBal!== null ? Math.max(0, m.RDCntBal): null;
      const rdAmtBal = m.RDAmtBal!== null ? Math.max(0, m.RDAmtBal): null;
      return`<tr style="${isFuture?"opacity:.5":""}">
        <td style="font-weight:${isFuture?"400":"700"}">${fyLabels[i]}</td>
        <td class="td-mono">₹${fmt(m.InvTarget||0)}</td>
        <td class="td-mono" style="color:var(--green)">${m.InvAch!==null?"₹"+fmt(m.InvAch):dash}</td>
        <td class="td-mono" style="color:var(--${invBal>0?"red":"green"})">${invBal!==null?"₹"+fmt(invBal):dash}</td>
        <td>${pBadge(invPctM)}</td>
        <td class="td-mono">${fmt(m.RDCntTarget||0)}</td>
        <td class="td-mono" style="color:var(--teal)">${m.RDCntAch!==null?fmt(m.RDCntAch):dash}</td>
        <td class="td-mono" style="color:var(--amber)">${rdCntBal!==null?fmt(rdCntBal):dash}</td>
        <td>${pBadge(rdCntPctM)}</td>
        <td class="td-mono">₹${fmt(m.RDAmtTarget||0)}</td>
        <td class="td-mono" style="color:var(--teal)">${m.RDAmtAch!==null?"₹"+fmt(m.RDAmtAch):dash}</td>
        <td class="td-mono" style="color:var(--amber)">${rdAmtBal!==null?"₹"+fmt(rdAmtBal):dash}</td>
        <td>${pBadge(rdAmtPctM)}</td>
        <td class="td-mono">${m.YTDPct!==null?m.YTDPct+"%":dash}</td>
      </tr>`;}).join("")}
    </tbody>
  </table></div>`;
});

document.getElementById("btn-download-ryear").addEventListener("click", () => {
  if(!_ryearData) return;
  const { res, branch } = _ryearData;
  const fyLabels=["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];
  const hdr = ["Month","Inv Target","Net Inv Ach","Inv Shortfall","Inv %","RD Cnt Tgt","RD Cnt Ach","RD Cnt Bal","RD Cnt %","RD Amt Tgt","Net RD Amt","RD Amt Bal","RD Amt %","Running YTD %"];
  const csvRows = [hdr, ...(res.months||[]).map((m,i)=>[
    fyLabels[i],
    m.InvTarget||0,m.InvAch!==null?m.InvAch:"",Math.max(0,m.InvBal||0),m.InvPct!==null?m.InvPct+"%":"",
    m.RDCntTarget||0,m.RDCntAch!==null?m.RDCntAch:"",Math.max(0,m.RDCntBal||0),m.RDCntPct!==null?m.RDCntPct+"%":"",
    m.RDAmtTarget||0,m.RDAmtAch!==null?m.RDAmtAch:"",Math.max(0,m.RDAmtBal||0),m.RDAmtPct!==null?m.RDAmtPct+"%":"",
    m.YTDPct!==null?m.YTDPct+"%":""
  ])];
  const csv = csvRows.map(r=>r.join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  const a = document.createElement("a"); a.href=url; a.download=`Yearly_${res.FY||"FY"}_${branch||"ALL"}.csv`; a.click();
});

// Leaderboard
document.getElementById("btn-load-rlb").addEventListener("click", async () => {
  const month=document.getElementById("rlb-month").value;
  const year=document.getElementById("rlb-year").value;
  const branch=document.getElementById("rlb-branch").value;
  const type=document.getElementById("rlb-type").value;
  const el=document.getElementById("rlb-result");
  el.innerHTML='<div class="loading-wrap"><div class="spinner-dark spinner"></div> Loading…</div>';

  // leaderboardReport returns: EmpID, FullName, BranchName, InvAch, InvTarget, AchPct, ConsistencyScore
  // monthlyReport returns full RD data — fetch both and merge
  const [lbRes, monRes] = await Promise.all([
    api("leaderboardReport",{year:Number(year),month:Number(month),branchName:branch||undefined}),
    api("monthlyReport",{year:Number(year),month:Number(month),branchName:branch||undefined})
  ]);

  if(!lbRes.ok){el.innerHTML=`<div class="alert alert-error"><span>✕</span>${lbRes.error}</div>`;return;}
  const rows=lbRes.rows||[];
  if(!rows.length){el.innerHTML=empty("No leaderboard data");return;}

  // Merge monthly RD data into leaderboard rows (matched by EmpID)
  const monRows = monRes.ok ? (monRes.rows||[]) : [];
  const merged = rows.map(r => {
    const mon = monRows.find(m => String(m.EmpID)===String(r.EmpID)) || {};
    return {
      ...r,
      InvTarget:   r.InvTarget   || mon.InvTarget   || 0,
      InvAch:      r.InvAch      || mon.InvAch       || 0,
      AchPct:      r.AchPct      || 0,
      RDCntTarget: mon.RDCntTarget  || 0,
      RDCntAch:    mon.RDCountAch   || 0,   // API field: RDCountAch
      RDAmtTarget: mon.RDAmtTarget  || 0,
      RDAmtAch:    mon.RDAmountAch  || 0,   // API field: RDAmountAch
    };
  });

  const medals=["🥇","🥈","🥉"];
  const isInv = (type === "investment");

  // Sort by appropriate metric
  const sorted = [...merged].sort((a,b) => {
    if(isInv) return (b.InvAch||0) - (a.InvAch||0);
    // For RD, sort by RD amount achievement
    return (b.RDAmtAch||0) - (a.RDAmtAch||0);
  });

  if(isInv) {
    el.innerHTML=`
      <div style="margin-bottom:12px"><span class="badge badge-blue">💼 Investment Leaderboard — ${document.getElementById("rlb-month").options[document.getElementById("rlb-month").selectedIndex]?.text||""} ${year}</span></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Rank</th><th>Employee</th><th>Branch</th><th>Inv Target</th><th>Inv Achievement</th><th>Achievement %</th><th>Consistency</th></tr></thead>
        <tbody>${sorted.map((r,i)=>{
          const invTgt = r.InvTarget||0;
          const invAch = r.InvAch||0;
          const achPct = invTgt>0 ? Math.round(invAch/invTgt*100) : (r.AchPct||0);
          const pc = progressColor(achPct)||"blue";
          return`<tr>
            <td style="font-size:18px">${medals[i]||`#${i+1}`}</td>
            <td class="td-name">${r.FullName}</td>
            <td style="font-size:12px;color:var(--t3)">${r.BranchName||""}</td>
            <td class="td-mono">₹${fmt(invTgt)}</td>
            <td class="td-mono" style="color:var(--green)">₹${fmt(invAch)}</td>
            <td><span class="badge badge-${pc}">${achPct}%</span></td>
            <td style="font-size:12px">${r.ConsistencyScore||"—"}</td>
          </tr>`;}).join("")}
        </tbody></table></div>`;
  } else {
    el.innerHTML=`
      <div style="margin-bottom:12px"><span class="badge badge-teal">🏦 RD Leaderboard — ${document.getElementById("rlb-month").options[document.getElementById("rlb-month").selectedIndex]?.text||""} ${year}</span></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Rank</th><th>Employee</th><th>Branch</th><th>RD Cnt Tgt</th><th>RD Cnt Ach</th><th>Cnt %</th><th>RD Amt Tgt</th><th>RD Amt Ach</th><th>Amt %</th><th>Consistency</th></tr></thead>
        <tbody>${sorted.map((r,i)=>{
          const cntTgt=r.RDCntTarget||0; const cntAch=r.RDCntAch||0;
          const amtTgt=r.RDAmtTarget||0; const amtAch=r.RDAmtAch||0;
          const cntPct=cntTgt>0?Math.round(cntAch/cntTgt*100):0;
          const amtPct=amtTgt>0?Math.round(amtAch/amtTgt*100):0;
          return`<tr>
            <td style="font-size:18px">${medals[i]||`#${i+1}`}</td>
            <td class="td-name">${r.FullName}</td>
            <td style="font-size:12px;color:var(--t3)">${r.BranchName||""}</td>
            <td class="td-mono">${fmt(cntTgt)}</td>
            <td class="td-mono" style="color:var(--teal)">${fmt(cntAch)}</td>
            <td><span class="badge badge-${progressColor(cntPct)||"blue"}">${cntPct}%</span></td>
            <td class="td-mono">₹${fmt(amtTgt)}</td>
            <td class="td-mono" style="color:var(--teal)">₹${fmt(amtAch)}</td>
            <td><span class="badge badge-${progressColor(amtPct)||"blue"}">${amtPct}%</span></td>
            <td style="font-size:12px">${r.ConsistencyScore||"—"}</td>
          </tr>`;}).join("")}
        </tbody></table></div>`;
  }
});

// Discipline Report
document.getElementById("btn-load-rdis").addEventListener("click", async () => {
  const month=document.getElementById("rdis-month").value;
  const year=document.getElementById("rdis-year").value;
  const branch=document.getElementById("rdis-branch").value;
  const el=document.getElementById("rdis-result");
  el.innerHTML='<div class="loading-wrap"><div class="spinner-dark spinner"></div> Loading…</div>';
  const res=await api("disciplineReport",{year:Number(year),month:Number(month),branchName:branch||undefined});
  if(!res.ok){el.innerHTML=`<div class="alert alert-error"><span>✕</span>${res.error}</div>`;return;}
  const rows=res.rows||[];
  if(!rows.length){el.innerHTML=empty("No discipline data");return;}
  el.innerHTML=`<div class="table-wrap"><table>
    <thead><tr><th>Employee</th><th>Branch</th><th>Days Submitted</th><th>Days Missing</th><th>Submission Rate</th><th>Late Entries</th></tr></thead>
    <tbody>${rows.map(r=>{const rate=r.SubmissionRate||0;const pc=progressColor(rate)||"blue";return`<tr>
      <td class="td-name">${r.FullName}</td>
      <td>${r.BranchName||""}</td>
      <td class="td-mono">${r.DaysSubmitted||0}</td>
      <td class="td-mono" style="color:var(--${(r.DaysMissing||0)>3?"red":"t2"})">${r.DaysMissing||0}</td>
      <td><span class="badge badge-${pc}">${rate}%</span></td>
      <td class="td-mono">${r.LateEntries||0}</td>
    </tr>`;}).join("")}
    </tbody></table></div>`;
});

// Summary Report
let _rsumData = null;
document.getElementById("btn-load-rsum").addEventListener("click", async () => {
  const month=document.getElementById("rsum-month").value;
  const year=document.getElementById("rsum-year").value;
  const type=document.getElementById("rsum-type").value;
  const el=document.getElementById("rsum-result");
  el.innerHTML='<div class="loading-wrap"><div class="spinner-dark spinner"></div> Loading…</div>';
  const res=await api("summaryReport",{year:Number(year),month:Number(month)});
  if(!res.ok){el.innerHTML=`<div class="alert alert-error"><span>✕</span>${res.error}</div>`;return;}
  const branches=res.branches||[];
  if(!branches.length){el.innerHTML=empty("No summary data");return;}

  _rsumData = { branches, month, year, type };
  document.getElementById("btn-download-rsum").style.display="inline-flex";
  renderSummaryReport(branches, type);
});

document.getElementById("rsum-type")?.addEventListener("change", () => {
  if(_rsumData) renderSummaryReport(_rsumData.branches, document.getElementById("rsum-type").value);
});

// summaryReport → getBranchTargetSummary fields per employee:
//   EmpID, FullName, BranchName,
//   InvTarget, InvAch, InvBal, DRR
//   RDCntTarget, RDCountAch, RDCntBal
//   RDAmtTarget, RDAmountAch, RDAmtBal
function renderSummaryReport(branches, type) {
  const el = document.getElementById("rsum-result");
  const showInv = (type === "investment" || type === "both");
  const showRD  = (type === "rd"         || type === "both");
  let html = "";

  branches.forEach(b => {
    const invP   = b.InvTarget>0 ? Math.round((b.InvAch||0)/b.InvTarget*100) : 0;
    // Aggregate RD from employees since branch-level RD totals may not exist
    const totRDCntTgt = (b.employees||[]).reduce((s,e)=>s+(e.RDCntTarget||0),0);
    const totRDCntAch = (b.employees||[]).reduce((s,e)=>s+(e.RDCountAch||0),0);
    const totRDAmtTgt = (b.employees||[]).reduce((s,e)=>s+(e.RDAmtTarget||0),0);
    const totRDAmtAch = (b.employees||[]).reduce((s,e)=>s+(e.RDAmountAch||0),0);
    const rdCntP = totRDCntTgt>0 ? Math.round(totRDCntAch/totRDCntTgt*100) : 0;
    const rdAmtP = totRDAmtTgt>0 ? Math.round(totRDAmtAch/totRDAmtTgt*100) : 0;
    const pc = progressColor(invP)||"blue";

    const empRows = (b.employees||[]).map(e => {
      const ep      = e.InvTarget>0 ? Math.round((e.InvAch||0)/e.InvTarget*100) : 0;
      const epc     = progressColor(ep)||"blue";
      const cntAch  = e.RDCountAch  || 0;   // correct API field
      const amtAch  = e.RDAmountAch || 0;   // correct API field
      const cntTgt  = e.RDCntTarget || 0;
      const amtTgt  = e.RDAmtTarget || 0;
      const cntPct  = cntTgt>0 ? Math.round(cntAch/cntTgt*100) : 0;
      const amtPct  = amtTgt>0 ? Math.round(amtAch/amtTgt*100) : 0;

      if(showInv && showRD) return`<tr>
        <td class="td-name">${e.FullName}</td>
        <td class="td-mono">₹${fmt(e.InvTarget||0)}</td>
        <td class="td-mono" style="color:var(--green)">₹${fmt(e.InvAch||0)}</td>
        <td><span class="badge badge-${epc}">${ep}%</span></td>
        <td class="td-mono" style="color:var(--amber)">₹${fmt(e.DRR||0)}</td>
        <td class="td-mono">${fmt(cntTgt)}</td>
        <td class="td-mono" style="color:var(--teal)">${fmt(cntAch)}</td>
        <td><span class="badge badge-${progressColor(cntPct)||"blue"}">${cntPct}%</span></td>
        <td class="td-mono">₹${fmt(amtTgt)}</td>
        <td class="td-mono" style="color:var(--teal)">₹${fmt(amtAch)}</td>
        <td><span class="badge badge-${progressColor(amtPct)||"blue"}">${amtPct}%</span></td>
      </tr>`;
      if(showInv) return`<tr>
        <td class="td-name">${e.FullName}</td>
        <td class="td-mono">₹${fmt(e.InvTarget||0)}</td>
        <td class="td-mono" style="color:var(--green)">₹${fmt(e.InvAch||0)}</td>
        <td><span class="badge badge-${epc}">${ep}%</span></td>
        <td class="td-mono" style="color:var(--amber)">₹${fmt(e.DRR||0)}</td>
      </tr>`;
      return`<tr>
        <td class="td-name">${e.FullName}</td>
        <td class="td-mono">${fmt(cntTgt)}</td>
        <td class="td-mono" style="color:var(--teal)">${fmt(cntAch)}</td>
        <td><span class="badge badge-${progressColor(cntPct)||"blue"}">${cntPct}%</span></td>
        <td class="td-mono">₹${fmt(amtTgt)}</td>
        <td class="td-mono" style="color:var(--teal)">₹${fmt(amtAch)}</td>
        <td><span class="badge badge-${progressColor(amtPct)||"blue"}">${amtPct}%</span></td>
      </tr>`;
    }).join("");

    const thead = showInv && showRD
      ? `<th>Employee</th><th>Inv Tgt</th><th>Inv Ach</th><th>Inv %</th><th>DRR</th><th>RD Cnt Tgt</th><th>RD Cnt Ach</th><th>Cnt %</th><th>RD Amt Tgt</th><th>RD Amt Ach</th><th>Amt %</th>`
      : showInv
        ? `<th>Employee</th><th>Inv Target</th><th>Inv Achievement</th><th>Inv %</th><th>DRR</th>`
        : `<th>Employee</th><th>RD Cnt Tgt</th><th>RD Cnt Ach</th><th>Cnt %</th><th>RD Amt Tgt</th><th>RD Amt Ach</th><th>Amt %</th>`;

    html += `<div class="card">
      <div class="card-header">
        <h3>${b.BranchName}</h3>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${showInv?`<span class="badge badge-${pc}">💼 ${invP}%</span>`:""}
          ${showRD?`<span class="badge badge-teal">🏦 Cnt ${rdCntP}%</span>`:""}
          ${showRD?`<span class="badge badge-teal">Amt ${rdAmtP}%</span>`:""}
        </div>
      </div>
      ${showInv?`<div class="progress-wrap"><div class="progress-bar ${pc}" style="width:${Math.min(invP,100)}%"></div></div>
      <div class="progress-label"><span>₹${fmt(b.InvAch||0)} achieved</span><span>Target: ₹${fmt(b.InvTarget||0)}</span></div>`:""}
      <div class="table-wrap" style="margin-top:14px;overflow-x:auto"><table style="white-space:nowrap">
        <thead><tr>${thead}</tr></thead>
        <tbody>${empRows}</tbody>
      </table></div>
    </div>`;
  });
  el.innerHTML = html;
}

document.getElementById("btn-download-rsum").addEventListener("click", () => {
  if(!_rsumData) return;
  const { branches, month, year } = _rsumData;
  const currentType = document.getElementById("rsum-type").value;
  const showInv = (currentType === "investment" || currentType === "both");
  const showRD  = (currentType === "rd"         || currentType === "both");
  const hdr = ["Branch","Employee"];
  if(showInv) hdr.push("Inv Target","Inv Ach","Inv %","DRR");
  if(showRD)  hdr.push("RD Cnt Tgt","RD Cnt Ach","Cnt %","RD Amt Tgt","RD Amt Ach","Amt %");
  const csvRows = [hdr];
  branches.forEach(b => {
    (b.employees||[]).forEach(e => {
      const ep      = e.InvTarget>0 ? Math.round((e.InvAch||0)/e.InvTarget*100) : 0;
      const cntAch  = e.RDCountAch  || 0;
      const amtAch  = e.RDAmountAch || 0;
      const cntTgt  = e.RDCntTarget || 0;
      const amtTgt  = e.RDAmtTarget || 0;
      const cntPct  = cntTgt>0 ? Math.round(cntAch/cntTgt*100) : 0;
      const amtPct  = amtTgt>0 ? Math.round(amtAch/amtTgt*100) : 0;
      const row = [b.BranchName, e.FullName];
      if(showInv) row.push(e.InvTarget||0, e.InvAch||0, ep+"%", e.DRR||0);
      if(showRD)  row.push(cntTgt, cntAch, cntPct+"%", amtTgt, amtAch, amtPct+"%");
      csvRows.push(row);
    });
  });
  const csv = csvRows.map(r=>r.join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  const a = document.createElement("a"); a.href=url;
  a.download=`Summary_${monthName(month)}_${year}_${currentType}.csv`; a.click();
});


// ── DAILY MONITOR ────────────────────────────────────────────
let _monitorTimer = null;

async function loadMonitor() {
  const date  = document.getElementById("monitor-date").value || todayISO();
  const view  = document.getElementById("monitor-view").value;
  const el    = document.getElementById("monitor-result");
  el.innerHTML = '<div class="loading-wrap"><div class="spinner-dark spinner"></div> Loading…</div>';

  const res = await api("getAllBranchDayStatus", { date });
  if(!res.ok) {
    el.innerHTML = `<div class="alert alert-error"><span>✕</span>${res.error||"Error"}</div>`;
    return;
  }

  let results = res.results || [];
  if(!results.length) { el.innerHTML = empty("No branch data"); return; }

  // Apply view filter
  if(view === "incomplete") results = results.filter(b => b.morningDone === 0 || b.eveningDone === 0);
  if(view === "partial")    results = results.filter(b =>
    (b.morningDone > 0 && !b.morningUnlocked) || (b.eveningDone > 0 && !b.eveningUnlocked));
  if(view === "complete")   results = results.filter(b => b.morningUnlocked && b.eveningUnlocked);

  if(!results.length) { el.innerHTML = empty("No branches match this filter"); return; }

  // Summary bar
  const total    = res.results.length;
  const mComplete = res.results.filter(b => b.morningUnlocked).length;
  const mPartial  = res.results.filter(b => b.morningDone > 0 && !b.morningUnlocked).length;
  const mNone     = res.results.filter(b => b.morningDone === 0).length;
  const eComplete = res.results.filter(b => b.eveningUnlocked).length;
  const ePartial  = res.results.filter(b => b.eveningDone > 0 && !b.eveningUnlocked).length;
  const eNone     = res.results.filter(b => b.eveningDone === 0).length;

  const statPill = (label, count, color) =>
    `<div style="text-align:center;padding:10px 16px;background:${color}18;border:1px solid ${color}44;border-radius:10px;min-width:80px">
      <div style="font-size:22px;font-weight:800;color:${color}">${count}</div>
      <div style="font-size:10px;font-weight:700;color:${color};opacity:.8;text-transform:uppercase;letter-spacing:.5px">${label}</div>
    </div>`;

  const summaryBar = `
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-bottom:20px;align-items:end">
      ${statPill("Total", total, "#1a56db")}
      <div style="display:flex;flex-direction:column;gap:6px">
        <div style="font-size:10px;font-weight:700;color:var(--t4);text-align:center;letter-spacing:.5px">☀️ MORNING</div>
        <div style="display:flex;gap:6px">
          ${statPill("None", mNone, "#c0392b")}
          ${statPill("Part", mPartial, "#c2770a")}
          ${statPill("Done", mComplete, "#0a6640")}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <div style="font-size:10px;font-weight:700;color:var(--t4);text-align:center;letter-spacing:.5px">🌙 EVENING</div>
        <div style="display:flex;gap:6px">
          ${statPill("None", eNone, "#c0392b")}
          ${statPill("Part", ePartial, "#c2770a")}
          ${statPill("Done", eComplete, "#0a6640")}
        </div>
      </div>
    </div>`;

  // Branch rows
  const statusIcon = (done, total, unlocked) => {
    if(done === 0)    return { icon:"🔴", label:`0/${total}`, color:"#c0392b", tag:"none" };
    if(!unlocked)     return { icon:"🟡", label:`${done}/${total}`, color:"#c2770a", tag:"partial" };
    return              { icon:"🟢", label:`${done}/${total}`, color:"#0a6640", tag:"complete" };
  };

  const branchRows = results.map(b => {
    const ms = statusIcon(b.morningDone, b.required, b.morningUnlocked);
    const es = statusIcon(b.eveningDone, b.required, b.eveningUnlocked);
    const pendingMNames = (b.pendingMorning||[]).map(e=>e.FullName).join(", ");
    const pendingENames = (b.pendingEvening||[]).map(e=>e.FullName).join(", ");
    const rowBg = ms.tag==="none" ? "background:#fff5f5" : ms.tag==="partial" ? "background:#fffbf0" : "";

    return `<div style="padding:12px 14px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;${rowBg}">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span style="font-weight:700;font-size:14px;flex:1;min-width:120px">${b.branchName}</span>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:11px;font-weight:700;color:var(--t4)">☀️</span>
          <span style="font-weight:700;color:${ms.color}">${ms.icon} ${ms.label}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:11px;font-weight:700;color:var(--t4)">🌙</span>
          <span style="font-weight:700;color:${es.color}">${es.icon} ${es.label}</span>
        </div>
        <span style="font-size:11px;color:var(--t4)">${b.onLeave ? b.onLeave+" on leave" : ""}</span>
      </div>
      ${pendingMNames ? `<div style="font-size:11px;color:#c2770a;margin-top:6px">☀️ Pending: ${pendingMNames}</div>` : ""}
      ${pendingENames ? `<div style="font-size:11px;color:#c2770a;margin-top:3px">🌙 Pending: ${pendingENames}</div>` : ""}
    </div>`;
  }).join("");

  el.innerHTML = summaryBar + branchRows;
}

document.getElementById("btn-load-monitor").addEventListener("click", loadMonitor);

document.getElementById("btn-auto-refresh-monitor").addEventListener("click", function() {
  if(_monitorTimer) {
    clearInterval(_monitorTimer);
    _monitorTimer = null;
    this.textContent = "⟳ Auto";
    this.style.background = "";
  } else {
    loadMonitor();
    _monitorTimer = setInterval(loadMonitor, 60000); // refresh every 60s
    this.textContent = "⟳ Live";
    this.style.background = "var(--green)";
    this.style.color = "#fff";
  }
});

// ── LOGOUT ────────────────────────────────────────────────────
document.getElementById("btn-logout").addEventListener("click", () => {
  A = { pwd:null, branches:[], employees:[] };
  document.getElementById("inp-admin-pwd").value="";
  document.getElementById("app").classList.remove("active");
  document.getElementById("screen-login").classList.add("active");
  showPanel("employees");
});

// ── ADMIN DOWNLOAD ───────────────────────────────────────────
document.getElementById("btn-adl-load").addEventListener("click", async () => {
  const fy         = document.getElementById("adl-fy").value;
  const type       = document.getElementById("adl-type").value;
  const branchName = document.getElementById("adl-branch").value || null;
  const btn = document.getElementById("btn-adl-load");
  btn.disabled=true; btn.textContent="Loading…";
  const res = await api("downloadReport", { adminPassword: A.pwd, branchName, FY: fy, type });
  btn.disabled=false; btn.textContent="Load & Download";

  const el = document.getElementById("adl-result");
  if(!res.ok){ el.innerHTML=`<div class="alert alert-error"><span>✕</span> ${res.error||"Error"}</div>`; return; }
  if(!res.rows?.length){ el.innerHTML=empty("No data found for selected criteria."); return; }

  const months = res.fyMonthDefs.map(d=>d.label);
  const isInv  = (type === "investment");

  // CSV
  const csvHdr = isInv
    ? ["Employee","Branch",...months.flatMap(m=>[m+" Target",m+" Ach",m+" Closing"]),"Total Ach","Total Closing"]
    : ["Employee","Branch",...months.flatMap(m=>[m+" Cnt Tgt",m+" Cnt Ach",m+" Amt Tgt",m+" Amt Ach"]),"Total Cnt Ach","Total Amt Ach"];
  const csvRows = [csvHdr];

  // Table header
  const thCells = isInv
    ? months.map(m=>`<th>${m} Tgt</th><th>${m} Ach</th><th>${m} Close</th>`).join("")
    : months.map(m=>`<th>${m} CntT</th><th>${m} CntA</th><th>${m} AmtT</th><th>${m} AmtA</th>`).join("");
  const thTotal = isInv ? `<th>Tot Ach</th><th>Tot Close</th>` : `<th>Tot Cnt</th><th>Tot Amt</th>`;

  let tableRows = "";
  res.rows.forEach(r => {
    let totAch=0,totClose=0,totCnt=0,totAmt=0;
    let cells=""; const csvCells=[r.FullName,r.BranchName];
    r.months.forEach(m=>{
      if(isInv){
        totAch+=m.invAch||0; totClose+=m.invClosing||0;
        cells+=`<td class="td-mono">${fmt(m.invTarget||0)}</td><td class="td-mono" style="color:var(--green)">${fmt(m.invAch||0)}</td><td class="td-mono">${fmt(m.invClosing||0)}</td>`;
        csvCells.push(m.invTarget||0, m.invAch||0, m.invClosing||0);
      } else {
        totCnt+=m.rdCntAch||0; totAmt+=m.rdAmtAch||0;
        cells+=`<td class="td-mono">${fmt(m.rdCntTarget||0)}</td><td class="td-mono" style="color:var(--teal)">${fmt(m.rdCntAch||0)}</td><td class="td-mono">${fmt(m.rdAmtTarget||0)}</td><td class="td-mono" style="color:var(--teal)">${fmt(m.rdAmtAch||0)}</td>`;
        csvCells.push(m.rdCntTarget||0,m.rdCntAch||0,m.rdAmtTarget||0,m.rdAmtAch||0);
      }
    });
    const totCells = isInv
      ? `<td class="td-mono" style="font-weight:700;color:var(--green)">${fmt(totAch)}</td><td class="td-mono">${fmt(totClose)}</td>`
      : `<td class="td-mono" style="font-weight:700;color:var(--teal)">${fmt(totCnt)}</td><td class="td-mono" style="font-weight:700">₹${fmt(totAmt)}</td>`;
    isInv ? csvCells.push(totAch,totClose) : csvCells.push(totCnt,totAmt);
    tableRows += `<tr><td class="td-name">${r.FullName}</td><td style="font-size:12px;color:var(--t3)">${r.BranchName}</td>${cells}${totCells}</tr>`;
    csvRows.push(csvCells);
  });

  const csv   = csvRows.map(r=>r.join(",")).join("\n");
  const url   = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  const fname = `IndividualTrack_${isInv?"Investment":"RD"}_${fy}_${branchName||"ALL"}.csv`;
  const label = `${isInv?"Investment":"RD"} — FY ${fy} — ${branchName||"All Branches"} (${res.rows.length} employees)`;

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <span style="font-weight:600;font-size:14px">${label}</span>
      <a href="${url}" download="${fname}" class="btn btn-primary btn-sm" style="text-decoration:none">⬇️ Download CSV</a>
    </div>
    <div class="table-wrap" style="overflow-x:auto">
      <table style="font-size:12px;white-space:nowrap">
        <thead><tr><th>Employee</th><th>Branch</th>${thCells}${thTotal}</tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>`;
});

// ── EMPLOYEE SEARCH — AI INTELLIGENCE REPORT ─────────────────
document.getElementById("btn-load-search").addEventListener("click", loadEmployeeSearch);
document.getElementById("search-emp-query").addEventListener("keydown", e => { if(e.key==="Enter") loadEmployeeSearch(); });

async function loadEmployeeSearch() {
  const query = document.getElementById("search-emp-query").value.trim();
  const el    = document.getElementById("search-result");
  if(!query) { el.innerHTML=`<div class="alert alert-error"><span>✕</span> Please enter an employee name or code.</div>`; return; }

  try {
    // Resolve employee — guard against null EmpID/FullName in employee list
    const emp = A.employees.find(e =>
      (
  (e.EmpID || "").toString().toLowerCase() === query) ||
(
  (e.FullName || "").toString().toLowerCase().includes(query))
    );
    if(!emp) { el.innerHTML=`<div class="alert alert-error"><span>✕</span> No employee found matching "${query}". Try the exact name or employee code.</div>`; return; }

    el.innerHTML=`<div class="loading-wrap"><div class="spinner-dark spinner"></div> Building full profile for <b>${emp.FullName}</b>…</div>`;
    document.getElementById("btn-download-search").style.display="none";

    const curDate  = new Date();
    const curMonth = curDate.getMonth()+1;
    const curYear  = curDate.getFullYear();
    const isBH     = emp.Role === "BRANCH_HEAD";

    const [histRes, disRes, lbRes, tgtRes] = await Promise.all([
      api("empHistory", { empId: emp.EmpID, year: curYear, month: curMonth,
                          isBH: isBH, branchName: emp.BranchName||emp.BranchID }),
      api("disciplineReport", { year: curYear, month: curMonth,
                                branchName: emp.BranchName||emp.BranchID }),
      api("leaderboardReport",{ year: curYear, month: curMonth,
                                branchName: emp.BranchName||emp.BranchID }),
      api("getTargets", { branchName: emp.BranchName||emp.BranchID })
    ]);

    if(!histRes.ok) {
      el.innerHTML=`<div class="alert alert-error"><span>✕</span> Could not load data: ${histRes.error||"Unknown error"}</div>`; return;
    }

    // empHistory returns:
    //   invMonthly, rdCntMonthly, rdAmtMonthly  (targets)
    //   invMonthAch, rdCntMonthAch, rdAmtMonthAch  (monthly achievement)
    //   invMonthBal, rdCntMonthBal, rdAmtMonthBal  (monthly balance)
    //   invYearly, rdCntYearly, rdAmtYearly  (annual targets)
    //   invYearAch, rdCntYearAch, rdAmtYearAch  (YTD achievement)
    //   invYearBal, rdCntYearBal, rdAmtYearBal  (YTD balance)
    //   drr  (daily run rate needed)
    //   rows[]  (day-by-day detail)

    const h = histRes;

    // Investment this month
    const invTgt    = h.invMonthly    || 0;
    const invAch    = h.invMonthAch   || 0;
    const invPct    = invTgt>0 ? Math.round(invAch/invTgt*100) : 0;
    const invBal    = h.invMonthBal   || 0;
    const invDRR    = h.drr           || 0;

    // RD this month
    const rdCntTgt  = h.rdCntMonthly  || 0;
    const rdCntAch  = h.rdCntMonthAch || 0;
    const rdAmtTgt  = h.rdAmtMonthly  || 0;
    const rdAmtAch  = h.rdAmtMonthAch || 0;
    const rdCntPct  = rdCntTgt>0 ? Math.round(rdCntAch/rdCntTgt*100) : 0;
    const rdAmtPct  = rdAmtTgt>0 ? Math.round(rdAmtAch/rdAmtTgt*100) : 0;

    // Yearly
    const invYearly   = h.invYearly   || 0;
    const invYearAch  = h.invYearAch  || 0;
    const rdCntYearly = h.rdCntYearly || 0;
    const rdCntYearAch= h.rdCntYearAch|| 0;
    const rdAmtYearly = h.rdAmtYearly || 0;
    const rdAmtYearAch= h.rdAmtYearAch|| 0;
    const ytdPct      = invYearly>0 ? Math.round(invYearAch/invYearly*100) : 0;

    // Discipline
    const disRow     = (disRes.ok ? disRes.rows||[] : []).find(r=>String(r.EmpID)===String(emp.EmpID)||r.FullName===emp.FullName)||{};
    const subRate    = disRow.SubmissionRate || 0;
    const subDays    = disRow.DaysSubmitted  || 0;
    const missDays   = disRow.DaysMissing    || 0;
    const lateDays   = disRow.LateEntries    || 0;

    // Count zero-ach days from day rows
    const dayRows    = h.rows || [];
    const zeroDays   = dayRows.filter(r=>r.Inv_Ach===0||r.Inv_Ach===null).length;

    // Leaderboard rank
    const lbRows     = lbRes.ok ? (lbRes.rows||[]) : [];
    const lbIdx      = lbRows.findIndex(r=>String(r.EmpID)===String(emp.EmpID)||r.FullName===emp.FullName);
    const lbRank     = lbIdx>=0 ? lbIdx+1 : null;
    const lbTotal    = lbRows.length;

    // Targets from getTargets
    const tgtRow     = (tgtRes.ok ? tgtRes.targets||[] : []).find(t=>String(t.EmpID)===String(emp.EmpID));
    // InvYearlyTarget, RDCountYearlyTarget, RDAmountYearlyTarget

    // ── AI ANALYTICS ──
    // Recent trend: last 5 day rows with ach > 0
    const validDays  = dayRows.filter(r=>(r.Inv_Ach||0)>0);
    const recentVals = validDays.slice(-5).map(r=>r.Inv_Ach||0);
    const trend      = recentVals.length>=2
    ? (recentVals[recentVals.length-1] > recentVals[0] ? "📈 Upward" : "📉 Downward")
    : "— Insufficient data";

    // Projected month-end based on avg daily achievement
    const avgDailyAch = validDays.length>0
    ? validDays.reduce((s,r)=>s+(r.Inv_Ach||0),0) / validDays.length : 0;
    const remainDays  = Math.max(0, invBal>0 && avgDailyAch>0 ? Math.round(invBal/avgDailyAch) : 0);

    // Risk score
    let riskScore = 0;
    if(invPct < 50)  riskScore += 30;
    else if(invPct < 75) riskScore += 15;
    if(subRate < 70) riskScore += 25;
    if(zeroDays > 5) riskScore += 20;
    if(missDays > 5) riskScore += 15;
    if(lateDays > 3) riskScore += 10;
    riskScore = Math.min(100, riskScore);
    const riskLabel = riskScore>=60 ? "🔴 High Risk" : riskScore>=35 ? "🟡 Medium Risk" : "🟢 Low Risk";
    const riskColor = riskScore>=60 ? "red" : riskScore>=35 ? "amber" : "green";

    // AI insights
    const insights = [];
    if(invPct>=90) insights.push({icon:"⭐",text:`Outstanding — Investment at ${invPct}%. On track to exceed monthly target.`,type:"green"});
    else if(invPct>=60) insights.push({icon:"📊",text:`Investment at ${invPct}% — steady performer, can push harder in remaining days.`,type:"blue"});
    else insights.push({icon:"⚠️",text:`Investment at only ${invPct}% — shortfall of ₹${fmt(Math.max(0,invBal))}. Requires immediate focus.`,type:"amber"});

    if(trend.includes("Upward")) insights.push({icon:"🚀",text:"Positive momentum — daily numbers improving over last 5 working days.",type:"green"});
    else if(trend.includes("Downward")) insights.push({icon:"📉",text:"Declining trend in recent days — review targets and motivation.",type:"red"});

    if(rdCntPct>=90) insights.push({icon:"✅",text:`RD count at ${rdCntPct}% — excellent conversion on RD submissions.`,type:"green"});
    else if(rdCntPct<50&&rdCntTgt>0) insights.push({icon:"🏦",text:`RD count only ${rdCntPct}% — only ${rdCntAch} of ${rdCntTgt} target achieved this month.`,type:"amber"});

    if(subRate>=95) insights.push({icon:"📋",text:"Perfect submission discipline — never misses a day.",type:"green"});
    else if(subRate<70) insights.push({icon:"🚨",text:`Submission rate at ${subRate}% — ${missDays} missing days this month. Attendance concern.`,type:"red"});

    if(zeroDays>5) insights.push({icon:"🔴",text:`${zeroDays} zero-achievement days this month — frequent blank days drag performance down.`,type:"red"});
    if(lateDays>3) insights.push({icon:"⏰",text:`${lateDays} late entries — may indicate morning commitment not being logged on time.`,type:"amber"});

    if(lbRank&&lbRank<=3) insights.push({icon:"🏆",text:`#${lbRank} in branch leaderboard — top performer this month!`,type:"green"});
    else if(lbRank&&lbTotal>0&&lbRank>lbTotal*0.7) insights.push({icon:"⬇️",text:`Ranked #${lbRank} of ${lbTotal} — in the bottom 30% of branch. Coaching opportunity.`,type:"amber"});

    const statusBadge = {ACTIVE:"badge-green",ON_LEAVE:"badge-amber",RESIGNED:"badge-red",INACTIVE:"badge-grey"}[emp.Status]||"badge-grey";
    const initials = emp.FullName.split(" ").map(w=>w[0]).join("").substring(0,2).toUpperCase();
    const monthLabel = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][curMonth-1];

    el.innerHTML = `
    <!-- PROFILE HEADER -->
    <div class="card" style="background:linear-gradient(135deg,var(--navy) 0%,#1e4080 100%);color:#fff;border:none;margin-bottom:14px">
    <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">
      <div style="width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;flex-shrink:0;border:2px solid rgba(255,255,255,.3)">${initials}</div>
      <div style="flex:1;min-width:180px">
        <div style="font-size:20px;font-weight:700">${emp.FullName} ${isBH?"👑":""}</div>
        <div style="font-size:12px;opacity:.7;margin-top:2px">${emp.EmpID} · ${emp.Designation||"—"} · ${isBH?"Branch Head":"Employee"}</div>
        <div style="font-size:12px;opacity:.7">🏢 ${emp.BranchName||emp.BranchID||"—"} · Joined ${displayDate(emp.JoinDate)||"—"}</div>
      </div>
      <span class="badge ${statusBadge}" style="font-size:12px;padding:5px 14px">${emp.Status}</span>
    </div>
    </div>

    <!-- RISK + RANK TILES -->
    <div class="tiles tiles-4" style="margin-bottom:14px">
    <div class="tile" style="border-left:4px solid var(--${riskColor})">
      <div class="tile-label">🤖 Risk Score</div>
      <div class="tile-value ${riskColor}">${riskScore}/100</div>
      <div class="tile-sub">${riskLabel}</div>
    </div>
    <div class="tile">
      <div class="tile-label">Branch Rank</div>
      <div class="tile-value blue">${lbRank?`#${lbRank}/${lbTotal}`:"—"}</div>
      <div class="tile-sub">${monthLabel} ${curYear}</div>
    </div>
    <div class="tile">
      <div class="tile-label">Daily Trend</div>
      <div class="tile-value" style="font-size:13px;margin-top:4px">${trend}</div>
      <div class="tile-sub">Avg daily: ₹${fmt(Math.round(avgDailyAch))}</div>
    </div>
    <div class="tile">
      <div class="tile-label">YTD Progress</div>
      <div class="tile-value ${progressColor(ytdPct)||"blue"}">${ytdPct}%</div>
      <div class="tile-sub">₹${fmt(invYearAch)} of ₹${fmt(invYearly)}</div>
    </div>
    </div>

    <!-- INVESTMENT THIS MONTH -->
    <div class="card">
    <div class="card-title"><span class="dot" style="background:var(--blue)"></span>💼 INVESTMENT — ${monthLabel} ${curYear}</div>
    <div class="tiles tiles-4" style="margin-bottom:8px">
      <div class="tile"><div class="tile-label">Monthly Target</div><div class="tile-value blue">₹${fmt(invTgt)}</div></div>
      <div class="tile"><div class="tile-label">Net Achievement</div><div class="tile-value green">₹${fmt(invAch)}</div></div>
      <div class="tile"><div class="tile-label">Achievement %</div><div class="tile-value ${progressColor(invPct)||"blue"}">${invPct}%</div></div>
      <div class="tile"><div class="tile-label">Shortfall / DRR</div><div class="tile-value amber">₹${fmt(Math.max(0,invBal))}<div class="tile-sub">DRR ₹${fmt(invDRR)}/day</div></div></div>
    </div>
    <div class="progress-wrap"><div class="progress-bar ${progressColor(invPct)||"blue"}" style="width:${Math.min(invPct,100)}%"></div></div>
    <div class="progress-label"><span>${invPct}% achieved</span><span>₹${fmt(invAch)} / ₹${fmt(invTgt)}</span></div>
    </div>

    <!-- RD THIS MONTH -->
    <div class="card">
    <div class="card-title"><span class="dot" style="background:var(--teal)"></span>🏦 RD — ${monthLabel} ${curYear}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr 1fr;gap:10px">
      <div class="tile"><div class="tile-label">Cnt Target</div><div class="tile-value blue">${fmt(rdCntTgt)}</div></div>
      <div class="tile"><div class="tile-label">Cnt Achieved</div><div class="tile-value teal">${fmt(rdCntAch)}</div></div>
      <div class="tile"><div class="tile-label">Cnt %</div><div class="tile-value ${progressColor(rdCntPct)||"blue"}">${rdCntPct}%</div></div>
      <div class="tile"><div class="tile-label">Amt Target</div><div class="tile-value blue">₹${fmt(rdAmtTgt)}</div></div>
      <div class="tile"><div class="tile-label">Amt Achieved</div><div class="tile-value teal">₹${fmt(rdAmtAch)}</div></div>
      <div class="tile"><div class="tile-label">Amt %</div><div class="tile-value ${progressColor(rdAmtPct)||"blue"}">${rdAmtPct}%</div></div>
    </div>
    </div>

    <!-- SUBMISSION DISCIPLINE -->
    <div class="card">
    <div class="card-title"><span class="dot" style="background:var(--purple)"></span>⚡ SUBMISSION DISCIPLINE</div>
    <div class="tiles tiles-4" style="margin-bottom:8px">
      <div class="tile"><div class="tile-label">Days Submitted</div><div class="tile-value blue">${subDays}</div></div>
      <div class="tile"><div class="tile-label">Days Missing</div><div class="tile-value ${missDays>5?"red":missDays>2?"amber":"green"}">${missDays}</div></div>
      <div class="tile"><div class="tile-label">Submission Rate</div><div class="tile-value ${progressColor(subRate)||"blue"}">${subRate}%</div></div>
      <div class="tile"><div class="tile-label">Late Entries</div><div class="tile-value ${lateDays>3?"red":lateDays>0?"amber":"green"}">${lateDays}<div class="tile-sub">Zero days: ${zeroDays}</div></div></div>
    </div>
    <div class="progress-wrap"><div class="progress-bar ${progressColor(subRate)||"blue"}" style="width:${Math.min(subRate,100)}%"></div></div>
    <div class="progress-label"><span>${subRate}% submission rate</span><span>${subDays} days submitted this month</span></div>
    </div>

    <!-- YEARLY SUMMARY -->
    <div class="card">
    <div class="card-title"><span class="dot" style="background:var(--amber)"></span>📊 YEARLY SUMMARY — FY ${h.fy||curYear}</div>
    <div class="tiles tiles-3" style="margin-bottom:14px">
      <div class="tile"><div class="tile-label">Annual Inv Target</div><div class="tile-value blue">₹${fmt(invYearly)}</div></div>
      <div class="tile"><div class="tile-label">YTD Inv Achievement</div><div class="tile-value green">₹${fmt(invYearAch)}</div></div>
      <div class="tile"><div class="tile-label">YTD Progress</div><div class="tile-value ${progressColor(ytdPct)||"blue"}">${ytdPct}%</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
      <div class="tile"><div class="tile-label">Annual RD Cnt Tgt</div><div class="tile-value blue">${fmt(rdCntYearly)}</div></div>
      <div class="tile"><div class="tile-label">YTD RD Cnt Ach</div><div class="tile-value teal">${fmt(rdCntYearAch)}</div></div>
      <div class="tile"><div class="tile-label">RD Cnt YTD %</div><div class="tile-value ${progressColor(rdCntYearly>0?Math.round(rdCntYearAch/rdCntYearly*100):0)||"blue"}">${rdCntYearly>0?Math.round(rdCntYearAch/rdCntYearly*100):0}%</div></div>
      <div class="tile"><div class="tile-label">Annual RD Amt Tgt</div><div class="tile-value blue">₹${fmt(rdAmtYearly)}</div></div>
      <div class="tile"><div class="tile-label">YTD RD Amt Ach</div><div class="tile-value teal">₹${fmt(rdAmtYearAch)}</div></div>
      <div class="tile"><div class="tile-label">RD Amt YTD %</div><div class="tile-value ${progressColor(rdAmtYearly>0?Math.round(rdAmtYearAch/rdAmtYearly*100):0)||"blue"}">${rdAmtYearly>0?Math.round(rdAmtYearAch/rdAmtYearly*100):0}%</div></div>
    </div>
    </div>

    <!-- DAY-BY-DAY THIS MONTH -->
    ${dayRows.length ? `<div class="card">
    <div class="card-title"><span class="dot" style="background:var(--teal)"></span>📅 DAY-BY-DAY — ${monthLabel} ${curYear}</div>
    <div class="table-wrap" style="overflow-x:auto"><table style="font-size:12px;white-space:nowrap">
      <thead><tr><th>Date</th><th>Inv Com</th><th>Inv Ach (Net)</th><th>RD Cnt Com</th><th>RD Cnt Ach</th><th>RD Amt Ach (Net)</th></tr></thead>
      <tbody>${dayRows.map(r=>{
        const ia=r.Inv_Ach; const isZero=(ia===0||ia===null);
        return`<tr style="${isZero?"background:#fff8f8":""}">
          <td class="td-mono">${r.Date||""}</td>
          <td class="td-mono">₹${fmt(r.Inv_Com||0)}</td>
          <td class="td-mono" style="color:var(--${isZero?"red":"green"})">${ia!==null?"₹"+fmt(ia):"—"}</td>
          <td class="td-mono">${fmt(r.RD_Count_Com||0)}</td>
          <td class="td-mono" style="color:var(--teal)">${fmt(r.RD_Count_Ach||0)}</td>
          <td class="td-mono" style="color:var(--teal)">₹${fmt(r.RD_Amount_Ach||0)}</td>
        </tr>`;
      }).join("")}</tbody>
    </table></div>
    </div>` : ""}

<div class="card" style="border-left:4px solid var(--purple)">
    <div class="card-title"><span class="dot" style="background:var(--purple)"></span>🤖 AI INSIGHTS & PREDICTIONS</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
      ${(typeof insights !== 'undefined' && insights.length) ? insights.map(ins=>`
        <div style="display:flex;gap:10px;padding:10px 14px;background:var(--${ins.type==="green"?"green":ins.type==="red"?"red":ins.type==="amber"?"amber":"blue"}-lt);border-radius:10px">
          <span style="font-size:16px;flex-shrink:0">${ins.icon}</span>
          <span style="font-size:13px;color:var(--t1);line-height:1.5">${ins.text}</span>
        </div>`).join("") : `<div class="alert alert-info"><span>ℹ️</span> Not enough data yet to generate insights.</div>`}
    </div>
    <div class="card-title"><span class="dot" style="background:var(--teal)"></span>🔮 NEXT STEPS</div>
    <div class="tiles tiles-3" style="margin-bottom:0">
      <div class="tile" style="border:2px dashed var(--border)">
        <div class="tile-label">Inv Shortfall Remaining</div>
        <div class="tile-value amber">₹${fmt(Math.max(0, (typeof invBal !== 'undefined' ? invBal : 0)))}</div>
        <div class="tile-sub">DRR needed: ₹${fmt(typeof invDRR !== 'undefined' ? invDRR : 0)}/day</div>
      </div>
      <div class="tile" style="border:2px dashed var(--border)">
        <div class="tile-label">RD Count Pending</div>
        <div class="tile-value teal">${fmt(Math.max(0, (typeof h !== 'undefined' ? h.rdCntMonthBal : 0)))}</div>
        <div class="tile-sub">of ${fmt(typeof rdCntTgt !== 'undefined' ? rdCntTgt : 0)} target</div>
      </div>
      <div class="tile" style="border:2px dashed var(--border)">
        <div class="tile-label">Est. Days to Close Inv</div>
        <div class="tile-value ${(typeof remainDays !== 'undefined' && remainDays > 15) ? "red" : (typeof remainDays !== 'undefined' && remainDays > 5) ? "amber" : "green"}">${(typeof avgDailyAch !== 'undefined' && avgDailyAch > 0) ? (typeof remainDays !== 'undefined' ? remainDays : "—") : "—"}</div>
        <div class="tile-sub">At current ₹${fmt(Math.round(typeof avgDailyAch !== 'undefined' ? avgDailyAch : 0))}/day pace</div>
      </div>
    </div>
    </div>

    <div class="card">
    <div class="card-title"><span class="dot" style="background:var(--t3)"></span>📋 EMPLOYEE PROFILE</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px">
      ${[
        ["Employee ID", emp.EmpID],
        ["Full Name", emp.FullName],
        ["Branch", emp.BranchName||emp.BranchID||"—"],
        ["Designation", emp.Designation||"—"],
        ["Role", (typeof isBH !== 'undefined' && isBH) ? "Branch Head 👑" : "Employee"],
        ["Status", emp.Status],
        ["Join Date", (typeof displayDate === 'function' ? displayDate(emp.JoinDate) : emp.JoinDate)||"—"],
        ["Phone", emp.Phone||"—"],
        ["Annual Inv Target", `₹${fmt(typeof tgtRow !== 'undefined' ? tgtRow.InvYearlyTarget : (typeof invYearly !== 'undefined' ? invYearly : 0))}`],
        ["Monthly Inv Target", `₹${fmt(typeof invTgt !== 'undefined' ? invTgt : 0)}`],
        ["RD Count Target (Yr)", fmt(typeof tgtRow !== 'undefined' ? tgtRow.RDCountYearlyTarget : (typeof rdCntYearly !== 'undefined' ? rdCntYearly : 0))],
        ["RD Amount Target (Yr)", `₹${fmt(typeof tgtRow !== 'undefined' ? tgtRow.RDAmountYearlyTarget : (typeof rdAmtYearly !== 'undefined' ? rdAmtYearly : 0))}`],
      ].map(([k,v])=>`<div style="padding:10px;background:var(--bg);border-radius:8px">
        <div style="font-size:10px;font-weight:700;color:var(--t4);text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">${k}</div>
        <div style="font-weight:600;color:var(--t1)">${v}</div>
      </div>`).join("")}
      ${emp.Notes?`<div style="padding:10px;background:var(--bg);border-radius:8px;grid-column:span 2">
        <div style="font-size:10px;font-weight:700;color:var(--t4);text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">Notes</div>
        <div style="color:var(--t2)">${emp.Notes}</div>
      </div>`:""}
    </div>
    </div>`;

    document.getElementById("btn-download-search").style.display="inline-flex";

  } catch(err) {
    console.error("Render Error:", err);
    document.getElementById("search-result").innerHTML =
      `<div class="alert alert-error"><span>✕</span> Unexpected error: ${err.message||err}. Please try again.</div>`;
  }
}

// Export employee report as CSV
document.getElementById("btn-download-search").addEventListener("click", () => {
  const query = (document.getElementById("search-emp-query").value || "").trim().toLowerCase();
  
  // FIXED: String conversion prevents .toLowerCase() from failing on numeric EmpIDs
  const emp = A.employees.find(e => {
    const id = e.EmpID ? String(e.EmpID).toLowerCase() : "";
    return id === query;
  });

  if(!emp) return;

  const rows = [
    ["IndividualTrack — Employee Intelligence Report"],
    ["Generated", new Date().toLocaleString("en-IN")],
    [""],
    ["Employee ID", String(emp.EmpID)],
    ["Full Name", emp.FullName],
    ["Branch", emp.BranchName||emp.BranchID||""],
    ["Designation", emp.Designation||""],
    ["Role", emp.Role || ""],
    ["Status", emp.Status],
    ["Join Date", emp.JoinDate||""],
    ["Phone", emp.Phone||""],
    ["Notes", emp.Notes||""],
  ];
  const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  const a=document.createElement("a"); a.href=url;
  a.download=`EmpReport_${emp.EmpID}.csv`; a.click();
});

// ── ANOMALY REPORT ───────────────────────────────────────────
document.getElementById("btn-load-ano").addEventListener("click", async () => {
  const branchName = document.getElementById("ano-branch").value || null;
  const month = document.getElementById("ano-month").value;
  const year  = document.getElementById("ano-year").value;
  const btn = document.getElementById("btn-load-ano");
  btn.disabled=true; btn.textContent="Loading…";
  const res = await api("getAnomalyReport", { adminPassword: A.pwd, branchName, month: Number(month), year: Number(year) });
  btn.disabled=false; btn.textContent="Load";

  const el = document.getElementById("ano-result");
  if(!res.ok){ el.innerHTML=`<div class="alert alert-error"><span>✕</span> ${res.error||"Error"}</div>`; return; }
  if(!res.total){ el.innerHTML=empty("No anomalies found for this period."); return; }

  // Summary tiles per branch
  const sev = {HIGH:"red",MEDIUM:"amber",LOW:"grey"};
  const summaryCards = (res.summary||[]).sort((a,b)=>b.total-a.total).map(b=>`
    <div class="card" style="padding:14px;min-width:160px">
      <div style="font-weight:700;font-size:13px;margin-bottom:6px;color:var(--t1)">${b.branch}</div>
      <div style="font-size:12px;margin-bottom:4px">Total: <b>${b.total}</b> &nbsp; Open: <b style="color:var(--red)">${b.OPEN}</b></div>
      <div style="font-size:11px;color:var(--t3)">
        🔴 HIGH: ${b.HIGH} &nbsp; 🟡 MED: ${b.MEDIUM} &nbsp; ⚪ LOW: ${b.LOW}
      </div>
      <div style="font-size:11px;color:var(--t3);margin-top:4px">${
        Object.entries(b.types||{}).map(([k,v])=>`${k}:${v}`).join(" · ")
      }</div>
    </div>`).join("");

  // Detail rows
  const detailRows = (res.anomalies||[]).map(a=>`
    <tr>
      <td style="font-size:11px;color:var(--t3);white-space:nowrap">${String(a.Timestamp||"").substring(0,16)}</td>
      <td style="font-weight:600;white-space:nowrap">${a.BranchName||""}</td>
      <td><code style="font-size:11px;background:var(--bg);padding:1px 5px;border-radius:3px">${a.FlagType||""}</code></td>
      <td><span class="badge badge-${sev[a.Severity]||"grey"}">${a.Severity||""}</span></td>
      <td style="font-size:11px;max-width:220px">${a.Details||""}</td>
      <td style="font-size:11px;color:var(--t3)">${a.EmpIDs||""}</td>
      <td><span class="badge badge-${a.Status==="OPEN"?"red":"green"}">${a.Status||""}</span></td>
    </tr>`).join("");

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;margin-bottom:18px">
      ${summaryCards}
    </div>
    <div class="table-wrap" style="overflow-x:auto">
      <table style="font-size:13px">
        <thead><tr>
          <th>Time</th><th>Branch</th><th>Flag Type</th><th>Severity</th>
          <th>Details</th><th>Emp IDs</th><th>Status</th>
        </tr></thead>
        <tbody>${detailRows}</tbody>
      </table>
    </div>`;
});