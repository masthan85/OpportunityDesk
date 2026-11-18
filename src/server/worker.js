const assetTypes = {'/':'text/html','/style.css':'text/css','/workspace.js':'text/javascript'};
const json = (body, status = 200) => Response.json(body, {status, headers:{'Cache-Control':'no-store'}});
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const visitor=request.headers.get('oai-authenticated-user-id');
    if (!visitor && url.pathname==='/') return new Response(assets['/sign-in.html'],{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store'}});
    if (Object.hasOwn(assetTypes, url.pathname)) {
      return new Response(assets[url.pathname], {headers:{'Cache-Control':'private, no-store','Content-Type': assetTypes[url.pathname]+'; charset=utf-8'}});
    }
    if(url.pathname==='/api/jobs')return !visitor?json({error:'Sign in required'},401):request.method==='GET'?employerJobs():json({error:'Method unavailable'},405);
    if (url.pathname !== '/api/entries') return new Response('Not found', {status:404});
    return handleEntries(request, env, visitor, url.origin);
  }
};
