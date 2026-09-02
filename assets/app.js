const API="http://127.0.0.1:8000/api/v1";
async function api(path){const r=await fetch(API+path);if(!r.ok)throw new Error(path+" "+r.status);return (await r.json()).data}
function fmt(n){n=Number(n)||0;const a=Math.abs(n);if(a>=1e9)return(n/1e9).toFixed(1)+"B";if(a>=1e6)return(n/1e6).toFixed(1)+"M";if(a>=1e3)return(n/1e3).toFixed(1)+"K";return String(Math.round(n))}
function ago(iso){if(!iso)return"—";const d=Date.now()-new Date(iso).getTime();if(d<0)return"just now";const m=Math.floor(d/60000);if(m<1)return"just now";if(m<60)return m+"m ago";const h=Math.floor(m/60);if(h<24)return h+"h ago";return Math.floor(h/24)+"d ago"}
function byId(id){return document.getElementById(id)}
function nav(active){document.querySelectorAll(".nav a").forEach(a=>a.classList.toggle("active",a.dataset.page===active))}
function shell(title,subtitle,active,body){
 document.body.innerHTML=`<div class="app"><aside class="sidebar"><div class="brand"><div class="brand-mark">CT</div><div><span>Claude Telemetry</span><small>Enterprise Console</small></div><button class="sidebar-toggle" aria-label="Minimize sidebar" title="Minimize sidebar" onclick="toggleSidebar()">‹</button></div>
 <div class="nav-section">Observe</div><nav class="nav">
 <a data-page="overview" href="index.html"><i class="dot"></i><span>Overview</span></a>
 <a data-page="projects" href="projects.html"><i class="dot"></i><span>Projects</span></a>
 <a data-page="requests" href="requests.html"><i class="dot"></i><span>Requests</span></a>
 <a data-page="sessions" href="sessions.html"><i class="dot"></i><span>Sessions</span></a>
 <a data-page="tools" href="tools.html"><i class="dot"></i><span>Tools</span></a>
 <a data-page="skills" href="skills.html"><i class="dot"></i><span>Skills</span></a>
 <a data-page="clients" href="clients.html"><i class="dot"></i><span>Clients & IDEs</span></a>
 </nav><div class="nav-section">Manage</div><nav class="nav"><a data-page="settings" href="settings.html"><i class="dot"></i><span>Telemetry settings</span></a></nav>
 <div class="sidebar-foot">Local-first · SQLite<br>Telemetry v5 compatible</div></aside>
 <main class="main"><header class="topbar"><div class="crumb"><strong>Telemetry</strong><span>/</span><span>${title}</span></div><div class="top-actions"><button class="btn" onclick="location.reload()">↻ Refresh</button><button class="btn primary" onclick="toast('Live collector is running')">● Live</button></div></header>
 <section class="content">${body}</section></main></div><div id="toast" class="toast"></div><div id="drawer" class="drawer"><div class="drawer-backdrop" onclick="closeDrawer()"></div><aside class="drawer-panel"><div class="drawer-head"><strong id="drawerTitle">Details</strong><button class="btn icon-btn" onclick="closeDrawer()">×</button></div><div id="drawerBody" class="drawer-body"></div></aside></div>`;
 nav(active); document.title=title+" · Claude Telemetry Enterprise"; applySidebarState();
}
function shellLoading(title,active){shell(title,"",active,`<div class="empty">Loading ${title.toLowerCase()}…</div>`)}
function shellError(title,active,err){shell(title,"",active,`<div class="empty">Could not reach the telemetry backend at ${API}.<br><span class="mono">${(err&&err.message)||err}</span><br><br>Start it with:<br><span class="mono">cd backend && python run.py</span></div>`)}
function toast(msg){const t=byId("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1800)}
function openDrawer(title,html){byId("drawerTitle").textContent=title;byId("drawerBody").innerHTML=html;byId("drawer").classList.add("open")}
function closeDrawer(){byId("drawer").classList.remove("open")}
function applySidebarState(){
 const app=document.querySelector(".app"); if(!app)return;
 const collapsed=localStorage.getItem("ct_sidebar_collapsed")==="1";
 app.classList.toggle("sidebar-collapsed",collapsed);
 const b=document.querySelector(".sidebar-toggle");
 if(b){b.textContent=collapsed?"›":"‹";b.title=collapsed?"Expand sidebar":"Minimize sidebar";b.setAttribute("aria-label",b.title)}
}
function toggleSidebar(){
 const collapsed=localStorage.getItem("ct_sidebar_collapsed")==="1";
 localStorage.setItem("ct_sidebar_collapsed",collapsed?"0":"1"); applySidebarState();
}
function metric(label,value,delta,dir="up"){return `<div class="card metric"><div class="label">${label}</div><div class="value">${value}</div>${delta?`<div class="delta ${dir}">${delta}</div>`:""}</div>`}
function healthOf(lastActivity){if(!lastActivity)return 70;const h=(Date.now()-new Date(lastActivity).getTime())/3600000;if(h<1)return 98;if(h<24)return 93;if(h<24*7)return 85;return 72}
function projectRows(list){return list.map(p=>`<div class="project-row" onclick="location.href='project.html?id=${encodeURIComponent(p.project)}'"><div class="project-id"><div class="project-icon">${p.project.slice(0,2).toUpperCase()}</div><div><div class="project-name">${p.project}</div><div class="project-path mono">${p.sessions} sessions · ${p.client_count} client${p.client_count===1?"":"s"}</div></div></div><div><b>${fmt(p.total_tokens)}</b><div class="project-path">tokens</div></div><div><b>${fmt(p.requests)}</b><div class="project-path">requests</div></div><div><b>${ago(p.last_activity)}</b><div class="project-path">last active</div></div><div><span class="badge ${p.health>95?"success":p.health>90?"info":"warn"}">${p.health}% health</span></div></div>`).join("")||`<div class="empty">No projects recorded yet.</div>`}
function bars(vals){const max=Math.max(1,...vals);return vals.map(v=>`<div class="bar-col"><div class="bar" style="height:${Math.max(3,v/max*100)}%"></div></div>`).join("")}
async function renderOverview(){
 shellLoading("Overview","overview");
 try{
  const [projects,timeline,clients]=await Promise.all([api("/projects"),api("/usage/timeline?days=30"),api("/clients")]);
  projects.forEach(p=>p.health=healthOf(p.last_activity));
  const totalTokens=projects.reduce((a,p)=>a+(p.total_tokens||0),0);
  const totalRequests=projects.reduce((a,p)=>a+(p.requests||0),0);
  const days=[...timeline].sort((a,b)=>a.day.localeCompare(b.day));
  const input=days.reduce((a,d)=>a+(d.input||0),0), output=days.reduce((a,d)=>a+(d.output||0),0);
  const cacheRead=days.reduce((a,d)=>a+(d.cache_read||0),0), cacheWrite=days.reduce((a,d)=>a+(d.cache_write||0),0);
  const topClient=clients[0];
  const body=`<div class="page-head"><div><div class="eyebrow">Command center</div><div class="page-title">Usage overview</div><div class="muted">Global Claude Code telemetry across projects, sessions, clients, tools and skills.</div></div><div class="actions"><select class="select"><option>Last 30 days</option></select><button class="btn" onclick="toast('Export prepared')">Export CSV</button></div></div>
  <div class="grid grid-4">${metric("Total tokens (30d)",fmt(totalTokens))} ${metric("Input tokens",fmt(input))} ${metric("Output tokens",fmt(output))} ${metric("Cache read",fmt(cacheRead))}</div>
  <div class="split" style="margin-top:16px"><div class="card"><div class="card-head" style="margin:-20px -20px 0"><span class="card-title">Token consumption (30d)</span><span class="badge accent">Exact request usage</span></div><div class="chart"><div class="bars">${bars(days.map(d=>d.tokens||0))}</div><div class="xlabels"><span>${days[0]?.day||""}</span><span>${days[Math.floor(days.length/2)]?.day||""}</span><span>${days[days.length-1]?.day||""}</span></div></div></div>
  <div class="card"><div class="card-title">Token mix</div><div style="margin-top:20px">${[["Input",input],["Cache read",cacheRead],["Cache write",cacheWrite],["Output",output]].map(x=>{const tot=input+cacheRead+cacheWrite+output||1;const pct=Math.round(x[1]/tot*100);return `<div style="margin:15px 0"><div style="display:flex;justify-content:space-between"><span>${x[0]}</span><b>${fmt(x[1])}</b></div><div class="progress" style="margin-top:7px"><span style="width:${pct}%"></span></div></div>`}).join("")}</div><div class="muted" style="font-size:11px;margin-top:20px">Cache write is tracked separately from cache read.</div></div></div>
  <div class="grid grid-4" style="margin-top:16px">${metric("Requests (30d)",fmt(totalRequests))} ${metric("Projects",fmt(projects.length))} ${metric("Top client",topClient?topClient.client:"—")} ${metric("Avg tokens/req",totalRequests>0?fmt(Math.round(totalTokens/totalRequests)):"—")}</div>
  <div class="card card-tight" style="margin-top:16px"><div class="card-head"><span class="card-title">Projects</span><a class="btn" href="projects.html">View all</a></div>${projectRows(projects.slice(0,8))}</div>`;
  shell("Overview","","overview",body);
 }catch(err){shellError("Overview","overview",err)}
}
async function renderProjects(){
 shellLoading("Projects","projects");
 try{
  const projects=await api("/projects");
  projects.forEach(p=>p.health=healthOf(p.last_activity));
  window.__projects=projects;
  const body=`<div class="page-head"><div><div class="eyebrow">Inventory</div><div class="page-title">Projects</div><div class="muted">Every project is an independent telemetry scope with its own sessions, requests, tools and skills.</div></div><div class="actions"><button class="btn" onclick="location.reload()">↻ Discover projects</button></div></div>
  <div class="card"><div class="toolbar" style="padding:18px 20px;border-bottom:1px solid var(--line)"><input id="projectSearch" class="input search" placeholder="Search projects…" oninput="filterProjects()"><select class="select"><option>Sort: tokens</option><option>Sort: requests</option><option>Sort: activity</option></select></div><div id="projectList">${projectRows(projects)}</div></div>`;
  shell("Projects","","projects",body);
 }catch(err){shellError("Projects","projects",err)}
}
function filterProjects(){const q=byId("projectSearch").value.toLowerCase();byId("projectList").innerHTML=projectRows((window.__projects||[]).filter(p=>p.project.toLowerCase().includes(q)))}
async function renderRequests(page){
 page=page||1;
 shellLoading("Requests","requests");
 try{
  const [usage,projects]=await Promise.all([api(`/usage?page=${page}&page_size=100`),api("/projects")]);
  window.__requests=usage; window.__requestProjects=projects;
  const totalTokens=usage.reduce((a,r)=>a+(r.total_tokens||0),0);
  const cacheHitTokens=usage.reduce((a,r)=>a+(r.cache_read_tokens||0),0);
  const body=`<div class="page-head"><div><div class="eyebrow">Trace explorer</div><div class="page-title">Requests</div><div class="muted">Inspect individual Claude requests with exact usage and context metadata.</div></div><div class="actions"><button class="btn" onclick="location.reload()">↻ Refresh</button></div></div>
  <div class="grid grid-4">${metric("Requests (page)",fmt(usage.length))} ${metric("Avg request",usage.length?fmt(Math.round(totalTokens/usage.length)):"—")} ${metric("Cache read (page)",fmt(cacheHitTokens))} ${metric("Page",String(page))}</div>
  <div class="card card-tight" style="margin-top:16px"><div class="toolbar" style="padding:18px 20px;border-bottom:1px solid var(--line)"><input class="input search" placeholder="Search project, model, client…" oninput="filterRequests(this.value)"><select class="select"><option>All projects</option>${projects.map(p=>`<option>${p.project}</option>`).join("")}</select></div><div class="table-wrap"><table class="table"><thead><tr><th>Session</th><th>Project</th><th>Model</th><th>Client</th><th class="right">Input</th><th class="right">Output</th><th class="right">Cache read</th><th>Age</th></tr></thead><tbody id="requestRows">${requestRows(usage)}</tbody></table></div></div>`;
  shell("Requests","","requests",body);
 }catch(err){shellError("Requests","requests",err)}
}
function requestRows(rows){return rows.map(r=>`<tr onclick="showRequest('${r.session_id}')" style="cursor:pointer"><td class="mono">${(r.session_id||"").slice(0,12)}</td><td><b>${r.project||"—"}</b></td><td><span class="badge accent">${r.model||"—"}</span></td><td>${r.client||"—"}</td><td class="right mono">${fmt(r.input_tokens)}</td><td class="right mono">${fmt(r.output_tokens)}</td><td class="right mono">${fmt(r.cache_read_tokens)}</td><td>${ago(r.event_time)}</td></tr>`).join("")||`<tr><td colspan="8" class="empty">No requests recorded yet.</td></tr>`}
function filterRequests(q){q=q.toLowerCase();byId("requestRows").innerHTML=requestRows((window.__requests||[]).filter(r=>[r.project,r.model,r.client,r.session_id].join(" ").toLowerCase().includes(q)))}
function showRequest(sid){const r=(window.__requests||[]).find(x=>x.session_id===sid);if(!r)return;openDrawer("Session "+sid.slice(0,12),`<div class="badge accent">${r.model||"—"}</div><h2 style="margin:14px 0 4px">${r.project||"—"}</h2><div class="muted">${r.client||"—"} · ${ago(r.event_time)}</div><div class="grid grid-2" style="margin-top:18px">${metric("Input",fmt(r.input_tokens),"Exact")} ${metric("Output",fmt(r.output_tokens),"Exact")} ${metric("Cache read",fmt(r.cache_read_tokens),"Exact")} ${metric("Cache write",fmt(r.cache_write_tokens),"Exact")}</div><h3>Session</h3><div class="kv"><span class="k">Session id</span><span class="mono">${sid}</span></div><div class="kv"><span class="k">Total tokens</span><span>${fmt(r.total_tokens)}</span></div><div class="kv"><span class="k">Event time</span><span>${r.event_time||"—"}</span></div>`)}
async function renderSessions(){
 shellLoading("Sessions","sessions");
 try{
  const [sessions,projects]=await Promise.all([api("/sessions"),api("/projects")]);
  window.__sessions=sessions;
  const body=`<div class="page-head"><div><div class="eyebrow">Execution history</div><div class="page-title">Sessions</div><div class="muted">Session-level context for diagnosing high-volume Claude Code workflows.</div></div></div><div class="card card-tight"><div class="toolbar" style="padding:18px 20px;border-bottom:1px solid var(--line)"><select class="select"><option>All projects</option>${projects.map(p=>`<option>${p.project}</option>`).join("")}</select><input id="sessionSearch" class="input search" placeholder="Search session…" oninput="filterSessions()"></div><div class="table-wrap"><table class="table"><thead><tr><th>Session</th><th>Project</th><th>Client</th><th>Model</th><th class="right">Tokens</th><th class="right">Interactions</th><th>Last active</th></tr></thead><tbody id="sessionRows">${sessionRows(sessions)}</tbody></table></div></div>`;
  shell("Sessions","","sessions",body);
 }catch(err){shellError("Sessions","sessions",err)}
}
function sessionRows(rows){return rows.map(s=>`<tr onclick="openDrawer('Session ${(s.session_id||'').slice(0,12)}','<div class=&quot;kv&quot;><span class=&quot;k&quot;>Project</span><span>${s.project||''}</span></div><div class=&quot;kv&quot;><span class=&quot;k&quot;>Client</span><span>${s.client||''}</span></div><div class=&quot;kv&quot;><span class=&quot;k&quot;>Model</span><span>${s.model||''}</span></div><div class=&quot;kv&quot;><span class=&quot;k&quot;>Tokens</span><span>${fmt(s.total_tokens)}</span></div><div class=&quot;kv&quot;><span class=&quot;k&quot;>Started</span><span>${s.started_at||''}</span></div>')"><td class="mono">${(s.session_id||"").slice(0,12)}</td><td><b>${s.project||"—"}</b></td><td>${s.client||"—"}</td><td>${s.model||"—"}</td><td class="right mono">${fmt(s.total_tokens)}</td><td class="right">${fmt(s.interactions)}</td><td>${ago(s.last_active)}</td></tr>`).join("")||`<tr><td colspan="7" class="empty">No sessions recorded yet.</td></tr>`}
function filterSessions(){const q=byId("sessionSearch").value.toLowerCase();byId("sessionRows").innerHTML=sessionRows((window.__sessions||[]).filter(s=>[s.project,s.client,s.model,s.session_id].join(" ").toLowerCase().includes(q)))}
async function renderTools(){
 shellLoading("Tools","tools");
 try{
  const tools=await api("/tools");
  const totalCalls=tools.reduce((a,t)=>a+(t.call_count||0),0);
  const body=`<div class="page-head"><div><div class="eyebrow">Tool telemetry</div><div class="page-title">Tools</div><div class="muted">Understand which Claude Code tools drive context growth and execution volume.</div></div></div><div class="grid grid-4">${metric("Tool calls",fmt(totalCalls))} ${tools.slice(0,3).map(t=>metric(t.tool_name,fmt(t.call_count),totalCalls?Math.round(t.call_count/totalCalls*100)+"% of calls":"")).join("")}</div><div class="card card-tight" style="margin-top:16px"><div class="card-head"><span class="card-title">Tool consumption</span><span class="badge info">Exact call counts</span></div><div class="table-wrap"><table class="table"><thead><tr><th>Tool</th><th class="right">Calls</th><th class="right">Unique sessions</th><th class="right">Share</th><th>First seen</th><th>Last seen</th></tr></thead><tbody>${tools.map((t,i)=>`<tr><td><b>${t.tool_name}</b></td><td class="right mono">${fmt(t.call_count)}</td><td class="right mono">${fmt(t.unique_sessions)}</td><td class="right">${totalCalls?Math.round(t.call_count/totalCalls*100):0}%</td><td>${t.first_seen||"—"}</td><td>${ago(t.last_seen)}</td></tr>`).join("")||`<tr><td colspan="6" class="empty">No tool calls recorded.</td></tr>`}</tbody></table></div></div>`;
  shell("Tools","","tools",body);
 }catch(err){shellError("Tools","tools",err)}
}
async function renderSkills(){
 shellLoading("Skills","skills");
 try{
  const skills=await api("/skills");
  const totalCalls=skills.reduce((a,s)=>a+(s.call_count||0),0);
  const body=`<div class="page-head"><div><div class="eyebrow">Workflow intelligence</div><div class="page-title">Skills</div><div class="muted">Track skill activation, invocation source and call volume.</div></div><div class="actions"><button class="btn" onclick="location.reload()">↻ Refresh</button></div></div><div class="grid grid-3">${metric("Skill activations",fmt(totalCalls))} ${metric("Unique skills",fmt(skills.length))} ${metric("Last activated",skills[0]?ago(skills[0].last_activated):"—")}</div><div class="card card-tight" style="margin-top:16px"><div class="card-head"><span class="card-title">Skill activity</span><span class="badge accent">Exact call counts</span></div><div class="table-wrap"><table class="table"><thead><tr><th>Skill</th><th>Trigger</th><th>Plugin</th><th class="right">Activations</th><th>Last activated</th></tr></thead><tbody>${skills.map(s=>`<tr><td><b>${s.skill_name}</b></td><td><span class="badge ${s.trigger_type==="tool"?"info":"success"}">${s.trigger_type||"—"}</span></td><td>${s.plugin_name||"—"}</td><td class="right mono">${fmt(s.call_count)}</td><td>${ago(s.last_activated)}</td></tr>`).join("")||`<tr><td colspan="5" class="empty">No skill activations recorded yet.</td></tr>`}</tbody></table></div></div>`;
  shell("Skills","","skills",body);
 }catch(err){shellError("Skills","skills",err)}
}
async function renderClients(){
 shellLoading("Clients & IDEs","clients");
 try{
  const clients=await api("/clients");
  const totalTokens=clients.reduce((a,c)=>a+(c.total_tokens||0),0);
  const body=`<div class="page-head"><div><div class="eyebrow">Environment intelligence</div><div class="page-title">Clients & IDEs</div><div class="muted">Best-effort client classification across Claude Code sessions.</div></div></div><div class="grid grid-4">${metric("Known clients",fmt(clients.length))} ${metric("Top client",clients[0]?clients[0].client:"—")} ${metric("Total tokens",fmt(totalTokens))} ${metric("Total requests",fmt(clients.reduce((a,c)=>a+(c.requests||0),0)))}</div><div class="card card-tight" style="margin-top:16px"><div class="card-head"><span class="card-title">Client mix</span><span class="badge info">Classification confidence varies</span></div><div class="table-wrap"><table class="table"><thead><tr><th>Client</th><th class="right">Tokens</th><th class="right">Sessions</th><th class="right">Requests</th><th class="right">Share</th><th>Projects</th></tr></thead><tbody>${clients.map(c=>`<tr><td><b>${c.client}</b></td><td class="right mono">${fmt(c.total_tokens)}</td><td class="right">${fmt(c.sessions)}</td><td class="right">${fmt(c.requests)}</td><td class="right">${totalTokens?Math.round(c.total_tokens/totalTokens*100):0}%</td><td><span class="badge">${fmt(c.projects)} active</span></td></tr>`).join("")||`<tr><td colspan="6" class="empty">No client data recorded yet.</td></tr>`}</tbody></table></div></div><div class="card" style="margin-top:16px"><div class="card-title">Classification note</div><p class="muted">The telemetry layer uses available process/environment signals and transcript metadata. Treat the client field as analytical classification, not a cryptographic source of truth.</p></div>`;
  shell("Clients & IDEs","","clients",body);
 }catch(err){shellError("Clients & IDEs","clients",err)}
}
async function renderSettings(){
 shellLoading("Telemetry settings","settings");
 try{
  const s=await api("/settings");
  const tc=s.table_counts||{};
  const body=`<div class="page-head"><div><div class="eyebrow">Operations</div><div class="page-title">Telemetry settings</div><div class="muted">Local-first collector configuration compatible with the Claude Token Telemetry v5 architecture.</div></div><div class="actions"><button class="btn primary" onclick="triggerReconcile()">Reconcile now</button></div></div><div class="grid grid-2"><div class="card"><div class="card-title">Collector</div><div class="kv"><span class="k">Database</span><span class="mono">${s.db_path||"—"}</span></div><div class="kv"><span class="k">DB size</span><span>${fmt(s.db_size)} bytes</span></div><div class="kv"><span class="k">Poll interval</span><span>${s.env&&s.env.CLAUDE_TELEMETRY_INTERVAL||"5"} seconds</span></div><div class="kv"><span class="k">Last reconcile</span><span>${s.last_reconcile||"—"}</span></div></div><div class="card"><div class="card-title">Data semantics</div><div class="kv"><span class="k">Request usage</span><span><span class="badge success">Exact</span></span></div><div class="kv"><span class="k">Tool/path attribution</span><span><span class="badge warn">Estimated</span></span></div><div class="kv"><span class="k">Skills</span><span><span class="badge info">Tracked</span></span></div></div></div><div class="card" style="margin-top:16px"><div class="card-title">Table counts</div><div class="mini-grid" style="grid-template-columns:repeat(3,1fr);margin-top:16px">${Object.entries(tc).map(([k,v])=>`<div class="card" style="box-shadow:none;background:var(--surface-muted);padding:14px"><div class="muted" style="font-size:11px">${k}</div><div style="font-weight:750;font-size:18px">${fmt(v)}</div></div>`).join("")}</div></div>`;
  shell("Telemetry settings","","settings",body);
 }catch(err){shellError("Telemetry settings","settings",err)}
}
async function triggerReconcile(){
 try{const r=await fetch(API+"/settings/reconcile",{method:"POST"});if(!r.ok)throw new Error(String(r.status));toast("Reconcile triggered");renderSettings()}
 catch(err){toast("Reconcile failed: "+err.message)}
}
async function renderProject(){
 const id=new URLSearchParams(location.search).get("id");
 shellLoading(id||"Project","projects");
 try{
  const [projects,attributions]=await Promise.all([api("/projects"),api("/attributions")]);
  const p=projects.find(x=>x.project===id);
  if(!p){shell("Project not found","","projects",`<div class="empty">No project named "${id}" was found in telemetry data.</div>`);return}
  p.health=healthOf(p.last_activity);
  window.__project=p; window.__projectAttrs=attributions.filter(a=>a.project===p.project);
  const body=`<div class="page-head"><div><div class="eyebrow">Project scope</div><div class="page-title">${p.project}</div><div class="muted mono">${p.sessions} sessions · ${p.client_count} clients</div></div><div class="actions"><span class="badge success">Live collector</span><button class="btn" onclick="toast('Project export prepared')">Export project</button></div></div>
  <div class="tabs"><button class="tab active" onclick="projectTab(this,'summary')">Summary</button><button class="tab" onclick="projectTab(this,'requests')">Requests</button><button class="tab" onclick="projectTab(this,'hotspots')">Hotspots</button><button class="tab" onclick="projectTab(this,'sessions')">Sessions</button></div>
  <div id="projectTabContent">${projectSummaryTab(p,window.__projectAttrs)}</div>`;
  shell(p.project,"","projects",body);
 }catch(err){shellError(id||"Project","projects",err)}
}
function projectSummaryTab(p,attrs){
 const top=[...attrs].sort((a,b)=>b.estimated_tokens-a.estimated_tokens).slice(0,4);
 const maxA=Math.max(1,...top.map(a=>a.estimated_tokens));
 return `<div class="grid grid-4">${metric("Tokens",fmt(p.total_tokens),"")} ${metric("Requests",fmt(p.requests),"")} ${metric("Sessions",fmt(p.sessions),"")} ${metric("Health",p.health+"%","")}</div><div class="split" style="margin-top:16px"><div class="card"><div class="card-head" style="margin:-20px -20px 0"><span class="card-title">Attribution hotspots</span><span class="badge warn">Estimated</span></div><div style="padding:20px 0">${top.map(a=>`<div style="margin:15px 0"><div style="display:flex;justify-content:space-between"><span class="mono">${a.category}</span><b>${fmt(a.estimated_tokens)}</b></div><div class="progress" style="margin-top:7px"><span style="width:${Math.round(a.estimated_tokens/maxA*100)}%"></span></div></div>`).join("")||`<div class="empty">No attribution data for this project.</div>`}</div></div><div class="card"><div class="card-title">Project profile</div><div class="kv"><span class="k">Sessions</span><span>${p.sessions}</span></div><div class="kv"><span class="k">Clients</span><span>${p.client_count}</span></div><div class="kv"><span class="k">Last activity</span><span>${ago(p.last_activity)}</span></div><div class="kv"><span class="k">Attribution</span><span><span class="badge warn">Estimated</span></span></div></div></div>`;
}
async function projectTab(btn,tab){
 document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));btn.classList.add("active");
 const p=window.__project; const content=byId("projectTabContent");
 if(!p)return;
 if(tab==="summary"){content.innerHTML=projectSummaryTab(p,window.__projectAttrs||[]);return}
 content.innerHTML=`<div class="empty">Loading…</div>`;
 if(tab==="requests"){
  const usage=await api(`/usage/project/${encodeURIComponent(p.project)}`);
  content.innerHTML=`<div class="card card-tight"><div class="card-head"><span class="card-title">Project requests</span><span class="badge accent">${p.project}</span></div><div class="table-wrap"><table class="table"><thead><tr><th>Session</th><th>Model</th><th>Client</th><th class="right">Input</th><th class="right">Output</th><th class="right">Cache read</th></tr></thead><tbody>${usage.slice(0,50).map(r=>`<tr onclick="showRequest('${r.session_id}')"><td class="mono">${(r.session_id||"").slice(0,12)}</td><td>${r.model||"—"}</td><td>${r.client||"—"}</td><td class="right mono">${fmt(r.input_tokens)}</td><td class="right mono">${fmt(r.output_tokens)}</td><td class="right mono">${fmt(r.cache_read_tokens)}</td></tr>`).join("")||`<tr><td colspan="6" class="empty">No requests for this project.</td></tr>`}</tbody></table></div></div>`;
  window.__requests=usage;
 }
 if(tab==="hotspots"){
  const attrs=[...(window.__projectAttrs||[])].sort((a,b)=>b.estimated_tokens-a.estimated_tokens);
  content.innerHTML=`<div class="card"><div class="card-title">Attribution hotspots</div><p class="muted">Estimated attribution for ${p.project}; drill into request rows for exact API usage.</p><div class="table-wrap" style="margin-top:12px"><table class="table"><thead><tr><th>Category</th><th class="right">Estimated tokens</th><th class="right">References</th></tr></thead><tbody>${attrs.map(a=>`<tr><td class="mono">${a.category}</td><td class="right mono">${fmt(a.estimated_tokens)}</td><td class="right">${fmt(a.reference_count)}</td></tr>`).join("")||`<tr><td colspan="3" class="empty">No attribution data.</td></tr>`}</tbody></table></div></div>`;
 }
 if(tab==="sessions"){
  const sessions=(await api("/sessions")).filter(s=>s.project===p.project);
  content.innerHTML=`<div class="card card-tight"><div class="card-head"><span class="card-title">Sessions for ${p.project}</span></div><div class="table-wrap"><table class="table"><thead><tr><th>Session</th><th>Client</th><th>Model</th><th class="right">Tokens</th><th class="right">Interactions</th><th>Last active</th></tr></thead><tbody>${sessionRows(sessions)}</tbody></table></div></div>`;
 }
}
const page=location.pathname.split("/").pop()||"index.html";
if(page==="index.html"||page==="")renderOverview();else if(page==="projects.html")renderProjects();else if(page==="requests.html")renderRequests();else if(page==="sessions.html")renderSessions();else if(page==="tools.html")renderTools();else if(page==="skills.html")renderSkills();else if(page==="clients.html")renderClients();else if(page==="settings.html")renderSettings();else if(page==="project.html")renderProject();else renderOverview();
