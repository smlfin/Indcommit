// ══════════════════════════════════════════════════════════════
//  IndividualTrack v3 — Frontend JavaScript
//  Links: index.html (entry) ↔ admin.html (HO) ↔ reports.html (branch)
//  All talk to the same Google Apps Script API
// ══════════════════════════════════════════════════════════════
const API = "https://script.google.com/macros/s/AKfycbz157zrRuJtbov5IbwdvCiCcuIB_jycObURZ7KQDbbLBfMDiiKhCVMZN1-tAJjYgAx2/exec";

// ── State ─────────────────────────────────────────────────────
let S = {
  branchName:null, empId:null, empName:null, role:null, bhEmpId:null,
  employees:[],  // all branch employees from login
  today:null,
  dayStatus:null, lockStatus:null,
  deviceHash:null,
  targets:null,      // { invMonthly, invYearly, rdCountMonthly, rdCountYearly, rdAmtMonthly, rdAmtYearly }
  perf:null,         // { invMonthAch, invYearAch, rdCntMonthAch, rdCntYearAch, rdAmtMonthAch }
  wd:null,           // { total, elapsed, remaining }
  history:[],        // array of morning log rows for this month (zero-streak check)
};

// ══════════════════════════════════════════════════════════════
//  DEVICE FINGERPRINT
// ══════════════════════════════════════════════════════════════
function buildFingerprint() {
  try {
    const p = [screen.width,screen.height,window.devicePixelRatio||1,
      navigator.language||"",navigator.hardwareConcurrency||0,
      Intl.DateTimeFormat().resolvedOptions().timeZone||"",
      navigator.platform||"",('ontouchstart' in window)?1:0];
    try {
      const c=document.createElement("canvas"), ctx=c.getContext("2d");
      ctx.textBaseline="top"; ctx.font="14px Arial";
      ctx.fillStyle="#f60"; ctx.fillRect(125,1,62,20);
      ctx.fillStyle="#069"; ctx.fillText("IT🔐",2,15);
      p.push(c.toDataURL().slice(-40));
    } catch(e){}
    const s=p.join("|"); let h=5381;
    for(let i=0;i<s.length;i++) h=((h<<5)+h)+s.charCodeAt(i);
    return (h>>>0).toString(16).padStart(8,"0");
  } catch(e){ return "unknown"; }
}

// ══════════════════════════════════════════════════════════════
//  API HELPER
// ══════════════════════════════════════════════════════════════
async function api(action, params={}) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(), 20000); // 20s timeout
    const res = await fetch(API, {
      method:"POST",
      body:JSON.stringify({action,...params}),
      signal:controller.signal,
    });
    clearTimeout(timer);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch(e) {
      // GAS returned HTML (auth redirect) or non-JSON
      console.error("GAS non-JSON response:", text.substring(0,200));
      return {ok:false, error:"INVALID_RESPONSE", message:"Server returned non-JSON. Check deployment permissions."};
    }
  } catch(e) {
    if(e.name==="AbortError") return {ok:false,error:"TIMEOUT",message:"Request timed out after 20s"};
    return {ok:false,error:"NETWORK_ERROR",message:e.message};
  }
}

// ══════════════════════════════════════════════════════════════
//  DATE & FORMAT HELPERS
// ══════════════════════════════════════════════════════════════
function todayISO() {
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function displayDate(iso) {
  if(!iso) return "";
  const [y,m,d]=iso.split("-");
  const days=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${days[new Date(y,m-1,d).getDay()]}, ${d} ${months[m-1]} ${y}`;
}
function greetingTime() {
  const h=new Date().getHours();
  return h<12?"Good morning":h<17?"Good afternoon":"Good evening";
}
function fmt(n) {
  if(n===null||n===undefined||n==="") return "–";
  const x=Number(n); if(isNaN(x)) return "–";
  return x.toLocaleString("en-IN");
}
function fmtRs(n) {
  if(n===null||n===undefined||n==="") return "–";
  const x=Number(n); if(isNaN(x)) return "–";
  return "₹"+x.toLocaleString("en-IN");
}
function monthName(m) {
  return ["January","February","March","April","May","June","July","August","September","October","November","December"][m-1]||"";
}

// ══════════════════════════════════════════════════════════════
//  WORKING DAYS (excludes Sundays + holidays)
// ══════════════════════════════════════════════════════════════
function calcWorkingDays(holidays=[]) {
  const now=new Date();
  const y=now.getFullYear(), m=now.getMonth(), today=now.getDate();
  const lastDay=new Date(y,m+1,0).getDate();
  const hlSet=new Set(holidays);
  let total=0, elapsed=0;
  for(let d=1;d<=lastDay;d++) {
    if(new Date(y,m,d).getDay()===0) continue; // Sunday
    const iso=`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    if(hlSet.has(iso)) continue;
    total++;
    if(d<=today) elapsed++;
  }
  return { total, elapsed, remaining:Math.max(0,total-elapsed) };
}

