// MCP server (Streamable HTTP, stateless JSON responses) exposing the visitor's workspace as tools.
// The visitor comes from the OAuth access token, so each AI app only ever sees one person's records.
const mcpProtocolVersions=['2025-11-25','2025-06-18','2025-03-26','2024-11-05'];
const regionKeys={global:'Global',all:'Global',worldwide:'Global',europe:'Europe','northern europe':'North','western europe':'West','eastern europe':'East','southern europe':'South','middle east':'MiddleEast'};
const londonDate=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

class ToolError extends Error {}

const text=(value,max)=>{
  if(value==null)return undefined;
  if(typeof value!=='string')throw new ToolError('Expected text.');
  if(value.length>max)throw new ToolError('Keep this under '+max+' characters.');
  return value.trim();
};

function resolveJobCountry(value){
  if(value==null||value==='')return null;
  const input=String(value).trim();
  if(/^(all|any|worldwide|global|anywhere)$/i.test(input))return 'All';
  if(jobCountryLabels.has(input.toUpperCase()))return input.toUpperCase();
  const code=jobCountryAliases.get(input.toLowerCase());
  if(!code)throw new ToolError('Unknown country "'+input+'". Use a country name such as United Kingdom, or a two-letter code such as GB.');
  return code;
}

function resolveRegion(value){
  if(value==null||value==='')return null;
  const input=String(value).trim();
  const key=regionKeys[input.toLowerCase()]||(regions[input]?input:null);
  if(key)return key;
  const code=resolveJobCountry(input);
  return code==='All'?'Global':code;
}

async function workspace(env, visitor){
  const original=await isOriginalOwner(env, visitor);
  return {original, records:await readRecords(env, visitor, original)};
}

// Reads the latest revision and writes the update, retrying once if another device saved first.
async function saveRecord(env, visitor, id, kind, build){
  for(let attempt=0;attempt<2;attempt++){
    const {original, records}=await workspace(env, visitor);
    const existing=records.find(r=>r.id===id);
    if(existing&&existing.kind!==kind)throw new ToolError('Record '+id+' is not a '+kind+'.');
    const entry={id,kind,revision:existing?.revision||0,data:build(existing?.data)};
    if(invalidEntry(entry))throw new ToolError('That record is incomplete.');
    if(JSON.stringify(entry.data).length>85000)throw new ToolError('That record is too long.');
    const saved=await writeRecord(env, visitor, original, entry);
    if(saved)return saved;
  }
  throw new ToolError('The record changed while saving. Try again.');
}

const preference=(records,id)=>records.find(r=>r.kind==='preference'&&r.id===id)?.data;

