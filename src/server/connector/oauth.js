// OAuth 2.1 authorisation server for AI connectors (Claude, ChatGPT and other MCP clients).
// Clients register themselves (RFC 7591), the visitor signs in with the site's existing
// ChatGPT sign-in and approves access, and the client receives tokens bound to that visitor.
// Only SHA-256 hashes of codes and tokens are stored.
const accessTokenSeconds=3600, refreshTokenSeconds=30*24*3600, codeSeconds=300;
const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':'Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id',
  'Access-Control-Expose-Headers':'WWW-Authenticate, Mcp-Session-Id',
};
const corsJson=(body,status=200,extra={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...corsHeaders,...extra}});
const nowSeconds=()=>Math.floor(Date.now()/1000);
const base64url=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const randomToken=()=>base64url(crypto.getRandomValues(new Uint8Array(32)));
const sha256=async text=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));
const hashHex=async text=>Array.from(await sha256(text),b=>b.toString(16).padStart(2,'0')).join('');
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function protectedResourceMetadata(origin){
  return corsJson({resource:origin+'/mcp',authorization_servers:[origin],scopes_supported:['workspace'],bearer_methods_supported:['header'],resource_name:'Opportunity Desk'});
}

function authorizationServerMetadata(origin){
  return corsJson({
    issuer:origin,
    authorization_endpoint:origin+'/oauth/authorize',
    token_endpoint:origin+'/oauth/token',
    registration_endpoint:origin+'/oauth/register',
    response_types_supported:['code'],
    grant_types_supported:['authorization_code','refresh_token'],
    code_challenge_methods_supported:['S256'],
    token_endpoint_auth_methods_supported:['none'],
    scopes_supported:['workspace'],
  });
}

function validRedirectUri(value){
  if(typeof value!=='string'||value.length>500)return false;
  try{
    const url=new URL(value);
    if(url.hash)return false;
    return url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname));
  }catch{return false}
}

async function registerClient(request, env){
  let body;
  try{body=await request.json()}catch{return corsJson({error:'invalid_client_metadata',error_description:'Send client metadata as JSON.'},400)}
  const uris=body?.redirect_uris;
  if(!Array.isArray(uris)||!uris.length||uris.length>5||!uris.every(validRedirectUri))
    return corsJson({error:'invalid_redirect_uri',error_description:'Provide one to five https redirect URIs.'},400);
  const method=body.token_endpoint_auth_method??'none';
  if(method!=='none')return corsJson({error:'invalid_client_metadata',error_description:'Only public clients using PKCE are supported.'},400);
  const name=(typeof body.client_name==='string'&&body.client_name.trim()?body.client_name.trim():'An AI app').slice(0,100);
  const id='odc_'+randomToken();
  const created=nowSeconds();
  await env.DB.prepare('INSERT INTO oauth_clients(id,name,redirect_uris,created) VALUES(?,?,?,?)').bind(id,name,JSON.stringify(uris),created).run();
  return corsJson({client_id:id,client_id_issued_at:created,client_name:name,redirect_uris:uris,
    grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:'none'},201);
}

// Checks the parameters that decide where the browser may be sent. Until these pass,
// errors are shown on the page rather than redirected, so an unregistered URI is never used.
async function authorisationRequest(env, params){
  const client=await env.DB.prepare('SELECT id,name,redirect_uris FROM oauth_clients WHERE id=?').bind(params.get('client_id')||'').first();
  if(!client)return {fatal:'This AI app is not registered. Remove the connector and add it again.'};
  const redirectUri=params.get('redirect_uri')||'';
  if(!JSON.parse(client.redirect_uris).includes(redirectUri))return {fatal:'The return address does not match this AI app’s registration.'};
  const request={client,redirectUri,state:params.get('state'),challenge:params.get('code_challenge')||''};
  if(params.get('response_type')!=='code')return {...request,error:'unsupported_response_type'};
  if(params.get('code_challenge_method')!=='S256'||!/^[A-Za-z0-9_-]{43}$/.test(request.challenge))return {...request,error:'invalid_request'};
  return request;
}

