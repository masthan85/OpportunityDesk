const interviewTopics = [
  ['Data architecture', /lakehouse|databricks|data architect|data platform|data warehouse/i, 'Explain how you chose a storage and compute design. Cover workload shape, governance, cost and how you checked the design met its targets.'],
  ['Data engineering', /data engineer|pipeline|\betl\b|\belt\b|airflow|spark|dbt/i, 'Describe inputs, transformations and consumers. Explain how you handled duplicate delivery, recoveries and data quality, then give one measured outcome.'],
  ['AI and machine learning', /machine learning|artificial intelligence|generative ai|\bllms?\b|\bai\b|mlops|agentic/i, 'Describe the baseline, the evaluation set and the metrics you chose. Explain failure handling and how you would monitor quality, latency and cost after release.'],
  ['Governance and security', /governance|privacy|security|compliance|lineage/i, 'Explain the data and risk involved, the access or audit controls you put in place and how you confirmed those controls worked.'],
  ['Migration and modernisation', /migration|moderni[sz]ation|legacy|cutover/i, 'Describe how you sequenced the migration, validated parity, planned rollback and checked the outcome after cutover.'],
  ['Analytics and SQL', /analytics|\bsql\b|dashboard|reporting|business intelligence/i, 'Explain how you defined the metric, validated query results against data users trusted and checked performance or adoption.'],
  ['Technical leadership', /leadership|stakeholder|mentoring|cross.functional|roadmap/i, 'Describe competing priorities, how you communicated options and trade-offs, what you personally decided and what changed as a result.'],
];

function interviewQuestions(job, profile, description) {
  const evidence = profile.experience?.trim();
  const skills = (profile.keywords || '').split(',').map(term=>term.trim()).filter(Boolean);
  const text = job.title+'\n'+description;
  const matchedSkills = skills.filter(skill=>text.toLowerCase().includes(skill.toLowerCase()));
  const relevant = interviewTopics.filter(([,pattern])=>pattern.test(text))
    .sort((a,b)=>Number(b[1].test(matchedSkills.join(' ')))-Number(a[1].test(matchedSkills.join(' '))));
  return [
    {
      question:'How has your experience prepared you for the '+job.title+' role at '+job.employer+'?',
      answer:(matchedSkills.length?'Connect '+matchedSkills.slice(0,3).join(', ')+' to the role. ':'Pick the closest project or relevant skill you can discuss. ')+
        'Explain the problem, your own contribution and the outcome.'+
        (evidence?' Use your saved example below if it fits.':' Add a real metric or concrete result if you have one.'),
    },
    ...relevant.slice(0,4).map(([name,pattern,answer])=>{
      const context=description.split(/\n|(?<=[.!?])\s+/).find(line=>line.length>=25&&line.length<=300&&pattern.test(line));
      const example=evidence?.split(/\n+/).map(line=>line.trim()).find(line=>pattern.test(line));
      return {
        question:'Tell me about a project involving '+name.toLowerCase()+'. What trade-off did you make?',
        answer:answer+(example?' Start from your saved example and add an outcome you can substantiate.':''),
        context,
        example:example?.slice(0,350),
      };
    }),
    {
      question:'Which responsibility for this role would you need to build more experience in?',
      answer:'Name one genuine gap. Describe relevant experience you can build on and a practical first step you would take to close it.',
    },
  ];
}

const interviewButton=id=>'<button class="quiet" data-interview-job="'+esc(id)+'">Interview prep</button>';
let interviewRequest;
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-interview-job]');
  if(!button)return;
  const id=button.dataset.interviewJob;
  const job=jobResults?.find(result=>result.id===id)||jobApplications().find(record=>record.id===id)?.data;
  if(!job)return;

  interviewRequest?.abort();
  const controller=new AbortController();
  interviewRequest=controller;
  const dialog=$('interview-prep'), content=$('interview-content');
  const profile=careerProfile()?.data||{};
  content.innerHTML='<p class="loading" role="status">Loading the employer description…</p>';
  dialog.showModal();
  let description='';
  try{
    const response=await fetch('/api/jobs/'+encodeURIComponent(id),{signal:controller.signal});
    if(response.ok){
      const result=await response.json();
      // Use an inert template and keep only text from the employer markup.
      const template=document.createElement('template');
      template.innerHTML=(result.description||'').replace(/<\/(?:p|li|div|h[1-6])>|<br\s*\/?\s*>/gi,'\n');
      template.content.querySelectorAll('script,style').forEach(node=>node.remove());
      description=template.content.textContent.trim();
      if(/&lt;\/?[a-z]/i.test(result.description||'')){
        template.innerHTML=description.replace(/<\/(?:p|li|div|h[1-6])>|<br\s*\/?\s*>/gi,'\n');
        template.content.querySelectorAll('script,style').forEach(node=>node.remove());
        description=template.content.textContent.trim();
      }
    }
  }catch{
    if(controller.signal.aborted)return;
  }
  if(interviewRequest!==controller||!dialog.open)return;
  content.innerHTML='<p><strong>'+esc(job.title)+'</strong> · '+esc(job.employer)+'</p>'+
    '<p>Use these practice questions and answer outlines to prepare examples from your own experience.</p>'+
    (profile.experience?.trim()?'<details><summary>Your saved experience</summary><p>'+esc(profile.experience)+'</p></details>':
      '<p>Add relevant experience to your Career profile to bring your own examples into prep.</p>')+
    '<details'+(description?'':' open')+'><summary>Job description</summary>'+
    (description?'':'<p>The employer description was unavailable. Paste it below to tailor the questions.</p>')+
    '<label class="field">Description<textarea id="interview-description" maxlength="20000"></textarea></label>'+
    '<button class="secondary" id="update-interview">Update questions</button></details>'+
    '<div id="interview-questions" aria-live="polite"></div>';
  const input=$('interview-description');
  input.value=description.slice(0,20000);
  const renderQuestions=()=>{
    $('interview-questions').innerHTML=interviewQuestions(job,profile,input.value).map(item=>
      '<article class="card"><h3>'+esc(item.question)+'</h3>'+
      (item.context?'<p>From the job description: '+esc(item.context)+'</p>':'')+
      (item.example?'<p>From your profile: '+esc(item.example)+'</p>':'')+
      '<details><summary>Answer outline</summary><p>'+esc(item.answer)+'</p></details></article>').join('');
  };
  $('update-interview').onclick=renderQuestions;
  renderQuestions();
});

$('interview-prep').addEventListener('close',()=>interviewRequest?.abort());