// ══════════════════════════════════════════════════════════════
//  UI HELPERS
// ══════════════════════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  document.getElementById("screen-"+id).classList.add("active");
}
function showTab(name) {
  document.querySelectorAll(".tab-btn").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));
  document.querySelectorAll(".tab-content").forEach(t=>t.classList.toggle("active",t.id==="tab-"+name));
}
function setBtn(id,loading,text) {
  const b=typeof id==="string"?document.getElementById(id):id;
  if(!b) return;
  if(loading){b.disabled=true;b.innerHTML=`<div class="spinner"></div> ${text||"Please wait…"}`;}
  else{b.disabled=false;b.innerHTML=`<span>${text}</span>`;}
}
function showAlert(id,type,msg) {
  const el=document.getElementById(id); if(!el) return;
  el.className=`alert alert-${type}`;
  el.innerHTML=`<span class="alert-icon">${type==="success"?"✓":type==="error"?"✕":"ℹ"}</span><span>${msg}</span>`;
  el.style.display="flex";
}
function hideAlert(id){const el=document.getElementById(id);if(el)el.style.display="none";}
function setText(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}
function errMsg(code) {
  const map={WRONG_PASSWORD:"Incorrect password.",BRANCH_NOT_FOUND:"Branch not found.",
    ALREADY_SUBMITTED:"Already submitted for today.",MORNING_NOT_SUBMITTED:"Submit morning entry first.",
    EMPLOYEE_ON_LEAVE:"This employee is on leave today.",FUTURE_DATE:"Cannot submit for a future date.",
    DATE_TOO_OLD:"This date is too old.",CASCADE_LOCKED:"Locked — team not ready.",
    NETWORK_ERROR:"Network error. Check connection.",SERVER_ERROR:"Server error. Try again.",
    EMP_NOT_FOUND:"Employee not found.",UNAUTHORIZED:"Incorrect admin password.",
    ALREADY_RESIGNED:"Already marked as resigned."};
  return map[code]||`Error: ${code}`;
}

// ══════════════════════════════════════════════════════════════
//  WARNING POPUP (Promise-based)
// ══════════════════════════════════════════════════════════════
let _popupResolve=null;
function showPopup({icon="⚠️",title,body,proceedText="Proceed Anyway",cancelText="Cancel",singleBtn=false}) {
  // If a previous popup was stuck, resolve it first
  if(_popupResolve){ _popupResolve(false); _popupResolve=null; }
  return new Promise(resolve=>{
    _popupResolve=resolve;
    setText("pw-icon",icon); setText("pw-title",title); setText("pw-body",body);
    setText("pw-proceed",proceedText); setText("pw-cancel",cancelText);
    document.getElementById("pw-acts").className="popup-acts"+(singleBtn?" single":"");
    document.getElementById("pw-cancel").style.display=singleBtn?"none":"";
    document.getElementById("popup-warn").classList.add("open");
  });
}
document.getElementById("pw-proceed").addEventListener("click",()=>{
  document.getElementById("popup-warn").classList.remove("open");
  if(_popupResolve){_popupResolve(true);_popupResolve=null;}
});
document.getElementById("pw-cancel").addEventListener("click",()=>{
  document.getElementById("popup-warn").classList.remove("open");
  if(_popupResolve){_popupResolve(false);_popupResolve=null;}
});

// ══════════════════════════════════════════════════════════════
//  INIT — Load branches on page load
// ══════════════════════════════════════════════════════════════
async function init() {
  S.deviceHash=buildFingerprint(); S.today=todayISO();
  const sel=document.getElementById("sel-branch");

  // Show loading state clearly
  sel.innerHTML='<option value="">⏳ Loading branches…</option>';
  sel.disabled=true;

  let res;
  try {
    res=await api("getPublicBranches");
  } catch(e) {
    sel.disabled=false;
    sel.innerHTML='<option value="">⚠️ Load failed</option>';
    showAlert("login-err1","error","Branch load error (JS): "+e.message);
    console.error("init() fetch threw:", e);
    return;
  }

  console.log("getPublicBranches response:", JSON.stringify(res));

  if(res.ok && res.branches?.length) {
    sel.innerHTML='<option value="">— Select Branch —</option>';
    res.branches.forEach(b=>{const o=document.createElement("option");o.value=b;o.textContent=b;sel.appendChild(o);});
    sel.disabled=false;
  } else {
    // Show exact error on screen instead of silently replacing with input
    sel.disabled=false;
    const errDetail = res.error || res.debug || res.message || JSON.stringify(res);
    sel.innerHTML='<option value="">⚠️ Could not load branches</option>';
    sel.disabled=false;
    showAlert("login-err1","error","Error: "+errDetail);
    console.error("getPublicBranches failed:", res);
    // Fallback text input so user can still type branch name
    const wrap = sel.parentElement;
    if(!document.getElementById("sel-branch-fallback")) {
      const inp = document.createElement("input");
      inp.type="text"; inp.id="sel-branch-fallback";
      inp.placeholder="Type your branch name here";
      inp.style.cssText="margin-top:8px;width:100%;padding:10px 14px;border:1.5px solid var(--border);border-radius:10px;font-size:15px;";
      wrap.appendChild(inp);
    }
  }
}

