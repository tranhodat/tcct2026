const assert=require('node:assert/strict');
const handler=require('../api/comments.js');
process.env.GITHUB_TOKEN='server-secret';process.env.GITHUB_REPO='owner/repo';process.env.GITHUB_BRANCH='main';
const original=global.fetch;
const prior={id:'prior',name:'A',text:'Existing',createdAt:1};
let stored=[prior],calls=[],conflict=false;
global.fetch=async(url,options)=>{
 calls.push({url,options});
 if(url.includes("/data/logs/"))return {ok:true,status:201,json:async()=>({})};
 if(options.method==='PUT'){
  if(conflict){conflict=false;stored.push({id:'concurrent',name:'B',text:'Another comment'});return {ok:false,status:409};}
  const body=JSON.parse(options.body);assert.equal(body.branch,'main');
  stored=JSON.parse(Buffer.from(body.content,'base64'));return {ok:true,status:201};
 }
 return {ok:true,status:200,json:async()=>({sha:'latest',content:Buffer.from(JSON.stringify(stored)).toString('base64')})};
};
async function request(method='GET',body,headers={}){
 const res={setHeader(){},status(code){this.code=code;return this},json(data){this.data=data;return this}};
 await handler({method,body,headers},res);return res;
}
(async()=>{
 assert.equal((await request()).data.comments[0].text,'Existing');
 assert.equal((await request('DELETE')).code,405);
 assert.equal((await request('POST',{name:'',text:'x'})).code,400);
 assert.equal((await request('POST',{name:'A',text:'x'.repeat(20001)})).code,400);
 assert.equal((await request('POST',{name:'A',text:'x'},{origin:'https://other.example',host:'app.example'})).code,403);
 conflict=true;
 const result=await request('POST',{name:'Reader',text:'Public feedback',comments:[],branch:'other',path:'index.html'});
 assert.equal(result.code,201);assert.equal(stored.length,3);assert(stored.some(c=>c.id==='concurrent'));assert.equal(stored.at(-1).text,'Public feedback');
 assert(!JSON.stringify(result.data).includes('server-secret'));
 assert.equal((await request('POST',{name:'Reader',text:'x'.repeat(20000)})).code,201);
 const id=result.data.comment.id,voterId='test-device-123456789';
 assert.equal((await request('POST',{action:'delete',id})).code,403);
 assert.equal((await request('POST',{action:'vote',id,voterId,voted:true})).data.comment.votes,1);
 assert.equal((await request('POST',{action:'vote',id,voterId,voted:true})).data.comment.votes,1);
 assert.equal((await request('POST',{action:'vote',id,voterId:'second-device-123456789',voted:true})).data.comment.votes,2);
 assert.equal((await request('POST',{action:'vote',id,voterId,voted:false})).data.comment.votes,1);
 assert(!JSON.stringify((await request()).data).includes('voters'));
 assert.equal((await request('POST',{action:'vote',id,voterId:'bad',voted:true})).code,400);
 process.env.EDIT_PASSWORD='editor-test';
 assert.equal((await request('POST',{action:'delete',id},{'x-edit-password':'wrong'})).code,403);
 assert.equal((await request('POST',{action:'delete',id},{'x-edit-password':'editor-test'})).code,200);
 assert(!stored.some(c=>c.id===id));assert(stored.some(c=>c.id==='prior'));
 assert.equal((await request('POST',{action:'vote',id,voterId,voted:true})).code,404);
 assert(calls.every(c=>(c.url.includes('/contents/data/comments.json')||c.url.includes('/contents/data/logs/'))));
 global.fetch=async()=>({ok:false,status:401});assert.equal((await request()).code,502);
 delete process.env.GITHUB_TOKEN;assert.equal((await request()).code,503);
 console.log('PASS: public comments read/append, validation, origin, fixed destination, concurrent-write retry, preserved comments, secret isolation and errors.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{global.fetch=original});
