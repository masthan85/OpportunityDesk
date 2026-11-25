const countryNames={Global:'All countries',GB:'United Kingdom',IN:'India',US:'United States (USA)',JP:'Japan',AU:'Australia',CA:'Canada',Europe:'All Europe',North:'Northern Europe',West:'Western Europe',East:'Eastern Europe',South:'Southern Europe',MiddleEast:'Middle East'};
for(const code of [...new Set(european)].sort((a,b)=>display.of(a).localeCompare(display.of(b))))countryNames[code]??=display.of(code);
let discoveryCountry='Global',discoveryType='',discoverySearch='';
// Saves the region shared by Discover, Upcoming conferences and the opportunity-type pages.
async function saveRegion(picker,after){
 const previous=discoveryCountry;picker.disabled=true;
 const existing=entries.find(r=>r.id==='discovery-region'&&r.kind==='preference');
 try{
   const response=await fetch('/api/entries',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'discovery-region',kind:'preference',revision:existing?.revision||0,data:{title:picker.value}})});
   if(!response.ok)throw Error();const saved=await response.json();
   entries=entries.filter(r=>r.id!==saved.id).concat(saved);discoveryCountry=saved.data.title;after();
 }catch{picker.value=previous;notify('Country could not be saved. Refresh and try again.')}finally{picker.disabled=false}
}
function initialiseCountry(saved,hint){
 const zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
 const suggested=hint||zoneCountries[zone];
 discoveryCountry=saved.find(r=>r.kind==='preference'&&r.id==='discovery-region')?.data.title || (suggested in countryNames?suggested:regions.MiddleEast.split(' ').includes(suggested)?'MiddleEast':'Global');
}
function showDiscovery(){
 $('view').innerHTML='<section class="intro"><h1>Upcoming opportunities</h1><p>Discover events, find an application route and save opportunities to your private tracker.</p></section><section class="panel"><div class="filters"><label>Country or region<select id="region">'+Object.entries(countryNames).map(([v,n])=>'<option value="'+v+'" '+(v===discoveryCountry?'selected':'')+'>'+n+'</option>').join('')+'</select></label><label>Type<select id="dtype"><option value="">All types</option>'+options(categories,discoveryType)+'</select></label><label class="search">Search<input type="search" id="dsearch" placeholder="Event, city or topic" value="'+esc(discoverySearch)+'"></label></div></section><p class="result-count" id="dcount"></p><div class="cards" id="dcards"></div>';
 $('region').onchange=e=>saveRegion(e.target,renderDiscoveryCards);
 $('dtype').onchange=e=>{discoveryType=e.target.value;renderDiscoveryCards()};
 $('dsearch').oninput=e=>{discoverySearch=e.target.value;renderDiscoveryCards()};
 renderDiscoveryCards();
}
let lastOrganiserVisit=null;
function renderDiscoveryCards(){
 if(!$('dcards'))return;
 const today=londonToday();
 const matches=catalogue.filter(d=>d.end>=today&&matchesLocation(discoveryCountry,d.country)&&(!discoveryType||d.category===discoveryType)&&[d.title,d.category,d.venue,d.fit].join(' ').toLowerCase().includes(discoverySearch.toLowerCase())).sort((a,b)=>a.start.localeCompare(b.start));
 $('dcount').textContent=matches.length+' upcoming ('+matches.filter(d=>d.country!=='Global').length+' location-specific) · Organiser listings checked 18 Nov 2026 · Worldwide online events included';
 $('dcards').innerHTML=matches.map(d=>{
 const existing=entries.find(r=>r.kind==='opportunity'&&r.id===d.id);
 const canSubmit=!existing||['Watching','Drafting'].includes(existing.data.status);
 const submissionAction=canSubmit?'<button class="secondary" data-submit-event="'+d.id+'">Mark as submitted</button>':'';
 return '<article class="card"><p class="eyebrow">'+esc(d.category)+'</p><h2>'+esc(d.title)+'</h2><p>'+date(d.start)+(d.end!==d.start?' – '+date(d.end):'')+' · '+esc(d.venue)+'</p><p>'+esc(d.fit)+'</p>'+(d.deadline?'<p>Deadline '+date(d.deadline)+'</p>':'')+(existing?badge(existing.data.status):'')+(canSubmit&&lastOrganiserVisit===d.id?'<p>Completed the organiser’s form? Record your submission here.</p>':'')+'<div class="actions"><a data-organiser="'+d.id+'" class="secondary" target="_blank" rel="noopener" href="'+esc(d.source)+'">'+esc(d.deadline&&d.deadline<today?'Organiser details':d.action)+' ↗</a>'+submissionAction+'<button class="quiet" data-discover="'+d.id+'">'+(existing?'Open tracked record':'Track opportunity')+'</button></div></article>';
 }).join('')||'<p class="empty">No verified listings match this selection. Try another type or country.</p>';
}
document.addEventListener('click',e=>{
 const link=e.target.closest('[data-organiser]');
 if(link){lastOrganiserVisit=link.dataset.organiser;return}
 const submissionId=e.target.closest('[data-submit-event]')?.dataset.submitEvent;
 const id=submissionId||e.target.closest('[data-discover]')?.dataset.discover;if(!id)return;
 const existing=entries.find(r=>r.id===id&&r.kind==='opportunity');
 const d=catalogue.find(item=>item.id===id);
 openEditor(existing||{id,revision:0,kind:'opportunity',data:{...d,status:'Watching'}},Boolean(submissionId));
});

window.addEventListener('focus',()=>{if(lastOrganiserVisit&&page==='Discover'&&!$('editor').open)renderDiscoveryCards()});