// ══════════════════════════════════════════════════════════════
//  LOGIN STEP 1
// ══════════════════════════════════════════════════════════════
document.getElementById("btn-branch-login").addEventListener("click", async()=>{
  const selEl = document.getElementById("sel-branch");
  const fallbackEl = document.getElementById("sel-branch-fallback");
  const branchName = ((selEl?.value||"") || (fallbackEl?.value||"")).trim();
  const pwd=document.getElementById("inp-branch-pwd").value.trim();
  hideAlert("login-err1");
  if(!branchName){showAlert("login-err1","error","Please select your branch.");return;}
  if(!pwd){showAlert("login-err1","error","Please enter the branch password.");return;}

  setBtn("btn-branch-login",true,"Verifying…");
  const res=await api("branchLogin",{branchName,password:pwd});
  setBtn("btn-branch-login",false,"Continue");

  if(!res.ok){
    const msg = res.error==="NETWORK_ERROR"
      ? "Network error. Check your connection and try again."
      : errMsg(res.error);
    showAlert("login-err1","error",msg); return;
  }
  S.branchName=branchName; S.bhEmpId=res.bhEmpId; S.employees=res.employees||[];

  const sel=document.getElementById("sel-employee");
  sel.innerHTML='<option value="">— Select your name —</option>';
  // Only show ACTIVE and ON_LEAVE — not RESIGNED/INACTIVE
  res.employees
    .filter(e=>e.Status!=="RESIGNED"&&e.Status!=="INACTIVE")
    .forEach(e=>{
      const o=document.createElement("option");
      o.value=e.EmpID;
      o.textContent=e.FullName+(e.Role==="BRANCH_HEAD"?" (BH)":"")+(e.Status==="ON_LEAVE"?" 🟡":""  );
      sel.appendChild(o);
    });

  document.getElementById("login-step1").classList.remove("active");
  document.getElementById("login-step2").classList.add("active");
});
document.getElementById("inp-branch-pwd").addEventListener("keydown",e=>{if(e.key==="Enter")document.getElementById("btn-branch-login").click();});
document.getElementById("btn-back-login").addEventListener("click",()=>{
  document.getElementById("login-step2").classList.remove("active");
  document.getElementById("login-step1").classList.add("active");
  hideAlert("login-err2");
});

// ══════════════════════════════════════════════════════════════
//  LOGIN STEP 2
// ══════════════════════════════════════════════════════════════
document.getElementById("btn-emp-select").addEventListener("click", async()=>{
  const sel=document.getElementById("sel-employee");
  const empId=sel.value; hideAlert("login-err2");
  if(!empId){showAlert("login-err2","error","Please select your name.");return;}
  const emp=S.employees.find(e=>String(e.EmpID)===String(empId));
  if(!emp){showAlert("login-err2","error","Employee not found.");return;}
  if(emp.Status==="RESIGNED"||emp.Status==="INACTIVE"){
    showAlert("login-err2","error","This account is no longer active.");return;
  }
  S.empId=empId; S.empName=emp.FullName; S.role=emp.Role;
  await enterMain();
});

// ══════════════════════════════════════════════════════════════
//  MAIN SCREEN
// ══════════════════════════════════════════════════════════════
async function enterMain() {
  showScreen("main");
  setText("topbar-branch-name",S.branchName);
  setText("greeting-time",greetingTime());
  setText("greeting-name",S.empName);
  setText("greeting-branch",S.branchName);
  const ds=displayDate(S.today);
  setText("morning-date-display",ds);
  setText("evening-date-display",ds);
  setText("team-date-display",ds);

  // BH check: role OR empId match against bhEmpId from branch login
  const isBH=S.role==="BRANCH_HEAD"||S.role==="BH"||String(S.empId)===String(S.bhEmpId);
  S.isBH=isBH;
  // Don't show bh-entry-section yet — loadTeamStatus will control it after cascade check

  await Promise.all([loadDayStatus(), loadTeamStatus(), loadPerformanceDashboard()]);
}

// ══════════════════════════════════════════════════════════════
//  PERFORMANCE DASHBOARD
// ══════════════════════════════════════════════════════════════
async function loadPerformanceDashboard() {
  const now=new Date(); const year=now.getFullYear(); const month=now.getMonth()+1;

  // empHistory now returns everything: targets + achievements in one call
  // BH gets data from BH_Morning/Evening logs via isBH flag
  const [hRes, hlRes] = await Promise.all([
    api("empHistory", {
      empId:      S.empId,
      year,       month,
      isBH:       S.isBH,
      branchName: S.isBH ? S.branchName : undefined,
    }),
    api("getHolidays", { year, month }),
  ]);

  // Working days (excludes Sundays + public holidays)
  const holidays = hlRes.ok ? (hlRes.holidays || []) : [];
  S.wd = calcWorkingDays(holidays);
  renderWD(month);

  if (!hRes.ok) {
    // Still show WD even if history fails
    document.getElementById("perf-dashboard").style.display = "block";
    return;
  }

  // History rows for zero-streak check
  S.history = hRes.rows || [];

  // Targets — empHistory returns yearly targets; monthly = yearly / 12
  const invYearly    = Number(hRes.invYearly    || 0);
  const rdCntYearly  = Number(hRes.rdCntYearly  || 0);
  const rdAmtYearly  = Number(hRes.rdAmtYearly  || 0);
  const invMonthly   = Number(hRes.invMonthly   || Math.round(invYearly   / 12));
  const rdCntMonthly = Number(hRes.rdCntMonthly || Math.round(rdCntYearly / 12));
  const rdAmtMonthly = Number(hRes.rdAmtMonthly || Math.round(rdAmtYearly / 12));
  S.targets = { invYearly, rdCntYearly, rdAmtYearly, invMonthly, rdCntMonthly, rdAmtMonthly };

  // Achievements
  S.perf = {
    invMonthAch:   Number(hRes.invMonthAch   || 0),
    rdCntMonthAch: Number(hRes.rdCntMonthAch || 0),
    rdAmtMonthAch: Number(hRes.rdAmtMonthAch || 0),
    invYearAch:    Number(hRes.invYearAch    || 0),
    rdCntYearAch:  Number(hRes.rdCntYearAch  || 0),
    rdAmtYearAch:  Number(hRes.rdAmtYearAch  || 0),
  };

  // Always show dashboard
  document.getElementById("perf-dashboard").style.display = "block";
  renderDashboard();
}

