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
