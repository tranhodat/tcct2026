const assert=require('node:assert/strict');
const reports=require('../api/reports'),logs=require('../api/logs');
const original=global.fetch;
Object.assign(process.env,{GITHUB_TOKEN:'secret-server',GITHUB_REPO:'owner/repo',GITHUB_BRANCH:'main',EDIT_PASSWORD:'editor'});
const files=new Map();let version=0,conflictOnce=false;
global.fetch=async(url,options={})=>{
 const path=decodeURIComponent(new URL(url).pathname.split('/contents/')[1]);
 if(options.method==='DELETE'){
  const body=JSON.parse(options.body),current=files.get(path);
  if(!current||body.sha!==current.sha)return {ok:false,status:409,json:async()=>({})};
  files.delete(path);return {ok:true,status:200,json:async()=>({})};
 }
 if(options.method==='PUT'){
  const body=JSON.parse(options.body);
  if(conflictOnce&&path.includes('report-submissions')){conflictOnce=false;return {ok:false,status:409,json:async()=>({})};}
  const current=files.get(path);
  if((current&&body.sha!==current.sha)||(!current&&body.sha))return {ok:false,status:409,json:async()=>({})};
  const value={sha:String(++version),content:body.content,download_url:'https://example.com/'+path};files.set(path,value);
  return {ok:true,status:201,json:async()=>({content:{path,...value},commit:{sha:'commit'}})};
 }
 if(path.startsWith('data/logs/')&&!path.endsWith('.json'))return {ok:true,status:200,json:async()=>[...files.keys()].filter(p=>p.startsWith(path+'/')).map(p=>({name:p.split('/').pop(),type:'file'}))};
 const value=files.get(path);return {ok:!!value,status:value?200:404,json:async()=>value||{}};
};
async function call(handler,method,body={},query={},headers={}){
 const res={headers:{},setHeader(k,v){this.headers[k]=v},status(c){this.code=c;return this},json(data){this.data=data;return this}};
 await handler({method,body,query,headers},res);return res;
}
(async()=>{
 const config={action:'create',title:'Weekly report',description:'Upload files',opensAt:new Date(Date.now()-60000).toISOString(),closesAt:new Date(Date.now()+3600000).toISOString()};
 assert.equal((await call(reports,'POST',config)).code,401);
 assert.equal((await call(reports,'POST',{...config,closesAt:config.opensAt},{},{'x-edit-password':'editor'})).code,400);
 const created=await call(reports,'POST',config,{},{'x-edit-password':'editor'});assert.equal(created.code,201);
 const roundId=created.data.round.id;
 const submission={action:'submit',roundId,submissionId:'submission-1',name:'Reader',studentId:'SV01',file:{name:'report.docx',content:Buffer.from('document').toString('base64')}};
 conflictOnce=true;
 assert.equal((await call(reports,'POST',submission)).code,201);
 assert.equal((await call(reports,'POST',submission)).code,201); // Retry does not duplicate file.
 assert.equal((await call(reports,'POST',{...submission,file:{name:'data.csv',content:Buffer.from('a,b').toString('base64')}})).code,201);
 const list=await call(reports,'GET',{}, {roundId});assert.equal(list.data.submissions.length,1);assert.equal(list.data.submissions[0].files.length,2);
 assert.equal((await call(reports,'POST',{...submission,file:{name:'script.exe',content:'YQ=='}})).code,400);
 assert.equal((await call(reports,'POST',{...submission,file:{name:'a.pdf',content:'A'.repeat(4*1024*1024+4)}})).code,400);
 assert.equal((await call(reports,'POST',{...config,action:'edit',id:roundId,opensAt:new Date(Date.now()-120000).toISOString(),closesAt:new Date(Date.now()-60000).toISOString()},{},{'x-edit-password':'editor'})).code,201);
 assert.equal((await call(reports,'POST',submission)).code,403);
 assert.equal((await call(logs,'GET')).code,401);
 const journal=await call(logs,'GET',{}, {},{'x-edit-password':'editor'});assert.equal(journal.code,200);assert(journal.data.events.some(e=>e.action==='report.round.create'));assert(journal.data.events.some(e=>e.action==='report.file.submit'));
 assert(!JSON.stringify(journal.data).includes('secret-server'));
 assert.equal((await call(logs,'GET',{}, {date:'../secret'},{'x-edit-password':'editor'})).code,400);
 const file=list.data.submissions[0].files[0];
 const deletion={action:'deleteFile',roundId,submissionId:'submission-1',fileId:file.id};
 assert.equal((await call(reports,'POST',deletion)).code,401);
 assert.equal((await call(reports,'POST',{...deletion,fileId:'../bad'},{},{'x-edit-password':'editor'})).code,400);
 assert.equal((await call(reports,'POST',deletion,{},{'x-edit-password':'editor'})).code,200);
 assert(!files.has(file.path));
 assert.equal((await call(reports,'GET',{}, {roundId})).data.submissions[0].files.length,1);
 assert.equal((await call(reports,'POST',{action:'deleteRound',roundId})).code,401);
 assert.equal((await call(reports,'POST',{action:'deleteRound',roundId},{},{'x-edit-password':'editor'})).code,200);
 const deleted=await call(reports,'GET',{}, {roundId});assert.equal(deleted.data.rounds.length,0);assert.equal(deleted.data.submissions.length,0);
 assert(![...files.keys()].some(p=>p.startsWith('uploads/bao-cao/'+roundId+'/')));
 console.log('PASS: round permissions/times, public multi-file reports, idempotent retry, SHA conflict, file validation, deadline enforcement, persistent audit and protected log access.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{global.fetch=original});