function renderWD(month) {
  const {total,elapsed,remaining}=S.wd;
  const pct=total>0?Math.round(elapsed/total*100):0;
  setText("wd-month-lbl",monthName(month));
  setText("wd-total",String(total)); setText("wd-elapsed",String(elapsed)); setText("wd-remaining",String(remaining));
  setText("wd-today-badge",`Day ${elapsed} of ${total}`);
  document.getElementById("wd-bar").style.width=pct+"%";
  setText("wd-pct",pct+"%");
}

function renderDashboard() {
  const T  = S.targets || {};
  const P  = S.perf    || {};
  const WD = S.wd      || { remaining: 1 };

  // Investment
  const invYrAch = P.invYearAch  || 0;
  const invMoAch = P.invMonthAch || 0;
  const invMoBal = Math.max(0, (T.invMonthly || 0) - invMoAch);
  const invYrBal = Math.max(0, (T.invYearly  || 0) - invYrAch);
  const invDRR   = WD.remaining > 0 ? Math.ceil(invMoBal / WD.remaining) : invMoBal;
  const drrPct   = T.invMonthly > 0 ? Math.min(100, Math.round(invMoAch / T.invMonthly * 100)) : 0;

  setText("inv-yr-tgt",  fmtRs(T.invYearly  || 0));
  setText("inv-yr-ach",  fmtRs(invYrAch));
  setText("inv-yr-bal",  fmtRs(invYrBal));
  setText("inv-mo-tgt",  fmtRs(T.invMonthly || 0));
  setText("inv-mo-ach",  fmtRs(invMoAch));
  setText("inv-mo-bal",  fmtRs(invMoBal));
  setText("inv-drr-val", invMoBal === 0 ? "₹0 — Target Met! 🎯" : fmtRs(invDRR) + "/day");
  setText("inv-drr-pct", drrPct + "%");

  const arc = document.getElementById("inv-drr-arc");
  if (arc) {
    arc.setAttribute("stroke-dashoffset", String(163 - (163 * drrPct / 100)));
    arc.setAttribute("stroke",
      drrPct >= 100 ? "#0a6640" :
      drrPct >=  75 ? "#1a56db" :
      drrPct >=  40 ? "#c2770a" : "#c0392b");
  }

  // RD Count
  const rdCntYrBal = Math.max(0, (T.rdCntYearly  || 0) - (P.rdCntYearAch  || 0));
  const rdCntMoBal = Math.max(0, (T.rdCntMonthly || 0) - (P.rdCntMonthAch || 0));
  setText("rd-yr-tgt",  fmt(T.rdCntYearly   || 0));
  setText("rd-yr-ach",  fmt(P.rdCntYearAch  || 0));
  setText("rd-yr-bal",  fmt(rdCntYrBal));
  setText("rd-mo-tgt",  fmt(T.rdCntMonthly  || 0));
  setText("rd-mo-ach",  fmt(P.rdCntMonthAch || 0));
  setText("rd-mo-bal",  fmt(rdCntMoBal));

  // RD Amount
  const rdAmtYrBal = Math.max(0, (T.rdAmtYearly  || 0) - (P.rdAmtYearAch  || 0));
  const rdAmtMoBal = Math.max(0, (T.rdAmtMonthly || 0) - (P.rdAmtMonthAch || 0));
  setText("rda-yr-tgt",  fmtRs(T.rdAmtYearly   || 0));
  setText("rda-yr-ach",  fmtRs(P.rdAmtYearAch  || 0));
  setText("rda-yr-bal",  fmtRs(rdAmtYrBal));
  setText("rda-mo-tgt",  fmtRs(T.rdAmtMonthly  || 0));
  setText("rda-mo-ach",  fmtRs(P.rdAmtMonthAch || 0));
  setText("rda-mo-bal",  fmtRs(rdAmtMoBal));

  // RD Amount DRR ring
  const rdaDRR    = WD.remaining > 0 ? Math.ceil(rdAmtMoBal / WD.remaining) : rdAmtMoBal;
  const rdaDrrPct = T.rdAmtMonthly > 0 ? Math.min(100, Math.round((P.rdAmtMonthAch||0) / T.rdAmtMonthly * 100)) : 0;
  setText("rda-drr-val", rdAmtMoBal === 0 ? "₹0 — Target Met! 🎯" : fmtRs(rdaDRR) + "/day");
  setText("rda-drr-pct", rdaDrrPct + "%");
  const rdaArc = document.getElementById("rda-drr-arc");
  if (rdaArc) {
    rdaArc.setAttribute("stroke-dashoffset", String(163 - (163 * rdaDrrPct / 100)));
    rdaArc.setAttribute("stroke",
      rdaDrrPct >= 100 ? "#0a6640" :
      rdaDrrPct >=  75 ? "#0e7c7b" :
      rdaDrrPct >=  40 ? "#c2770a" : "#c0392b");
  }
}

// ══════════════════════════════════════════════════════════════
//  DAY STATUS
// ══════════════════════════════════════════════════════════════
async function loadDayStatus() {
  const res=await api("getDayStatus",{date:S.today,branchName:S.branchName,empId:S.empId});
  if(!res.ok) {
    // Network hiccup — don't clear existing UI state
    if(res.error==="NETWORK_ERROR") showAlert("morning-alert","error","Could not refresh status. Check connection.");
    return;
  } S.dayStatus=res;

  if(res.morningDone) {
    document.getElementById("morning-submitted-banner").style.display="block";
    document.getElementById("morning-form-wrap").style.display="none";
    // Show reference card if data available
    if(res.morningData) {
      setText("ref-inv",    fmtRs(res.morningData.Inv_Com||0));
      setText("ref-rd-count", fmt(res.morningData.RD_Count_Com||0));
      setText("ref-rd-amount",fmtRs(res.morningData.RD_Amount_Com||0));
      document.getElementById("morning-ref-card").style.display="block";
    } else {
      document.getElementById("morning-ref-card").style.display="none";
    }
    // Always unlock evening form when morning is done — regardless of morningData
    document.getElementById("no-morning-alert").style.display="none";
    document.getElementById("evening-form-inner").style.display="block";
  } else {
    document.getElementById("morning-submitted-banner").style.display="none";
    document.getElementById("morning-form-wrap").style.display="block";
    document.getElementById("morning-ref-card").style.display="none";
    document.getElementById("no-morning-alert").style.display="flex";
    document.getElementById("evening-form-inner").style.display="none";
  }

  if(res.eveningDone) {
    document.getElementById("evening-submitted-banner").style.display="block";
    document.getElementById("evening-form-wrap").style.display="none";
  } else {
    document.getElementById("evening-submitted-banner").style.display="none";
    document.getElementById("evening-form-wrap").style.display="block";
  }
}

