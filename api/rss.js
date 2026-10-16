const https = require('node:https');
const dns = require('node:dns').promises;
const { BlockList } = require('node:net');
const blocked = new BlockList();
for (const [ip, bits] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.168.0.0',16],['198.18.0.0',15],['224.0.0.0',3]]) blocked.addSubnet(ip,bits,'ipv4');

async function readFeed(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new Error('Chỉ hỗ trợ link HTTPS công khai.');
  // Pin a public IPv4 address for the connection to prevent DNS rebinding.
  const addresses = await dns.resolve4(url.hostname);
  if (!addresses.length || addresses.some(ip => blocked.check(ip,'ipv4'))) throw new Error('Nguồn RSS phải là địa chỉ công khai.');
  return new Promise((resolve,reject) => {
    const req = https.get(url,{headers:{Accept:'application/rss+xml, application/atom+xml, application/xml, text/xml', 'User-Agent':'ClassNotebook-RSS/1.0'},lookup:(_host,options,cb)=>options.all?cb(null,[{address:addresses[0],family:4}]):cb(null,addresses[0],4)},res=>{
      if (res.statusCode !== 200) { res.resume();reject(new Error('Nguồn RSS trả về HTTP '+res.statusCode+'. Hãy dùng link feed trực tiếp (không chuyển hướng).'));return; }
      let size=0;const chunks=[];
      res.on('data',chunk=>{size+=chunk.length;if(size>1024*1024){req.destroy(new Error('RSS vượt quá 1 MB.'));return;}chunks.push(chunk)});
      res.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error',reject);
    });
    req.setTimeout(8000,()=>req.destroy(new Error('Nguồn RSS phản hồi quá chậm.')));
    req.on('error',reject);
  });
}
module.exports = async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({message:'Method not allowed'});
  try{return res.status(200).json({xml:await readFeed(String(req.query.url||''))})}
  catch{return res.status(400).json({message:'Không đọc được RSS. Kiểm tra link HTTPS công khai và dùng URL feed trực tiếp.'})}
};
