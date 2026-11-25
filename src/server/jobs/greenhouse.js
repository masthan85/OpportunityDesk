// Technical roles only: data, AI, software, test and QA, platform, reliability and security.
const technicalRole=/data|architect|machine learning|artificial intelligence|\bAI\b|\bML\b|analytics|MLOps|platform|engineer|developer|scientist|\bQA\b|quality|\btest|SDET|automation|devops|\bSRE\b|reliability|security|cloud/i;
const jobBoards=[['databricks','Databricks'],['gitlab','GitLab'],['canonical','Canonical']];

async function fetchEmployerJobs(){
 const failed=[];
 const lists=await Promise.all(jobBoards.map(async ([board,employer])=>{
  try{
   const res=await fetch('https://boards-api.greenhouse.io/v1/boards/'+board+'/jobs',{signal:AbortSignal.timeout(9000),cf:{cacheTtl:300,cacheEverything:true}});
   if(!res.ok)throw Error();
   const {jobs}=await res.json();
   return jobs.filter(j=>technicalRole.test(j.title)&&/^https:\/\//.test(j.absolute_url)).map(j=>({id:'job-'+board+'-'+j.id,title:j.title,employer,location:j.location?.name||'See listing',department:(j.departments||[]).map(d=>d.name).join(', '),url:j.absolute_url}));
  }catch{failed.push(employer);return []}
 }));
 return {jobs:lists.flat(),failed};
}

async function employerJobs(){
 return json(await fetchEmployerJobs());
}

// Returns {description} with the employer's HTML, or {error, status}.
async function fetchJobDescription(jobId) {
  const match = /^job-(databricks|gitlab|canonical)-(\d{1,18})$/.exec(jobId);
  if (!match) return {error:'Unknown job',status:404};
  const [, board, id] = match;
  try {
    const response = await fetch('https://boards-api.greenhouse.io/v1/boards/'+board+'/jobs/'+id, {
      signal:AbortSignal.timeout(9000),
      cf:{cacheTtl:300,cacheEverything:true},
    });
    if (response.status === 404) return {error:'The employer listing is no longer available',status:404};
    if (!response.ok) throw Error('Employer feed unavailable');
    const {content} = await response.json();
    return {description:typeof content === 'string' ? content.slice(0,42000) : ''};
  } catch {
    return {error:'The employer description is temporarily unavailable',status:502};
  }
}

async function employerJobDescription(path) {
  const result = await fetchJobDescription(path.slice('/api/jobs/'.length));
  return result.error ? json({error:result.error},result.status) : json(result);
}
