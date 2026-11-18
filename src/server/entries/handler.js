async function handleEntries(request, env, visitor, origin) {
  if (!visitor) return json({error:'Sign in required'},401);
  try {
    let owner=await env.DB.prepare('SELECT visitor FROM original_owner WHERE slot=1').first();
    if (!owner) {
      const email=(request.headers.get('oai-authenticated-user-email')||'').trim().toLowerCase();
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(email));
      const fingerprint=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
      if (fingerprint==='f8b1061d55c0f19ecf5eb51a5a1652042f5c77df6b22a9cd3da5c45fdb0a27a9') {
        await env.DB.prepare('INSERT OR IGNORE INTO original_owner(slot,visitor) VALUES(1,?)').bind(visitor).run();
        owner=await env.DB.prepare('SELECT visitor FROM original_owner WHERE slot=1').first();
      }
    }
    const original=owner?.visitor===visitor;
    if (request.method === 'GET') {
      const {results} = original ? await env.DB.prepare('SELECT id, kind, payload, revision FROM entries').all() : await env.DB.prepare('SELECT id,kind,payload,revision FROM personal_entries WHERE visitor=?').bind(visitor).all();
      return json({countryHint:request.cf?.country||null,ownerDefault:original?ownerRecord:null,saved:results.map(row => ({id:row.id, kind:row.kind, revision:row.revision, data:JSON.parse(row.payload)}))});
    }
    if (request.method !== 'PUT') return json({error:'Method unavailable'},405);
    if (request.headers.get('Origin') !== origin || request.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
      return json({error:'Invalid request origin or content type'},403);
    }
    const body = await request.text();
    if (body.length > 85000) return json({error:'Entry is too long'},413);
    let entry;
    try {entry=JSON.parse(body)} catch {return json({error:'Invalid JSON'},400)}
    const {id,kind,revision,data} = entry ?? {};
    if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,70}$/.test(id) ||
        !['opportunity','template','preference','job'].includes(kind) || !Number.isInteger(revision) || revision<0 ||
        !data || typeof data.title !== 'string' || !data.title.trim()) return json({error:'Invalid entry'},400);
    const payload=JSON.stringify(data);
    const result = !original ? (revision===0
      ? await env.DB.prepare("INSERT OR IGNORE INTO personal_entries(visitor,id,kind,payload) VALUES(?,?,?,?)").bind(visitor,id,kind,payload).run()
      : await env.DB.prepare("UPDATE personal_entries SET payload=?,revision=revision+1 WHERE visitor=? AND id=? AND kind=? AND revision=?").bind(payload,visitor,id,kind,revision).run()) : revision===0
      ? await env.DB.prepare('INSERT OR IGNORE INTO entries (id,kind,payload) VALUES (?,?,?)').bind(id,kind,payload).run()
      : await env.DB.prepare('UPDATE entries SET payload=?,revision=revision+1 WHERE id=? AND kind=? AND revision=?').bind(payload,id,kind,revision).run();
    if (!result.meta.changes) return json({error:'This record has changed. Close and reopen it to try again.'},409);
    return json({id,kind,revision:revision+1,data});
  } catch (error) {
    console.error(error);
    return json({error:'Workspace storage is temporarily unavailable.'},503);
  }
}
