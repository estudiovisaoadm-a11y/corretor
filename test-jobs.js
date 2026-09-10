const test = require('node:test');
const assert = require('node:assert/strict');
const { PersistentQueue } = require('./src/jobs/queue');

function fakeStore() {
  const jobs = [];
  return {
    jobs,
    jobEnqueue(j) { const x={...j,state:'queued',attempts:0,createdAt:new Date().toISOString()}; jobs.push(x); return x; },
    jobRecover(cutoff) { let n=0; for(const j of jobs) if(j.state==='running'&&j.lockedAt<cutoff){j.state='queued';n++;} return n; },
    jobClaim(now) { const j=jobs.find(x=>x.state==='queued'); if(!j)return null; j.state='running';j.attempts++;j.lockedAt=now;return {...j}; },
    jobComplete(id,result){const j=jobs.find(x=>x.id===id);j.state='completed';j.result=result;return j;},
    jobFail(id,error,terminal){const j=jobs.find(x=>x.id===id);j.state=terminal?'failed':'queued';j.error=error;return j;},
    jobList(){return jobs;}, jobRetry(id){const j=jobs.find(x=>x.id===id);if(j)j.state='queued';return j||null;}
  };
}

test('fila executa tarefa e persiste conclusão', async () => {
  const store=fakeStore(); const q=new PersistentQueue(store); q.register('x', async p=>({ok:p.value}));
  const j=await q.enqueue('x',{value:7}); const out=await q.processOne();
  assert.equal(out.state,'completed'); assert.deepEqual(store.jobs[0].result,{ok:7}); assert.equal(j.attempts,1);
});
test('fila recupera execução abandonada após reinício', async () => {
  const store=fakeStore(); const q=new PersistentQueue(store,{leaseMs:10});
  const j=await q.enqueue('x',{}, {allowUnregistered:true}); j.state='running';j.lockedAt=new Date(Date.now()-1000).toISOString();
  assert.equal(await q.recover(),1); assert.equal(store.jobs[0].state,'queued');
});
test('fila retenta e falha após limite', async () => {
  const store=fakeStore(); let n=0; const q=new PersistentQueue(store,{maxAttempts:2}); q.register('x',async()=>{n++;throw new Error('falhou');});
  await q.enqueue('x'); await q.processOne(); assert.equal(store.jobs[0].state,'queued'); await q.processOne(); assert.equal(store.jobs[0].state,'failed'); assert.equal(n,2);
});
