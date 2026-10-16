const https = require('node:https');
const dns = require('node:dns').promises;
const { BlockList } = require('node:net');
const blocked = new BlockList();
for (const [ip, bits] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.168.0.0',16],['198.18.0.0',15],['224.0.0.0',3]]) blocked.addSubnet(ip,bits,'ipv4');

async function readFeed(value, depth=0) {
  if(depth>3)throw new Error('Quá nhiều chuyển hướng.');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new Error('Chỉ hỗ trợ link HTTPS công khai.');
  // Pin a public IPv4 address for the connection to prevent DNS rebinding.
  const addresses = await dns.resolve4(url.hostname);
  if (!addresses.length || addresses.some(ip => blocked.check(ip,'ipv4'))) throw new Error('Nguồn RSS phải là địa chỉ công khai.');
  const result=await new Promise((resolve,reject) => {
    const req = https.get(url,{headers:{Accept:'application/rss+xml, application/atom+xml, application/xml, text/xml', 'User-Agent':'ClassNotebook-RSS/1.0'},lookup:(_host,options,cb)=>options.all?cb(null,[{address:addresses[0],family:4}]):cb(null,addresses[0],4)},res=>{
      if([301,302,303,307,308].includes(res.statusCode)&&res.headers.location){res.resume();resolve({redirect:new URL(res.headers.location,url).href});return;}
      if (res.statusCode !== 200) { res.resume();reject(new Error('Nguồn RSS trả về HTTP '+res.statusCode));return; }
      let size=0;const chunks=[];
      res.on('data',chunk=>{size+=chunk.length;if(size>1024*1024){req.destroy(new Error('RSS vượt quá 1 MB.'));return;}chunks.push(chunk)});
      res.on('end',()=>resolve({xml:Buffer.concat(chunks).toString('utf8'),feedUrl:url.href}));
      res.on('error',reject);
    });
    req.setTimeout(8000,()=>req.destroy(new Error('Nguồn RSS phản hồi quá chậm.')));
    req.on('error',reject);
  });
  if(result.redirect)return readFeed(result.redirect,depth+1);
  if(/<(?:rss|feed|(?:\w+:)?RDF)\b/i.test(result.xml))return result;
  // Discover RSS/Atom advertised by a website; all destinations use the same public-IP checks.
  const tags=result.xml.match(/<link\b[^>]*>/gi)||[];
  for(const tag of tags){
    if(!/\btype\s*=\s*["']application\/(?:rss|atom)\+xml["']/i.test(tag))continue;
    const href=tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    if(href)return readFeed(new URL(href.replace(/&amp;/g,'&'),url).href,depth+1);
  }
  throw new Error('Website không công bố RSS/Atom. Hãy nhập link feed trực tiếp.');
}
module.exports = async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({message:'Method not allowed'});
  try{return res.status(200).json(await readFeed(String(req.query.url||'')))}
  catch{return res.status(400).json({message:'Không tìm thấy RSS/Atom. Hãy nhập link feed HTTPS công khai hoặc website có công bố nguồn RSS.'})}
};
