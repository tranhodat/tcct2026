const {createHmac,timingSafeEqual}=require('node:crypto');
const {settings,editor,request,audit}=require('../lib/github-store');
const MAX=50*1024*1024,CHUNK=2*1024*1024;
function sign(value){return createHmac('sha256',process.env.GITHUB_TOKEN).update(JSON.stringify(value)).digest('hex')}
module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store');
 const fail=(status,message)=>res.status(status).json({message});
 if(req.method!=='POST')return fail(405,'Method not allowed');
 if(!editor(req))return fail(401,'Mật khẩu Edit mode không đúng.');
 try{
  const g=settings(),input=typeof req.body==='string'?JSON.parse(req.body):req.body;
  async function blob(path,method='GET',body){
   const r=await fetch('https://api.github.com/repos/'+g.repo+'/git/blobs'+path,{method,headers:{Authorization:'Bearer '+g.token,Accept:'application/vnd.github+json','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
   if(!r.ok)throw Error('GitHub ('+r.status+'): không thể xử lý tệp.');
   return r.json();
  }
  if(input?.action==='chunk'){
   if(typeof input.content!=='string'||input.content.length>4*Math.ceil(CHUNK/3)||!input.content||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.content))return fail(400,'Phần tệp không hợp lệ.');
   const size=Buffer.from(input.content,'base64').length;
   if(!size||size>CHUNK)return fail(413,'Phần tệp quá lớn.');
   const result=await blob('','POST',{content:input.content,encoding:'base64'});
   const receipt={sha:result.sha,size,expires:Date.now()+24*60*60*1000};
   return res.status(200).json({...receipt,signature:sign(receipt)});
  }
  if(input?.action!=='finish'||typeof input.path!=='string'||!/^uploads\/[a-z0-9_./-]+$/.test(input.path)||input.path.split('/').some(p=>!p||p==='.'||p==='..'))return fail(400,'Đường dẫn không hợp lệ.');
  if(!Array.isArray(input.parts)||!input.parts.length||input.parts.length>25)return fail(400,'Danh sách phần tệp không hợp lệ.');
  let total=0;
  for(const part of input.parts){
   const {sha,size,expires,signature}=part||{};
   if(!/^[a-f0-9]{40}$/.test(sha)||!Number.isInteger(size)||size<1||size>CHUNK||!Number.isFinite(expires)||expires<Date.now()||typeof signature!=='string'||!/^[a-f0-9]{64}$/.test(signature))return fail(400,'Phần tệp không hợp lệ hoặc hết hạn.');
   if(!timingSafeEqual(Buffer.from(sign({sha,size,expires})),Buffer.from(signature)))return fail(400,'Chữ ký phần tệp không hợp lệ.');
   total+=size;
  }
  if(total>MAX)return fail(413,'Tệp quá lớn (tối đa 50 MB).');
  const buffers=[];
  for(const part of input.parts){
   const data=await blob('/'+part.sha);
   if(data.encoding!=='base64')throw Error('Định dạng phần tệp không hợp lệ.');
   const bytes=Buffer.from(data.content,'base64');
   if(bytes.length!==part.size)throw Error('Dung lượng phần tệp không khớp.');
   buffers.push(bytes);
  }
  const saved=await request(input.path,'PUT',{message:'Upload '+input.path,content:Buffer.concat(buffers,total).toString('base64')});
  if(!saved.content?.path)throw Error('GitHub chưa xác nhận tệp đã lưu.');
  const logged=await audit('file.upload',{actor:'editor',path:input.path,commit:saved.commit?.sha||null});
  res.setHeader('X-Audit-Status',logged?'saved':'failed');
  return res.status(201).json({content:{path:saved.content.path,download_url:saved.content.download_url}});
 }catch(e){return fail(502,e.message||'Không thể lưu tệp.');}
};
