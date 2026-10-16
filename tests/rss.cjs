const assert=require('node:assert/strict');
const {gzipSync,deflateSync,brotliCompressSync}=require('node:zlib');
const dns=require('node:dns').promises,https=require('node:https'),{EventEmitter}=require('node:events');
const lookup=dns.lookup,get=https.get;
const handler=require('../api/rss.js');
async function request(url,method='GET'){
 const res={setHeader(){},status(code){this.code=code;return this},json(data){this.data=data;return this}};
 await handler({method,query:{url}},res);return res;
}
(async()=>{
 let calls=0;
 dns.lookup=async()=>[{address:'127.0.0.1',family:4}];
 https.get=()=>{calls++;throw Error('unexpected network')};
 assert.equal((await request('http://example.com/rss')).code,400);
 assert.equal((await request('https://example.com/rss')).code,400);assert.equal(calls,0);
 dns.lookup=async()=>[{address:'169.254.169.254',family:4}];assert.equal((await request('https://example.com/rss')).code,400);
 dns.lookup=async()=>[{address:'93.184.216.34',family:4}];
 const xml='<rss><channel><item><title>News</title></item></channel></rss>';
 https.get=(url,options,callback)=>{
  calls++;
  options.lookup(url.hostname,{},(error,address)=>assert.equal(address,'93.184.216.34'));
  const req=new EventEmitter();req.setTimeout=()=>{};
  const res=new EventEmitter();res.statusCode=200;res.headers={};res.resume=()=>{};
  if(url.pathname==='/redirect'){res.statusCode=302;res.headers.location='/feed';}
  if(url.pathname==='/private'){res.statusCode=302;res.headers.location='http://127.0.0.1/feed';}
  let body=Buffer.from(url.pathname==='/website'?'<html><head><link rel="alternate" type="application/rss+xml" href="/feed"></head></html>':xml);
  if(url.pathname==='/gzip'){res.headers['content-encoding']='gzip';body=gzipSync(body);}
  if(url.pathname==='/deflate'){res.headers['content-encoding']='deflate';body=deflateSync(body);}
  if(url.pathname==='/br'){res.headers['content-encoding']='br';body=brotliCompressSync(body);}
  if(url.pathname==='/bad-gzip')res.headers['content-encoding']='gzip';
  if(url.pathname==='/oversized-gzip'){res.headers['content-encoding']='gzip';body=gzipSync(Buffer.alloc(1024*1024+1,65));}
  callback(res);queueMicrotask(()=>{res.emit('data',body);res.emit('end')});return req;
 };
 const result=await request('https://example.com/rss');assert.equal(result.code,200);assert.equal(result.data.xml,xml);
 const discovered=await request('https://example.com/website');assert.equal(discovered.code,200);assert.equal(discovered.data.feedUrl,'https://example.com/feed');
 assert.equal((await request('https://example.com/redirect')).code,200);
 assert.equal((await request('https://example.com/private')).code,400);
 for(const encoding of ['gzip','deflate','br'])assert.equal((await request('https://example.com/'+encoding)).data.xml,xml);
 assert.equal((await request('https://example.com/bad-gzip')).code,400);
 assert.equal((await request('https://example.com/oversized-gzip')).code,400);
 assert.equal((await request('https://example.com/rss','POST')).code,405);
 console.log('PASS: RSS public HTTPS, pinned system DNS, private address blocking, redirects/discovery, gzip/deflate/br, corrupt compression and decompressed size limits.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{dns.lookup=lookup;https.get=get});
