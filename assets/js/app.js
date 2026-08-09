/* ============ CopticSports shared app ============ */
const CS = {
  teams: null, seasons: null, cache: {},
  // official team colours
  colors: {
    "St. Andrew":{bg:"#400023",fg:"#ffffff"},"St. Basil":{bg:"#056723",fg:"#ffffff"},
    "St. Dometius":{bg:"#ccba92",fg:"#141414"},"St. Gregory":{bg:"#616568",fg:"#ffffff"},
    "St. James":{bg:"#bb0a28",fg:"#ffffff"},"St. John":{bg:"#67aade",fg:"#141414"},
    "St. Maximus":{bg:"#37487d",fg:"#ffffff"},"St. Peter":{bg:"#ffffff",fg:"#141414"},
    "St. Cosmas":{bg:"#3a4048",fg:"#c9d3dd"},"St. Damian":{bg:"#3a4048",fg:"#c9d3dd"}
  },

  _pending: {},
  // Loads data via <script> so the site works when opened straight from a folder
  // (file://) as well as over the web. fetch() is blocked on file:// by browsers.
  data(name){
    if(!this.cache[name]){
      this.cache[name] = new Promise((resolve, reject)=>{
        this._pending[name] = resolve;
        const s = document.createElement("script");
        s.src = `data/${name}.js`;
        s.onerror = ()=> reject(new Error("Could not load data/"+name+".js"));
        document.head.appendChild(s);
      });
    }
    return this.cache[name];
  },
  _recv(name, payload){
    if(this._pending[name]) this._pending[name](payload);
    else this.cache[name] = Promise.resolve(payload);
  },
  // the team's name rendered in its own colour
  team(name, size){
    if(!name) return "";
    const c = this.colors[name] || {bg:"#1b405e",fg:"#ffffff"};
    const light = ["#ffffff","#ccba92","#67aade","#b2d034"].includes(c.bg.toLowerCase());
    return `<span class="tpill${size?" "+size:""}${light?" light":""}" style="background:${c.bg};color:${c.fg}">${name}</span>`;
  },
  // short form for tight spots (schedule chips, calendar)
  teamShort(name, size){
    if(!name) return "";
    const c = this.colors[name] || {bg:"#1b405e",fg:"#ffffff"};
    const light = ["#ffffff","#ccba92","#67aade","#b2d034"].includes(c.bg.toLowerCase());
    return `<span class="tpill${size?" "+size:""}${light?" light":""}" style="background:${c.bg};color:${c.fg}">${name.replace("St. ","")}</span>`;
  },

  fmtDate(d, opts){
    if(!d) return "TBD";
    return new Date(d+"T12:00:00").toLocaleDateString("en-US", opts || {weekday:"short", month:"short", day:"numeric", year:"numeric"});
  },
  fmtTime(t){
    if(!t) return "";
    const [h,m] = t.split(":").map(Number);
    const ap = h>=12 ? "PM":"AM";
    return `${((h+11)%12)+1}:${String(m).padStart(2,"0")} ${ap}`;
  },
  gameCard(g){
    const done = g.status==="F";
    const w1 = done && g.score1>g.score2, w2 = done && g.score2>g.score1;
    const line = (team,score,win,lose)=> team ? `
      <div class="row ${win?"win":""} ${lose?"dim":""}">${this.team(team)}
        <span class="score">${score??""}</span></div>` : "";
    const label = g.status==="FFT" ? "FORFEIT" : g.status==="BYE" ? "BYE WEEK" : g.status==="NR" ? "NOT REPORTED" : done ? "FINAL" : this.fmtTime(g.time);
    return `<div class="game">
      <div class="meta"><span>${g.stage}${g.venue?" · "+g.venue:""}</span>
      <span class="status-${g.status}">${label}</span></div>
      ${g.status==="BYE" ? `<div class="row"><span class="tname" style="color:var(--ink-dim)">No games. Rest & fellowship</span></div>`
        : line(g.team1,g.score1,w1,w2)+line(g.team2,g.score2,w2,w1)}
    </div>`;
  },
  // tab-bar icons (24px stroke set)
  icons:{
    home:'M3 10.6 12 3.2l9 7.4M5.6 9.4V20.8h12.8V9.4',
    schedule:'M8 6h12M8 12h12M8 18h12M3.6 6h.01M3.6 12h.01M3.6 18h.01',
    teams:'M15.5 20.5v-1.4a3.8 3.8 0 0 0-3.8-3.8H6.3a3.8 3.8 0 0 0-3.8 3.8v1.4M9 11.9a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2M21.5 20.5v-1.4a3.8 3.8 0 0 0-2.9-3.7M15.8 4.9a3.6 3.6 0 0 1 0 7',
    stats:'M3 20.5h18M6.5 20.5v-6.4M11.5 20.5V7.6M16.5 20.5v-4M21 20.5V4',
    standings:'M7 3.8h10v5.1a5 5 0 0 1-10 0zM7 5.8H4.2v1a3 3 0 0 0 2.9 3M17 5.8h2.8v1a3 3 0 0 1-2.9 3M9 20.2h6M12 14v6.2',
    calendar:'M3.2 8.6h17.6M7.6 3.4v3.2M16.4 3.4v3.2M4.4 6.2h15.2a1.2 1.2 0 0 1 1.2 1.2v12.4a1.2 1.2 0 0 1-1.2 1.2H4.4a1.2 1.2 0 0 1-1.2-1.2V7.4a1.2 1.2 0 0 1 1.2-1.2z'
  },
  nav(active){
    const links = [["index.html","Home"],["schedule.html","Schedule"],["teams.html","Teams"],
      ["stats.html","Stats"],["standings.html","Standings"],["calendar.html","Calendar"]];
    const onPortal = /upload\.html$/.test(location.pathname);
    // ---- desktop top bar (unchanged) + mobile-only brand & portal link ----
    document.getElementById("topbar").innerHTML = `<div class="wrap">
      <a class="brand m-only" href="index.html" aria-label="TCBL home"><img src="assets/img/logo-mini.png" alt=""></a>
      <a class="m-only m-portal${onPortal?" on":""}" href="upload.html">Stat Portal</a>
      <nav class="nav">${links.map(([h,l])=>`<a href="${h}" class="${l.toLowerCase()===active?"on":""}">${l}</a>`).join("")}
        <a class="cta spacer" href="upload.html">Stat Portal</a></nav></div>`;
    // ---- mobile bottom tab bar ----
    const tabs = document.createElement("nav");
    tabs.className = "tabbar";
    tabs.setAttribute("aria-label","Primary");
    tabs.innerHTML = links.map(([h,l])=>{
      const k = l.toLowerCase(), cur = k===active;
      return `<a href="${h}" class="${cur?"on":""}"${cur?' aria-current="page"':""}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${this.icons[k]}"/></svg>
        <span>${l}</span></a>`;
    }).join("");
    document.body.appendChild(tabs);
  },
  // "Show all stats" control for wide tables on small screens
  colToggle(tbl){
    const host = tbl.closest(".tbl-scroll") || tbl;
    if(host.previousElementSibling && host.previousElementSibling.classList.contains("more-cols")) return;
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn ghost more-cols"; b.textContent = "Show all stats";
    b.onclick = ()=>{
      const on = tbl.classList.toggle("wide");
      b.textContent = on ? "Show fewer stats" : "Show all stats";
      b.setAttribute("aria-expanded", on);
    };
    b.setAttribute("aria-expanded","false");
    host.insertAdjacentElement("beforebegin", b);
  },

  footer(){
    const f = document.createElement("footer");
    f.innerHTML = `<div class="wrap">
      <div><div class="verse">"Honor all people. Love the brotherhood. Fear God…" (1 Peter 2:17)</div>
        <div>Faith · Fellowship · Fitness</div></div>
      <div class="right">Tampa Bay Coptic Basketball League<br>
        Sanctioned under the Coptic Orthodox Diocese of the Southern United States</div></div>`;
    document.body.appendChild(f);
  },
  countdown(el, target, label){
    const tick = ()=>{
      const ms = new Date(target) - new Date();
      if(ms<0){ el.innerHTML = `<div class="count-label">${label} is LIVE</div>`; return; }
      const d = Math.floor(ms/864e5), h = Math.floor(ms%864e5/36e5),
            m = Math.floor(ms%36e5/6e4), s = Math.floor(ms%6e4/1e3);
      el.innerHTML = `<div class="count-label">${label}</div>` +
        [[d,"Days"],[h,"Hours"],[m,"Min"],[s,"Sec"]].map(([v,l])=>
          `<div class="cell"><b>${v}</b><span>${l}</span></div>`).join("");
    };
    tick(); setInterval(tick, 1000);
  },
  seasonTabs(el, current, onPick, disable1){
    el.innerHTML = [5,4,3,2,1].map(n=>
      `<button data-s="${n}" ${n===current?'class="on"':""} ${n===1&&disable1?"disabled title='Season 1 archive coming soon'":""}>Season ${n}</button>`).join("");
    el.querySelectorAll("button").forEach(b=>b.onclick=()=>{
      el.querySelectorAll("button").forEach(x=>x.classList.remove("on"));
      b.classList.add("on"); onPick(+b.dataset.s);
    });
  },
  sortTable(tbl, data, render){
    tbl.querySelectorAll("th[data-k]").forEach(th=>{
      th.onclick = ()=>{
        const k = th.dataset.k, dir = th.dataset.dir==="asc" ? -1 : 1;
        th.dataset.dir = dir===1 ? "asc" : "desc";
        data.sort((a,b)=> (b[k]??-1e9) > (a[k]??-1e9) ? dir : -dir);
        render(data);
      };
    });
  }
};