// ══════════════════════════════════════════════════════════════
//  TEAM STATUS
// ══════════════════════════════════════════════════════════════
async function loadTeamStatus() {
  const res=await api("getBranchLockStatus",{date:S.today,branchName:S.branchName});
  if(!res.ok) return; S.lockStatus=res;

  const req=res.required||1;
  const mCnt=res.morningSubmittedCount||0;
  const eCnt=res.eveningSubmittedCount||0;
  const mPct=Math.round(mCnt/req*100);
  const ePct=Math.round(eCnt/req*100);

  // Use stored isBH (set during enterMain)
  const isBH = S.isBH || S.role==="BRANCH_HEAD" || S.role==="BH" || String(S.empId)===String(S.bhEmpId);

  // Morning panel — only show names of pending members if BH, otherwise generic message
  const mUnlocked=res.morningUnlocked;
  document.getElementById("lock-morning-panel").className="lock-panel "+(mUnlocked?"unlocked":"locked");
  setText("lock-morning-title",mUnlocked?"☀️ Morning — All Submitted ✓":"☀️ Morning — Pending Submissions");
  if(mUnlocked) {
    setText("lock-morning-desc","All active employees have submitted.");
  } else {
    const pendingNames=(res.pendingMorning||[]).map(e=>e.FullName||e);
    if(isBH) {
      setText("lock-morning-desc",`Waiting for: ${pendingNames.join(", ")}`);
    } else {
      // Non-BH: just show count, not names
      setText("lock-morning-desc",`${pendingNames.length} member(s) yet to submit morning entry.`);
    }
  }
  document.getElementById("lock-morning-bar").style.width=mPct+"%";
  document.getElementById("lock-morning-bar").className="progress-bar "+(mUnlocked?"green":"amber");
  setText("lock-morning-count",`${mCnt} of ${req} submitted`);
  setText("lock-morning-pct",mPct+"%");

  // Evening panel
  const eUnlocked=res.eveningUnlocked;
  document.getElementById("lock-evening-panel").className="lock-panel "+(eUnlocked?"unlocked":"locked");
  setText("lock-evening-title",eUnlocked?"🌙 Evening — All Submitted ✓":"🌙 Evening — Pending Submissions");
  if(eUnlocked) {
    setText("lock-evening-desc","All active employees have submitted.");
  } else {
    const pendingNames=(res.pendingEvening||[]).map(e=>e.FullName||e);
    if(isBH) {
      setText("lock-evening-desc",`Waiting for: ${pendingNames.join(", ")}`);
    } else {
      setText("lock-evening-desc",`${pendingNames.length} member(s) yet to submit evening entry.`);
    }
  }
  document.getElementById("lock-evening-bar").style.width=ePct+"%";
  document.getElementById("lock-evening-bar").className="progress-bar "+(eUnlocked?"green":"amber");
  setText("lock-evening-count",`${eCnt} of ${req} submitted`);
  setText("lock-evening-pct",ePct+"%");

  renderTeamList(res);
}

function renderTeamList(lockData) {
  const list=document.getElementById("team-list");
  const isBH=S.isBH||S.role==="BRANCH_HEAD"||S.role==="BH"||String(S.empId)===String(S.bhEmpId);
  const onLeave=(lockData.onLeaveList||[]).map(String);
  const pendingM=(lockData.pendingMorning||[]).map(e=>String(e.EmpID||e));
  const pendingE=(lockData.pendingEvening||[]).map(e=>String(e.EmpID||e));

  // S.employees already contains only this branch's employees (filtered by branchLogin in GS)
  const activeEmps=S.employees.filter(e=>e.Status!=="RESIGNED"&&e.Status!=="INACTIVE");
  if(!activeEmps.length){list.innerHTML="<p style='color:var(--t4);text-align:center;padding:16px'>No team data</p>";return;}

  list.innerHTML=activeEmps.map(emp=>{
    const eid=String(emp.EmpID);
    const isLeave=onLeave.includes(eid)||emp.Status==="ON_LEAVE";
    const mDone=!pendingM.includes(eid)&&!isLeave;
    const eDone=!pendingE.includes(eid)&&!isLeave;
    const init=emp.FullName.split(" ").map(w=>w[0]||"").join("").substring(0,2).toUpperCase();
    const isBHEmp=emp.Role==="BRANCH_HEAD"||eid===String(S.bhEmpId);

    let actions="";
    if(isBH && !isBHEmp) {
      const leaveIsMarked=isLeave;
      actions=`
        <button class="leave-btn ${leaveIsMarked?"cancel":"mark"}" data-eid="${eid}" data-name="${emp.FullName}" data-leave="${leaveIsMarked}">
          ${leaveIsMarked?"Cancel Leave":"Leave"}
        </button>
        <button class="btn-resign" data-eid="${eid}" data-name="${emp.FullName}" style="margin-left:4px">Resign</button>
      `;
    }

    const statusTxt=isLeave?"On Leave 🟡":mDone?(eDone?"Full Day ✓":"Morning ✓"):"Pending";
    const dotCls=isLeave?"leave":mDone?"done":"pending";

    return `<div class="emp-row">
      <div class="emp-avatar ${isLeave?"leave":isBHEmp?"bh":""}">${isLeave?"–":init}</div>
      <div style="flex:1;min-width:0">
        <div class="emp-name">${emp.FullName}${isBHEmp?" 👑":""}</div>
        <div class="emp-status">
          <span class="status-dot ${dotCls}"></span>
          <span style="font-size:11px;color:var(--t3)">${statusTxt}</span>
        </div>
      </div>
      <div style="display:flex;gap:4px;align-items:center;flex-shrink:0">${actions}</div>
    </div>`;
  }).join("");

  list.querySelectorAll(".leave-btn").forEach(btn=>{
    btn.addEventListener("click",()=>openLeaveModal(btn.dataset.eid,btn.dataset.name,btn.dataset.leave==="true"));
  });
  list.querySelectorAll(".btn-resign").forEach(btn=>{
    btn.addEventListener("click",()=>openResignModal(btn.dataset.eid,btn.dataset.name));
  });
}

