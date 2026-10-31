// Contract tests use an isolated fake Supabase HTTP service, never the live DB.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const ideaId = '11111111-1111-4111-8111-111111111111';
const ideas = [];
const votes = new Set();
let failReads = false;
const upstream = createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  const params = body ? JSON.parse(body) : {};
  res.setHeader('Content-Type', 'application/json');
  if (req.url.startsWith('/rest/v1/rpc/list_ideas')) {
    res.statusCode = failReads ? 503 : 200;
    res.end(JSON.stringify(failReads ? { message: 'internal database detail' } : ideas.map(i => ({ ...i, vote_count: votes.size }))));
  } else if (req.url === '/rest/v1/rpc/submit_idea') {
    assert.equal(params.p_title, 'Test idea');
    assert.equal(params.p_author_nickname, 'Tester');
    ideas.push({ id: ideaId, title: params.p_title, description: params.p_description, author_nickname: params.p_author_nickname, created_at: new Date().toISOString() });
    res.end(JSON.stringify(ideaId));
  } else if (req.url === '/rest/v1/rpc/cast_vote') {
    if (params.p_idea_id !== ideaId) {
      res.statusCode = 409;
      res.end(JSON.stringify({ code: '23503' }));
    } else {
      const duplicate = votes.has(params.p_voter_id);
      votes.add(params.p_voter_id);
      res.end(JSON.stringify(!duplicate));
    }
  } else { res.statusCode = 404; res.end('{}'); }
});
await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:3102';
let logs = '';
const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3102', '-H', '127.0.0.1'], {
  env: { ...process.env, SUPABASE_URL: `http://127.0.0.1:${upstream.address().port}`, SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_fixture', NODE_USE_ENV_PROXY: '0' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
app.stdout.on('data', chunk => { logs += chunk; });
app.stderr.on('data', chunk => { logs += chunk; });
let cookie = '';
async function request(path, body, origin = base) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  return { response, data: await response.json() };
}
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    if (app.exitCode !== null) throw new Error(logs);
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch {}
    await delay(100);
  }
  assert.ok(ready, logs);
  const page = await (await fetch(base)).text();
  assert.ok(page.includes('Share an idea') && page.includes('Community ideas'));
  const empty = await request('/api/ideas');
  assert.equal(empty.response.status, 200);
  assert.deepEqual(empty.data.ideas, []);
  assert.match(empty.response.headers.get('set-cookie'), /HttpOnly/i);
  const valid = { title: ' Test idea ', description: 'A useful description', author_nickname: ' Tester ' };
  assert.equal((await request('/api/ideas', { ...valid, title: ' ' })).response.status, 400);
  assert.equal((await request('/api/ideas', { ...valid, title: 'x'.repeat(121) })).response.status, 400);
  assert.equal((await request('/api/ideas', valid, 'https://other.example')).response.status, 403);
  assert.equal((await request('/api/ideas', valid)).response.status, 201);
  assert.equal((await request('/api/ideas')).data.ideas[0].author_nickname, 'Tester');
  assert.equal((await request(`/api/ideas/${ideaId}/vote`, {}, 'https://other.example')).response.status, 403);
  assert.equal((await request('/api/ideas/not-a-uuid/vote', {})).response.status, 400);
  assert.equal((await request('/api/ideas/22222222-2222-4222-8222-222222222222/vote', {})).response.status, 404);
  assert.equal((await request(`/api/ideas/${ideaId}/vote`, {})).data.duplicate, false);
  assert.equal((await request(`/api/ideas/${ideaId}/vote`, {})).data.duplicate, true);
  assert.equal((await request('/api/ideas')).data.ideas[0].vote_count, 1);
  failReads = true;
  const failed = await request('/api/ideas');
  assert.equal(failed.response.status, 503);
  assert.ok(!JSON.stringify(failed.data).includes('internal database detail'));
  console.log('PASS: page rendering, empty/list states, submission, validation, origin checks, voter cookie, duplicate vote, missing idea, vote count, and safe database errors. No live data written.');
} finally {
  app.kill('SIGTERM');
  await new Promise(resolve => upstream.close(resolve));
}
