const assert=require('node:assert/strict');
const handler=require('../api/upload');
Object.assign(process.env,{GITHUB_TOKEN:'test-token',EDIT_PASSWORD:'test-password',GITHUB_REPO:'owner/repo'});
const content=Buffer.alloc(2*1024*1024,65).toString('base64');
const sha='a'.repeat(40);let writes=0,reads=0;
global.fetch=async(url,opts)=>{
 if(url.endsWith('/git/blobs')&&opts.method==='POST')return {ok:true,json:async()=>({sha})};
 if(url.endsWith('/git/blobs/'+sha)){reads++;return {ok:true,json:async()=>({encoding:'base64',content})};}
 const body=JSON.parse(opts.body);
 if(url.includes('/contents/uploads/')){writes++;assert.equal(Buffer.from(body.content,'base64').length,50*1024*1024);}
 return {ok:true,json:async()=>({content:{path:'uploads/large.zip'},commit:{sha:'commit'}})};
};
async function call(body,headers={'x-edit-password':'test-password'}){
 const res={setHeader(){},status(code){this.code=code;return this},json(data){this.data=data;return this}};
 await handler({method:'POST',headers,body},res);return res;
}
(async()=>{
 assert.equal((await call({action:'chunk',content},{})).code,401);
 assert.equal((await call({action:'chunk',content:'!invalid'})).code,400);
 assert.equal((await call({action:'chunk',content:content+'AAAA'})).code,400);
 const part=await call({action:'chunk',content});assert.equal(part.code,200);
 assert(!JSON.stringify(part.data).includes('test-token'));
 const parts=Array(25).fill(part.data);
 assert.equal((await call({action:'finish',path:'uploads/../bad',parts})).code,400);
 assert.equal((await call({action:'finish',path:'uploads/file.zip',parts:[{...part.data,size:1}]})).code,400);
 assert.equal((await call({action:'finish',path:'uploads/file.zip',parts:[{...part.data,expires:0}]})).code,400);
 assert.equal((await call({action:'finish',path:'uploads/file.zip',parts:Array(26).fill(part.data)})).code,400);
 assert.equal(reads,0);assert.equal(writes,0);
 const result=await call({action:'finish',path:'uploads/large.zip',parts});
 assert.equal(result.code,201);assert.equal(reads,25);assert.equal(writes,1);
 global.fetch=async()=>({ok:false,status:503});
 assert.equal((await call({action:'chunk',content})).code,502);
 console.log('PASS: chunk authentication, bounded payloads, signed receipts, path restrictions and 50 MiB reassembly.');
})().catch(e=>{console.error(e);process.exitCode=1});
