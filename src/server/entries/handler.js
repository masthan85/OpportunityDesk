// Per-visitor record storage. The original owner keeps using the legacy `entries` table;
// everyone else reads and writes rows in `personal_entries` keyed by their visitor ID.
const entryKinds=['opportunity','template','preference','job'];

async function isOriginalOwner(env, visitor, email) {
  let owner=await env.DB.prepare('SELECT visitor FROM original_owner WHERE slot=1').first();
  if (!owner && email !== undefined) {
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(email.trim().toLowerCase()));
    const fingerprint=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    if (fingerprint==='f8b1061d55c0f19ecf5eb51a5a1652042f5c77df6b22a9cd3da5c45fdb0a27a9') {
      await env.DB.prepare('INSERT OR IGNORE INTO original_owner(slot,visitor) VALUES(1,?)').bind(visitor).run();
      owner=await env.DB.prepare('SELECT visitor FROM original_owner WHERE slot=1').first();
    }
  }
  return owner?.visitor===visitor;
}

async function readRecords(env, visitor, original) {
  const {results} = original
    ? await env.DB.prepare('SELECT id, kind, payload, revision FROM entries').all()
    : await env.DB.prepare('SELECT id,kind,payload,revision FROM personal_entries WHERE visitor=?').bind(visitor).all();
  return results.map(row => ({id:row.id, kind:row.kind, revision:row.revision, data:JSON.parse(row.payload)}));
}

function invalidEntry(entry) {
  const {id,kind,revision,data} = entry ?? {};
  return typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,70}$/.test(id) ||
    !entryKinds.includes(kind) || !Number.isInteger(revision) || revision<0 ||
    !data || typeof data.title !== 'string' || !data.title.trim();
}

// Inserts at revision 0 or updates the stored revision. Returns the saved record, or null on a stale revision.
async function writeRecord(env, visitor, original, {id,kind,revision,data}) {
  const payload=JSON.stringify(data);
  const result = !original ? (revision===0
    ? await env.DB.prepare("INSERT OR IGNORE INTO personal_entries(visitor,id,kind,payload) VALUES(?,?,?,?)").bind(visitor,id,kind,payload).run()
    : await env.DB.prepare("UPDATE personal_entries SET payload=?,revision=revision+1 WHERE visitor=? AND id=? AND kind=? AND revision=?").bind(payload,visitor,id,kind,revision).run()) : revision===0
    ? await env.DB.prepare('INSERT OR IGNORE INTO entries (id,kind,payload) VALUES (?,?,?)').bind(id,kind,payload).run()
    : await env.DB.prepare('UPDATE entries SET payload=?,revision=revision+1 WHERE id=? AND kind=? AND revision=?').bind(payload,id,kind,revision).run();
  return result.meta.changes ? {id,kind,revision:revision+1,data} : null;
}

async function handleEntries(request, env, visitor, origin) {
  if (!visitor) return json({error:'Sign in required'},401);
  try {
    const original=await isOriginalOwner(env, visitor, request.headers.get('oai-authenticated-user-email')||'');
    if (request.method === 'GET') {
      return json({countryHint:request.cf?.country||null,ownerDefault:original?ownerRecord:null,saved:await readRecords(env, visitor, original)});
    }
    if (request.method !== 'PUT') return json({error:'Method unavailable'},405);
    if (!sameOriginJson(request, origin)) return json({error:'Invalid request origin or content type'},403);
    const body = await request.text();
    if (body.length > 85000) return json({error:'Entry is too long'},413);
    let entry;
    try {entry=JSON.parse(body)} catch {return json({error:'Invalid JSON'},400)}
    if (invalidEntry(entry)) return json({error:'Invalid entry'},400);
    const saved=await writeRecord(env, visitor, original, entry);
    if (!saved) return json({error:'This record has changed. Close and reopen it to try again.'},409);
    return json(saved);
  } catch (error) {
    console.error(error);
    return json({error:'Workspace storage is temporarily unavailable.'},503);
  }
}

function sameOriginJson(request, origin) {
  return request.headers.get('Origin') === origin &&
    request.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase() === 'application/json';
}