const tools=[
  {
    name:'get_profile',
    title:'Get career profile',
    description:'Read the signed-in user’s Opportunity Desk career profile: target roles or skills, preferred locations, relevant experience, saved job country and event region, plus how many opportunities and job applications they track.',
    inputSchema:{type:'object',properties:{},additionalProperties:false},
    annotations:{readOnlyHint:true,openWorldHint:false},
    async run(env, visitor, args, origin){
      const {records}=await workspace(env, visitor);
      const profile=preference(records,'career-profile')||{};
      const jobCountry=preference(records,'jobs-country')?.title||null;
      const region=preference(records,'discovery-region')?.title||'Global';
      return {
        targetRoles:profile.keywords||'',
        preferredLocations:profile.locations||'',
        experience:profile.experience||'',
        jobCountry:jobCountry&&{code:jobCountry,name:jobCountry==='All'?'All countries':jobCountryLabels.get(jobCountry)},
        eventRegion:region,
        trackedOpportunities:records.filter(r=>r.kind==='opportunity').length,
        jobApplications:records.filter(r=>r.kind==='job').length,
        website:origin,
      };
    },
  },
  {
    name:'update_profile',
    title:'Update career profile',
    description:'Update the user’s career profile. Only the fields you pass change. target_roles is a comma-separated list of job titles or skills used to match vacancies (for example "test engineer, QA engineer"). Confirm the new values with the user before saving.',
    inputSchema:{type:'object',properties:{
      target_roles:{type:'string',maxLength:500,description:'Comma-separated job titles or skills.'},
      preferred_locations:{type:'string',maxLength:500,description:'Comma-separated cities or regions used to rank matches.'},
      experience:{type:'string',maxLength:6000,description:'Relevant experience the user wants to draw on in interview prep.'},
      job_country:{type:'string',description:'Country for job searches: a name, a two-letter code, or "All".'},
    },additionalProperties:false},
    annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false},
    async run(env, visitor, args, origin){
      const fields={keywords:text(args.target_roles,500),locations:text(args.preferred_locations,500),experience:text(args.experience,6000)};
      const country=resolveJobCountry(args.job_country);
      if(Object.values(fields).some(v=>v!==undefined)){
        await saveRecord(env, visitor, 'career-profile', 'preference', data=>{
          const next={title:'Career profile',keywords:'',locations:'',experience:'',...data};
          for(const [key,value] of Object.entries(fields))if(value!==undefined)next[key]=value;
          return next;
        });
      }
      if(country)await saveRecord(env, visitor, 'jobs-country', 'preference', ()=>({title:country}));
      return tools[0].run(env, visitor, {}, origin);
    },
  },
  {
    name:'search_jobs',
    title:'Search job vacancies',
    description:'Search current technical vacancies (data, AI, software, test and QA, platform, security) on the Databricks, GitLab and Canonical job boards. Roles default to the user’s profile and country to their saved job country. Each result has an id for get_job_description and mark_job_applied.',
    inputSchema:{type:'object',properties:{
      roles:{type:'string',maxLength:500,description:'Comma-separated roles or skills. Leave out to use the profile.'},
      country:{type:'string',description:'Country name, two-letter code, or "All". Leave out to use the saved job country.'},
      limit:{type:'integer',minimum:1,maximum:50,description:'Maximum results, default 20.'},
    },additionalProperties:false},
    annotations:{readOnlyHint:true,openWorldHint:true},
    async run(env, visitor, args){
      const {records}=await workspace(env, visitor);
      const profile=preference(records,'career-profile')||{};
      const terms=value=>(value||'').toLowerCase().split(',').map(t=>t.trim()).filter(Boolean);
      const roles=terms(args.roles??profile.keywords), locations=terms(profile.locations);
      const country=resolveJobCountry(args.country)||preference(records,'jobs-country')?.title||'All';
      const limit=Math.min(Math.max(Number.isInteger(args.limit)?args.limit:20,1),50);
      const {jobs,failed}=await fetchEmployerJobs();
      const applied=new Set(records.filter(r=>r.kind==='job').map(r=>r.id));
      const matches=jobs
        .filter(job=>country==='All'||jobCountries(job.location).has(country))
        .map(job=>({...job,matched:roles.filter(role=>roleMatches(role,job.title+' '+job.department))}))
        .filter(job=>!roles.length||job.matched.length)
        .sort((a,b)=>b.matched.length-a.matched.length||
          Number(locations.some(l=>b.location.toLowerCase().includes(l)))-Number(locations.some(l=>a.location.toLowerCase().includes(l)))||
          a.title.localeCompare(b.title));
      return {
        country:country==='All'?'All countries':jobCountryLabels.get(country),
        roles,
        vacanciesSearched:jobs.length,
        totalMatches:matches.length,
        unavailableFeeds:failed,
        jobs:matches.slice(0,limit).map(({department,...job})=>({...job,department:department||undefined,alreadyApplied:applied.has(job.id)})),
        note:roles.length?undefined:'No roles given and none saved in the profile, so every technical vacancy is listed.',
      };
    },
  },
  {
    name:'get_job_description',
    title:'Get job description',
    description:'Fetch the full description of a vacancy from search_jobs as plain text. Use it to tailor interview preparation, CV points or a cover note to the role.',
    inputSchema:{type:'object',properties:{job_id:{type:'string',description:'Job id from search_jobs, for example job-gitlab-123456.'}},required:['job_id'],additionalProperties:false},
    annotations:{readOnlyHint:true,openWorldHint:true},
    async run(env, visitor, args){
      const result=await fetchJobDescription(String(args.job_id||''));
      if(result.error)throw new ToolError(result.error);
      return {jobId:args.job_id,description:htmlToText(result.description).slice(0,20000)};
    },
  },
  {
    name:'search_events',
    title:'Search events and opportunities',
    description:'List active data and AI events that have not yet ended: conferences, calls for speakers, hackathons, technical competitions, industry leadership events, mentoring and networking. Region defaults to the user’s saved event region. Results show whether the user already tracks each one.',
    inputSchema:{type:'object',properties:{
      type:{type:'string',enum:categories,description:'Opportunity type.'},
      region:{type:'string',description:'A country, a two-letter code, Europe, Northern Europe, Western Europe, Eastern Europe, Southern Europe, Middle East, or Global.'},
      query:{type:'string',maxLength:200,description:'Words to match in the title, venue or summary.'},
    },additionalProperties:false},
    annotations:{readOnlyHint:true,openWorldHint:false},
    async run(env, visitor, args){
      const {records}=await workspace(env, visitor);
      const region=resolveRegion(args.region)||preference(records,'discovery-region')?.title||'Global';
      if(args.type&&!categories.includes(args.type))throw new ToolError('Unknown opportunity type.');
      const needle=(text(args.query,200)||'').toLowerCase(), today=londonDate();
      const tracked=new Map(records.filter(r=>r.kind==='opportunity').map(r=>[r.id,r.data.status]));
      const events=catalogue
        .filter(d=>d.end>=today&&matchesLocation(region,d.country)&&(!args.type||d.category===args.type)&&
          [d.title,d.category,d.venue,d.fit].join(' ').toLowerCase().includes(needle))
        .sort((a,b)=>a.start.localeCompare(b.start))
        .map(d=>({id:d.id,title:d.title,type:d.category,start:d.start,end:d.end,venue:d.venue,country:d.country,
          summary:d.fit,deadline:d.deadline,deadlinePassed:d.deadline?d.deadline<today:undefined,officialUrl:d.source,
          trackedStatus:tracked.get(d.id)||null}));
      return {region,listingsCheckedOn:'2026-11-18',total:events.length,events};
    },
  },
  {
    name:'list_my_records',
    title:'List tracked opportunities and applications',
    description:'List the opportunities the user tracks (with status, dates and follow-ups) and the jobs they have applied for.',
    inputSchema:{type:'object',properties:{kind:{type:'string',enum:['all','opportunities','jobs'],description:'Default all.'}},additionalProperties:false},
    annotations:{readOnlyHint:true,openWorldHint:false},
    async run(env, visitor, args){
      const {records}=await workspace(env, visitor);
      const kind=args.kind||'all';
      const result={};
      if(kind!=='jobs')result.opportunities=records.filter(r=>r.kind==='opportunity').map(({id,data:d})=>({id,title:d.title,type:d.category,
        start:d.start,end:d.end,venue:d.venue,deadline:d.deadline,status:d.status,submitted:d.submitted,followUp:d.follow,followUpDate:d.followDate,notes:d.notes,source:d.source}));
      if(kind!=='opportunities')result.jobApplications=records.filter(r=>r.kind==='job').map(({id,data:d})=>({id,title:d.title,employer:d.employer,
        location:d.location,status:d.status,applied:d.applied,url:d.url}));
      return result;
    },
  },
  {
    name:'track_event',
    title:'Track an event',
    description:'Add an event from search_events to the user’s tracker, or change the status or notes of one they already track. Use only when the user asks.',
    inputSchema:{type:'object',properties:{
      event_id:{type:'string',description:'Event id from search_events.'},
      status:{type:'string',enum:opportunityStatuses,description:'Default Watching for a new record.'},
      notes:{type:'string',maxLength:6000,description:'Replaces the record’s notes.'},
    },required:['event_id'],additionalProperties:false},
    annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false},
    async run(env, visitor, args){
      const id=String(args.event_id||''), notes=text(args.notes,6000);
      if(args.status&&!opportunityStatuses.includes(args.status))throw new ToolError('Unknown status.');
      const listing=catalogue.find(d=>d.id===id);
      const {records}=await workspace(env, visitor);
      if(!listing&&!records.some(r=>r.id===id&&r.kind==='opportunity'))throw new ToolError('No event with id '+id+'. Use search_events to find one.');
      const saved=await saveRecord(env, visitor, id, 'opportunity', data=>{
        const next=data?{...data}:{...listing,status:'Watching'};
        if(args.status)next.status=args.status;
        if(notes!==undefined)next.notes=notes;
        if(['Submitted','Awaiting decision'].includes(next.status)&&!next.submitted)next.submitted=londonDate();
        return next;
      });
      return {saved:true,id:saved.id,title:saved.data.title,status:saved.data.status};
    },
  },
  {
    name:'mark_job_applied',
    title:'Record a job application',
    description:'Record that the user has applied for a vacancy from search_jobs. Use only after the user confirms they applied on the employer’s site.',
    inputSchema:{type:'object',properties:{job_id:{type:'string',description:'Job id from search_jobs.'}},required:['job_id'],additionalProperties:false},
    annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:true},
    async run(env, visitor, args){
      const id=String(args.job_id||'');
      const {records}=await workspace(env, visitor);
      const existing=records.find(r=>r.id===id&&r.kind==='job');
      if(existing)return {saved:false,alreadyRecorded:true,id,title:existing.data.title,status:existing.data.status};
      const job=(await fetchEmployerJobs()).jobs.find(j=>j.id===id);
      if(!job)throw new ToolError('That vacancy is not in the current employer feeds. It may have closed.');
      const saved=await saveRecord(env, visitor, id, 'job', ()=>({...job,status:'Applied',applied:londonDate()}));
      return {saved:true,id:saved.id,title:saved.data.title,employer:saved.data.employer,status:saved.data.status};
    },
  },
  {
    name:'update_record_status',
    title:'Update a record’s status',
    description:'Change the status of a tracked opportunity (Watching, Drafting, Submitted, Awaiting decision, Accepted, Declined, Completed, Archived) or a job application (Applied, Interviewing, Offer received, Rejected, Withdrawn). Use only when the user asks.',
    inputSchema:{type:'object',properties:{
      record_id:{type:'string',description:'Id from list_my_records.'},
      status:{type:'string',enum:[...opportunityStatuses,...jobStatuses]},
    },required:['record_id','status'],additionalProperties:false},
    annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false},
    async run(env, visitor, args){
      const id=String(args.record_id||'');
      const {records}=await workspace(env, visitor);
      const record=records.find(r=>r.id===id&&(r.kind==='opportunity'||r.kind==='job'));
      if(!record)throw new ToolError('No tracked record with id '+id+'.');
      const allowed=record.kind==='job'?jobStatuses:opportunityStatuses;
      if(!allowed.includes(args.status))throw new ToolError('Use one of: '+allowed.join(', ')+'.');
      const saved=await saveRecord(env, visitor, id, record.kind, data=>{
        const next={...data,status:args.status};
        if(record.kind==='opportunity'&&['Submitted','Awaiting decision'].includes(args.status)&&!next.submitted)next.submitted=londonDate();
        return next;
      });
      return {saved:true,id,title:saved.data.title,status:saved.data.status};
    },
  },
];