// ══════════════════════════════════════════════════════════════
//  ZERO-STREAK CHECK (f: ≤5 inv zeros, ≤3 RD zeros)
// ══════════════════════════════════════════════════════════════
async function checkZeroStreak(invVal,rdVal) {
  // S.history = morning+evening rows for this month, sorted ascending
  // We need to check commitment (Inv_Com) streaks, not achievement
  const hist=[...S.history].sort((a,b)=>(a.Date||"")>(b.Date||"")?-1:1); // newest first
  let invStreak=0, rdStreak=0;
  // Count consecutive zero-commitment days from history
  for(const r of hist) {
    if((Number(r.Inv_Com)||0)===0) invStreak++;
    else break;
  }
  for(const r of hist) {
    if((Number(r.RD_Count_Com)||0)===0 && (Number(r.RD_Amount_Com)||0)===0) rdStreak++;
    else break;
  }

  const todayInvZero=(Number(invVal)||0)===0;
  const todayRdZero=(Number(rdVal)||0)===0;

  // Hard block: 5+ consecutive zeros for Inv
  if(todayInvZero && invStreak>=5) {
    await showPopup({icon:"🚫",title:"Investment Zero Limit Reached",
      body:`You have entered ZERO investment commitment for ${invStreak} consecutive days.\n\nThe limit is 5 days. Please enter a commitment value.`,
      proceedText:"Edit Entry",singleBtn:true});
    return false;
  }
  // Hard block: 3+ consecutive zeros for RD
  if(todayRdZero && rdStreak>=3) {
    await showPopup({icon:"🚫",title:"RD Zero Limit Reached",
      body:`You have entered ZERO RD commitment for ${rdStreak} consecutive days.\n\nThe limit is 3 days. Please enter a commitment value.`,
      proceedText:"Edit Entry",singleBtn:true});
    return false;
  }
  // Soft warning: day 4 of inv zeros
  if(todayInvZero && invStreak>=4) {
    const ok=await showPopup({icon:"⚠️",title:"Investment Zero Streak Warning",
      body:`This would be day ${invStreak+1} of zero Investment commitment.\nYou have 1 more day before it is blocked.\n\nConsider entering a commitment.`,
      proceedText:"Proceed Anyway",cancelText:"Edit Entry"});
    if(!ok) return false;
  }
  // Soft warning: day 2 of RD zeros
  if(todayRdZero && rdStreak>=2) {
    const ok=await showPopup({icon:"⚠️",title:"RD Zero Streak Warning",
      body:`This would be day ${rdStreak+1} of zero RD commitment.\nYou have 1 more day before it is blocked.\n\nConsider entering a commitment.`,
      proceedText:"Proceed Anyway",cancelText:"Edit Entry"});
    if(!ok) return false;
  }
  return true;
}

// ══════════════════════════════════════════════════════════════
//  UNDER-COMMITMENT CHECK (g: commitment < DRR → warning)
// ══════════════════════════════════════════════════════════════
async function checkUnderCommitment(invVal) {
  const T=S.targets||{}; const P=S.perf||{}; const WD=S.wd||{remaining:1};
  const invMoBal=Math.max(0,(T.invMonthly||0)-(P.invMonthAch||0));
  const invDRR=WD.remaining>0?Math.ceil(invMoBal/WD.remaining):invMoBal;
  const inv=Number(invVal)||0;
  if(invDRR>0 && inv>0 && inv<invDRR) {
    const ok=await showPopup({icon:"📉",title:"Under-Commitment Alert",
      body:`Your commitment of ${fmtRs(inv)} is below your DRR.\n\nMonthly Balance: ${fmtRs(invMoBal)}\nRequired DRR: ${fmtRs(invDRR)}\nYou entered: ${fmtRs(inv)}\n\nDo you want to proceed?`,
      proceedText:"Yes, Proceed",cancelText:"Edit Entry"});
    if(!ok) return false;
  }
  return true;
}

