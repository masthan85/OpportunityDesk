const careerViews=['Available jobs','Jobs applied','Career profile'];
let jobResults=null, jobFetch=null, failedBoards=[];
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
  $('view').innerHTML=head+'<form id="career-form" class="panel card"><p>Enter comma-separated job titles or skills to match against vacancy titles and departments. Locations match the employer’s wording.</p>'+field('keywords','Job titles or skills',data.keywords||'','text',true)+field('locations','Preferred locations',data.locations||'','text',true)+'<button class="primary">Save profile</button></form>';
  $('career-form').onsubmit=async e=>{e.preventDefault();const f=e.target;f.querySelector('button').disabled=true;try{await saveCareerRecord({id:'career-profile',kind:'preference',revision:profile?.revision||0,data:{title:'Career profile',...Object.fromEntries(new FormData(f))}});navigate('Available jobs')}catch(err){notify(err.message)}finally{f.querySelector('button').disabled=false}};return;
 }
 if(page==='Jobs applied'){
  const apps=jobApplications().sort((a,b)=>b.data.applied.localeCompare(a.data.applied));
  $('view').innerHTML=head+'<div class="cards">'+(apps.map(r=>'<article class="card"><h2>'+esc(r.data.title)+'</h2><p>'+esc(r.data.employer)+' · '+esc(r.data.location)+'</p><p>Applied '+date(r.data.applied)+'</p><label class="field">Application status<select data-job-status="'+esc(r.id)+'">'+options(['Applied','Interviewing','Offer received','Rejected','Withdrawn'],r.data.status)+'</select></label><a target="_blank" rel="noopener" href="'+esc(safeUrl(r.data.url))+'">Employer listing ↗</a></article>').join('')||'<p class="empty">Applications appear here when you select Mark as applied on a vacancy.</p>')+'</div>';return;
 }
 $('view').innerHTML=head+'<div class="filters"><button class="secondary" data-page="Career profile">Edit career profile</button><button class="secondary" id="refresh-jobs">Refresh vacancies</button></div><p class="result-count" id="job-summary"></p><div class="cards" id="job-list"></div>';
 $('refresh-jobs').onclick=()=>{jobResults=null;renderCareer()};
 if(!jobResults){$('job-summary').textContent='Checking employer job boards…';$('refresh-jobs').disabled=true;
 if(!jobFetch)jobFetch=fetch('/api/jobs').then(async r=>{if(!r.ok)throw Error();const body=await r.json();jobResults=body.jobs;failedBoards=body.failed}).catch(()=>{jobResults=[];failedBoards=['Employer feeds']}).finally(()=>{jobFetch=null;if(page==='Available jobs')renderCareer()});return}
 const terms=v=>(v||'').toLowerCase().split(',').map(t=>t.trim()).filter(Boolean);
 const keywords=terms(data.keywords),locations=terms(data.locations);
 const jobs=jobResults.map(j=>({...j,matched:keywords.filter(k=>(j.title+' '+j.department).toLowerCase().includes(k))})).filter(j=>(!keywords.length||j.matched.length)&&(!locations.length||locations.some(l=>j.location.toLowerCase().includes(l)))).sort((a,b)=>b.matched.length-a.matched.length||a.title.localeCompare(b.title));
 $('job-summary').textContent=jobs.length+' matching vacancies'+(failedBoards.length?' · Unavailable feeds: '+failedBoards.join(', '):'')+(!keywords.length&&!locations.length?' · Add your profile to personalise results.':'');
 $('job-list').innerHTML=jobs.map(j=>'<article class="card"><h2>'+esc(j.title)+'</h2><p>'+esc(j.employer)+' · '+esc(j.location)+'</p>'+(j.matched.length?'<p>Matches '+esc(j.matched.join(', '))+'</p>':'')+'<div class="actions"><a class="secondary" target="_blank" rel="noopener" href="'+esc(safeUrl(j.url))+'">Apply with employer ↗</a>'+(entries.some(r=>r.id===j.id)?'<button class="quiet" data-page="Jobs applied">View application</button>':'<button class="quiet" data-job-apply="'+esc(j.id)+'">Mark as applied</button>')+'</div></article>').join('')||'<p class="empty">Try changing your profile or refreshing the employer feeds.</p>';
}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-job-apply]');if(!b)return;const job=jobResults.find(j=>j.id===b.dataset.jobApply);if(!job)return;b.disabled=true;try{await saveCareerRecord({id:job.id,kind:'job',revision:0,data:{...job,status:'Applied',applied:londonToday()}});renderCareer();notify('Application recorded')}catch(err){notify(err.message);b.disabled=false}});
document.addEventListener('change',async e=>{const id=e.target.dataset.jobStatus;if(!id)return;const r=entries.find(v=>v.id===id);const input=e.target;input.disabled=true;try{await saveCareerRecord({...r,data:{...r.data,status:input.value}});notify('Status updated')}catch(err){input.value=r.data.status;notify(err.message)}finally{input.disabled=false}});
