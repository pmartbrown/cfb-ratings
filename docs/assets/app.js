// College football ratings site. Plain JS, no libraries, no external requests.
(function(){
  "use strict";
  var esc = CFB.esc;
  var S = { idx:null, weeks:{}, list:[], hasConf:false,
            cmpWeeks:null, cmpAll:false, cmpSort:null, cmpDir:1, cmpQ:"", cmpConf:"",
            topQ:"", topConf:"", allQ:"", allConf:"", allSort:"rank", allDir:1,
            chartTeams:null };
  // Chart colors: none is the orange site accent; mid-tone so each reads on navy and on white.
  var PALETTE = ["#2E9BF0","#22B573","#E5484D","#8B6CEF","#C9A227","#D9529A","#13A8A8","#7C8BA1","#6E9F2E","#9C7A5B","#5B6CD6","#A05BC4","#3D7EA6","#C2185B","#558B6E"];
  var main = document.getElementById("main");

  function fmt(x,d){ if(x==null||isNaN(x)) return "–"; return (x>0?"+":"")+Number(x).toFixed(d==null?1:d); }
  function rat(x){ return x==null ? "–" : Number(x).toFixed(1); }
  function teamRow(wk, team){ var w=S.weeks[wk]; return w ? w.byTeam[team] : null; }

  // ---------- routing ----------
  function parseHash(){
    var h = (location.hash||"").replace(/^#\/?/,""); var q = {};
    var qi = h.indexOf("?"); if(qi>=0){ h.slice(qi+1).split("&").forEach(function(kv){ var p=kv.split("="); if(p[0]) q[decodeURIComponent(p[0])]=decodeURIComponent(p[1]||""); }); h=h.slice(0,qi); }
    var parts = h.split("/").filter(Boolean);
    var r = { view:"top", week:S.idx.latest, sub:"table", q:q };
    if(parts[0]==="week"){ r.view="top"; r.week=+parts[1]; }
    else if(parts[0]==="teams"){ r.view="teams"; if(parts[1]) r.week=+parts[1]; }
    else if(parts[0]==="compare"){ r.view="compare"; r.sub = parts[1]==="chart" ? "chart" : "table"; }
    if(!S.weeks[r.week]) r.week = S.idx.latest;
    return r;
  }
  function weekHref(view, wk){ return view==="teams" ? "#/teams/"+wk : "#/week/"+wk; }

  // ---------- header / nav ----------
  function header(wk){
    var w = S.weeks[wk]; var el = document.getElementById("weekline");
    var mode = w.mode==="full" ? '<span class="chip full" title="Includes play-by-play efficiency">Full</span>'
                               : '<span class="chip scores" title="Final scores only; play-by-play not yet available for this week">Scores-only</span>';
    el.innerHTML = '<h2>Week '+w.week+', '+w.season+'</h2>'+mode+(w.provisional?'<span class="chip prov" title="Built from a backup play-by-play feed; may change">Provisional</span>':'')+
                   '<span class="updated">Updated '+esc(CFB.fmtDate(w.updated))+'</span>';
  }
  function nav(r){
    ["top","compare","teams"].forEach(function(v){ document.getElementById("tab-"+v).classList.toggle("on", r.view===v); });
    document.getElementById("tab-top").setAttribute("href", "#/week/"+r.week);
    document.getElementById("tab-teams").setAttribute("href", "#/teams/"+r.week);
  }
  function pills(view, wk){
    return '<div class="pills" role="tablist" aria-label="Week">'+S.list.map(function(n){
      var w=S.weeks[n]; return '<a class="pill'+(n===wk?' on':'')+'" role="tab" aria-selected="'+(n===wk)+'" href="'+weekHref(view,n)+'" title="'+(w.mode==="full"?"Full":"Scores-only")+(w.provisional?", provisional":"")+'">Wk '+n+(n===S.idx.latest?'<span class="dot" aria-hidden="true"></span>':'')+'</a>';
    }).join("")+'</div>';
  }
  function filterBar(id, q, conf, extra){
    var c = '';
    if(S.hasConf){
      var confs = {}; S.list.forEach(function(n){ S.weeks[n].teams.forEach(function(t){ if(t.conference) confs[t.conference]=1; }); });
      c = '<select id="'+id+'Conf" aria-label="Conference"><option value="">All conferences</option>'+Object.keys(confs).sort().map(function(k){ return '<option'+(k===conf?' selected':'')+'>'+esc(k)+'</option>'; }).join("")+'</select>';
    }
    return '<div class="toolbar"><input type="search" id="'+id+'Q" placeholder="Search team" aria-label="Search team" value="'+esc(q)+'">'+c+(extra||'')+'<span class="count" id="'+id+'Count"></span></div>';
  }
  function match(t, q, conf){
    if(q && t.team.toLowerCase().indexOf(q.toLowerCase())<0) return false;
    if(conf && t.conference!==conf) return false;
    return true;
  }
  function bindFilter(id, onq, onc, rerender){
    var qi=document.getElementById(id+"Q"); if(qi) qi.addEventListener("input", function(){ onq(qi.value); rerender(); });
    var ci=document.getElementById(id+"Conf"); if(ci) ci.addEventListener("change", function(){ onc(ci.value); rerender(); });
  }

  // ---------- sparkline ----------
  function series(team){ return S.list.map(function(n){ var t=teamRow(n,team); return {w:n, r:t?t.rating:null, k:t?t.rank:null}; }); }
  function spark(team, w, h){
    w=w||120; h=h||34; var s=series(team).filter(function(p){return p.r!=null;});
    if(s.length<2) return '<span class="dr">not enough weeks</span>';
    var lo=Math.min.apply(null,s.map(function(p){return p.r;})), hi=Math.max.apply(null,s.map(function(p){return p.r;}));
    if(hi-lo<1){ hi+=0.5; lo-=0.5; }
    var pad=4, X=function(i){ return pad + i*(w-2*pad)/(s.length-1); }, Y=function(v){ return pad + (hi-v)*(h-2*pad)/(hi-lo); };
    var d = s.map(function(p,i){ return (i?"L":"M")+X(i).toFixed(1)+" "+Y(p.r).toFixed(1); }).join(" ");
    var last=s[s.length-1];
    return '<svg class="spark" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+esc(team)+' rating by week: '+s.map(function(p){return "week "+p.w+" "+rat(p.r);}).join(", ")+'">'+
      '<path d="'+d+'"/><circle cx="'+X(s.length-1).toFixed(1)+'" cy="'+Y(last.r).toFixed(1)+'" r="3"/></svg>';
  }
  function trail(team){ return series(team).filter(function(p){return p.k!=null;}).map(function(p){ return "Wk"+p.w+" #"+p.k; }).join(" · "); }

  // ---------- movement ----------
  function movement(t, w, topOnly){
    if(!w.has_prev) return '<div class="arr flat" title="First week of the season series">–</div><div class="dr">first week</div>';
    if(t.prev_rank==null) return '<div class="arr new">NEW</div><div class="dr">not rated last wk</div>';
    var dr = t.prev_rating!=null && t.rating!=null ? fmt(t.rating - t.prev_rating) : "–";
    var m = t.prev_rank - t.rank;
    var a = m>0 ? '<div class="arr up" aria-label="up '+m+'">&#9650; '+m+'</div>' : m<0 ? '<div class="arr down" aria-label="down '+(-m)+'">&#9660; '+(-m)+'</div>' : '<div class="arr flat" aria-label="no change">–</div>';
    if(topOnly && t.prev_rank>30) return a+'<div class="dr" title="Outside the Top 30 last week">was #'+t.prev_rank+' · '+dr+'</div>';
    return a+'<div class="dr">'+dr+' pts</div>';
  }

  // ---------- Top 30 ----------
  function renderTop(r){
    var w=S.weeks[r.week];
    var shown = w.teams.filter(function(t){ return t.rank<=30 && match(t,S.topQ,S.topConf); });
    var html = pills("top", r.week) + filterBar("top", S.topQ, S.topConf) +
      '<div class="card"><ol class="rows" id="topRows">'+ (shown.length? shown.map(function(t){
        return '<li class="row" tabindex="0" data-team="'+esc(t.team)+'">'+
          '<div class="rk">'+t.rank+'</div>'+
          '<div class="badge" title="Rating">'+rat(t.rating)+'</div>'+
          '<div class="tm"><div class="name">'+esc(t.team)+'</div><div class="sub">'+esc(t.record)+(t.conference?' · '+esc(t.conference):'')+'</div></div>'+
          '<div class="sparkcell" aria-hidden="true">'+spark(t.team,110,32)+'</div>'+
          '<div class="mv">'+movement(t,w,true)+'</div>'+
          '<div class="detail">'+spark(t.team,140,36)+'<span>'+esc(trail(t.team))+'</span></div>'+
          '<span class="chev" aria-hidden="true">&#8250;</span>'+
        '</li>';
      }).join("") : '<li class="empty">No teams match.</li>')+'</ol></div>'+
      '<p class="note">The small line on each row is the team\'s rating trend; tap a row on a phone to see it. Movement compares with the previous week\'s list.</p>';
    main.innerHTML = html;
    document.getElementById("topCount").textContent = shown.length+" of 30";
    bindFilter("top", function(v){S.topQ=v;}, function(v){S.topConf=v;}, function(){ var pos=caret("topQ"); renderTop(r); restore("topQ",pos); });
    Array.prototype.forEach.call(document.querySelectorAll("#topRows .row"), function(li){
      var tog=function(){ li.classList.toggle("open"); };
      li.addEventListener("click", tog);
      li.addEventListener("keydown", function(e){ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); tog(); } });
    });
  }
  function caret(id){ var e=document.getElementById(id); return e && document.activeElement===e ? e.selectionStart : null; }
  function restore(id,pos){ if(pos==null) return; var e=document.getElementById(id); if(e){ e.focus(); try{ e.setSelectionRange(pos,pos); }catch(_){} } }

  // ---------- All teams ----------
  function renderTeams(r){
    var w=S.weeks[r.week];
    var rows = w.teams.filter(function(t){ return match(t,S.allQ,S.allConf); }).map(function(t){
      return {t:t, mv: (w.has_prev && t.prev_rank!=null) ? t.prev_rank-t.rank : null, dr:(t.prev_rating!=null&&t.rating!=null)? t.rating-t.prev_rating : null};
    });
    var key=S.allSort, dir=S.allDir;
    rows.sort(function(a,b){
      var va, vb;
      if(key==="team"){ return dir*a.t.team.localeCompare(b.t.team); }
      if(key==="conf"){ return dir*((a.t.conference||"").localeCompare(b.t.conference||"")) || a.t.rank-b.t.rank; }
      if(key==="rating"){ va=-a.t.rating; vb=-b.t.rating; }
      else if(key==="mv"){ va=a.mv==null?1e9:-a.mv; vb=b.mv==null?1e9:-b.mv; }
      else if(key==="dr"){ va=a.dr==null?1e9:-a.dr; vb=b.dr==null?1e9:-b.dr; }
      else if(key==="prev"){ va=a.t.prev_rank==null?1e9:a.t.prev_rank; vb=b.t.prev_rank==null?1e9:b.t.prev_rank; }
      else { va=a.t.rank; vb=b.t.rank; }
      return dir*(va-vb) || a.t.rank-b.t.rank;
    });
    function th(k,label,cls){ return '<th class="sortable'+(cls?' '+cls:'')+(key===k?' sorted':'')+'" data-k="'+k+'" aria-sort="'+(key===k?(dir>0?"ascending":"descending"):"none")+'">'+label+(key===k?(dir>0?' ▲':' ▼'):'')+'</th>'; }
    var html = pills("teams", r.week) + filterBar("all", S.allQ, S.allConf) +
      '<div class="card tablewrap"><table class="grid" id="allTable"><thead><tr>'+
        th("rank","Rank","")+th("team","Team","l frz")+(S.hasConf?th("conf","Conference","l"):"")+th("rating","Rating","")+th("prev","Last wk","")+th("mv","Move","")+th("dr","Rating Δ","")+
      '</tr></thead><tbody>'+ rows.map(function(o){ var t=o.t;
        var mv = o.mv==null ? (w.has_prev?'<span class="delta flat">NEW</span>':'<span class="delta flat">–</span>') : o.mv>0 ? '<span class="delta up">▲ '+o.mv+'</span>' : o.mv<0 ? '<span class="delta down">▼ '+(-o.mv)+'</span>' : '<span class="delta flat">–</span>';
        return '<tr><td class="bigrk">'+t.rank+'</td><td class="frz"><span class="tname">'+esc(t.team)+'</span><span class="trec">'+esc(t.record)+'</span></td>'+
          (S.hasConf?'<td class="l">'+esc(t.conference||"")+'</td>':'')+'<td><b>'+rat(t.rating)+'</b></td><td>'+(t.prev_rank==null?"–":t.prev_rank)+'</td><td>'+mv+'</td><td>'+fmt(o.dr)+'</td></tr>';
      }).join("") + '</tbody></table></div>'+(rows.length?'':'<div class="empty">No teams match.</div>');
    main.innerHTML = html;
    document.getElementById("allCount").textContent = rows.length+" of "+w.teams.length+" FBS teams";
    bindFilter("all", function(v){S.allQ=v;}, function(v){S.allConf=v;}, function(){ var pos=caret("allQ"); renderTeams(r); restore("allQ",pos); });
    Array.prototype.forEach.call(document.querySelectorAll("#allTable th.sortable"), function(h){
      h.addEventListener("click", function(){ var k=h.getAttribute("data-k"); if(S.allSort===k) S.allDir=-S.allDir; else { S.allSort=k; S.allDir=1; } renderTeams(r); });
    });
  }

  // ---------- Compare weeks ----------
  function cmpWeeks(){ if(!S.cmpWeeks) S.cmpWeeks = S.list.slice(-4); return S.cmpWeeks.slice().sort(function(a,b){return a-b;}); }
  function renderCompare(r){
    if(r.q.w){ var ws=r.q.w.split(",").map(Number).filter(function(n){return S.weeks[n];}); if(ws.length) S.cmpWeeks=ws; }
    var sub = '<div class="subtabs" role="tablist"><a href="#/compare" class="'+(r.sub==="table"?"on":"")+'">Side by side</a><a href="#/compare/chart" class="'+(r.sub==="chart"?"on":"")+'">Rank over time</a></div>';
    if(r.sub==="chart") return renderChart(sub);
    var weeks = cmpWeeks(), last = weeks[weeks.length-1], first = weeks[0];
    var picker = '<div class="weekpick" id="wkPick"><span class="lbl">Weeks</span>'+S.list.map(function(n){ var on=weeks.indexOf(n)>=0;
      return '<label class="'+(on?'on':'')+'"><input type="checkbox" value="'+n+'"'+(on?' checked':'')+'>Wk '+n+'</label>'; }).join("")+'</div>';
    // team set: any team in the top 30 of a selected week (or all FBS)
    var set={}; weeks.forEach(function(n){ S.weeks[n].teams.forEach(function(t){ if(S.cmpAll || t.rank<=30) set[t.team]=1; }); });
    var latestW = S.weeks[last];
    var rows = Object.keys(set).map(function(name){
      var cur = teamRow(S.idx.latest,name) || teamRow(last,name) || {};
      var cells = weeks.map(function(n){ return teamRow(n,name); });
      var a=cells[0], b=cells[cells.length-1];
      return {team:name, rec:cur.record||"", conf:cur.conference||"", cells:cells, delta:(a&&b&&weeks.length>1)? a.rank-b.rank : null};
    }).filter(function(o){ return match({team:o.team, conference:o.conf}, S.cmpQ, S.cmpConf); });
    var sk = S.cmpSort && (S.cmpSort==="team"||S.cmpSort==="delta"||weeks.indexOf(+S.cmpSort.slice(1))>=0) ? S.cmpSort : "w"+last;
    var dir=S.cmpDir;
    rows.sort(function(x,y){
      if(sk==="team") return dir*x.team.localeCompare(y.team);
      if(sk==="delta"){ var dx=x.delta==null?-1e9:x.delta, dy=y.delta==null?-1e9:y.delta; return dir*(dy-dx) || x.team.localeCompare(y.team); }
      var i=weeks.indexOf(+sk.slice(1)); var rx=x.cells[i]?x.cells[i].rank:1e9, ry=y.cells[i]?y.cells[i].rank:1e9; return dir*(rx-ry);
    });
    var lo=1e9, hi=-1e9; rows.forEach(function(o){ o.cells.forEach(function(c){ if(c&&c.rating!=null){ lo=Math.min(lo,c.rating); hi=Math.max(hi,c.rating); } }); });
    function shade(v){ if(v==null||hi<=lo) return ""; var t=(v-lo)/(hi-lo); return 'background:rgba(var(--shade),'+(0.06+0.62*t*t).toFixed(3)+')'; }
    function th(k,label,cls){ return '<th class="sortable '+(cls||"")+(sk===k?' sorted':'')+'" data-k="'+k+'" aria-sort="'+(sk===k?(dir>0?"ascending":"descending"):"none")+'">'+label+(sk===k?(dir>0?' ▲':' ▼'):'')+'</th>'; }
    var head = '<tr>'+th("team","Team","l frz")+weeks.map(function(n){ return th("w"+n,"Wk "+n+(S.weeks[n].mode!=="full"?'<span title="Scores-only"> *</span>':''),""); }).join("")+th("delta",weeks.length>1?"Δ Wk "+first+"→"+last:"Δ","")+'</tr>';
    var body = rows.map(function(o){
      return '<tr><td class="frz"><span class="tname">'+esc(o.team)+'</span><span class="trec">'+esc(o.rec)+'</span></td>'+
        o.cells.map(function(c,i){
          if(!c) return '<td class="cell na">–</td>';
          var p=i>0?o.cells[i-1]:null, arr="";
          if(p){ var m=p.rank-c.rank; if(m>0) arr='<span class="a up">▲'+m+'</span>'; else if(m<0) arr='<span class="a down">▼'+(-m)+'</span>'; }
          return '<td class="cell" style="'+shade(c.rating)+'" title="Week '+weeks[i]+': #'+c.rank+', rating '+rat(c.rating)+'"><span class="c">'+c.rank+' · '+rat(c.rating)+'</span>'+arr+'</td>';
        }).join("")+
        '<td>'+(o.delta==null?'<span class="delta flat">–</span>':o.delta>0?'<span class="delta up">▲ '+o.delta+'</span>':o.delta<0?'<span class="delta down">▼ '+(-o.delta)+'</span>':'<span class="delta flat">–</span>')+'</td></tr>';
    }).join("");
    var extra = '<label class="lbl" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="cmpAll"'+(S.cmpAll?' checked':'')+' style="accent-color:var(--accent)">All FBS teams</label>';
    main.innerHTML = sub + '<div class="toolbar">'+picker+'</div>' + filterBar("cmp", S.cmpQ, S.cmpConf, extra) +
      '<div class="card tablewrap"><table class="grid" id="cmpTable"><thead>'+head+'</thead><tbody>'+body+'</tbody></table></div>'+
      (rows.length?'':'<div class="empty">No teams match.</div>')+
      '<p class="note">Each cell shows rank · rating; darker orange means a higher rating. Arrows show the move from the previous column. '+(S.cmpAll?'Showing every FBS team.':'Showing every team that was in the Top 30 in at least one selected week.')+(weeks.some(function(n){return S.weeks[n].mode!=="full";})?' * = scores-only week.':'')+'</p>';
    document.getElementById("cmpCount").textContent = rows.length+" teams";
    bindFilter("cmp", function(v){S.cmpQ=v;}, function(v){S.cmpConf=v;}, function(){ var pos=caret("cmpQ"); renderCompare({sub:"table",q:{}}); restore("cmpQ",pos); });
    document.getElementById("cmpAll").addEventListener("change", function(e){ S.cmpAll=e.target.checked; renderCompare({sub:"table",q:{}}); });
    Array.prototype.forEach.call(document.querySelectorAll("#wkPick input"), function(cb){
      cb.addEventListener("change", function(){
        var sel = Array.prototype.filter.call(document.querySelectorAll("#wkPick input"), function(x){return x.checked;}).map(function(x){return +x.value;});
        if(!sel.length){ cb.checked=true; return; }
        S.cmpWeeks = sel; history.replaceState(null,"","#/compare?w="+sel.join(",")); renderCompare({sub:"table",q:{}});
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll("#cmpTable th.sortable"), function(h){
      h.addEventListener("click", function(){ var k=h.getAttribute("data-k"); if(sk===k) S.cmpDir=-S.cmpDir; else { S.cmpSort=k; S.cmpDir=1; } renderCompare({sub:"table",q:{}}); });
    });
  }

  // ---------- Rank over time chart ----------
  function renderChart(sub){
    var latest = S.weeks[S.idx.latest];
    if(!S.chartTeams) S.chartTeams = latest.teams.filter(function(t){return t.rank<=10;}).map(function(t){return t.team;});
    var weeks = S.list, teams = S.chartTeams;
    var all = {}; S.list.forEach(function(n){ S.weeks[n].teams.forEach(function(t){ all[t.team]=1; }); });
    var names = Object.keys(all).sort();
    var maxRank = 10; teams.forEach(function(nm){ weeks.forEach(function(n){ var t=teamRow(n,nm); if(t) maxRank=Math.max(maxRank,t.rank); }); });
    maxRank = Math.ceil(maxRank/5)*5;
    var W=900, H=Math.max(380, Math.min(720, 140+teams.length*26)), L=44, R=150, T=20, B=36;
    var X=function(i){ return L + (weeks.length>1? i*(W-L-R)/(weeks.length-1) : (W-L-R)/2); };
    var Y=function(rk){ return T + (rk-1)*(H-T-B)/Math.max(1,maxRank-1); };
    var g='';
    var ticks=[1]; for(var k=5;k<=maxRank;k+=5) ticks.push(k);
    ticks.forEach(function(k){ g+='<line class="gridl" x1="'+L+'" x2="'+(W-R+10)+'" y1="'+Y(k)+'" y2="'+Y(k)+'"/><text class="axis" x="'+(L-10)+'" y="'+(Y(k)+4)+'" text-anchor="end">'+k+'</text>'; });
    weeks.forEach(function(n,i){ g+='<text class="axis" x="'+X(i)+'" y="'+(H-10)+'" text-anchor="middle">Wk '+n+'</text>'; });
    var labels=[];
    var lines = teams.map(function(nm,ti){
      var col = PALETTE[ti % PALETTE.length], pts=[], segs=[], cur=[];
      weeks.forEach(function(n,i){ var t=teamRow(n,nm); if(t){ cur.push([X(i),Y(t.rank),t,n]); } else if(cur.length){ segs.push(cur); cur=[]; } });
      if(cur.length) segs.push(cur);
      var path = segs.map(function(s){ return s.map(function(p,j){ return (j?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1); }).join(" "); }).join(" ");
      segs.forEach(function(s){ s.forEach(function(p){ pts.push('<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="4" fill="'+col+'"><title>'+esc(nm)+' — week '+p[3]+': #'+p[2].rank+', rating '+rat(p[2].rating)+'</title></circle>'); }); });
      var lastSeg = segs[segs.length-1]; if(lastSeg){ var lp=lastSeg[lastSeg.length-1]; labels.push({y:lp[1], x:lp[0], nm:nm, col:col, rk:lp[2].rank}); }
      return '<g class="series" data-team="'+esc(nm)+'"><path class="ln" d="'+path+'" stroke="'+col+'"/>'+pts.join("")+'</g>';
    }).join("");
    labels.sort(function(a,b){return a.y-b.y;}); var minGap=15;
    for(var i=1;i<labels.length;i++){ if(labels[i].y-labels[i-1].y<minGap) labels[i].y=labels[i-1].y+minGap; }
    var lab = labels.map(function(l){ return '<text class="lbltxt" x="'+(W-R+16)+'" y="'+(l.y+4).toFixed(1)+'" fill="'+l.col+'">#'+l.rk+' '+esc(l.nm)+'</text>'; }).join("");
    var Hh = Math.max(H, labels.length? labels[labels.length-1].y+20 : H);
    var svg = '<svg class="chartsvg" id="rankChart" viewBox="0 0 '+W+' '+Hh+'" role="img" aria-label="Rank over time for '+teams.length+' teams. Rank 1 is at the top."><g>'+g+'</g>'+lines+lab+'</svg>';
    var chips = teams.map(function(nm,ti){ return '<span class="tchip"><i style="background:'+PALETTE[ti%PALETTE.length]+'"></i>'+esc(nm)+'<button type="button" data-rm="'+esc(nm)+'" aria-label="Remove '+esc(nm)+'">×</button></span>'; }).join("");
    main.innerHTML = sub +
      '<div class="toolbar"><input type="search" id="chartAdd" list="teamList" placeholder="Add a team" aria-label="Add a team to the chart"><datalist id="teamList">'+names.map(function(n){return '<option value="'+esc(n)+'">';}).join("")+'</datalist>'+
      '<button class="iconbtn" id="chartAddBtn" type="button">Add</button><button class="iconbtn" id="chartReset" type="button">Reset to Top 10</button><span class="count">'+teams.length+' teams</span></div>'+
      '<div class="teamchips">'+chips+'</div>'+
      '<div class="card chartcard">'+(teams.length? svg : '<div class="empty">Add a team to draw its line.</div>')+'</div>'+
      '<p class="note">Rank 1 is at the top. A gap in a line means the team was not rated that week. Hover a point for the exact rank and rating.</p>';
    function add(){ var v=document.getElementById("chartAdd").value.trim(); var hit=names.filter(function(n){return n.toLowerCase()===v.toLowerCase();})[0];
      if(hit && S.chartTeams.indexOf(hit)<0){ S.chartTeams.push(hit); renderChart(sub); } }
    document.getElementById("chartAddBtn").addEventListener("click", add);
    document.getElementById("chartAdd").addEventListener("keydown", function(e){ if(e.key==="Enter") add(); });
    document.getElementById("chartAdd").addEventListener("change", add);
    document.getElementById("chartReset").addEventListener("click", function(){ S.chartTeams=null; renderChart(sub); });
    Array.prototype.forEach.call(document.querySelectorAll("[data-rm]"), function(b){ b.addEventListener("click", function(){ var nm=b.getAttribute("data-rm"); S.chartTeams=S.chartTeams.filter(function(x){return x!==nm;}); renderChart(sub); }); });
    var chart=document.getElementById("rankChart");
    if(chart) Array.prototype.forEach.call(chart.querySelectorAll("g.series"), function(gs){
      gs.addEventListener("mouseenter", function(){ Array.prototype.forEach.call(chart.querySelectorAll("g.series"), function(o){ if(o!==gs) o.classList.add("dim"); }); });
      gs.addEventListener("mouseleave", function(){ Array.prototype.forEach.call(chart.querySelectorAll("g.series"), function(o){ o.classList.remove("dim"); }); });
    });
  }

  // ---------- main ----------
  function render(){
    var r = parseHash();
    nav(r);
    header(r.view==="compare" ? S.idx.latest : r.week);
    if(r.view==="teams") renderTeams(r); else if(r.view==="compare") renderCompare(r); else renderTop(r);
    CFB.footer(S.idx.updated);
  }
  CFB.initTheme();
  CFB.getJSON("data/index.json").then(function(idx){
    S.idx = idx; S.hasConf = !!idx.has_conference;
    S.list = idx.weeks.map(function(w){return w.week;}).sort(function(a,b){return a-b;});
    return Promise.all(S.list.map(function(n){ return CFB.getJSON("data/week-"+n+".json"); }));
  }).then(function(docs){
    docs.forEach(function(d){ d.byTeam={}; d.teams.forEach(function(t){ d.byTeam[t.team]=t; }); S.weeks[d.week]=d; });
    window.addEventListener("hashchange", render);
    render();
  }).catch(function(e){
    main.innerHTML = '<div class="err">Could not load the ratings data. Please try again later.</div>';
    if(window.console) console.error(e);
  });
})();