function redirectWith(redirectUri, values){
  const url=new URL(redirectUri);
  for(const [key,value] of Object.entries(values))if(value!=null)url.searchParams.set(key,value);
  return new Response(null,{status:302,headers:{Location:url.href,'Cache-Control':'no-store'}});
}

function consentPage(title, body, status=200){
  return new Response(`<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · Opportunity Desk</title><link rel="stylesheet" href="/style.css"></head><body><main id="view"><section class="panel card consent"><div class="eyebrow">OPPORTUNITY DESK</div><h1>${escapeHtml(title)}</h1>${body}</section></main></body></html>`,
    {status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'DENY','Content-Security-Policy':"frame-ancestors 'none'",'Referrer-Policy':'same-origin'}});
}

async function authorize(request, env, visitor, url){
  if(request.method==='GET'){
    const auth=await authorisationRequest(env, url.searchParams);
    if(auth.fatal)return consentPage('Connection failed','<p>'+escapeHtml(auth.fatal)+'</p>',400);
    if(auth.error)return redirectWith(auth.redirectUri,{error:auth.error,state:auth.state});
    if(!visitor)return new Response(null,{status:302,headers:{Location:'/signin-with-chatgpt?return_to='+encodeURIComponent(url.pathname+url.search),'Cache-Control':'no-store'}});
    const hidden=['client_id','redirect_uri','state','code_challenge','code_challenge_method','response_type']
      .map(name=>url.searchParams.has(name)?`<input type="hidden" name="${name}" value="${escapeHtml(url.searchParams.get(name))}">`:'').join('');
    return consentPage('Connect '+auth.client.name,
      `<p><strong>${escapeHtml(auth.client.name)}</strong> wants to use your Opportunity Desk workspace.</p>
<p>It will be able to read your career profile, tracked opportunities and job applications, and update them when you ask it to. It cannot see other people’s workspaces.</p>
<p class="result-count">After you approve, you return to ${escapeHtml(new URL(auth.redirectUri).host)}. You can disconnect from Career profile at any time.</p>
<form method="post" action="/oauth/authorize" class="actions">${hidden}<button class="primary" name="decision" value="allow">Allow access</button><button class="secondary" name="decision" value="deny">Cancel</button></form>`);
  }
  if(request.method!=='POST')return new Response('Method unavailable',{status:405});
  if(!visitor)return consentPage('Sign in required','<p>Sign in with ChatGPT and try connecting again.</p>',401);
  if(request.headers.get('Origin')!==url.origin)return consentPage('Connection failed','<p>This approval did not come from Opportunity Desk.</p>',403);
  const form=new URLSearchParams(await request.text());
  const auth=await authorisationRequest(env, form);
  if(auth.fatal)return consentPage('Connection failed','<p>'+escapeHtml(auth.fatal)+'</p>',400);
  if(auth.error)return redirectWith(auth.redirectUri,{error:auth.error,state:auth.state});
  if(form.get('decision')!=='allow')return redirectWith(auth.redirectUri,{error:'access_denied',state:auth.state});
  const code=randomToken();
  await env.DB.prepare('INSERT INTO oauth_codes(hash,client_id,visitor,redirect_uri,challenge,expires) VALUES(?,?,?,?,?,?)')
    .bind(await hashHex(code),auth.client.id,visitor,auth.redirectUri,auth.challenge,nowSeconds()+codeSeconds).run();
  return redirectWith(auth.redirectUri,{code,state:auth.state,iss:url.origin});
}

