// Shared helpers: theme toggle, escaping, footer. No network calls except same-origin data/*.json.
var CFB = (function(){
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function curTheme(){return document.documentElement.getAttribute("data-theme")||"dark";}
  function setTheme(t,save){document.documentElement.setAttribute("data-theme",t);if(save){try{localStorage.setItem("theme",t);}catch(e){}}paintToggle();}
  function paintToggle(){var b=document.getElementById("themeBtn");if(!b)return;var d=curTheme()==="dark";
    b.innerHTML=(d?"&#9788;":"&#9790;")+'<span class="sr">Switch to '+(d?"light":"dark")+' theme</span>';b.title="Switch to "+(d?"light":"dark")+" theme";}
  function initTheme(){var b=document.getElementById("themeBtn");if(b)b.addEventListener("click",function(){setTheme(curTheme()==="dark"?"light":"dark",true);});
    try{var mq=matchMedia("(prefers-color-scheme: light)");var f=function(e){var saved=null;try{saved=localStorage.getItem("theme");}catch(_){}
      if(saved!=="light"&&saved!=="dark")setTheme(e.matches?"light":"dark",false);};
      if(mq.addEventListener)mq.addEventListener("change",f);else if(mq.addListener)mq.addListener(f);}catch(e){}
    paintToggle();}
  function fmtDate(iso){if(!iso)return "";var p=iso.split("-");var m=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return m[+p[1]-1]+" "+(+p[2])+", "+p[0];}
  function fmtShort(iso){var s=fmtDate(iso);return s.slice(0,s.lastIndexOf(","))||s;}
  function footer(updated){var f=document.getElementById("foot");if(!f)return;
    f.innerHTML='<span>Updated '+esc(fmtDate(updated))+'</span><a href="about.html">Methodology</a><span>Model output, not betting advice.</span><span>Data provided by CollegeFootballData.com and sportsdataverse.</span>';}
  function getJSON(url){return fetch(url,{cache:"no-cache"}).then(function(r){if(!r.ok)throw new Error(url+" "+r.status);return r.json();});}
  return {esc:esc,initTheme:initTheme,fmtDate:fmtDate,fmtShort:fmtShort,footer:footer,getJSON:getJSON};
})();
