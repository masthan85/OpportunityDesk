async function employerJobs(){
 const boards=[['databricks','Databricks'],['gitlab','GitLab'],['canonical','Canonical']];
 const failed=[];
 const lists=await Promise.all(boards.map(async ([board,employer])=>{
  try{
   const res=await fetch('https://boards-api.greenhouse.io/v1/boards/'+board+'/jobs',{signal:AbortSignal.timeout(9000),cf:{cacheTtl:300,cacheEverything:true}});
   if(!res.ok)throw Error();
   const {jobs}=await res.json();
   return jobs.filter(j=>/data|architect|machine learning|artificial intelligence|\bAI\b|analytics|MLOps|platform engineer/i.test(j.title)&&/^https:\/\//.test(j.absolute_url)).map(j=>({id:'job-'+board+'-'+j.id,title:j.title,employer,location:j.location?.name||'See listing',department:(j.departments||[]).map(d=>d.name).join(', '),url:j.absolute_url}));
  }catch{failed.push(employer);return []}
 }));
 return json({jobs:lists.flat(),failed});
}

async function employerJobDescription(path) {
  const match = /^\/api\/jobs\/job-(databricks|gitlab|canonical)-(\d{1,18})$/.exec(path);
  if (!match) return json({error:'Unknown job'},404);
  const [, board, id] = match;
  try {
    const response = await fetch('https://boards-api.greenhouse.io/v1/boards/'+board+'/jobs/'+id, {
      signal:AbortSignal.timeout(9000),
      cf:{cacheTtl:300,cacheEverything:true},
    });
    if (response.status === 404) return json({error:'The employer listing is no longer available'},404);
    if (!response.ok) throw Error('Employer feed unavailable');
    const {content} = await response.json();
    return json({description:typeof content === 'string' ? content.slice(0,42000) : ''});
  } catch {
    return json({error:'The employer description is temporarily unavailable'},502);
  }
}
