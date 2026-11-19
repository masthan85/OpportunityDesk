const interviewTopics = [
  ['Data architecture', /lakehouse|databricks|data architect|data platform|data warehouse/i, 'Explain how you chose a storage and compute design. Cover workload shape, governance, cost and how you checked the design met its targets.'],
  ['Data engineering', /data engineer|pipeline|\betl\b|\belt\b|airflow|spark|dbt/i, 'Describe inputs, transformations and consumers. Explain how you handled duplicate delivery, recoveries and data quality, then give one measured outcome.'],
  ['AI and machine learning', /machine learning|artificial intelligence|generative ai|\bllms?\b|\bai\b|mlops|agentic/i, 'Describe the baseline, the evaluation set and the metrics you chose. Explain failure handling and how you would monitor quality, latency and cost after release.'],
  ['Governance and security', /governance|privacy|security|compliance|lineage/i, 'Explain the data and risk involved, the access or audit controls you put in place and how you confirmed those controls worked.'],
  ['Migration and modernisation', /migration|moderni[sz]ation|legacy|cutover/i, 'Describe how you sequenced the migration, validated parity, planned rollback and checked the outcome after cutover.'],
  ['Analytics and SQL', /analytics|\bsql\b|dashboard|reporting|business intelligence/i, 'Explain how you defined the metric, validated query results against data users trusted and checked performance or adoption.'],
  ['Technical leadership', /leadership|stakeholder|mentoring|cross.functional|roadmap/i, 'Describe competing priorities, how you communicated options and trade-offs, what you personally decided and what changed as a result.'],
];

const companyPrep = new Map([
  ['Databricks', {
    focus:'Databricks builds a data and AI platform. Review how it describes its engineering, research and customer-facing teams.',
    prepare:'Prepare an example of a data or AI workload you improved. Be ready to discuss cost, reliability, governance and the outcome for users.',
    source:'https://www.databricks.com/company/careers',
  }],
  ['GitLab', {
    focus:'GitLab builds a DevSecOps platform and publishes its hiring handbook. Review how the role fits the product and read the public hiring guidance.',
    prepare:'Prepare an example of collaborating across teams or improving delivery. Explain how you communicated decisions and measured their effect.',
    source:'https://handbook.gitlab.com/handbook/hiring/',
  }],
  ['Canonical', {
    focus:'Canonical publishes Ubuntu and develops open-source products for cloud, infrastructure and devices. Review the product area named in the vacancy.',
    prepare:'Prepare an example involving Linux, open-source software or production operations. Explain how you diagnosed an issue or made a system easier to maintain.',
    source:'https://canonical.com/careers',
  }],
]);

const mockChecks = [
  ['Personal contribution', /\bI\s+(?:led|built|designed|implemented|chose|owned|tested|analysed|analyzed|changed|decided|proposed|migrated|would)\b/i, 'Name the action you personally took or would take.'],
  ['Evidence or success measure', /\b(?:measured|reduced|increased|saved|improved|verified|validated|outcome|result|baseline|metric|p95|percent)\b|\d\s*%/i, 'Add a concrete result, baseline or success measure you can explain.'],
  ['Decision rationale', /\b(?:because|trade.off|instead|alternative|constraint|risk|versus|so that)\b/i, 'Explain why you chose that approach and what alternative you considered.'],
];

function mockFeedback(item, answer) {
  const checks = item.checks || [0,1];
  return checks.map(index=>{
    const [label, pattern, suggestion] = mockChecks[index];
    return {label, found:pattern.test(answer), suggestion};
  });
}

function roleScenario(job, focus) {
  if (/architect|consultant|solutions/i.test(job.title)) return {
    question:'How would you design a solution involving '+focus+' for this role if the customer needed a quick launch and had strict reliability requirements?',
    answer:'Clarify the workload and reliability target. Compare two designs, explain your recommendation and describe how you would validate it in a pilot.',
    checks:[1,2],
  };
  if (/lead|manager|principal|director|head of/i.test(job.title)) return {
    question:'Two teams disagree on the next '+focus+' priority. How would you decide what to deliver first as '+job.title+'?',
    answer:'Define the user outcome, compare impact and risk, explain how you would reach a decision and name a measure to revisit it.',
    checks:[0,1,2],
  };
  return {
    question:'How would you diagnose and fix a problem involving '+focus+' that starts affecting users after a release?',
    answer:'Explain what you would measure first, how you would isolate the cause, when you would roll back and how you would verify recovery.',
    checks:[1,2],
  };
}

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
        checks:[0,1,2],
        context,
        example:example?.slice(0,350),
      };
    }),
    roleScenario(job, relevant[0]?.[0].toLowerCase() || 'technical delivery'),
    {
      checks:[0],
      question:'Which responsibility for this role would you need to build more experience in?',
      answer:'Name one genuine gap. Describe relevant experience you can build on and a practical first step you would take to close it.',
    },
  ];
}

