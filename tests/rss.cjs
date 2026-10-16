const assert=require('node:assert/strict');
const dns=require('node:dns').promises,https=require('node:https'),{EventEmitter}=require('node:events');
const resolve4=dns.resolve4,get=https.get;
const handler=require('../api/rss.js');
async function request(url,method='GET'){
 const res={setHeader(){},status(code){this.code=code;return this},json(data){this.data=data;return this}};
 await handler({method,query:{url}},res);return res;
}
(async()=>{
 let calls=0;
 dns.resolve4=async()=>['127.0.0.1'];
 https.get=()=>{calls++;throw Error('unexpected network')};
 assert.equal((await request('http://example.com/rss')).code,400);
 assert.equal((await request('https://example.com/rss')).code,400);assert.equal(calls,0);
 dns.resolve4=async()=>['169.254.169.254'];assert.equal((await request('https://example.com/rss')).code,400);
 dns.resolve4=async()=>['93.184.216.34'];
 const xml='<rss><channel><item><title>News</title></item></channel></rss>';
 https.get=(url,options,callback)=>{
  calls++;
  options.lookup(url.hostname,{},(error,address)=>assert.equal(address,'93.184.216.34'));
  const req=new EventEmitter();req.setTimeout=()=>{};
  const res=new EventEmitter();res.statusCode=200;res.headers={};res.resume=()=>{};
  if(url.pathname==='/redirect'){res.statusCode=302;res.headers.location='/feed';}
  if(url.pathname==='/private'){res.statusCode=302;res.headers.location='http://127.0.0.1/feed';}
  const body=url.pathname==='/website'?'<html><head><link rel="alternate" type="application/rss+xml" href="/feed"></head></html>':xml;
  callback(res);queueMicrotask(()=>{res.emit('data',Buffer.from(body));res.emit('end')});return req;
 };
 const result=await request('https://example.com/rss');assert.equal(result.code,200);assert.equal(result.data.xml,xml);
 const discovered=await request('https://example.com/website');assert.equal(discovered.code,200);assert.equal(discovered.data.feedUrl,'https://example.com/feed');
 assert.equal((await request('https://example.com/redirect')).code,200);
 assert.equal((await request('https://example.com/private')).code,400);
 assert.equal((await request('https://example.com/rss','POST')).code,405);
 console.log('PASS: RSS public HTTPS validation, private address blocking, pinned DNS, feed response and allowed method.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{dns.resolve4=resolve4;https.get=get});
