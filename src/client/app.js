const categories=['Conferences','Calls for speakers','Hackathons','Technical competitions','Industry leadership','Mentoring','Networking events'];
const topics=['Enterprise data architecture','Databricks and lakehouse','Agentic AI','AI engineering and governance','AI-assisted migration and data modernisation','Enterprise AI strategy and technical leadership'];
const statuses=['Watching','Drafting','Submitted','Awaiting decision','Accepted','Declined','Completed','Archived'];
const templates=[
  ['Speaker biography','[Name] is a [role] specialising in [topics], with experience in [relevant work].\n\nFor [event], [name] will share [specific practitioner lesson] from [approved project context].\n\nTailor to [word limit]. Add one relevant, verifiable credential and confirm permission to name clients.'],
  ['Talk abstract','Title: [Specific problem and what the audience will learn]\nAudience and level: [Who will benefit]\nProblem: [What made the work difficult]\nApproach: [Architecture decision, trade-offs and safeguards]\nEvidence: [Approved outcome and how it was measured]\nTakeaways: [Three actions attendees can apply]\nFormat and duration: [As requested by organiser]'],
  ['Nomination form','Event and track: [Name]\nApplicant, role and contact: [Details]\nTalk title and abstract: [Paste final version]\nWhy this fits: [Match against published selection criteria]\nSupporting evidence: [Approved links and measurable outcomes]\nPermissions and accessibility: [Confirm]\nSubmitted on and reference: [Record after receipt]\nExpected decision date: [If published]'],
  ['Mentoring outreach','Subject: Mentoring support for [programme]\n\nHi [name],\n\nI’m [name], a [role] specialising in [topic]. I’d like to volunteer with [programme] because [specific connection]. I could offer [session or mentoring format] on [relevant subject], with [practical takeaway for participants].\n\nIs there a suitable route to apply or a programme lead I should speak with?\n\nBest wishes,\n[name]'],
  ['Follow-up message','Subject: Follow-up on [submission title or reference]\n\nHi [name],\n\nI submitted [title] for [event] on [date], reference [reference if available]. Could you confirm the expected decision timeline? I’m happy to provide any further details that would help the review.\n\nBest wishes,\n[name]'],
  ['Evidence capture','Opportunity and role: [Event, date, organiser and contribution]\nOutcome: [Accepted, delivered, shortlisted or other outcome]\nIndependent evidence: [Agenda, organiser confirmation, recording or public link]\nReach and impact: [Verified numbers and measurement source]\nFeedback: [Approved quote or contact]\nPermissions: [What may be shared publicly]\nFollow-up: [Next action and date]']
];
const defaults=[
  {id:'big-data-ldn-2027',kind:'opportunity',revision:0,data:{title:'Big Data LDN 2027',organisation:'Big Data LDN',category:'Conferences',start:'2027-09-22',end:'2027-09-23',venue:'Olympia London',source:'https://www.bigdataldn.com/',topics:[topics[0],topics[2],topics[3],topics[5]],fit:'Relevant to enterprise architecture, AI engineering and governance. Review the 2027 programme when announced.',status:'Watching',follow:'Check the organiser’s site for the 2027 programme and any speaker submission route.'}},
  ...templates.map(([title,body],i)=>({id:'template-'+i,kind:'template',revision:0,data:{title,body}}))
];
const icons={
  overview:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
  mic:'<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 11a7 7 0 0 0 14 0m-7 7v4m-3 0h6"/>',
  code:'<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18"/>',
  award:'<circle cx="12" cy="8" r="5"/><path d="m8 12-2 9 6-3 6 3-2-9"/>',
  people:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-17a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5v2"/>',
  file:'<path d="M5 3h9l5 5v13H5zM14 3v6h5M8 13h8m-8 4h8"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h1m-1 6h1m-1 6h1"/>',
  pin:'<path d="m5 14 9-9 5 5-9 9H5zm6-6 5 5m-11 6-2 2"/>'
};
const icon=name=>`<span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg></span>`;
const groups=[['Workspace',[['Discover','calendar'],['Overview','overview'],['My opportunities','list'],['My submissions','pin'],['Upcoming conferences','clock']]],['Jobs',[['Available jobs','list'],['Jobs applied','file'],['Career profile','people']]],['Opportunity types',categories.map((c,i)=>[c,['calendar','mic','code','award','award','people','people'][i]])],['Resources',[['Templates','file']]]];
const subtitles={'Overview':'Track opportunities, prepare submissions and record what comes of them.','My opportunities':'Search, review and update your full opportunity register.','My submissions':'Review your submitted applications, registrations and nominations across all opportunity types.','Upcoming conferences':'Browse upcoming conferences in your selected region and conferences in your tracker, ordered by event date.','Templates':'Edit and copy reusable drafts for speaking, mentoring and professional evidence.'};
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=value=>{try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:''}catch{return ''}};
const date=value=>value ? new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z')):'';
const londonToday=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const badge=value=>`<span class="badge ${esc(value?.toLowerCase().replaceAll(' ','-'))}">${esc(value||'Watching')}</span>`;
const options=(values,selected)=>values.map(v=>`<option ${v===selected?'selected':''}>${esc(v)}</option>`).join('');
const isSubmission=r=>Boolean(r.data.submitted)||['Submitted','Awaiting decision','Accepted','Declined'].includes(r.data.status);
function upcomingConferences(){
  const today=londonToday();
  const conference=d=>['Conferences','Calls for speakers'].includes(d.category)||/conference|summit|congress|expo/i.test(d.title);
  const tracked=entries.filter(r=>r.kind==='opportunity');
  const ids=new Set(tracked.map(r=>r.id));
  const listings=catalogue.filter(d=>!ids.has(d.id)&&matchesLocation(discoveryCountry,d.country))
    .map(d=>({id:d.id,kind:'opportunity',revision:0,data:{...d,status:'Untracked'}}));
  return [...tracked,...listings].filter(r=>conference(r.data)&&(r.data.end||r.data.start)>=today);
}
const pendingDecision=r=>['Submitted','Awaiting decision'].includes(r.data.status);
let entries=[], page='Discover', query='', stage='', topic='', sort='Event date', active=null, ready=false, saving=false, noticeTimer;
function notify(message){$('notice').textContent=message;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').textContent='',4000)}
async function load(){
  $('add').disabled=true;
  try{
    const response=await fetch('/api/entries');
    if(!response.ok) throw Error();
    const {saved, ownerDefault, countryHint}=await response.json();
    if(ownerDefault && !defaults.some(r=>r.id===ownerDefault.id))defaults.push(ownerDefault);
    initialiseCountry(saved,countryHint);
    initialiseJobCountry(saved,countryHint);
    const ids=new Set(saved.map(r=>r.id));
    entries=[...saved,...defaults.filter(r=>!ids.has(r.id))];
    ready=true;$('add').disabled=false;render();
  }catch{
    $('view').setAttribute('aria-busy','false');
    $('view').innerHTML='<div class="panel empty">Workspace storage is temporarily unavailable. <button class="secondary" id="retry">Try again</button></div>';
    $('retry').onclick=load;
  }
}
function navigate(target){page=target;query='';stage='';topic='';sort='Event date';render();window.scrollTo(0,0)}
function render(){
  $('navigation').innerHTML=groups.map(([label,items])=>`<div class="nav-label">${label}</div>`+items.map(([name,i])=>`<button class="nav ${page===name?'active':''}" ${page===name?'aria-current="page"':''} data-page="${name}">${icon(i)}${name}</button>`).join('')).join('');
  $('crumb').textContent=page;
  if(!ready)return;
  $('view').setAttribute('aria-busy','false');
  if(careerViews.includes(page)){renderCareer();return}
  if(page==="Discover"){showDiscovery();return}
  const opportunities=entries.filter(r=>r.kind==='opportunity');

  const intro=`<section class="intro"><div class="eyebrow">OPPORTUNITY TRACKER</div><h1>${page==='Overview'?'Opportunity Desk':esc(page)}</h1><p>${subtitles[page]||'Review opportunities in this category and plan your next action.'}</p></section>`;
  if(page==='Templates'){
    $('view').innerHTML=intro+`<div class="filters"><label class="search"><span class="sr-only">Search templates</span><input id="template-search" type="search" placeholder="Search templates" value="${esc(query)}"></label></div><div id="template-grid" class="cards"></div>`;
    $('template-search').oninput=e=>{query=e.target.value;renderTemplates()};
    renderTemplates();return;
  }
  const stat=(n,label,target,i,filter='')=>`<button class="stat" data-page="${target}" data-stage="${filter}"><span><strong>${n}</strong>${label}</span>${icon(i)}</button>`;
  const stats=page==='Overview'?`<div class="stats">${stat(opportunities.length,'Tracked opportunities','My opportunities','list')}${stat(upcomingConferences().length,'Upcoming conferences','Upcoming conferences','calendar')}${stat(opportunities.filter(pendingDecision).length,'Awaiting decisions','My opportunities','clock','Decision pending')}${stat(opportunities.filter(isSubmission).length,'My submissions','My submissions','pin')}${stat(jobApplications().length,'Jobs applied','Jobs applied','file')}${stat(templates.length,'Reusable templates','Templates','file')}</div>`:'';
  $('view').innerHTML=intro+stats+`<section class="panel"><div class="section-title"><h2>${page==='Overview'?'Opportunity register':page==='My submissions'?'Submission history':'Records'}</h2></div><div class="filters">
  <label class="search"><span class="sr-only">Search opportunities</span><input id="search" type="search" placeholder="Search opportunities…" value="${esc(query)}"></label>
  <label><span class="sr-only">Application status</span><select id="stage"><option value="">All statuses</option>${options(['Decision pending',...(page==='Upcoming conferences'?['Untracked']:[]),...statuses],stage)}</select></label>
  <label><span class="sr-only">Topic fit</span><select id="topic"><option value="">All topics</option>${options(topics,topic)}</select></label>
  <label><span class="sr-only">Sort opportunities</span><select id="sort">${options(['Event date','Deadline','Follow-up date','Name'],sort)}</select></label></div>
  <div class="table-scroll"><table><thead><tr><th scope="col">Opportunity</th><th scope="col">Event date / venue</th><th scope="col">Deadline</th><th scope="col">Status</th><th scope="col">Source</th></tr></thead><tbody id="rows"></tbody></table></div><div id="count" class="result-count" aria-live="polite"></div></section>${page==='Overview'?`<div class="topics" aria-label="Priority topics">${topics.map(t=>`<button class="topic" data-topic="${esc(t)}">${esc(t)}</button>`).join('')}</div>`:''}`;
  $('search').oninput=e=>{query=e.target.value;renderRows()};
  for(const [id,update] of [['stage',v=>stage=v],['topic',v=>topic=v],['sort',v=>sort=v]]) $(id).onchange=e=>{update(e.target.value);renderRows()};
  renderRows();
}
function renderRows(){
  const needle=query.trim().toLowerCase();
  const records=page==='Upcoming conferences'?upcomingConferences():entries;
  const rows=records.filter(r=>{
    if(r.kind!=='opportunity')return false;
    const d=r.data;
    return (page!=='My submissions'||isSubmission(r))&&
      (!categories.includes(page)||d.category===page)&&
      (!stage||(stage==='Decision pending'?pendingDecision(r):d.status===stage))&&
      (!topic||d.topics?.includes(topic))&&Object.values(d).join(' ').toLowerCase().includes(needle);
  });
  const key={'Event date':'start','Deadline':'deadline','Follow-up date':'followDate','Name':'title'}[sort];
  rows.sort((a,b)=>(a.data[key]||'9999-99-99').localeCompare(b.data[key]||'9999-99-99')||a.data.title.localeCompare(b.data.title));
  $('rows').innerHTML=rows.map(r=>{
    const d=r.data, url=safeUrl(d.source);
    const event=d.start ? date(d.start)+(d.end?' to '+date(d.end):'') : 'To be confirmed';
    const closed=d.deadline&&d.deadline<londonToday();
    return `<tr><td><button class="entry-title" data-edit="${esc(r.id)}">${esc(d.title)}</button><small>${esc([d.organisation,d.category].filter(Boolean).join(' · '))}</small></td><td>${event}<small>${esc(d.venue)}</small></td><td>${date(d.deadline)||'—'}${closed?'<small>Passed</small>':''}</td><td>${badge(d.status)}</td><td>${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Official ↗</a>`:'—'}</td></tr>`;
  }).join('')||'<tr><td colspan="5" class="empty">No matching opportunities. Adjust the filters or add a record.</td></tr>';
  $('count').textContent=rows.length+' '+(rows.length===1?'opportunity':'opportunities');
}
function renderTemplates(){
  $('template-grid').innerHTML=entries.filter(r=>r.kind==='template'&&Object.values(r.data).join(' ').toLowerCase().includes(query.trim().toLowerCase())).map(r=>`<article class="card"><h2>${esc(r.data.title)}</h2><p>${esc(r.data.body)}</p><div class="actions"><button class="secondary" data-copy="${r.id}">Copy template</button><button class="quiet" data-edit="${r.id}">Edit</button></div></article>`).join('')||'<p class="empty">No matching templates.</p>';
}
const field=(name,label,value,type='text',full=false,required=false)=>`<label class="field ${full?'full':''}">${label}${type==='textarea'||type==='template'?`<textarea name="${name}" class="${type}" maxlength="6000" ${required?'required':''}>${esc(value)}</textarea>`:`<input name="${name}" type="${type}" value="${esc(value)}" ${type==='date'?'':'maxlength="500"'} ${required?'required':''}>`}</label>`;
const select=(name,label,values,value)=>`<label class="field">${label}<select name="${name}">${options(values,value)}</select></label>`;
let recordingSubmission=false;
function openEditor(record, submission=false){
  if(!ready||saving)return;
  recordingSubmission=submission;
  active=record||{id:crypto.randomUUID(),kind:'opportunity',revision:0,data:{category:categories.includes(page)?page:'Conferences',status:'Watching'}};
  const d=active.data;
  $('editor-title').textContent=record?record.kind==='template'?'Edit template':'Edit opportunity':'Add opportunity';
  $('form-error').textContent='';
  const url=safeUrl(d.source);
  $('fields').innerHTML=active.kind==='template'?field('title','Template name',d.title,'text',true,true)+field('body','Template text',d.body,'template',true,true):
    field('title','Event or opportunity',d.title,'text',true,true)+field('organisation','Organisation',d.organisation)+select('category','Opportunity type',categories,d.category)+
    field('start','Start date',d.start,'date')+field('end','End date',d.end,'date')+field('venue','Venue',d.venue)+field('deadline','Application or registration deadline',d.deadline,'date')+
    field('source','Official source URL',d.source,'url',true)+(url?`<a id="record-source" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open official source ↗</a>`:'')+
    `<fieldset class="checkboxes"><legend>Topic fit</legend>${topics.map(t=>`<label><input type="checkbox" name="topics" value="${esc(t)}" ${d.topics?.includes(t)?'checked':''}>${esc(t)}</label>`).join('')}</fieldset>`+
    field('fit','Why it fits',d.fit,'textarea',true)+select('status','Application status',statuses,d.status)+field('submitted','Submitted on',d.submitted,'date')+
    field('team','Team name',d.team)+field('confirmation','Organiser confirmation reference or message',d.confirmation,'textarea',true)+
    field('materials','Submission materials, links or references',d.materials,'textarea',true)+field('follow','Follow-up actions',d.follow,'textarea',true)+
    field('followDate','Follow-up date',d.followDate,'date')+field('reviewDate','Last reviewed',d.reviewDate,'date')+
    field('outcome','Outcome and supporting evidence',d.outcome,'textarea',true)+field('notes','Notes',d.notes,'textarea',true);
  if(submission){
    $('editor-title').textContent='Record submission';
    $('fields').innerHTML='<div class="field full"><strong>'+esc(d.title)+'</strong><p>Confirm that you completed the organiser’s form. You can paste the acknowledgement below.</p></div>'+
      field('submitted','Submitted on',d.submitted||londonToday(),'date',false,true)+
      field('team','Team name (optional)',d.team)+field('confirmation','Confirmation reference or message (optional)',d.confirmation,'textarea',true);
  }
  $('save').textContent=submission?'Confirm submitted':'Save changes';
  $('editor').showModal();
}
$('add').onclick=()=>openEditor();
for(const id of ['cancel','close'])$(id).onclick=()=>{if(!saving)$('editor').close()};
$('editor').addEventListener('cancel',e=>{if(saving)e.preventDefault()});
$('editor-form').onsubmit=async e=>{
  e.preventDefault();
  if(saving)return;
  const form=new FormData(e.target);
  const fields=Object.fromEntries([...form].map(([key,value])=>[key,value.trim()]));
  const data=recordingSubmission?{...active.data,...fields,status:'Submitted'}:fields;
  if(!recordingSubmission&&active.kind==='opportunity')data.topics=form.getAll('topics');
  const error=$('form-error');
  error.textContent='';
  if(!data.title || (active.kind==='template'&&!data.body)){error.textContent='Enter a title and complete the required fields.';return}
  if(data.end&&data.start&&data.end<data.start){error.textContent='The end date must be on or after the start date.';return}
  if(data.source&&!safeUrl(data.source)){error.textContent='Enter an official link beginning with https:// or http://.';return}
  saving=true;
  $('save').disabled=true;
  let refresh=false;
  try{
    const response=await fetch('/api/entries',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...active,data})});
    const saved=await response.json();
    if(!response.ok){refresh=response.status===409;throw Error(saved.error)}
    entries=[...entries.filter(r=>r.id!==saved.id),saved];
    $('editor').close();
    render();
    notify(recordingSubmission?'Submission recorded':'Changes saved');
  }catch(err){
    error.textContent=err.message||'Changes could not be saved. Try again.';
    if(refresh)await load();
  }finally{saving=false;$('save').disabled=false}
};
document.addEventListener('click',async e=>{
  const button=e.target.closest('button');
  if(!button)return;
  const {page:target,edit,copy,stage:filter,topic:topicFilter}=button.dataset;
  if(target){navigate(target);if(filter){stage=filter;render()}}
  if(edit){
    const tracked=entries.find(r=>r.id===edit);
    const listing=!tracked&&catalogue.find(d=>d.id===edit);
    if(tracked||listing)openEditor(tracked||{id:edit,kind:'opportunity',revision:0,data:{...listing,status:'Watching'}});
  }
  if(topicFilter){topic=topicFilter;$('topic').value=topicFilter;renderRows();$('topic').focus()}
  if(copy){
    const body=entries.find(r=>r.id===copy)?.data.body;
    try{await navigator.clipboard.writeText(body);notify('Template copied')}catch{notify('Clipboard unavailable. Open Edit to select and copy the text.')}
  }
});
render();
load();
