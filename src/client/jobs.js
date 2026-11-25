const careerViews=['Available jobs','Jobs applied','Career profile'];
const jobEmployers='Databricks, GitLab and Canonical';
let jobResults=null, jobFetch=null, failedBoards=[];
let jobCountry = '';
function initialiseJobCountry(saved, hint) {
  const selected = saved.find(r => r.kind === 'preference' && r.id === 'jobs-country')?.data.title;
  const detected = jobCountryLabels.has(hint) ? hint : zoneCountries[Intl.DateTimeFormat().resolvedOptions().timeZone];
  jobCountry = selected === 'All' || jobCountryLabels.has(selected) ? selected : detected || '';
}



// Lets visitors use their own Claude or ChatGPT with this workspace through the MCP connector.
function connectorPanel(){
 return '<section class="panel card connector"><h2>Use Opportunity Desk from your AI assistant</h2>'+
  '<p>Connect Claude or ChatGPT to this workspace and ask it to find vacancies, prepare you for interviews and update your tracker. It works with the free Claude plan, which allows one custom connector.</p>'+
  '<ol><li>Copy the connector address below.</li><li>In Claude, open Customize, then Connectors, select Add and choose Add custom connector. In ChatGPT, add it as an app in developer mode where your plan offers it.</li><li>Paste the address, then sign in with ChatGPT and allow access when asked.</li></ol>'+
  '<p class="connector-url"><code id="connector-url">'+esc(location.origin+'/mcp')+'</code></p>'+
  '<div class="actions"><button class="secondary" type="button" id="copy-connector">Copy address</button><button class="quiet" type="button" id="disconnect-ai" hidden>Disconnect all AI apps</button></div>'+
  '<p class="result-count" id="connected-apps" aria-live="polite">Checking connected apps…</p></section>';
}
async function wireConnectorPanel(){
 $('copy-connector').onclick=async()=>{try{await navigator.clipboard.writeText(location.origin+'/mcp');notify('Connector address copied')}catch{notify('Select the address and copy it.')}};
 const show=apps=>{
  if(!$('connected-apps'))return;
  $('connected-apps').textContent=apps.length?'Connected: '+apps.join(', ')+'.':'No AI apps are connected.';
  $('disconnect-ai').hidden=!apps.length;
 };
 $('disconnect-ai').onclick=async e=>{
  e.target.disabled=true;
  try{
   const res=await fetch('/api/connections',{method:'DELETE',headers:{'Content-Type':'application/json'}});
   if(!res.ok)throw Error();show((await res.json()).apps);notify('AI apps disconnected');
  }catch{notify('Could not disconnect. Try again.')}finally{e.target.disabled=false}
 };
 try{const res=await fetch('/api/connections');if(!res.ok)throw Error();show((await res.json()).apps)}
 catch{if($('connected-apps'))$('connected-apps').textContent='Connected apps could not be loaded.'}
}

