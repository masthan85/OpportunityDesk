const careerViews=['Available jobs','Jobs applied','Career profile'];
const jobEmployers='Databricks, GitLab and Canonical';
const apiBase = (typeof window !== 'undefined' && window.OPPORTUNITY_DESK_API_BASE) ? String(window.OPPORTUNITY_DESK_API_BASE).replace(/\/+$/, '') : '';
let jobResults=null, jobFetch=null, failedBoards=[];
const jobCountryLabels = new Map(Object.values(zoneCountries).map(code => [code, display.of(code)]));
const jobCountryAliases = new Map([...jobCountryLabels].map(([code, name]) => [name.toLowerCase(), code]));
for (const [alias, code] of Object.entries({
  uk: 'GB', 'u.k.': 'GB', britain: 'GB', 'great britain': 'GB',
  england: 'GB', scotland: 'GB', wales: 'GB', 'northern ireland': 'GB',
  london: 'GB', edinburgh: 'GB', manchester: 'GB',
  us: 'US', usa: 'US', 'u.s.': 'US', 'united states of america': 'US',
  'washington d.c.': 'US', 'washington, d.c.': 'US',
  bengaluru: 'IN', bangalore: 'IN', mumbai: 'IN', hyderabad: 'IN',
  pune: 'IN', chennai: 'IN', gurugram: 'IN', 'new delhi': 'IN',
  uae: 'AE', 'czech republic': 'CZ',
})) jobCountryAliases.set(alias, code);
const usStates = new Set('Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming'.toLowerCase().split('|'));

const jobPersonaLabels = new Map([
  ['all', 'All personas'],
  ['qa_engineer', 'Test / QA Engineer'],
  ['software_engineer', 'Software Engineer'],
  ['business_analyst', 'Business Analyst'],
  ['college_grad', 'College Graduate'],
  ['data_ai', 'Data & AI'],
]);

let jobCountry = '';
let jobPersona = 'all';

function initialiseJobCountry(saved = [], hint) {
  const list = Array.isArray(saved) ? saved : [];
  const selected = list.find(r => r.kind === 'preference' && r.id === 'jobs-country')?.data?.title;
  const detected = jobCountryLabels.has(hint) ? hint : zoneCountries[Intl.DateTimeFormat().resolvedOptions().timeZone];
  jobCountry = selected === 'All' || jobCountryLabels.has(selected) ? selected : detected || '';

  const savedPersona = list.find(r => r.kind === 'preference' && (r.id === 'jobs-persona' || r.id === 'discovery-persona'))?.data?.title;
  jobPersona = jobPersonaLabels.has(savedPersona) ? savedPersona : 'all';
}

function inferJobPersonas(job) {
  if (Array.isArray(job?.personas) && job.personas.length) return job.personas;
  const text = `${job?.title || ''} ${job?.department || ''}`.toLowerCase();
  const personas = new Set();
  if (/\b(qa|quality assurance|test engineer|sdet|automation engineer|software in test)\b/.test(text)) personas.add('qa_engineer');
  if (/\b(software engineer|full[- ]?stack|backend|frontend|platform engineer|devops|sre|developer)\b/.test(text)) personas.add('software_engineer');
  if (/\b(business analyst|systems analyst|product analyst|requirements)\b/.test(text)) personas.add('business_analyst');
  if (/\b(graduate|new grad|junior|entry[- ]?level|associate|intern|internship)\b/.test(text)) personas.add('college_grad');
  if (/\b(data engineer|machine learning|ml engineer|artificial intelligence|\bai\b|\bml\b|analytics|mlops|data scientist)\b/.test(text)) personas.add('data_ai');
  if (!personas.size) personas.add('software_engineer');
  return [...personas];
}

function jobCountries(location) {
  const codes = new Set();
  for (const place of location.toLowerCase().split(';')) {
    const label = place.trim().replace(/^(?:remote|home based|office based)\s*[-–,:]?\s*/, '');
    const last = label.split(',').at(-1).trim().replace(/^remote\s*[-–:]\s*/, '');
    const directional = last.replace(/^(?:central|east coast|west coast|southeast|northeast|southwest|northwest)\s*[-–]\s*/, '');
    const code = label.includes('tbilisi') ? 'GE' :
      usStates.has(last) ? 'US' : jobCountryAliases.get(label) || jobCountryAliases.get(directional);
    if (code) codes.add(code);
  }
  return codes;
}

