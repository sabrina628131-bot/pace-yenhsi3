'use strict';
const $=id=>document.getElementById(id), center=[24.1796,120.6495], KEY='campus-move-history-v1';
// Base map source is defined in tiles.js (CARTO Voyager, OpenStreetMap data). Change it there for school-wide use.
let records=[];try{records=JSON.parse(localStorage.getItem(KEY)||'[]');if(!Array.isArray(records))records=[];}catch{}
let map, route, halo=null, startMarker=null, positionDot, accuracyCircle, targetMarker, targetLine, target=null, current=null;
let session=null, watch=null, demoTimer=null, wake=null, last=null, lastSignal=0, lines=[], storageOK=true;
function message(s){$('message').textContent=s;}
function pinIcon(kind,label){return L.divIcon({className:'map-pin-wrap map-pin-'+kind,html:'<span class="pin-body"><b>'+label+'</b></span>',iconSize:[30,30],iconAnchor:[15,30]});}
function setTrack(lines){if(route)route.setLatLngs(lines);if(halo)halo.setLatLngs(lines);}
function clearStart(){if(startMarker&&map)map.removeLayer(startMarker);startMarker=null;}
function setStart(p){clearStart();if(map)startMarker=L.marker([p.lat,p.lng],{icon:pinIcon('start','起'),zIndexOffset:500}).addTo(map).bindTooltip('起點');}
try{map=L.map('map',{zoomControl:false}).setView(center,17);L.control.zoom({position:'bottomright'}).addTo(map);addBaseMap(map).on('tileerror',()=>message('底圖載入失敗，請檢查網路；Google Maps 仍可使用其他功能。'));halo=L.polyline([],{color:'#ffefc7',weight:9,opacity:.8,lineCap:'round',lineJoin:'round'}).addTo(map);route=L.polyline([],{color:'#d95432',weight:5,lineCap:'round',lineJoin:'round'}).addTo(map);map.on('click',e=>{target=e.latlng;if(targetMarker)map.removeLayer(targetMarker);targetMarker=L.marker(target,{icon:pinIcon('target','終'),zIndexOffset:600}).addTo(map).bindPopup('集合點').openPopup();updateTarget();});}catch{(m=>{}).call(null,'map')}
function updateTarget(){if(!target){$('navigate').hidden=true;$('targetInfo').textContent='點一下地圖，設定老師指定的集合點。';return;}let info='集合點已設定（依老師現場安排）';if(current){info+='｜距離 '+Math.round(MoveCore.distance(current,{lat:target.lat,lng:target.lng})).toLocaleString()+' m';}$('targetInfo').textContent=info;$('navigate').hidden=false;$('navigate').href=`https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}&travelmode=walking`;if(targetMarker&&map){if(targetLine)map.removeLayer(targetLine);targetLine=L.polyline([current?[current.lat,current.lng]:[center[0],center[1]], [target.lat,target.lng]],{color:'#ae703d',dashArray:'6 8',weight:2}).addTo(map);}}
function clearTarget(){target=null;for(const l of [targetMarker,targetLine])if(l&&map)map.removeLayer(l);targetMarker=targetLine=null;updateTarget();}
$('clearTarget').onclick=clearTarget;$('campus').onclick=()=>map&&map.setView(center,17);
function displayPosition(p){current=p;if(map){const ll=[p.lat,p.lng];if(!positionDot){positionDot=L.circleMarker(ll,{radius:7,color:'white',weight:3,fillColor:'#2f88b3',fillOpacity:1}).addTo(map);accuracyCircle=L.circle(ll,{radius:p.accuracy,color:'#2f88b3',weight:1,fillOpacity:.08}).addTo(map);}else{positionDot.setLatLng(ll);accuracyCircle.setLatLng(ll).setRadius(p.accuracy);}$('accuracy').textContent=`±${Math.round(p.accuracy)} m`;updateTarget();}}
const GEO_REASONS={1:'定位權限被拒絕：請到瀏覽器／手機設定允許位置與精確定位後重試。',2:'目前無法取得位置，請移到戶外空曠處。',3:'定位逾時，請再試一次。',0:'定位失敗，請再試一次。'};
function geoError(err){if(session?.state==='running')pause('定位中斷，已暫停。'+(GEO_REASONS[err.code]||'請重試。'));else message(GEO_REASONS[err.code]||'定位失敗。');$('badge').textContent='● GPS 中斷';}
function locateError(err){message(GEO_REASONS[err.code]||'定位失敗。');if(!session||session.state!=='running')$('badge').textContent='● 定位不可用';}
function available(){if(!window.isSecureContext){message('GPS 需要 HTTPS 網址（電腦本機 localhost 例外），請依部署說明開啟。');return false;}if(!navigator.geolocation){message('此裝置不支援 GPS 定位。');return false;}return true;}
$('locate').onclick=()=>{if(session?.demo){message('示範模式使用模擬位置；結束後可取得真實定位。');return;}if(!available())return;message('正在取得你的定位…');navigator.geolocation.getCurrentPosition(pos=>{const p=normalize(pos);displayPosition(p);message('定位已更新。');},locateError,{enableHighAccuracy:true,timeout:15000,maximumAge:0});}
function normalize(pos){return {lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:pos.coords.accuracy,t:pos.timestamp};}
function seconds(){return session?session.seconds+(session.state==='running'&&session.runStart?(Date.now()-session.runStart)/1000:0):0;}
function fmt(n){const s=Math.floor(n);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
function calcAverageKmh(totalMeters, activeSeconds){
  if(!Number.isFinite(totalMeters)||!Number.isFinite(activeSeconds)||activeSeconds<=0) return 0;
  return totalMeters / activeSeconds * 3.6;
}
function render(){
  document.body.classList.toggle('is-active',!!session&&session.state!=='finished');
  $('activityLabel').textContent=session?.demo?'示範運動':session?.mode?.split(' · ')[0]||'舒適步行';
  const s=seconds();
  const d=Number(session?.meters ?? 0);
  const averageKmh=calcAverageKmh(d,s);
  $('elapsed').textContent=fmt(s);
  $('distance').textContent=(d/1000).toFixed(2);
  $('speed').textContent=averageKmh.toFixed(2);
  $('calories').textContent=session?Math.round(MoveCore.calories(session.met,session.weight,s)):0;
  $('points').textContent=`${session?.points?.length ?? 0} 個點`;
  $('fields').disabled=!session||session.state==='finished';
  $('start').disabled=!session||session.state==='finished';
  $('demo').disabled=!session||session.state==='finished';
  $('pause').disabled=!session||session.state==='finished';
  $('finish').disabled=!session||session.state==='finished';
}
async function holdScreen(){try{if('wakeLock'in navigator)wake=await navigator.wakeLock.request('screen');}catch{} }
function stopWatch(){if(watch!==null){navigator.geolocation.clearWatch(watch);watch=null;}clearInterval(demoTimer);demoTimer=null;wake?.release().catch(()=>{});wake=null;}
function receive(p){if(!session||session.state!=='running')return;lastSignal=Date.now();displayPosition(p);const result=MoveCore.accept(last,p);if(!result.ok){message(result.reason);return;}if(!session.runStart)session.runStart=Date.now();if(result.break||!lines.length)lines.push([]);lines[lines.length-1].push([p.lat,p.lng]);session.meters=(session.meters||0)+result.distance;session.points.push({...p,segment:lines.length-1,meters:session.meters});last=p;setTrack(lines);if(session.points.length===1&&map){map.setView([p.lat,p.lng],17);setStart(p);}if(session.points.length===1&&map)map.fitBounds([[p.lat,p.lng],[p.lat,p.lng]],{padding:[30,30]});$('badge').textContent='● GPS 已更新';message(session.demo?'示範運動已更新。':`已記錄 ${session.points.length} 個定位點`);render();}
function run(){session.state='running';session.runStart=0;last=null;lastSignal=Date.now();if(session.demo){demoTick();demoTimer=setInterval(demoTick,1000);}else{watch=navigator.geolocation.watchPosition(pos=>receive(normalize(pos)),geoError,{enableHighAccuracy:true,maximumAge:0,timeout:15000});holdScreen();}}
function begin(demo){const fields=demo?['height','weight','age'].map($):[$('profile')];if(!fields.every(el=>el.reportValidity()))return;if(!demo&&!available())return;$('setupDialog').close();stopWatch();session={id:Date.now(),date:new Date().toISOString(),alias:$('alias').value.trim(),height:Number($('height').value),weight:Number($('weight').value),age:Number($('age').value),met:Number($('mode').value),mode:$('mode').selectedOptions[0].textContent,demo,seconds:0,meters:0,points:[],runStart:0,state:'ready',demoIndex:0};lines=[];setTrack(lines);clearStart();message(demo?'示範模式已啟動，準備開始。':'GPS 追蹤已啟動，請移動開始運動。');$('badge').textContent=demo?'● 示範運動':'● GPS 等待定位';run();}
$('profile').onsubmit=e=>{e.preventDefault();begin(false);};$('demo').onclick=()=>begin(true);
function demoTick(){const i=session.demoIndex++,angle=i*.12;session.seconds+=5;receive({lat:center[0]+.00062*Math.sin(angle),lng:center[1]+.00085*Math.cos(angle),accuracy:6,t:session.id+i*6000});}
function pause(reason){if(!session||session.state!=='running')return;session.seconds=seconds();session.runStart=0;session.state='paused';stopWatch();last=null;$('badge').textContent='● 已暫停';message(reason||'已暫停，準備繼續。');render();}
$('pause').onclick=()=>{if(session.state==='running')pause();else {message('等待新的有效定位後繼續…');run();}};
function persist(){try{localStorage.setItem(KEY,JSON.stringify(records));storageOK=true;}catch{storageOK=false;message('裝置儲存空間不足或儲存被封鎖。紀錄暫留本頁，請先匯出。');}}
$('finish').onclick=()=>{if(!session||session.state==='finished')return;session.seconds=seconds();session.runStart=0;session.state='finished';stopWatch();session.kcal=MoveCore.calories(session.met,session.weight,session.seconds);records.unshift({...session,points:[...session.points],target:target?{lat:target.lat,lng:target.lng}:null});persist();renderHistory();render();$('badge').textContent='● 完成';message(session.demo?'示範運動已結束。':'運動紀錄已保存。');};
function download(name,body,type){const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function cell(v){let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
function exportCSV(items){if(!items.length){message('目前沒有可匯出的紀錄。');return;}const rows=[['時間 ISO','課堂代號','類型','活動','身高 cm','體重 kg','年齡','時間 sec','距離 m','熱量 kcal','平均速度 km/h','點數']];for(const r of items){rows.push([r.date,r.alias,r.demo?'demo':'gps',r.mode,r.height,r.weight,r.age,Math.round(r.seconds),Math.round(r.meters||0),Math.round(r.kcal||0),calcAverageKmh(r.meters||0,r.seconds).toFixed(2),r.points?.length||0]);}download('campus-move.csv',rows.map(r=>r.map(cell).join(',')).join('\n'),'text/csv;charset=utf-8');}
let historyFilter='all';
function routeThumbnail(r){const box=document.createElement('div');box.className='route-thumb';const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 100 67');svg.setAttribute('aria-label','運動路線');const pts=(r.points||[]).slice(0,200).map(p=>`${50+(p.lng-center[1])*2200},${33-(p.lat-center[0])*2200}`).join(' ');if(pts){const poly=document.createElementNS(ns,'polyline');poly.setAttribute('points',pts);poly.setAttribute('fill','none');poly.setAttribute('stroke','#d95432');poly.setAttribute('stroke-width','3');svg.append(poly);}else{const text=document.createElementNS(ns,'text');text.setAttribute('x','50');text.setAttribute('y','35');text.setAttribute('text-anchor','middle');text.setAttribute('font-size','9');text.setAttribute('fill','#9aa98c');text.textContent='暫無軌跡';svg.append(text);}box.append(svg);return box;}
function renderHistory(){const root=$('records');root.replaceChildren();const actual=records.filter(r=>!r.demo);$('historyTotal').textContent=actual.length?`${actual.length} 次運動 · ${(actual.reduce((s,r)=>s+r.meters,0)/1000).toFixed(2)} km`: '0 次運動';const shown=records.filter(r=>historyFilter==='all'||(historyFilter==='real'&&!r.demo)||(historyFilter==='demo'&&r.demo));if(!shown.length){root.innerHTML='<div class="empty"><div class="empty-art"><svg><use href="#i-route"/></svg></div><div><h3>尚無紀錄</h3><p>這裡會顯示你的運動軌跡與摘要。</p></div></div>';return;}shown.forEach(r=>{const row=document.createElement('div');row.className='record';row.append(routeThumbnail(r));const info=document.createElement('div');info.className='record-info';const title=document.createElement('strong');title.textContent=r.demo?'示範運動':`${r.alias||'校園運動'} · ${r.mode}`;const sub=document.createElement('small');sub.textContent=new Date(r.date).toLocaleString('zh-TW',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});const stats=document.createElement('div');stats.className='record-stats';for(const [value,label] of [[(r.meters||0)/1000,'km'],[Math.round(r.seconds||0),'sec'],[calcAverageKmh(r.meters||0,r.seconds||0).toFixed(2),'km/h']]){const item=document.createElement('span');item.textContent=`${value} ${label}`;stats.append(item);}info.append(title,sub,stats);const actions=document.createElement('div');actions.className='record-actions';for(const [label,handler] of [['匯出 CSV',()=>exportCSV([r])],['下載 JSON',()=>download(`campus-track-${r.id}.json`,JSON.stringify(r,null,2),'application/json;charset=utf-8')],['刪除',()=>{records=records.filter(x=>x.id!==r.id);persist();renderHistory();}]]){const button=document.createElement('button');button.textContent=label;button.onclick=handler;actions.append(button);}row.append(info,actions);root.append(row);});}
$('openSetup').onclick=()=>$('setupDialog').showModal();$('closeSetup').onclick=()=>$('setupDialog').close();$('energyInfo').onclick=()=>$('energyDialog').showModal();$('closeEnergy').onclick=()=>$('energyDialog').close();
$('todayDate').textContent=new Date().toLocaleDateString('zh-TW',{month:'long',day:'numeric',weekday:'short'});
document.querySelectorAll('[data-filter]').forEach(button=>button.onclick=()=>{historyFilter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});renderHistory();});
$('exportAll').onclick=()=>exportCSV(records);$('deleteAll').onclick=()=>{if(records.length&&confirm('永久刪除此裝置全部運動紀錄？')){records=[];persist();renderHistory();}};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&session?.state==='running')pause('頁面已離開前景，為避免漏記與錯估已自動暫停。回到頁面後按「繼續」。');});
window.addEventListener('beforeunload',e=>{if(session&&session.state!=='finished'){e.preventDefault();e.returnValue='';}});
setInterval(()=>{if(session?.state==='running'&&!session.demo&&Date.now()-lastSignal>30000)pause('超過 30 秒沒有 GPS 更新，已自動暫停。請檢查定位後按繼續。');render();},1000);
renderHistory();render();if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
document.querySelectorAll('.sidenav a[href^="#"]').forEach(a=>a.addEventListener('click',()=>{document.querySelectorAll('.sidenav a').forEach(n=>n.classList.toggle('active',n===a));document.querySelector('.breadcrumb strong').textContent=a.textContent.trim();}));
