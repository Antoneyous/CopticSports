/* ============ CopticSports shared app ============ */
// clean addresses: /players instead of /players.html (GitHub Pages serves both)
if(/^https?:/.test(location.protocol) && /\.html$/.test(location.pathname))
  history.replaceState(null, "", location.pathname.replace(/index\.html$/,"").replace(/\.html$/,"") + location.search + location.hash);
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
    return `<span class="tpill${size?" "+size:""}${light?" light":""}" style="background:${c.bg};color:${c.fg}">${name}</span>`;
  },

  /* ---- YouTube live stream ----
     There is no way to ask YouTube "are you live?" from a static page without
     an API key, so the schedule is the source of truth: a game day is treated
     as live from 15 minutes before the first tip-off to 90 after the last. */
  yt:{ channel:"UC7ZiDacChTUNhqhS9G1i53Q", url:"https://www.youtube.com/@Coptichoops" },
  LIVE_PRE: 15, LIVE_POST: 90,   // minutes either side of the day's games

  liveWindow(games, now){
    now = now || new Date();
    const byDate = {};
    games.forEach(g=>{ if(g.date && g.time) (byDate[g.date] ||= []).push(g); });
    const days = Object.keys(byDate).sort().map(d=>{
      const t = byDate[d].map(g=> +this.et(d, g.time));   // Tampa time, not the viewer's
      return { date:d, games:byDate[d].sort((a,b)=>a.time<b.time?-1:1),
               start:new Date(Math.min(...t) - this.LIVE_PRE*6e4),
               end:  new Date(Math.max(...t) + this.LIVE_POST*6e4) };
    });
    return { live: days.find(x=> now>=x.start && now<=x.end) || null,
             next: days.find(x=> now < x.start) || null };
  },
  liveEmbed(){
    return `<div class="ytwrap"><iframe
      src="https://www.youtube.com/embed/live_stream?channel=${this.yt.channel}"
      title="TCBL live stream" loading="lazy" allowfullscreen
      allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
  },
  matchups(games){
    const m = games.filter(g=>g.team1 && g.team2).map(g=>
      `<div class="mchip"><span class="mteams">${this.teamShort(g.team1,"sm")}<i>vs</i>${this.teamShort(g.team2,"sm")}</span>
        <b>${this.fmtTime(g.time)}</b></div>`).join("");
    return m ? `<div class="mgrid">${m}</div>` : "";
  },
  // Renders the player when a game is on, and a countdown to the next one when not.
  async liveSection(host, onlyLive){
    if(!host) return;
    const w = this.liveWindow((await this.data("season5")).games);
    clearTimeout(host._liveT);
    const sec = host.closest("section");
    if(onlyLive && sec) sec.hidden = !w.live;
    if(w.live){
      // switch back to "off air" by itself once the day's games are over
      host._liveT = setTimeout(()=>this.liveSection(host, onlyLive), Math.min(w.live.end - new Date() + 1000, 2**31-1));
      host.innerHTML = `<div class="livenow"><span class="ldot"></span>Live now${w.live.games[0].venue?" · "+w.live.games[0].venue:""}</div>
        ${this.liveEmbed()}${this.matchups(w.live.games)}`;
    } else if(w.next){
      const g0 = w.next.games[0]||{};
      host.innerHTML = `<div class="card live-next">
        <div class="ln-head"><div><span class="eyebrow">Next broadcast</span><h3>${this.fmtDate(w.next.date,{weekday:"long",month:"short",day:"numeric"})}</h3>
          <p class="cardp">${g0.venue?g0.venue+" · ":""}First tip ${this.fmtTime(g0.time)}</p></div></div>
        ${this.matchups(w.next.games)}</div>`;
      // flip to the live player by itself when the first game tips
      host._liveT = setTimeout(()=>this.liveSection(host, onlyLive), Math.min(w.next.start - new Date() + 1000, 2**31-1));
    } else {
      host.innerHTML = `<div class="card"><h3>That's a wrap on the season</h3>
        <p class="cardp">Every game is on our YouTube channel.</p>
        <p class="card-cta"><a class="btn ghost" href="${this.yt.url}" target="_blank" rel="noopener">Watch on YouTube</a></p></div>`;
    }
  },
  // Calls fn(window) now, again at every on-air / off-air flip, and when a phone or
  // laptop wakes and the tab comes back, so nothing on the page goes stale.
  async liveWatch(fn){
    const games = (await this.data("season5")).games;
    let t = null;
    const run = ()=>{
      const w = this.liveWindow(games);
      fn(w);
      clearTimeout(t);
      const next = w.live ? w.live.end : w.next ? w.next.start : null;
      if(next) t = setTimeout(run, Math.min(next - new Date() + 1000, 2**31-1));
    };
    document.addEventListener("visibilitychange", ()=>{ if(!document.hidden) run(); });
    run();
  },
  // Slim site-wide bar, skipped on pages that already show the player. It appears
  // by itself at tip-off and leaves by itself when the day's games are over.
  liveBar(){
    if(document.getElementById("livehost")) return;
    this.liveWatch(w=>{
      let a = document.querySelector(".livebar");
      if(w.live && !a){
        a = document.createElement("a");
        a.className = "livebar"; a.href = "./#live";
        a.innerHTML = `<span class="ldot"></span><b>We're live now</b>
          <span>Watch today's games →</span>`;
        document.body.insertBefore(a, document.body.firstChild);
      } else if(!w.live && a) a.remove();
    });
  },

  /* ---- registration state ----
     One source of truth for the window so the hero button, the register page
     and anything added later can never disagree. */
  // Times carry Tampa's UTC offset (EST, -05:00) so every visitor gets the same
  // moment, wherever their device's clock is set.
  reg:{ open:"2026-11-09T10:45:00-05:00", close:"2026-11-09T23:59:00-05:00",
        form:"https://pci.jotform.com/form/253064435211144" },
  // "7 PM" or "10:45 AM", Tampa time, read from reg.open so the label and the rule can't drift
  regOpenTime(){
    return new Date(this.reg.open).toLocaleTimeString("en-US",{timeZone:"America/New_York",
      hour:"numeric", minute:"2-digit"}).replace(":00","");
  },
  regState(now){
    now = now || new Date();
    if(now < new Date(this.reg.open))  return "soon";
    if(now < new Date(this.reg.close)) return "open";
    return "closed";
  },
  // Locked until registration opens, live during the window, retired after.
  regButton(el, href){
    if(!el) return;
    const s = this.regState();
    if(s==="open"){
      el.innerHTML = `<a class="btn" href="${href||this.reg.form}">Register Now</a>`;
    } else if(s==="soon"){
      el.innerHTML = `<span class="btn locked" aria-disabled="true" role="link"
        title="Registration opens at ${this.regOpenTime()} Eastern">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>
        Opens at ${this.regOpenTime()}</span>`;
    } else {
      el.innerHTML = "";   // registration over: no button at all
    }
    return s;
  },
  // Calls render(state) now, and again the moment registration opens or closes,
  // so a page left open flips over by itself. Also re-checks when a phone or
  // laptop wakes up and the tab comes back into view.
  regWatch(render){
    let last = null, t = null;
    const run = ()=>{
      const s = this.regState();
      if(s !== last){ last = s; render(s); }
      clearTimeout(t);
      const next = s==="soon" ? this.reg.open : s==="open" ? this.reg.close : null;
      if(next) t = setTimeout(run, Math.min(new Date(next) - new Date() + 50, 2**31-1));
    };
    document.addEventListener("visibilitychange", ()=>{ if(!document.hidden) run(); });
    run();
  },
  // A milestone counts as done once its moment has passed (Tampa time).
  milestonePast(m){
    const now = new Date();
    if(/^Registration Opens/i.test(m.label))  return now >= new Date(this.reg.open);
    if(/^Registration Closes/i.test(m.label)) return now >= new Date(this.reg.close);
    if(!m.date) return false;
    return m.date < this.todayET();
  },

  /* ---- Tampa (America/New_York) time helpers ----
     Date strings like "2026-11-01" are read by browsers as midnight UTC, which
     is 8 PM the evening before in Tampa. These keep every date on local time. */
  todayET(){
    return new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",
      year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  },
  // "2027-01-03","15:30" -> the Date for 3:30 PM in Tampa, EST or EDT as appropriate
  et(date, time){
    const [y,mo,d] = date.split("-").map(Number), [h,mi] = (time||"00:00").split(":").map(Number);
    let t = Date.UTC(y, mo-1, d, h+5, mi);            // assume EST (UTC-5)
    const shown = +new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",
      hour:"numeric",hourCycle:"h23"}).format(new Date(t));
    if(shown !== h) t -= 36e5;                         // daylight time (UTC-4)
    return new Date(t);
  },

  /* ---- name canonicalisation ----
     Scoresheets record people as "Hanna", "M. Hanna", "Hanna M" and so on. The
     roster in teams.js is the source of truth, joined on jersey number, which
     is the one field scorekeepers get right. Without this, one player's season
     splits across several rows and the leaderboards undercount. */
  JUNK: /^(livestream|overlay|scoreboard|stream)\b|^[\s\-:]*$/i,
  async rosterIndex(season){
    const teams = await this.data("teams");
    const byNum = {}, bySur = {};
    Object.entries(teams).forEach(([tn,t])=>{
      ((((t.seasons||{})[String(season)])||{}).roster||[]).forEach(p=>{
        byNum[tn+"|"+p.num] = p.name;
        const s = tn+"|"+p.name.split(/\s+/).pop().toLowerCase();
        (bySur[s] = bySur[s] || []).push(p.name);
      });
    });
    return { byNum, bySur };
  },
  canonName(idx, team, num, raw){
    const words = (String(raw||"").toLowerCase().match(/[a-z]{2,}/g)) || [];
    const hit = idx.byNum[team+"|"+num];
    if(hit){
      // guard: a stranger wearing someone else's number must not be absorbed
      // into that player. Only accept the match if a word actually agrees.
      const rw = hit.toLowerCase().match(/[a-z]{2,}/g) || [];
      const agrees = !words.length || words.some(w=>rw.includes(w));
      return agrees ? { name:hit, how:"roster" }
                    : { name:raw, how:"conflict", suggest:hit };
    }
    const sur = words.length ? words[words.length-1] : "";
    const c = idx.bySur[team+"|"+sur] || [];
    if(c.length===1) return { name:c[0], how:"surname" };
    return { name:raw, how:"unknown" };
  },

  // 3-letter code for tight spots like calendar cells. Unique across all ten clubs.
  abbr(name){ return name ? name.replace(/^St\.\s*/,"").slice(0,3).toUpperCase() : ""; },
  teamTag(name){
    if(!name) return "";
    const c = this.colors[name] || {bg:"#1b405e",fg:"#ffffff"};
    const light = ["#ffffff","#ccba92","#67aade","#b2d034"].includes(c.bg.toLowerCase());
    return `<span class="ab${light?" light":""}" style="background:${c.bg};color:${c.fg}"
      title="${name}">${this.abbr(name)}</span>`;
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
    if(g.status==="BYE")
      return `<div class="game up"><span class="tbd">No games. Rest &amp; fellowship</span></div>`;
    if(!done && g.status!=="FFT" && !g.team1)
      return `<div class="game up"><span class="tbd">Matchups set by the standings</span><b>${this.fmtTime(g.time)}</b></div>`;
    if(!done && g.status!=="FFT" && g.team1 && g.team2)
      return `<div class="game up"><span class="mteams">${this.teamShort(g.team1,"sm")}<i>vs</i>${this.teamShort(g.team2,"sm")}</span><b>${this.fmtTime(g.time)}</b></div>`;
    return `<div class="game">
      <div class="meta"><span>${g.stage}${g.venue?", "+g.venue:""}</span>
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
    players:'M12 12.2a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2M4.5 20.5v-.9a5.6 5.6 0 0 1 5.6-5.6h3.8a5.6 5.6 0 0 1 5.6 5.6v.9',
    stats:'M3 20.5h18M6.5 20.5v-6.4M11.5 20.5V7.6M16.5 20.5v-4M21 20.5V4',
    standings:'M7 3.8h10v5.1a5 5 0 0 1-10 0zM7 5.8H4.2v1a3 3 0 0 0 2.9 3M17 5.8h2.8v1a3 3 0 0 1-2.9 3M9 20.2h6M12 14v6.2',
    history:'M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4.5v3.9h3.9M12 7.6V12l3 1.8',
    gallery:'M4 5.5h16v13H4zM4 15.2l4.3-4.1 4.2 4.1 2.9-2.8 4.6 4.4M15.6 9.3h.01',
    more:'M5 12h.01M12 12h.01M19 12h.01',
    register:'M12 20.5h8.5M16.6 4a2.1 2.1 0 0 1 3 3L7.5 19.1l-4 1 1-4z',
    statportal:'M4 20h16M7 16V9M12 16V5M17 16v-4',
    rulebook:'M5 4.6A1.6 1.6 0 0 1 6.6 3H20v14.6H6.6A1.6 1.6 0 0 0 5 19.2zM5 19.2A1.6 1.6 0 0 0 6.6 21H20M9 7.4h7M9 11h5',
    calendar:'M3.2 8.6h17.6M7.6 3.4v3.2M16.4 3.4v3.2M4.4 6.2h15.2a1.2 1.2 0 0 1 1.2 1.2v12.4a1.2 1.2 0 0 1-1.2 1.2H4.4a1.2 1.2 0 0 1-1.2-1.2V7.4a1.2 1.2 0 0 1 1.2-1.2z'
  },
  // Stat Portal switch. While true the portal shows as locked everywhere and
  // upload.html refuses to load the tool. Flip to false to open it back up.
  portalLocked: true,
  // what every Stat Portal entry point renders: a link, or a locked label
  portalLink(cls){
    if(!this.portalLocked) return `<a class="${cls||""}" href="upload">Stat Portal</a>`;
    return `<span class="${cls||""} locked" aria-disabled="true" title="The Stat Portal is locked for now"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg> Stat Portal</span>`;
  },
  // Register switch: locked everywhere (like the Stat Portal) once registration closes.
  get regLocked(){ return this.regState()==="closed"; },
  regLink(cls){
    if(!this.regLocked) return `<a class="${cls||""}" href="register">Register</a>`;
    return `<span class="${cls||""} locked" aria-disabled="true" title="Season 5 registration is closed"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg> Register</span>`;
  },
  // social + contact, used by the footer and the mobile "More" sheet
  social:{ instagram:"https://www.instagram.com/coptichoops/", youtube:"https://www.youtube.com/@Coptichoops",
           email:"coptichoops@gmail.com" },
  nav(active){
    const links = [["./","Home"],["schedule","Schedule"],["teams","Teams"],
      ["players","Players"],["stats","Stats"],["standings","Standings"],["history","History"],
      ["gallery","Gallery"],["calendar","Calendar"]];
    const regOpen = !this.regLocked;
    // Right-hand call to action: Register while sign-ups are open. Otherwise the
    // live stream (or the next broadcast date), filled in once the schedule loads.
    // Nothing locked or greyed out is ever shown here.
    const cta = regOpen
      ? `<a class="spacer ghost-cta${active==="register"?" on":""}" href="register">Register</a>`
      : `<a class="spacer ghost-cta nav-live" data-live-cta href="./#live" hidden></a>`;
    const mcta = regOpen
      ? `<a class="m-only m-portal${active==="register"?" on":""}" href="register">Register</a>`
      : `<a class="m-only m-portal m-live" data-live-cta href="./#live" hidden></a>`;
    document.getElementById("topbar").innerHTML = `<div class="wrap">
      <a class="brand" href="./" aria-label="TCBL home"><img src="assets/img/logo-mini.png" alt=""><span>TCBL</span></a>
      ${mcta}
      <nav class="nav">${links.map(([h,l])=>
        `<a href="${h}" class="${l.toLowerCase()===active?"on":""}"${l.toLowerCase()===active?' aria-current="page"':""}>${l}</a>`).join("")}
        ${cta}${this.portalLocked ? "" : this.portalLink("cta")}</nav></div>`;
    if(!regOpen) this.liveWatch(w=>{
      const html = w.live ? `<span class="ldot"></span>Live now`
        : w.next ? `Next game · ${this.fmtDate(w.next.date,{month:"short",day:"numeric"})}`
        : `${this.glyph.yt} YouTube`;
      document.querySelectorAll("[data-live-cta]").forEach(a=>{
        a.innerHTML = html; a.hidden = false; a.classList.toggle("is-live", !!w.live);
        if(w.live || w.next){ a.href = "./#live"; a.removeAttribute("target"); a.removeAttribute("rel"); }
        else { a.href = this.yt.url; a.target = "_blank"; a.rel = "noopener"; }
      });
    });
    // ---- mobile bottom tab bar: 4 main tabs + a "More" sheet ----
    const main = links.slice(0,4), extra = [["stats","Stats"],["standings","Standings"],["history","History"],
      ["gallery","Gallery"],["calendar","Calendar"],["assets/docs/TCBL-Rulebook.pdf","Rulebook"]];
    const icon = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${this.icons[k]}"/></svg>`;
    const inMore = extra.some(([,l])=>l.toLowerCase()===active);
    const tabs = document.createElement("nav");
    tabs.className = "tabbar";
    tabs.setAttribute("aria-label","Primary");
    tabs.innerHTML = main.map(([h,l])=>{
      const k = l.toLowerCase(), cur = k===active;
      return `<a href="${h}" class="${cur?"on":""}"${cur?' aria-current="page"':""}>${icon(k)}<span>${l}</span></a>`;
    }).join("") + `<button type="button" class="more-btn${inMore?" on":""}" aria-haspopup="dialog" aria-expanded="false">${icon("more")}<span>More</span></button>`;
    document.body.appendChild(tabs);
    const sheet = document.createElement("div");
    sheet.className = "sheet";
    sheet.innerHTML = `<div class="sheet-scrim"></div><div class="sheet-card" role="dialog" aria-modal="true" aria-label="More pages">
      <div class="sheet-grab" aria-hidden="true"></div>
      <div class="sheet-grid">${extra.map(([h,l])=>{ const k = l.toLowerCase(), on = k===active, pdf = /\.pdf$/.test(h);
        return `<a href="${h}" class="${on?"on":""}"${on?' aria-current="page"':""}${pdf?' target="_blank" rel="noopener"':""}>${icon(this.icons[k]?k:"more")}<span>${l}</span></a>`;}).join("")}</div>
      <div class="sheet-social"><a href="${this.social.instagram}" target="_blank" rel="noopener">${this.glyph.ig} @coptichoops</a>
        <a href="${this.social.youtube}" target="_blank" rel="noopener">${this.glyph.yt} Live on YouTube</a></div></div>`;
    document.body.appendChild(sheet);
    const btn = tabs.querySelector(".more-btn"), card = sheet.querySelector(".sheet-card"), scrim = sheet.querySelector(".sheet-scrim");
    const isOpen = ()=> sheet.classList.contains("open");
    const toggle = open => {
      if(isOpen()===open) return;
      card.style.transform = ""; scrim.style.opacity = "";
      sheet.classList.toggle("open", open); btn.setAttribute("aria-expanded", open);
      // focus moves into the sheet when it opens and back to "More" when it closes
      if(open) setTimeout(()=>{ const f = card.querySelector(".sheet-grid a"); if(f) f.focus({preventScroll:true}); }, 60);
      else if(card.contains(document.activeElement)) btn.focus({preventScroll:true});
    };
    btn.onclick = ()=> toggle(!isOpen());
    scrim.onclick = ()=> toggle(false);
    document.addEventListener("keydown", e=>{
      if(!isOpen()) return;
      if(e.key==="Escape"){ toggle(false); return; }
      if(e.key==="Tab"){   // keep keyboard focus inside the open sheet
        const f = [...card.querySelectorAll("a[href]")], i = f.indexOf(document.activeElement);
        if(e.shiftKey && i<=0){ e.preventDefault(); f[f.length-1].focus(); }
        else if(!e.shiftKey && i===f.length-1){ e.preventDefault(); f[0].focus(); }
      }
    });
    // Drag the sheet down to dismiss. It follows the finger, then either closes
    // (pulled far enough, or flicked) or springs back open.
    let y0 = null, dy = 0, t0 = 0, dragging = false, swallow = false;
    card.addEventListener("touchstart", e=>{
      if(e.touches.length>1) return;
      y0 = e.touches[0].clientY; dy = 0; t0 = performance.now(); dragging = false;
    }, {passive:true});
    card.addEventListener("touchmove", e=>{
      if(y0===null) return;
      dy = e.touches[0].clientY - y0;
      if(!dragging && dy>6){ dragging = true; card.style.transition = scrim.style.transition = "none"; }
      if(!dragging) return;
      const d = Math.max(0, dy);
      card.style.transform = `translateY(${d}px)`;
      scrim.style.opacity = String(Math.max(0, 1 - d/card.offsetHeight));
    }, {passive:true});
    const endDrag = ()=>{
      if(y0===null) return;
      y0 = null;
      if(!dragging) return;
      dragging = false;
      card.style.transition = scrim.style.transition = "";
      const v = dy / Math.max(1, performance.now()-t0);          // px per ms
      if(dy > card.offsetHeight*0.28 || v > 0.55) toggle(false);
      else { card.style.transform = ""; scrim.style.opacity = ""; }
      swallow = true; setTimeout(()=>swallow = false, 350);       // a drag isn't a tap
    };
    card.addEventListener("touchend", endDrag);
    card.addEventListener("touchcancel", endDrag);
    card.addEventListener("click", e=>{ if(swallow){ e.preventDefault(); e.stopPropagation(); } }, true);
    this.liveBar();
    this.fx();
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

  glyph:{
    ig:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r=".9" fill="currentColor"/></svg>',
    yt:'<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M22 8.2a3 3 0 0 0-2.1-2.1C18 5.6 12 5.6 12 5.6s-6 0-7.9.5A3 3 0 0 0 2 8.2 31 31 0 0 0 1.6 12 31 31 0 0 0 2 15.8a3 3 0 0 0 2.1 2.1c1.9.5 7.9.5 7.9.5s6 0 7.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .4-3.8 31 31 0 0 0-.4-3.8zM10 15.2V8.8l5.2 3.2z"/></svg>',
    mail:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/></svg>'
  },
  // Season-by-season facts the data files don't carry. Registration counts come
  // from the league's own @coptichoops announcements.
  history:{
    1:{ year:"Winter 2023", hoopers:70, blurb:"The first-ever season. 70 hoopers, 8 teams, four pairs of brothers, and St. Andrew lifted the first trophy." },
    2:{ year:"Fall 2023",   hoopers:85, blurb:"The league grew to 10 teams with St. Cosmas & St. Damian, added a play-in and a 3-point contest. St. Maximus went 6–1 and won it all." },
    3:{ year:"Winter 2025", hoopers:80, blurb:"St. James lost once all season, then beat 7th-seed Cinderella St. Andrew in the Finals." },
    4:{ year:"Winter 2026", hoopers:72, blurb:"St. Andrew went 7–0. St. Gregory went 1–6, then won the whole thing as the 7th seed. March doesn’t care about your record." }
  },
  // the saints behind the eight teams, paired as brothers
  saints:{
    "St. Andrew":{ full:"St. Andrew the Apostle", brother:"St. Peter", bio:"The First-Called. A fisherman of Galilee who heard John the Baptist, followed Christ, and went to bring his brother Peter." },
    "St. Peter":{ full:"St. Peter the Apostle", brother:"St. Andrew", bio:"The fisherman Christ called the rock. Brother of St. Andrew and first among the Twelve." },
    "St. James":{ full:"St. James the Apostle", brother:"St. John", bio:"Son of Zebedee, one of the “sons of thunder,” and the first of the Twelve to be martyred for Christ." },
    "St. John":{ full:"St. John the Apostle", brother:"St. James", bio:"The Beloved Disciple, evangelist and theologian, who stood at the Cross. Brother of St. James." },
    "St. Basil":{ full:"St. Basil the Great", brother:"St. Gregory", bio:"Bishop of Caesarea, a father of communal monastic life, and the voice behind the Liturgy of St. Basil prayed in our churches every week." },
    "St. Gregory":{ full:"St. Gregory of Nyssa", brother:"St. Basil", bio:"Bishop and theologian who defended the Nicene faith. Younger brother of St. Basil the Great." },
    "St. Maximus":{ full:"St. Maximus", brother:"St. Dometius", bio:"Son of a Roman emperor who left the palace for the desert of Scetis with his brother, under St. Macarius the Great." },
    "St. Dometius":{ full:"St. Dometius", brother:"St. Maximus", bio:"With his brother St. Maximus, gave up a royal life for the desert. Baramous, “of the Romans,” remembers them." },
    "St. Cosmas":{ full:"St. Cosmas", brother:"St. Damian", bio:"Twin physician and martyr who healed without charge. Season 2 club." },
    "St. Damian":{ full:"St. Damian", brother:"St. Cosmas", bio:"Twin physician and martyr who healed without charge. Season 2 club." }
  },
  // All-time numbers across every completed season, built from the season files.
  async allTime(){
    if(this._all) return this._all;
    const meta = await this.data("seasons");
    const done = meta.filter(s=>s.champion).map(s=>s.id);
    const seasons = await Promise.all(done.map(n=>this.data("season"+n)));
    const players = {}, teams = {}, games = {n:0, pts:0}, highs = [];
    seasons.forEach((d,i)=>{
      const sn = done[i];
      (d.players||[]).forEach(p=>{
        const a = players[p.name] = players[p.name] || {name:p.name, gp:0, pts:0, reb:0, ast:0, fg3m:0, stl:0, blk:0, seasons:[], teams:[]};
        ["gp","pts","reb","ast","fg3m","stl","blk"].forEach(k=>a[k]+= (p[k]||0));
        if(!a.seasons.includes(sn)) a.seasons.push(sn);
        if(!a.teams.includes(p.team)) a.teams.push(p.team);
        a.team = p.team;
      });
      (d.standings||[]).forEach(s=>{
        const t = teams[s.team] = teams[s.team] || {team:s.team, w:0, l:0, titles:[], finals:[], seasons:0};
        t.w += s.w; t.l += s.l; t.seasons++;
      });
      (d.games||[]).forEach(g=>{ if(g.status==="F" && g.score1!=null){ games.n++; games.pts += g.score1+g.score2; } });
      (d.playerLines||[]).forEach(l=>{ if(l.gp) highs.push({...l, season:sn}); });
      if(d.champion){ (teams[d.champion]=teams[d.champion]||{team:d.champion,w:0,l:0,titles:[],finals:[],seasons:0}).titles.push(sn); }
      const fin = this.finalGame(d);
      if(fin) [fin.team1, fin.team2].forEach(t=>{ if(teams[t]) teams[t].finals.push(sn); });
      else if(d.champion) teams[d.champion].finals.push(sn);
    });
    Object.values(players).forEach(p=>{ p.ppg = p.gp ? p.pts/p.gp : 0; });
    return this._all = { done, seasons, players:Object.values(players), teams, games, highs,
      hoopers: Object.keys(players).length };
  },
  // the championship game: the last Finals-stage game between champion and runner-up
  finalGame(d){
    if(!d.champion) return null;
    const fs = (d.games||[]).filter(g=>/Final/.test(g.stage) && !/Semi/.test(g.stage) && g.status==="F"
      && [g.team1,g.team2].includes(d.champion) && (!d.runnerUp || [g.team1,g.team2].includes(d.runnerUp)));
    return fs[fs.length-1] || null;
  },
  // Fades sections in as they scroll into view. Anything with .reveal, including
  // elements rendered later, is picked up; reduced-motion users see it all at once.
  // sections are simply there when the page opens (no fade-in)
  reveal(){
    if(this._rv) return; this._rv = 1;
    const show = ()=>document.querySelectorAll(".reveal:not(.in)").forEach(e=>e.classList.add("in"));
    show(); new MutationObserver(show).observe(document.body,{childList:true,subtree:true});
  },
  /* ---- player profiles ----
     Every name in the season files and rosters gets a profile at
     player.html?p=<slug>. data/players.js adds headshots and Season 5 sign-ups.
     Names were cleaned up across seasons so one person = one slug. */
  // solid badges: captain (gold, "C" mark), new (orange), champion (navy + gold star)
  badge(kind, text){
    const m = {cap:["bdg-cap","C",text||"Captain"], new:["bdg-new","",text||"New"], champ:["bdg-champ","★",text||"Champion"]}[kind];
    return m ? `<span class="bdg ${m[0]}">${m[1]?`<i>${m[1]}</i>`:""}${m[2]}</span>` : "";
  },
  // No motion layer: no tilt, spotlight, ripples, parallax or count-ups.
  // Anything still marked data-count simply shows its value.
  fx(){
    if(this._fx) return; this._fx = 1;
    const scan = ()=>document.querySelectorAll("[data-count]:not([data-cv])").forEach(el=>{
      el.dataset.cv = 1;
      const v = +el.dataset.count, dec = +(el.dataset.dec||0);
      el.textContent = dec ? v.toFixed(dec) : Math.round(v).toLocaleString("en-US");
    });
    scan(); new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
  },
  slug(name){
    return String(name||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"")
      .replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
  },
  pLink(name, cls){
    if(!name) return "";
    return `<a class="plink${cls?" "+cls:""}" href="player?p=${this.slug(name)}">${name}</a>`;
  },
  initials(name){
    return String(name||"").replace(/\(.*?\)/g,"").replace(/^Fr\.\s*/,"").trim().split(/\s+/)
      .map(w=>w[0]).slice(0,2).join("").toUpperCase();
  },
  // round headshot, or the player's initials on their latest team colour
  avatar(p, cls){
    const c = this.colors[p.team] || {bg:"#1b405e",fg:"#ffffff"};
    return p.photo
      ? `<span class="pav${cls?" "+cls:""}"><img src="${p.photo}" alt="${p.name}" loading="lazy"></span>`
      : `<span class="pav ini${cls?" "+cls:""}" style="background:${c.bg};color:${c.fg}" aria-hidden="true">${this.initials(p.name)}</span>`;
  },
  async players(){
    if(this._players) return this._players;
    const [meta, teams, reg] = await Promise.all([this.data("seasons"), this.data("teams"),
      this.data("players").catch(()=>({}))]);
    const ids = meta.map(s=>s.id);
    const seasons = await Promise.all(ids.map(n=>this.data("season"+n)));
    const P = {};
    const get = name => P[this.slug(name)] ||= {name, slug:this.slug(name), seasons:{}, lines:[], titles:[], captain:[]};
    seasons.forEach((d,i)=>{
      const sn = ids[i];
      (d.players||[]).forEach(p=>{ get(p.name).seasons[sn] = {...p, season:sn}; });
      (d.playerLines||[]).forEach(l=>{ get(l.name).lines.push({...l, season:sn}); });
    });
    // a roster spot counts as a season even before any stats are in
    Object.entries(teams).forEach(([tn,t])=>Object.entries(t.seasons||{}).forEach(([sn,sd])=>{
      (sd.roster||[]).forEach(r=>{
        const x = get(r.name);
        if(!x.seasons[sn]) x.seasons[sn] = {name:r.name, team:tn, num:r.num, season:+sn, rosterOnly:true};
      });
      if(sd.captain) get(sd.captain).captain.push(+sn);
    }));
    seasons.forEach((d,i)=>{
      if(!d.champion) return;
      Object.values(P).forEach(p=>{ const s = p.seasons[ids[i]]; if(s && s.team===d.champion) p.titles.push(ids[i]); });
    });
    Object.entries(reg).forEach(([slug,r])=>{
      const x = P[slug] ||= {name:r.name, slug, seasons:{}, lines:[], titles:[], captain:[]};
      x.name = r.name; x.photo = r.photo || null; x.s5 = !!r.s5; x.cap5 = !!r.captain;
    });
    const K = ["gp","gs","pts","reb","ast","fg2m","fg2a","fg3m","fg3a","ftm","fta","pf","stl","blk","to"];
    Object.values(P).forEach(p=>{
      const t = p.tot = Object.fromEntries(K.map(k=>[k,0]));
      const list = Object.values(p.seasons).sort((a,b)=>a.season-b.season);
      list.forEach(s=>{ if(!s.rosterOnly) K.forEach(k=>t[k]+= (s[k]||0)); });
      t.ppg = t.gp ? t.pts/t.gp : 0; t.rpg = t.gp ? t.reb/t.gp : 0; t.apg = t.gp ? t.ast/t.gp : 0;
      const fa = t.fg2a+t.fg3a; t.fgp = fa ? (t.fg2m+t.fg3m)/fa*100 : null; t.ftp = t.fta ? t.ftm/t.fta*100 : null;
      const last = list[list.length-1];
      p.team = last ? last.team : null; p.num = last ? last.num : null;
      p.seasonList = list.map(s=>s.season);
      p.lines.sort((a,b)=> a.date<b.date?-1:1);
    });
    return this._players = P;
  },
  photo(id, thumb){ return `assets/img/photos/${thumb?"thumb/":""}${id}.jpg`; },

  footer(){
    const f = document.createElement("footer");
    f.className = "foot";
    f.innerHTML = `<div class="wrap">
      <img class="foot-logo" src="assets/img/logo-white.png" alt="TCBL" loading="lazy">
      <p class="foot-verse">"Honor all people. Love the brotherhood. Fear God…" <span>1 Peter 2:17</span></p>
      <nav class="foot-links" aria-label="More">
        <a href="assets/docs/TCBL-Rulebook.pdf" target="_blank" rel="noopener">Rulebook</a>
        <a href="${this.social.instagram}" target="_blank" rel="noopener">Instagram</a>
        <a href="${this.social.youtube}" target="_blank" rel="noopener">YouTube</a>
        <a href="mailto:${this.social.email}">Email us</a>
        ${this.portalLocked ? "" : this.portalLink()}
      </nav>
      <p class="foot-fine">Tampa Bay Coptic Basketball League · Coptic Orthodox Diocese of the Southern United States</p>
    </div>`;
    document.body.appendChild(f);
    this.reveal();
  },
  // A quiet countdown line ("49 days until tip-off"). Refreshes every 30 seconds,
  // no ticking digits. At zero it stops and calls onDone.
  countdown(el, target, label, onDone){
    if(!el) return;
    clearInterval(el._cd);
    const pl = (n,w)=>`${n} ${w}${n===1?"":"s"}`;
    const tick = ()=>{
      const ms = new Date(target) - new Date();
      if(ms<=0){ clearInterval(el._cd); el.innerHTML = ""; if(onDone) onDone(); return; }
      const d = Math.floor(ms/864e5), h = Math.floor(ms%864e5/36e5), m = Math.floor(ms%36e5/6e4);
      const left = d>=3 ? pl(d,"day") : d>=1 ? `${pl(d,"day")}, ${pl(h,"hour")}` : h>=1 ? `${pl(h,"hour")}, ${m} min` : m>=1 ? `${m} min` : "Under a minute";
      el.innerHTML = `<b>${left}</b> ${label}`;
    };
    el._cd = setInterval(tick, 30000); tick();
  },
  /* Season tabs that keep the choice in the address (?s=3): a season can be shared,
     survives a reload, and Back/Forward step through it. With no ?s the page opens
     on the newest season that actually has something to show, as judged by has(d),
     so pages move on to a new season by themselves once its data lands. */
  async seasonPicker(el, onPick, has){
    const meta = await this.data("seasons");
    const ids = meta.map(s=>s.id).sort((a,b)=>b-a), cur = (meta.find(s=>s.current)||{}).id;
    let def = ids[ids.length-1];
    for(const n of ids){ if(!has || has(await this.data("season"+n))){ def = n; break; } }
    const fromUrl = ()=>{ const n = +new URLSearchParams(location.search).get("s"); return ids.includes(n) ? n : def; };
    el.innerHTML = ids.map(n=>`<button type="button" data-s="${n}" aria-pressed="false">Season ${n}</button>`).join("");
    const go = n=>{
      el.querySelectorAll("button").forEach(b=>{ const on = +b.dataset.s===n; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
      onPick(n);
    };
    el.querySelectorAll("button").forEach(b=>b.onclick=()=>{
      if(b.classList.contains("on")) return;
      const n = +b.dataset.s, u = new URL(location.href);
      u.searchParams.set("s", n);
      history.pushState(null, "", u);
      go(n);
    });
    addEventListener("popstate", ()=>go(fromUrl()));
    go(fromUrl());
  },
  // Small status message near the bottom of the screen. Polite: it never steals focus.
  toast(msg){
    let t = document.querySelector(".toast");
    if(!t){ t = document.createElement("div"); t.className = "toast"; t.setAttribute("role","status"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(()=>t.classList.remove("show"), 2600);
  },
  // Sortable headers: every th[data-k] gets a real button (reachable by keyboard), an
  // arrow on the active column and aria-sort. First tap sorts high to low, the next
  // flips it. The chosen sort carries over when the season changes.
  sortTable(tbl, data, render, first){
    const st = tbl._sort || (tbl._sort = { k:first||null, dir:"desc" });
    const ths = [...tbl.querySelectorAll("th[data-k]")];
    const apply = ()=>{
      if(st.k) data.sort((a,b)=>{
        const x = a[st.k] ?? -1e9, y = b[st.k] ?? -1e9, c = x<y ? -1 : x>y ? 1 : 0;
        return st.dir==="asc" ? c : -c;
      });
      ths.forEach(th=>{
        const on = th.dataset.k===st.k;
        th.classList.toggle("sorted", on);
        if(on) th.setAttribute("aria-sort", st.dir==="asc" ? "ascending" : "descending"); else th.removeAttribute("aria-sort");
      });
      render(data);
    };
    ths.forEach(th=>{
      if(!th.querySelector(".th-sort")) th.innerHTML = `<button type="button" class="th-sort">${th.textContent}<i aria-hidden="true"></i></button>`;
      th.querySelector(".th-sort").onclick = ()=>{
        st.dir = (st.k===th.dataset.k && st.dir==="desc") ? "asc" : "desc";
        st.k = th.dataset.k;
        apply();
      };
    });
    apply();
  }
};