const roleWords=text=>text.toLowerCase().replace(/\bquality assurance\b/g,'qa').replace(/\bsdet\b/g,'sdet qa test engineer').split(/[^a-z0-9+#]+/).filter(Boolean);
function roleMatches(term,text){
  const words=roleWords(text);
  return roleWords(term).every(part=>words.some(word=>word.startsWith(part)));
}

function careerProfile(){return entries.find(r=>r.kind==='preference'&&r.id==='career-profile')}
function jobApplications(){return entries.filter(r=>r.kind==='job')}
async function saveCareerRecord(record){
 const res=await fetch(apiBase+'/api/entries',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(record)});
 const body=await res.json();if(!res.ok)throw Error(body.error||'Could not save');
 entries=entries.filter(r=>r.id!==body.id).concat(body);
}
function renderCareer(){
 const profile=careerProfile(), data=profile?.data||{};
 const head='<section class="intro"><h1>'+esc(page)+'</h1></section>';
 if(page==='Career profile'){
  $('view').innerHTML=head+'<form id="career-form" class="panel card"><p>Vacancies come from the '+jobEmployers+' job boards. Enter comma-separated job titles or skills to match against vacancy titles and departments. Preferred locations rank matches within the country you select.</p>'+field('keywords','Job titles or skills',data.keywords||'','text',true)+field('locations','Preferred locations',data.locations||'','text',true)+field('experience','Relevant experience for interview prep',data.experience||'','textarea',true)+'<button class="primary">Save profile</button></form>';
  $('career-form').onsubmit=async e=>{e.preventDefault();const f=e.target;f.querySelector('button').disabled=true;try{await saveCareerRecord({id:'career-profile',kind:'preference',revision:profile?.revision||0,data:{title:'Career profile',...Object.fromEntries(new FormData(f))}});navigate('Available jobs')}catch(err){notify(err.message)}finally{f.querySelector('button').disabled=false}};return;
 }
 if(page==='Jobs applied'){
  const apps=jobApplications().sort((a,b)=>b.data.applied.localeCompare(a.data.applied));
  $('view').innerHTML=head+'<div class="cards">'+(apps.map(r=>'<article class="card"><h2>'+esc(r.data.title)+'</h2><p>'+esc(r.data.employer)+' · '+esc(r.data.location)+'</p><p>Applied '+date(r.data.applied)+'</p><label class="field">Application status<select data-job-status="'+esc(r.id)+'">'+options(['Applied','Interviewing','Offer received','Rejected','Withdrawn'],r.data.status)+'</select></label><a target="_blank" rel="noopener" href="'+esc(safeUrl(r.data.url))+'">Employer listing ↗</a><div class="actions">'+interviewButton(r.id)+'</div></article>').join('')||'<p class="empty">Applications appear here when you select Mark as applied on a vacancy.</p>')+'</div>';return;
 }
 const countries = [...jobCountryLabels].sort((a,b)=>a[1].localeCompare(b[1]));
 const countryOptions = [['','Choose a country'],['All','All countries'],...countries].map(([code,label]) =>
   '<option value="'+esc(code)+'"'+(code===jobCountry?' selected':'')+'>'+esc(label)+'</option>').join('');
 const personaOptions = [...jobPersonaLabels].map(([code,label]) =>
   '<option value="'+esc(code)+'"'+(code===jobPersona?' selected':'')+'>'+esc(label)+'</option>').join('');
 $('view').innerHTML=head+'<div class="filters"><label>Job country<select id="jobs-country">'+countryOptions+'</select></label><label>Persona<select id="jobs-persona">'+personaOptions+'</select></label><button class="secondary" data-page="Career profile">Edit career profile</button><button class="secondary" id="refresh-jobs">Refresh vacancies</button></div><p class="result-count" id="job-summary" aria-live="polite"></p><div class="cards" id="job-list"></div>';
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
 $('jobs-persona').onchange=async e=>{
   const selected=jobPersonaLabels.has(e.target.value)?e.target.value:'all';
   e.target.disabled=true;
   const existing=entries.find(r=>r.id==='jobs-persona');
   try{
     await saveCareerRecord({id:'jobs-persona',kind:'preference',revision:existing?.revision||0,data:{title:selected}});
     jobPersona=selected;
   }catch(err){notify(err.message)}
   if(page==='Available jobs')renderCareer();
 };
 if(!jobCountry){$('job-summary').textContent='Choose a country to see vacancies.';return}
 $('refresh-jobs').onclick=()=>{jobResults=null;renderCareer()};
 if(!jobResults){$('job-summary').textContent='Checking employer job boards…';$('refresh-jobs').disabled=true;
 const params = new URLSearchParams();
 if (jobPersona && jobPersona !== 'all') params.set('persona', jobPersona);
 const jobsUrl = apiBase + '/api/jobs' + (params.toString() ? '?' + params.toString() : '');
 if(!jobFetch)jobFetch=fetch(jobsUrl).then(async r=>{if(!r.ok)throw Error();const body=await r.json();jobResults=body.jobs;failedBoards=body.failed}).catch(()=>{jobResults=[];failedBoards=['Employer feeds']}).finally(()=>{jobFetch=null;if(page==='Available jobs')renderCareer()});return}
 const terms=v=>(v||'').toLowerCase().split(',').map(t=>t.trim()).filter(Boolean);
 const keywords=terms(data.keywords),locations=terms(data.locations);
 const jobs=jobResults
   .filter(job=>jobCountry==='All'||jobCountries(job.location).has(jobCountry))
   .filter(job=>jobPersona==='all'||inferJobPersonas(job).includes(jobPersona))
   .map(j=>({...j,matched:keywords.filter(k=>roleMatches(k,j.title+' '+j.department))}))
   .filter(j=>!keywords.length||j.matched.length)
   .sort((a,b)=>b.matched.length-a.matched.length||
     Number(locations.some(l=>b.location.toLowerCase().includes(l)))-Number(locations.some(l=>a.location.toLowerCase().includes(l)))||
     a.title.localeCompare(b.title));
 $('job-summary').textContent=jobs.length+' matching vacancies · '+(jobCountryLabels.get(jobCountry)||'All countries')+' · '+(jobPersonaLabels.get(jobPersona)||'All personas')+(failedBoards.length?' · Unavailable feeds: '+failedBoards.join(', '):'')+(!keywords.length&&!locations.length?' · Add your profile to personalise results.':'');
 $('job-list').innerHTML=jobs.map(j=>'<article class="card"><h2>'+esc(j.title)+'</h2><p>'+esc(j.employer)+' · '+esc(j.location)+'</p>'+(j.matched.length?'<p>Matches '+esc(j.matched.join(', '))+'</p>':'')+'<div class="actions"><a class="secondary" target="_blank" rel="noopener" href="'+esc(safeUrl(j.url))+'">Apply with employer ↗</a>'+interviewButton(j.id)+(entries.some(r=>r.id===j.id)?'<button class="quiet" data-page="Jobs applied">View application</button>':'<button class="quiet" data-job-apply="'+esc(j.id)+'">Mark as applied</button>')+'</div></article>').join('')||'<p class="empty">'+(keywords.length&&jobResults.length?'None of the '+jobResults.length+' technical vacancies from '+jobEmployers+' match '+esc(keywords.join(', '))+(jobCountry==='All'?'':' in '+esc(jobCountryLabels.get(jobCountry)))+'. Try All countries or a broader role, such as engineer.':'Try another country, persona, edit your profile or refresh the employer feeds.')+'</p>';
}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-job-apply]');if(!b)return;const job=jobResults.find(j=>j.id===b.dataset.jobApply);if(!job)return;b.disabled=true;try{const res=await fetch(apiBase+'/api/entries',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:job.id,kind:'job',revision:0,data:{...job,status:'Applied',applied:londonToday()}})});const body=await res.json();if(!res.ok)throw Error(body.error||'Could not save');entries=entries.filter(r=>r.id!==body.id).concat(body);renderCareer();notify('Application recorded')}catch(err){notify(err.message);b.disabled=false}});
document.addEventListener('change',async e=>{const id=e.target.dataset.jobStatus;if(!id)return;const r=entries.find(v=>v.id===id);const input=e.target;input.disabled=true;try{await saveCareerRecord({...r,data:{...r.data,status:input.value}});notify('Status updated')}catch(err){input.value=r.data.status;notify(err.message)}finally{input.disabled=false}});