// ══════════════════════════════════════════════════════════════
//  MORNING SUBMIT
// ══════════════════════════════════════════════════════════════
document.getElementById("btn-morning-submit").addEventListener("click", async()=>{
  hideAlert("morning-alert");
  // Guard: already submitted?
  if (document.getElementById("morning-submitted-banner").style.display === "block") return;

  // BH: wait for all team members to submit first
  if (S.isBH) {
    const lock = await api("getBranchLockStatus", {date:S.today, branchName:S.branchName});
    if (!lock.ok || !lock.morningUnlocked) {
      const pending = (lock.pendingMorning||[]).map(e=>e.FullName).join(", ");
      showAlert("morning-alert","error",
        "🔒 Wait for all team members to submit first." +
        (pending ? " Pending: " + pending : ""));
      return;
    }
  }

  const inv=document.getElementById("m-inv-com").value;
  const rdCnt=document.getElementById("m-rd-count").value;
  const rdAmt=document.getElementById("m-rd-amount").value;
  if(!inv&&!rdAmt&&!rdCnt){showAlert("morning-alert","error","Enter at least one commitment value (Investment or RD).");return;}
  if(inv && isNaN(Number(inv))){showAlert("morning-alert","error","Investment commitment must be a number.");return;}
  if(rdAmt && isNaN(Number(rdAmt))){showAlert("morning-alert","error","RD Amount must be a number.");return;}
  if(Number(inv)<0||Number(rdAmt)<0){showAlert("morning-alert","error","Values cannot be negative.");return;}

  const zOk=await checkZeroStreak(inv,rdCnt||rdAmt);
  if(!zOk) return;
  const uOk=await checkUnderCommitment(inv);
  if(!uOk) return;

  setBtn("btn-morning-submit",true,"Submitting…");
  let mRes;
  try {
    mRes=await api("empMorning",{
      date:S.today,empId:S.empId,branchName:S.branchName,
      inv_com:Number(inv)||0,rd_count_com:Number(rdCnt)||0,rd_amount_com:Number(rdAmt)||0,
      deviceHash:S.deviceHash,
    });
  } catch(e) {
    setBtn("btn-morning-submit",false,"Submit Morning Commitment");
    showAlert("morning-alert","error","Network error — please try again.");
    return;
  }
  setBtn("btn-morning-submit",false,"Submit Morning Commitment");
  const res=mRes;
  if(!res.ok){showAlert("morning-alert","error",errMsg(res.error)+" ("+res.error+")");return;}

  document.getElementById("morning-submitted-banner").style.display="block";
  document.getElementById("morning-form-wrap").style.display="none";
  setText("ref-inv",fmtRs(inv||0));
  setText("ref-rd-count",fmt(rdCnt||0));
  setText("ref-rd-amount",fmtRs(rdAmt||0));
  document.getElementById("morning-ref-card").style.display="block";
  document.getElementById("no-morning-alert").style.display="none";
  document.getElementById("evening-form-inner").style.display="block";
  await loadTeamStatus();
  await loadPerformanceDashboard();
});

// ══════════════════════════════════════════════════════════════
//  EVENING SUBMIT
// ══════════════════════════════════════════════════════════════
document.getElementById("mat-toggle").addEventListener("change",function(){
  document.getElementById("mat-fields").classList.toggle("open",this.checked);
});

document.getElementById("btn-evening-submit").addEventListener("click", async()=>{
  hideAlert("evening-alert");
  // Guard: already submitted?
  if (document.getElementById("evening-submitted-banner").style.display === "block") return;

  // BH: wait for all team members to submit first
  if (S.isBH) {
    const lock = await api("getBranchLockStatus", {date:S.today, branchName:S.branchName});
    if (!lock.ok || !lock.eveningUnlocked) {
      const pending = (lock.pendingEvening||[]).map(e=>e.FullName).join(", ");
      showAlert("evening-alert","error",
        "🔒 Wait for all team members to submit first." +
        (pending ? " Pending: " + pending : ""));
      return;
    }
  }

  const invAch=document.getElementById("e-inv-ach").value;
  const invClose=document.getElementById("e-inv-closing").value;
  const rdCnt=document.getElementById("e-rd-count").value;
  const rdAmt=document.getElementById("e-rd-amount").value;
  const matOn=document.getElementById("mat-toggle").checked;

  setBtn("btn-evening-submit",true,"Submitting…");
  const res=await api("empEvening",{
    date:S.today,empId:S.empId,branchName:S.branchName,
    inv_ach:Number(invAch)||0,inv_closing_count:Number(invClose)||0,
    rd_count_ach:Number(rdCnt)||0,rd_amount_ach:Number(rdAmt)||0,
    rd_mat_emi:matOn?Number(document.getElementById("e-mat-emi").value)||0:0,
    rd_mat_total:matOn?Number(document.getElementById("e-mat-total").value)||0:0,
    deviceHash:S.deviceHash,
  });
  setBtn("btn-evening-submit",false,"Submit Evening Achievement");

  if(!res.ok){showAlert("evening-alert","error",errMsg(res.error));return;}
  document.getElementById("evening-submitted-banner").style.display="block";
  document.getElementById("evening-form-wrap").style.display="none";
  await loadTeamStatus(); await loadPerformanceDashboard();
});