function htmlToText(html){
  const decode=value=>value.replace(/&(#\d+|#x[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi,(entity,name)=>{
    const lower=name.toLowerCase();
    if(lower[0]==='#'){const code=lower[1]==='x'?parseInt(lower.slice(2),16):parseInt(lower.slice(1),10);return code>0&&code<0x110000?String.fromCodePoint(code):''}
    return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[lower];
  });
  return decode(decode(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi,'')
    .replace(/<li[^>]*>/gi,'\n• ')
    .replace(/<br\s*\/?>|<\/(p|div|li|ul|ol|h[1-6]|tr)>/gi,'\n')
    .replace(/<[^>]+>/g,''))
    .replace(/[ \t ]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}

const rpcResult=(id,result)=>({jsonrpc:'2.0',id,result});
const rpcError=(id,code,message)=>({jsonrpc:'2.0',id,error:{code,message}});

async function handleRpc(message, env, visitor, origin){
  if(!message||message.jsonrpc!=='2.0'||typeof message.method!=='string')return rpcError(message?.id??null,-32600,'Invalid request');
  const {id,method,params}=message;
  if(id===undefined)return null; // Notifications need no reply.
  if(method==='initialize'){
    const requested=params?.protocolVersion;
    return rpcResult(id,{
      protocolVersion:mcpProtocolVersions.includes(requested)?requested:mcpProtocolVersions[0],
      capabilities:{tools:{listChanged:false}},
      serverInfo:{name:'opportunity-desk',title:'Opportunity Desk',version:'1.0.0'},
      instructions:'Opportunity Desk is the user’s private job and event tracker for data and AI careers. Use search_jobs and search_events to find openings, get_job_description to prepare for interviews, and list_my_records to review progress. Ask before changing records unless the user has asked you to.',
    });
  }
  if(method==='ping')return rpcResult(id,{});
  if(method==='tools/list')return rpcResult(id,{tools:tools.map(({run,...tool})=>tool)});
  if(method==='tools/call'){
    const tool=tools.find(t=>t.name===params?.name);
    if(!tool)return rpcError(id,-32602,'Unknown tool: '+params?.name);
    const args=params.arguments??{};
    if(typeof args!=='object'||Array.isArray(args))return rpcError(id,-32602,'Tool arguments must be an object');
    try{
      const output=await tool.run(env, visitor, args, origin);
      return rpcResult(id,{content:[{type:'text',text:JSON.stringify(output,null,1)}],structuredContent:output});
    }catch(error){
      if(!(error instanceof ToolError))console.error(error);
      return rpcResult(id,{content:[{type:'text',text:error instanceof ToolError?error.message:'Opportunity Desk is temporarily unavailable. Try again shortly.'}],isError:true});
    }
  }
  return rpcError(id,-32601,'Method not found: '+method);
}

async function handleMcp(request, env, origin){
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders});
  const visitor=await connectorVisitor(request, env);
  if(!visitor)return connectorUnauthorised(origin);
  if(request.method!=='POST')return corsJson({error:'Use POST for MCP requests.'},405,{Allow:'POST, OPTIONS'});
  const body=await request.text();
  if(body.length>200000)return corsJson(rpcError(null,-32600,'Request too large'),413);
  let message;
  try{message=JSON.parse(body)}catch{return corsJson(rpcError(null,-32700,'Parse error'),400)}
  const replies=Array.isArray(message)
    ? (await Promise.all(message.map(m=>handleRpc(m, env, visitor, origin)))).filter(Boolean)
    : [await handleRpc(message, env, visitor, origin)].filter(Boolean);
  if(!replies.length)return new Response(null,{status:202,headers:corsHeaders});
  return corsJson(Array.isArray(message)?replies:replies[0]);
}