async function issueTokens(env, clientId, visitor){
  const now=nowSeconds(), access=randomToken(), refresh=randomToken();
  await env.DB.prepare('DELETE FROM oauth_tokens WHERE expires<?').bind(now).run();
  await env.DB.prepare('DELETE FROM oauth_codes WHERE expires<?').bind(now).run();
  const insert='INSERT INTO oauth_tokens(hash,kind,client_id,visitor,expires) VALUES(?,?,?,?,?)';
  await env.DB.prepare(insert).bind(await hashHex(access),'access',clientId,visitor,now+accessTokenSeconds).run();
  await env.DB.prepare(insert).bind(await hashHex(refresh),'refresh',clientId,visitor,now+refreshTokenSeconds).run();
  return corsJson({access_token:access,token_type:'Bearer',expires_in:accessTokenSeconds,refresh_token:refresh,scope:'workspace'});
}

async function token(request, env){
  const form=new URLSearchParams(await request.text());
  const grantError=description=>corsJson({error:'invalid_grant',error_description:description},400);
  const clientId=form.get('client_id')||'';
  if(form.get('grant_type')==='authorization_code'){
    // DELETE ... RETURNING makes each code single-use even under concurrent requests.
    const row=await env.DB.prepare('DELETE FROM oauth_codes WHERE hash=? RETURNING client_id,visitor,redirect_uri,challenge,expires')
      .bind(await hashHex(form.get('code')||'')).first();
    if(!row||row.expires<nowSeconds())return grantError('The authorisation code is invalid or has expired.');
    if(row.client_id!==clientId||row.redirect_uri!==form.get('redirect_uri'))return grantError('The code was issued to a different client.');
    const verifier=form.get('code_verifier')||'';
    if(!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)||base64url(await sha256(verifier))!==row.challenge)return grantError('PKCE verification failed.');
    return issueTokens(env,row.client_id,row.visitor);
  }
  if(form.get('grant_type')==='refresh_token'){
    const row=await env.DB.prepare("DELETE FROM oauth_tokens WHERE hash=? AND kind='refresh' RETURNING client_id,visitor,expires")
      .bind(await hashHex(form.get('refresh_token')||'')).first();
    if(!row||row.expires<nowSeconds()||row.client_id!==clientId)return grantError('The refresh token is invalid or has expired.');
    return issueTokens(env,row.client_id,row.visitor);
  }
  return corsJson({error:'unsupported_grant_type'},400);
}

// Returns the visitor a bearer token belongs to, or null.
async function connectorVisitor(request, env){
  const match=/^Bearer\s+([A-Za-z0-9_-]{20,200})$/i.exec(request.headers.get('Authorization')||'');
  if(!match)return null;
  const row=await env.DB.prepare("SELECT visitor,expires FROM oauth_tokens WHERE hash=? AND kind='access'").bind(await hashHex(match[1])).first();
  return row&&row.expires>=nowSeconds()?row.visitor:null;
}

function connectorUnauthorised(origin){
  return corsJson({error:'invalid_token',error_description:'Connect Opportunity Desk again to continue.'},401,
    {'WWW-Authenticate':`Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource", scope="workspace"`});
}

// Lists and revokes the AI apps connected to the signed-in visitor's workspace.
async function handleConnections(request, env, visitor, origin){
  if(!visitor)return json({error:'Sign in required'},401);
  if(request.method==='GET'){
    const {results}=await env.DB.prepare("SELECT DISTINCT c.name FROM oauth_tokens t JOIN oauth_clients c ON c.id=t.client_id WHERE t.visitor=? AND t.kind='refresh' AND t.expires>=? ORDER BY c.name")
      .bind(visitor,nowSeconds()).all();
    return json({apps:results.map(row=>row.name)});
  }
  if(request.method!=='DELETE')return json({error:'Method unavailable'},405);
  if(!sameOriginJson(request, origin))return json({error:'Invalid request origin or content type'},403);
  await env.DB.prepare('DELETE FROM oauth_tokens WHERE visitor=?').bind(visitor).run();
  await env.DB.prepare('DELETE FROM oauth_codes WHERE visitor=?').bind(visitor).run();
  return json({apps:[]});
}