// ══════════════════════════════════════════════════════════════
//  LEAVE MODAL
// ══════════════════════════════════════════════════════════════
let _leaveTarget=null;
function openLeaveModal(empId,name,isLeave) {
  _leaveTarget={empId,name,isLeave};
  document.getElementById("modal-leave").style.display="flex";
  setText("leave-modal-title",isLeave?`Cancel Leave — ${name}`:`Mark Leave — ${name}`);
  setText("leave-modal-desc",isLeave
    ?`Cancel leave for ${name}? They will need to submit today's entry.`
    :`Mark ${name} as on leave today? Their status will be set to ON_LEAVE.`);
}
document.getElementById("btn-leave-cancel-modal").addEventListener("click",()=>{
  document.getElementById("modal-leave").style.display="none"; _leaveTarget=null;
});
document.getElementById("btn-leave-confirm").addEventListener("click", async()=>{
  if(!_leaveTarget) return;
  const {empId,name,isLeave}=_leaveTarget;
  document.getElementById("modal-leave").style.display="none";
  const res=await api(isLeave?"cancelLeave":"markLeave",{
    date:S.today,empId,branchName:S.branchName,
    markedBy:S.empId,cancelledBy:S.empId,
  });
  if(res.ok) {
    // Update local employee status to reflect leave change immediately
    const newStatus = isLeave ? "ACTIVE" : "ON_LEAVE";
    S.employees=S.employees.map(e=>String(e.EmpID)===String(empId)?{...e,Status:newStatus}:e);
    await loadTeamStatus();
  } else {
    await showPopup({icon:"❌",title:"Error",body:errMsg(res.error),proceedText:"OK",singleBtn:true});
  }
  _leaveTarget=null;
});

// ══════════════════════════════════════════════════════════════
//  RESIGN MODAL (BH power — requires admin password)
// ══════════════════════════════════════════════════════════════
let _resignTarget=null;
function openResignModal(empId,name) {
  _resignTarget={empId,name};
  setText("resign-modal-title",`Resign — ${name}`);
  document.getElementById("resign-date-inp").value=S.today;
  document.getElementById("resign-admin-pwd").value="";
  document.getElementById("resign-alert").style.display="none";
  document.getElementById("modal-resign").style.display="flex";
}
document.getElementById("btn-resign-cancel").addEventListener("click",()=>{
  document.getElementById("modal-resign").style.display="none"; _resignTarget=null;
});
document.getElementById("btn-resign-confirm").addEventListener("click", async()=>{
  if(!_resignTarget) return;
  const resignDate=document.getElementById("resign-date-inp").value;
  const adminPwd=document.getElementById("resign-admin-pwd").value.trim();
  if(!resignDate){
    document.getElementById("resign-alert").style.display="flex";
    setText("resign-alert-msg","Enter resignation date."); return;
  }
  if(!adminPwd){
    document.getElementById("resign-alert").style.display="flex";
    setText("resign-alert-msg","Enter admin password."); return;
  }
  setBtn("btn-resign-confirm",true,"Processing…");
  const res=await api("markResigned",{
    adminPassword:adminPwd,EmpID:_resignTarget.empId,resignDate,markedBy:S.empId
  });
  setBtn("btn-resign-confirm",false,"Yes, Resign");

  if(res.ok) {
    document.getElementById("modal-resign").style.display="none";
    S.employees=S.employees.map(e=>String(e.EmpID)===String(_resignTarget.empId)?{...e,Status:"RESIGNED"}:e);
    await showPopup({icon:"✅",title:"Resigned",
      body:`${_resignTarget.name} has been marked as resigned and disabled from future entries.`,
      proceedText:"OK",singleBtn:true});
    await loadTeamStatus();
  } else {
    document.getElementById("resign-alert").style.display="flex";
    setText("resign-alert-msg",errMsg(res.error));
  }
  _resignTarget=null;
});

// ══════════════════════════════════════════════════════════════
//  TABS, REFRESH, LOGOUT
// ══════════════════════════════════════════════════════════════
document.querySelectorAll(".tab-btn").forEach(btn=>{
  btn.addEventListener("click",()=>showTab(btn.dataset.tab));
});

document.getElementById("btn-refresh-team").addEventListener("click", async()=>{
  const btn=document.getElementById("btn-refresh-team");
  btn.textContent="…"; btn.disabled=true;
  await loadTeamStatus();
  btn.textContent="Refresh"; btn.disabled=false;
});

document.getElementById("btn-logout").addEventListener("click",()=>{
  S={branchName:null,empId:null,empName:null,role:null,isBH:false,bhEmpId:null,
    employees:[],today:todayISO(),dayStatus:null,lockStatus:null,
    deviceHash:buildFingerprint(),targets:null,perf:null,wd:null,history:[]};
  // Clear all form inputs
  ["m-inv-com","m-rd-count","m-rd-amount",
   "e-inv-ach","e-inv-closing","e-rd-count","e-rd-amount","e-mat-emi","e-mat-total",
   "inp-branch-pwd"]
    .forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
  document.getElementById("mat-toggle").checked=false;
  document.getElementById("mat-fields").classList.remove("open");
  // Reset banners and form visibility
  document.getElementById("morning-submitted-banner").style.display="none";
  document.getElementById("morning-form-wrap").style.display="block";
  document.getElementById("morning-ref-card").style.display="none";
  document.getElementById("no-morning-alert").style.display="flex";
  document.getElementById("evening-form-inner").style.display="none";
  document.getElementById("evening-submitted-banner").style.display="none";
  document.getElementById("evening-form-wrap").style.display="block";
  document.getElementById("perf-dashboard").style.display="none";
  // Reset greeting
  setText("greeting-name","–"); setText("greeting-branch","–"); setText("topbar-branch-name","");
  // Reset employee selector
  document.getElementById("sel-employee").innerHTML="<option value=''>Select your name</option>";
  hideAlert("morning-alert"); hideAlert("evening-alert"); hideAlert("login-err1"); hideAlert("login-err2");
  document.getElementById("login-step1").classList.add("active");
  document.getElementById("login-step2").classList.remove("active");
  showScreen("login"); showTab("morning");
});

// ══════════════════════════════════════════════════════════════
//  START
// ══════════════════════════════════════════════════════════════
init();