function renderCompanyPrep(job) {
  const notes=companyPrep.get(job.employer);
  return '<section class="card"><h3>Company prep · '+esc(job.employer)+'</h3>'+
    (notes?'<p>'+esc(notes.focus)+'</p><p>'+esc(notes.prepare)+'</p>'+
      '<p><a href="'+esc(notes.source)+'" target="_blank" rel="noopener noreferrer">Official company resource ↗</a></p>':
      '<p>Read the company’s careers and product pages. Identify the team’s users, the problems it solves and one product decision you can discuss.</p>')+
    '<p>For this role, connect one responsibility from the job description to a project you can explain. Ask the interviewer how the team measures success in the first six months.</p></section>';
}

function startMock(questions, panel) {
  let index=0;
  const feedback=[];
  const nextQuestion=()=>{
    const item=questions[index];
    if(!item){
      panel.innerHTML='<section class="card"><h3 tabindex="-1">Mock interview complete</h3>'+
        '<p>Review your feedback below and practise the areas you want to improve.</p>'+
        feedback.map((review,i)=>'<details><summary>Question '+(i+1)+': '+esc(questions[i].question)+'</summary>'+review+'</details>').join('')+
        '<button class="secondary" id="restart-mock">Practise again</button></section>';
      panel.querySelector('h3').focus();
      $('restart-mock').onclick=()=>startMock(questions,panel);
      return;
    }
    panel.innerHTML='<form id="mock-answer-form" class="card"><p>Question '+(index+1)+' of '+questions.length+'</p>'+
      '<h3 tabindex="-1">'+esc(item.question)+'</h3>'+
      '<label class="field">Your answer<textarea name="answer" maxlength="6000" required></textarea></label>'+
      '<button class="primary">Get feedback</button></form>';
    panel.querySelector('h3').focus();
    $('mock-answer-form').onsubmit=event=>{
      event.preventDefault();
      const answer=new FormData(event.currentTarget).get('answer').trim();
      if(!answer){event.currentTarget.elements.answer.focus();return;}
      const checks=mockFeedback(item,answer);
      const review='<p><strong>Your answer</strong></p><p>'+esc(answer)+'</p>'+
        '<ul>'+checks.map(check=>'<li><strong>'+esc(check.label)+'</strong> · '+
          (check.found?'Found a cue for this in your answer.':esc(check.suggestion))+'</li>').join('')+
        '</ul><p><strong>Answer outline</strong></p><p>'+esc(item.answer)+'</p>';
      feedback.push(review);
      panel.innerHTML='<section class="card"><h3 tabindex="-1">Practice feedback</h3>'+review+
        '<div class="actions"><button class="primary" id="next-mock">'+(index+1===questions.length?'Finish mock interview':'Next question')+
        '</button></div></section>';
      panel.querySelector('h3').focus();
      $('next-mock').onclick=()=>{index++;nextQuestion();};
    };
  };
  nextQuestion();
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
    '<div class="prep-modes" role="group" aria-label="Interview prep views">'+
    '<button class="secondary" type="button" data-prep-view="questions">Likely questions</button>'+
    '<button class="secondary" type="button" data-prep-view="mock">Mock interview</button>'+
    '<button class="secondary" type="button" data-prep-view="company">Company notes</button></div>'+
    '<div id="interview-questions" aria-live="polite"></div><div id="interview-mock" hidden></div><div id="interview-company" hidden></div>';
  const input=$('interview-description');
  input.value=description.slice(0,20000);
  const questionsPanel=$('interview-questions');
  const mockPanel=$('interview-mock');
  const companyPanel=$('interview-company');
  const panels={questions:questionsPanel,mock:mockPanel,company:companyPanel};
  const controls=content.querySelectorAll('[data-prep-view]');
  const selectView=name=>{
    for(const [key,panel] of Object.entries(panels))panel.hidden=key!==name;
    for(const control of controls)control.setAttribute('aria-pressed',String(control.dataset.prepView===name));
  };
  companyPanel.innerHTML=renderCompanyPrep(job);
  mockPanel.innerHTML='<section class="card"><h3>Mock interview</h3>'+
    '<p>Answer one question at a time and get checklist feedback on your written response. Answers are cleared when you close prep.</p>'+
    '<button class="primary" id="begin-mock">Start mock interview</button></section>';
  $('begin-mock').onclick=()=>startMock(interviewQuestions(job,profile,input.value),mockPanel);
  for(const control of controls)control.onclick=()=>selectView(control.dataset.prepView);
  const renderQuestions=()=>{
    questionsPanel.innerHTML=interviewQuestions(job,profile,input.value).map(item=>
      '<article class="card"><h3>'+esc(item.question)+'</h3>'+
      (item.context?'<p>From the job description: '+esc(item.context)+'</p>':'')+
      (item.example?'<p>From your profile: '+esc(item.example)+'</p>':'')+
      '<details><summary>Answer outline</summary><p>'+esc(item.answer)+'</p></details></article>').join('');
  };
  $('update-interview').onclick=()=>{renderQuestions();selectView('questions');};
  renderQuestions();
  selectView('questions');
});

$('interview-prep').addEventListener('close',()=>{
  if($('interview-prep').open)return;
  interviewRequest?.abort();
  $('interview-content').replaceChildren();
});
