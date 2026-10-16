const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const handler=require('../api/state');
const originalFetch=global.fetch;
Object.assign(process.env,{GITHUB_TOKEN:'server-secret',EDIT_PASSWORD:'editor',GITHUB_REPO:'owner/repo',GITHUB_BRANCH:'main'});
const empty=()=>({events:[],anns:[],folders:[],docs:[],courses:[],albums:[],cls:{}});
let shared={...empty(),docs:[{id:'shared',name:'Remote.pdf'}],updatedAt:1},sha='v1';
global.fetch=async(url,options)=>{
 if(url.includes('/data/logs/'))return {ok:true,status:201,json:async()=>({})};
 if(options.method==='PUT'){const b=JSON.parse(options.body);if(b.sha!==sha)return {ok:false,status:409,json:async()=>({})};shared=JSON.parse(Buffer.from(b.content,'base64'));sha='v'+(Number(sha.slice(1))+1);return {ok:true,status:200,json:async()=>({content:{sha},commit:{sha:'commit'}})};}
 return {ok:true,status:200,json:async()=>({content:Buffer.from(JSON.stringify(shared)).toString('base64'),sha})};
};
async function api(method='GET',body,authorized=false){const res={setHeader(){},status(c){this.code=c;return this},json(data){this.data=data;return this}};await handler({method,body,headers:authorized?{'x-edit-password':'editor'}:{}},res);return res;}
function app(storage=new Map()){
 let js=fs.readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];js=js.replace('init();','globalThis.test={S,G,syncState,syncShared,persistState,recoveryPlan};');
 const ctx={console,TextEncoder,URL,crypto:require('node:crypto').webcrypto,window:{},document:{addEventListener(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},requestAnimationFrame:()=>1,cancelAnimationFrame(){},setTimeout,clearTimeout,fetch:async(url,options={})=>{assert.equal(url,'/api/state');const r=await api(options.method||'GET',options.body?JSON.parse(options.body):undefined,!!options.headers?.['X-Edit-Password']);return {ok:r.code<300,status:r.code,json:async()=>r.data}}};
 vm.createContext(ctx);vm.runInContext(js,ctx);return {ctx,t:ctx.test,storage};
}
(async()=>{
 assert.equal((await api('PUT',{state:shared,revision:sha})).code,401);
 const legacy={...empty(),docs:[{id:'local-only',name:'Local.pdf'}],updatedAt:Date.now()+864000000};
 const first=app(new Map([['solop-static-v1',JSON.stringify(legacy)]])),second=app();
 await first.t.syncShared();await second.t.syncShared();
 assert.equal(first.t.S.docs[0].id,'shared'); // Server wins even when browser's clock is far ahead.
 assert(first.storage.has('solop.recoveryState'));
 const plan=first.t.recoveryPlan();assert.equal(plan.added.length,1);assert.equal(plan.state.docs.length,2);
 first.t.G.token='editor';first.t.S.docs.push({id:'new',name:'New.pdf'});await first.t.persistState();
 assert.equal(JSON.parse(first.storage.get('solop.pendingState')),null);
 second.t.G.token='editor';second.t.S.docs.push({id:'stale',name:'Stale.pdf'});
 await assert.rejects(second.t.persistState(),/Máy khác/);assert.equal(shared.docs.length,2);assert(second.t.syncState.error);assert(JSON.parse(second.storage.get('solop.pendingState')));
 await second.t.syncShared();assert.equal(second.t.S.docs.length,2);assert(second.t.recoveryPlan().state.docs.some(d=>d.id==='stale'));
 const third=app();await third.t.syncShared();assert(third.t.S.docs.some(d=>d.id==='new'));
 first.ctx.fetch=async()=>{throw Error('offline')};first.t.S.docs.push({id:'offline'});await assert.rejects(first.t.persistState(),/offline/);assert(JSON.parse(first.storage.get('solop.pendingState')).state.docs.some(d=>d.id==='offline'));
 console.log('PASS: public canonical reads, server time/revision, stale-clock cache replacement, legacy recovery, cross-device updates, concurrent-write rejection and offline pending preservation.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{global.fetch=originalFetch});
