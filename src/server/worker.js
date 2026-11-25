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
    // AI connector: OAuth discovery, registration and tokens, then MCP tools. These callers are
    // Claude, ChatGPT and other MCP clients, so they authenticate with bearer tokens, not Sites headers.
    const connectorPaths=['/mcp','/oauth/register','/oauth/token'];
    if (request.method==='OPTIONS' && (connectorPaths.includes(url.pathname) || url.pathname.startsWith('/.well-known/'))) {
      return new Response(null,{status:204,headers:corsHeaders});
    }
    try {
      if (url.pathname.startsWith('/.well-known/oauth-protected-resource')) return await protectedResourceMetadata(url.origin);
      if (url.pathname.startsWith('/.well-known/oauth-authorization-server')) return await authorizationServerMetadata(url.origin);
      if (url.pathname==='/mcp') return await handleMcp(request, env, url.origin);
      if (url.pathname==='/oauth/register') return await (request.method==='POST'?registerClient(request, env):corsJson({error:'Use POST'},405));
      if (url.pathname==='/oauth/token') return await (request.method==='POST'?token(request, env):corsJson({error:'Use POST'},405));
      if (url.pathname==='/oauth/authorize') return await authorize(request, env, visitor, url);
      if (url.pathname==='/api/connections') return await handleConnections(request, env, visitor, url.origin);
    } catch (error) {
      console.error(error);
      return corsJson({error:'temporarily_unavailable'},503);
    }
    if(url.pathname==='/api/jobs')return !visitor?json({error:'Sign in required'},401):request.method==='GET'?employerJobs():json({error:'Method unavailable'},405);
    if (url.pathname.startsWith('/api/jobs/')) {
      if (!visitor) return json({error:'Sign in required'},401);
      if (request.method !== 'GET') return json({error:'Method unavailable'},405);
      return employerJobDescription(url.pathname);
    }
    if (url.pathname !== '/api/entries') return new Response('Not found', {status:404});
    return handleEntries(request, env, visitor, url.origin);
  }
};
