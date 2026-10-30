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
      `<span class="mchip">${this.teamShort(g.team1,"sm")}<i>vs</i>${this.teamShort(g.team2,"sm")}
        <b>${this.fmtTime(g.time)}</b></span>`).join("");
    return m ? `<div class="mgrid">${m}</div>` : "";
  },
  // Renders the player when a game is on, and a countdown to the next one when not.
  async liveSection(host){
    if(!host) return;
    const w = this.liveWindow((await this.data("season5")).games);
    clearTimeout(host._liveT);
    if(w.live){
      // switch back to "off air" by itself once the day's games are over
      host._liveT = setTimeout(()=>this.liveSection(host), Math.min(w.live.end - new Date() + 1000, 2**31-1));
      host.innerHTML = `<div class="livenow"><span class="ldot"></span>Live now ·
        ${this.fmtDate(w.live.date)}${w.live.games[0].venue?" · "+w.live.games[0].venue:""}</div>
        ${this.liveEmbed()}${this.matchups(w.live.games)}`;
    } else if(w.next){
      host.innerHTML = `<div class="card offair"><h3>Off air right now</h3>
        <p class="cardp">Every TCBL game is streamed on our YouTube channel. This player switches
        itself on when the first ball tips — no need to go looking for the link.</p>
        <div class="count" id="live-count"></div>
        ${this.matchups(w.next.games)}
        <p style="margin-top:16px"><a class="btn ghost" href="${this.yt.url}"
          target="_blank" rel="noopener">Past broadcasts on YouTube</a></p></div>`;
      // when the countdown runs out, re-render so the player appears without a refresh
      this.countdown(document.getElementById("live-count"), w.next.start.toISOString(),
        `Next tip-off · ${this.fmtDate(w.next.date)}`, ()=>this.liveSection(host));
    } else {
      host.innerHTML = `<div class="card offair"><h3>That's a wrap on the season</h3>
        <p class="cardp">Every game from the season is up on our YouTube channel.</p>
        <p style="margin-top:14px"><a class="btn ghost" href="${this.yt.url}"
          target="_blank" rel="noopener">Watch on YouTube</a></p></div>`;
    }
  },
  // Slim site-wide bar, skipped on pages that already show the player.
  async liveBar(){
    if(document.getElementById("livehost")) return;
    const w = this.liveWindow((await this.data("season5")).games);
    if(!w.live) return;
    const a = document.createElement("a");
    a.className = "livebar"; a.href = "index.html#live";
    a.innerHTML = `<span class="ldot"></span><b>We're live now</b>
      <span>Watch today's games →</span>`;
    document.body.insertBefore(a, document.body.firstChild);
  },

  /* ---- registration state ----
     One source of truth for the window so the hero button, the register page
     and anything added later can never disagree. */
  // Times carry Tampa's UTC offset (EST, -05:00) so every visitor gets the same
  // moment, wherever their device's clock is set.
  reg:{ open:"2026-11-08T19:00:00-05:00", close:"2026-11-15T23:59:00-05:00",
        form:"https://pci.jotform.com/form/253064435211144" },
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
      el.innerHTML = `<a class="btn" href="${href||this.reg.form}">Register for Season 5</a>`;
    } else if(s==="soon"){
      el.innerHTML = `<span class="btn locked" aria-disabled="true" role="link"
        title="Registration opens November 8, 2026 at 7:00 PM Eastern">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>
        Registration opens Nov 8</span>`;
    } else {
      el.innerHTML = `<span class="btn locked" aria-disabled="true" role="link">
        Registration closed for Season 5</span>`;
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
    history:'M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4.5v3.9h3.9M12 7.6V12l3 1.8',
    gallery:'M4 5.5h16v13H4zM4 15.2l4.3-4.1 4.2 4.1 2.9-2.8 4.6 4.4M15.6 9.3h.01',
    more:'M5 12h.01M12 12h.01M19 12h.01',
    register:'M12 20.5h8.5M16.6 4a2.1 2.1 0 0 1 3 3L7.5 19.1l-4 1 1-4z',
    statportal:'M4 20h16M7 16V9M12 16V5M17 16v-4',
    calendar:'M3.2 8.6h17.6M7.6 3.4v3.2M16.4 3.4v3.2M4.4 6.2h15.2a1.2 1.2 0 0 1 1.2 1.2v12.4a1.2 1.2 0 0 1-1.2 1.2H4.4a1.2 1.2 0 0 1-1.2-1.2V7.4a1.2 1.2 0 0 1 1.2-1.2z'
  },
  // Stat Portal switch. While true the portal shows as locked everywhere and
  // upload.html refuses to load the tool. Flip to false to open it back up.
  portalLocked: true,
  // what every Stat Portal entry point renders: a link, or a locked label
  portalLink(cls){
    if(!this.portalLocked) return `<a class="${cls||""}" href="upload.html">Stat Portal</a>`;
    return `<span class="${cls||""} locked" aria-disabled="true" title="The Stat Portal is locked for now"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg> Stat Portal</span>`;
  },
  // social + contact, used by the footer and the mobile "More" sheet
  social:{ instagram:"https://www.instagram.com/coptichoops/", youtube:"https://www.youtube.com/@Coptichoops",
           email:"coptichoops@gmail.com" },
  nav(active){
    const links = [["index.html","Home"],["schedule.html","Schedule"],["teams.html","Teams"],
      ["stats.html","Stats"],["standings.html","Standings"],["history.html","History"],
      ["gallery.html","Gallery"],["calendar.html","Calendar"]];
    const onPortal = /upload\.html$/.test(location.pathname);
    // ---- top bar: brand, links, register + portal ----
    document.getElementById("topbar").innerHTML = `<div class="wrap">
      <a class="brand" href="index.html" aria-label="TCBL home"><img src="assets/img/logo-mini.png" alt=""><span>TCBL</span></a>
      <a class="m-only m-portal${onPortal?" on":""}" href="register.html">Register</a>
      <nav class="nav">${links.map(([h,l])=>
        `<a href="${h}" class="${l.toLowerCase()===active?"on":""}">${l}</a>`).join("")}
        <a class="spacer ghost-cta${active==="register"?" on":""}" href="register.html">Register</a>
        ${this.portalLink("cta")}</nav></div>`;
    // ---- mobile bottom tab bar: 4 main tabs + a "More" sheet ----
    const main = links.slice(0,4), extra = [["standings.html","Standings"],["history.html","History"],
      ["gallery.html","Gallery"],["calendar.html","Calendar"],["register.html","Register"],["upload.html","Stat Portal"]];
    const tile = (h,l,k,on) => (k==="statportal" && this.portalLocked)
      ? `<span class="locked" aria-disabled="true">${icon(k)}<span>${l} · Locked</span></span>`
      : `<a href="${h}" class="${on?"on":""}">${icon(this.icons[k]?k:"more")}<span>${l}</span></a>`;
    const inMore = extra.some(([,l])=>l.toLowerCase()===active) || onPortal;
    const icon = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${this.icons[k]}"/></svg>`;
    const tabs = document.createElement("nav");
    tabs.className = "tabbar";
    tabs.setAttribute("aria-label","Primary");
    tabs.innerHTML = main.map(([h,l])=>{
      const k = l.toLowerCase(), cur = k===active;
      return `<a href="${h}" class="${cur?"on":""}"${cur?' aria-current="page"':""}>${icon(k)}<span>${l}</span></a>`;
    }).join("") + `<button type="button" class="more-btn${inMore?" on":""}" aria-haspopup="true" aria-expanded="false">${icon("more")}<span>More</span></button>`;
    document.body.appendChild(tabs);
    const sheet = document.createElement("div");
    sheet.className = "sheet"; sheet.setAttribute("role","dialog"); sheet.setAttribute("aria-label","More pages");
    sheet.innerHTML = `<div class="sheet-scrim"></div><div class="sheet-card">
      <div class="sheet-grab"></div>
      <div class="sheet-grid">${extra.map(([h,l])=>{ const k=l.toLowerCase().replace(" ","");
        return tile(h,l,k,l.toLowerCase()===active||(onPortal&&k==="statportal"));}).join("")}</div>
      <div class="sheet-social"><a href="${this.social.instagram}" target="_blank" rel="noopener">${this.glyph.ig} @coptichoops</a>
        <a href="${this.social.youtube}" target="_blank" rel="noopener">${this.glyph.yt} Live on YouTube</a></div></div>`;
    document.body.appendChild(sheet);
    const btn = tabs.querySelector(".more-btn");
    const toggle = open => { sheet.classList.toggle("open", open); btn.setAttribute("aria-expanded", open); };
    btn.onclick = ()=> toggle(!sheet.classList.contains("open"));
    sheet.querySelector(".sheet-scrim").onclick = ()=> toggle(false);
    document.addEventListener("keydown", e=>{ if(e.key==="Escape") toggle(false); });
    this.liveBar();
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
    1:{ year:"Winter 2023", hoopers:70, blurb:"The first-ever season. 70 hoopers, 8 teams, four pairs of brothers — and St. Andrew lifted the first trophy." },
    2:{ year:"Fall 2023",   hoopers:85, blurb:"The league grew to 10 teams with St. Cosmas & St. Damian, added a play-in and a 3-point contest. St. Maximus went 6–1 and won it all." },
    3:{ year:"Winter 2025", hoopers:80, blurb:"Sold out in hours. St. James lost once all season, then beat 7th-seed Cinderella St. Andrew in the Finals." },
    4:{ year:"Winter 2026", hoopers:72, blurb:"St. Andrew went 7–0. St. Gregory went 1–6 — then won the whole thing as the 7th seed. March doesn’t care about your record." }
  },
  // the saints behind the eight teams, paired as brothers
  saints:{
    "St. Andrew":{ full:"St. Andrew the Apostle", brother:"St. Peter", bio:"The First-Called. A fisherman of Galilee who heard John the Baptist, followed Christ, and went to bring his brother Peter." },
    "St. Peter":{ full:"St. Peter the Apostle", brother:"St. Andrew", bio:"The fisherman Christ called the rock. Brother of St. Andrew and first among the Twelve." },
    "St. James":{ full:"St. James the Apostle", brother:"St. John", bio:"Son of Zebedee, one of the “sons of thunder,” and the first of the Twelve to be martyred for Christ." },
    "St. John":{ full:"St. John the Apostle", brother:"St. James", bio:"The Beloved Disciple — evangelist and theologian — who stood at the Cross. Brother of St. James." },
    "St. Basil":{ full:"St. Basil the Great", brother:"St. Gregory", bio:"Bishop of Caesarea, a father of communal monastic life, and the voice behind the Liturgy of St. Basil prayed in our churches every week." },
    "St. Gregory":{ full:"St. Gregory of Nyssa", brother:"St. Basil", bio:"Bishop and theologian who defended the Nicene faith. Younger brother of St. Basil the Great." },
    "St. Maximus":{ full:"St. Maximus", brother:"St. Dometius", bio:"Son of a Roman emperor who left the palace for the desert of Scetis with his brother, under St. Macarius the Great." },
    "St. Dometius":{ full:"St. Dometius", brother:"St. Maximus", bio:"With his brother St. Maximus, gave up a royal life for the desert. Baramous — “of the Romans” — remembers them." },
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
  reveal(){
    if(this._rv) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if(reduce || !("IntersectionObserver" in window)){
      const show = ()=>document.querySelectorAll(".reveal").forEach(e=>e.classList.add("in"));
      show(); new MutationObserver(show).observe(document.body,{childList:true,subtree:true}); this._rv=1; return;
    }
    const io = new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target);} }),
      {rootMargin:"0px 0px -8% 0px", threshold:.08});
    const scan = ()=>document.querySelectorAll(".reveal:not(.in):not([data-rv])").forEach(e=>{ e.dataset.rv=1; io.observe(e); });
    scan(); new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
    this._rv = 1;
  },
  photo(id, thumb){ return `assets/img/photos/${thumb?"thumb/":""}${id}.jpg`; },

  footer(){
    const f = document.createElement("footer");
    const col = (t, items)=>`<div class="fcol"><h4>${t}</h4>${items.map(([h,l,ext])=>
      `<a href="${h}"${ext?' target="_blank" rel="noopener"':""}>${l}</a>`).join("")}</div>`;
    f.innerHTML = `<div class="wrap fgrid">
      <div class="fbrand"><img src="assets/img/logo-white.png" alt="TCBL">
        <p class="verse">"Honor all people. Love the brotherhood. Fear God…" <span>1 Peter 2:17</span></p>
        <p class="fpillars">Faith · Fellowship · Fitness</p></div>
      ${col("League",[["schedule.html","Schedule"],["standings.html","Standings"],["stats.html","Stats"],["teams.html","Teams"]])}
      ${col("Story",[["history.html","History"],["gallery.html","Gallery"],["calendar.html","Coptic calendar"],["register.html","Register"]])}
      <div class="fcol"><h4>Follow</h4>
        <a href="${this.social.instagram}" target="_blank" rel="noopener">${this.glyph.ig} Instagram</a>
        <a href="${this.social.youtube}" target="_blank" rel="noopener">${this.glyph.yt} YouTube</a>
        <a href="mailto:${this.social.email}">${this.glyph.mail} Email us</a></div>
    </div>
    <div class="wrap fbottom"><span>Tampa Bay Coptic Basketball League · Sanctioned under the Coptic Orthodox Diocese of the Southern United States</span>
      ${this.portalLink()}</div>`;
    document.body.appendChild(f);
    this.reveal();
  },
  // Ticks every second; when it reaches zero it stops and calls onDone, which
  // the page uses to swap in whatever comes next.
  countdown(el, target, label, onDone){
    if(!el) return;
    clearInterval(el._cd);
    const tick = ()=>{
      const ms = new Date(target) - new Date();
      if(ms<=0){ clearInterval(el._cd); el.innerHTML = ""; if(onDone) onDone(); return; }
      const d = Math.floor(ms/864e5), h = Math.floor(ms%864e5/36e5),
            m = Math.floor(ms%36e5/6e4), s = Math.floor(ms%6e4/1e3);
      el.innerHTML = `<div class="count-label">${label}</div>` +
        [[d,"Days"],[h,"Hours"],[m,"Min"],[s,"Sec"]].map(([v,l])=>
          `<div class="cell"><b>${v}</b><span>${l}</span></div>`).join("");
    };
    el._cd = setInterval(tick, 1000); tick();
  },
  async seasonTabs(el, current, onPick, disable1){
    // which season is live comes from seasons.js, never a hardcoded number
    const meta = await this.data("seasons");
    const cur = (meta.find(s=>s.current) || {}).id;
    el.innerHTML = [5,4,3,2,1].map(n=>
      `<span class="tabwrap"><button data-s="${n}" ${n===current?'class="on"':""}
        ${n===1&&disable1?"disabled title='Season 1 archive coming soon'":""}
        >Season ${n}</button>${n===cur?'<i class="nowlabel">Current</i>':""}</span>`).join("");
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