function careerProfile(){return entries.find(r=>r.kind==='preference'&&r.id==='career-profile')}
function jobApplications(){return entries.filter(r=>r.kind==='job')}
async function saveCareerRecord(record){
 const res=await fetch('/api/entries',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(record)});
 const body=await res.json();if(!res.ok)throw Error(body.error||'Could not save');
 entries=entries.filter(r=>r.id!==body.id).concat(body);
}
function renderCareer(){
 const profile=careerProfile(), data=profile?.data||{};
 const head='<section class="intro"><h1>'+esc(page)+'</h1></section>';
 if(page==='Career profile'){
  $('view').innerHTML=head+'<form id="career-form" class="panel card"><p>Vacancies come from the '+jobEmployers+' job boards. Enter comma-separated job titles or skills to match against vacancy titles and departments. Preferred locations rank matches within the country you select.</p>'+field('keywords','Job titles or skills',data.keywords||'','text',true)+field('locations','Preferred locations',data.locations||'','text',true)+field('experience','Relevant experience for interview prep',data.experience||'','textarea',true)+'<button class="primary">Save profile</button></form>'+connectorPanel();
  $('career-form').onsubmit=async e=>{e.preventDefault();const f=e.target;f.querySelector('button').disabled=true;try{await saveCareerRecord({id:'career-profile',kind:'preference',revision:profile?.revision||0,data:{title:'Career profile',...Object.fromEntries(new FormData(f))}});navigate('Available jobs')}catch(err){notify(err.message)}finally{f.querySelector('button').disabled=false}};wireConnectorPanel();return;
 }
 if(page==='Jobs applied'){
  const apps=jobApplications().sort((a,b)=>b.data.applied.localeCompare(a.data.applied));
  $('view').innerHTML=head+'<div class="cards">'+(apps.map(r=>'<article class="card"><h2>'+esc(r.data.title)+'</h2><p>'+esc(r.data.employer)+' · '+esc(r.data.location)+'</p><p>Applied '+date(r.data.applied)+'</p><label class="field">Application status<select data-job-status="'+esc(r.id)+'">'+options(jobStatuses,r.data.status)+'</select></label><a target="_blank" rel="noopener" href="'+esc(safeUrl(r.data.url))+'">Employer listing ↗</a><div class="actions">'+interviewButton(r.id)+'</div></article>').join('')||'<p class="empty">Applications appear here when you select Mark as applied on a vacancy.</p>')+'</div>';return;
 }
 const countries = [...jobCountryLabels].sort((a,b)=>a[1].localeCompare(b[1]));
 const countryOptions = [['','Choose a country'],['All','All countries'],...countries].map(([code,label]) =>
   '<option value="'+esc(code)+'"'+(code===jobCountry?' selected':'')+'>'+esc(label)+'</option>').join('');
 $('view').innerHTML=head+'<div class="filters"><label>Job country<select id="jobs-country">'+countryOptions+'</select></label><button class="secondary" data-page="Career profile">Edit career profile</button><button class="secondary" id="refresh-jobs">Refresh vacancies</button></div><p class="result-count" id="job-summary" aria-live="polite"></p><div class="cards" id="job-list"></div>';
 $('jobs-country').onchange=async e=>{
   const selected=e.target.value;
   if(!selected){jobCountry='';renderCareer();return}
   e.target.disabled=true;
   const existing=entries.find(r=>r.id==='jobs-country');
   try{
     await saveCareerRecord({id:'jobs-country',kind:'preference',revision:existing?.revision||0,data:{title:selected}});
     jobCountry=selected;
   }catch(err){notify(err.message)}
   if(page==='Available jobs')renderCareer();
 };
 if(!jobCountry){$('job-summary').textContent='Choose a country to see vacancies.';return}
 $('refresh-jobs').onclick=()=>{jobResults=null;renderCareer()};
 if(!jobResults){$('job-summary').textContent='Checking employer job boards…';$('refresh-jobs').disabled=true;
 if(!jobFetch)jobFetch=fetch('/api/jobs').then(async r=>{if(!r.ok)throw Error();const body=await r.json();jobResults=body.jobs;failedBoards=body.failed}).catch(()=>{jobResults=[];failedBoards=['Employer feeds']}).finally(()=>{jobFetch=null;if(page==='Available jobs')renderCareer()});return}
 const terms=v=>(v||'').toLowerCase().split(',').map(t=>t.trim()).filter(Boolean);
 const keywords=terms(data.keywords),locations=terms(data.locations);
 const jobs=jobResults
   .filter(job=>jobCountry==='All'||jobCountries(job.location).has(jobCountry))
   .map(j=>({...j,matched:keywords.filter(k=>roleMatches(k,j.title+' '+j.department))}))
   .filter(j=>!keywords.length||j.matched.length)
   .sort((a,b)=>b.matched.length-a.matched.length||
     Number(locations.some(l=>b.location.toLowerCase().includes(l)))-Number(locations.some(l=>a.location.toLowerCase().includes(l)))||
     a.title.localeCompare(b.title));
 $('job-summary').textContent=jobs.length+' matching vacancies · '+(jobCountryLabels.get(jobCountry)||'All countries')+(failedBoards.length?' · Unavailable feeds: '+failedBoards.join(', '):'')+(!keywords.length&&!locations.length?' · Add your profile to personalise results.':'');
 $('job-list').innerHTML=jobs.map(j=>'<article class="card"><h2>'+esc(j.title)+'</h2><p>'+esc(j.employer)+' · '+esc(j.location)+'</p>'+(j.matched.length?'<p>Matches '+esc(j.matched.join(', '))+'</p>':'')+'<div class="actions"><a class="secondary" target="_blank" rel="noopener" href="'+esc(safeUrl(j.url))+'">Apply with employer ↗</a>'+interviewButton(j.id)+(entries.some(r=>r.id===j.id)?'<button class="quiet" data-page="Jobs applied">View application</button>':'<button class="quiet" data-job-apply="'+esc(j.id)+'">Mark as applied</button>')+'</div></article>').join('')||'<p class="empty">'+(keywords.length&&jobResults.length?'None of the '+jobResults.length+' technical vacancies from '+jobEmployers+' match '+esc(keywords.join(', '))+(jobCountry==='All'?'':' in '+esc(jobCountryLabels.get(jobCountry)))+'. Try All countries or a broader role, such as engineer.':'Try another country, edit your profile or refresh the employer feeds.')+'</p>';
}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-job-apply]');if(!b)return;const job=jobResults.find(j=>j.id===b.dataset.jobApply);if(!job)return;b.disabled=true;try{await saveCareerRecord({id:job.id,kind:'job',revision:0,data:{...job,status:'Applied',applied:londonToday()}});renderCareer();notify('Application recorded')}catch(err){notify(err.message);b.disabled=false}});
document.addEventListener('change',async e=>{const id=e.target.dataset.jobStatus;if(!id)return;const r=entries.find(v=>v.id===id);const input=e.target;input.disabled=true;try{await saveCareerRecord({...r,data:{...r.data,status:input.value}});notify('Status updated')}catch(err){input.value=r.data.status;notify(err.message)}finally{input.disabled=false}});
