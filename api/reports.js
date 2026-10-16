const {randomUUID,createHash}=require('node:crypto');
const {editor,request,read,update,audit,settings}=require('../lib/github-store');
const roundsPath='data/report-rounds.json';
const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(value);
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({message:'Method not allowed'});
 try{
  if(req.method==='GET'){
   const rounds=(await read(roundsPath,[])).data;
   const id=req.query.roundId;
   if(id&&!validId(id))return res.status(400).json({message:'Đợt nộp không hợp lệ.'});
   const submissions=id?(await read('data/report-submissions/'+id+'.json',[])).data:[];
   return res.status(200).json({rounds,submissions});
  }
  if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return res.status(403).json({message:'Nguồn gửi không hợp lệ.'});
  const b=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
  if(['deleteRound','deleteFile'].includes(b.action)){
   if(!editor(req))return res.status(401).json({message:'Bật Edit mode để xóa báo cáo.'});
   if(!validId(b.roundId)||b.action==='deleteFile'&&(!validId(b.submissionId)||typeof b.fileId!=='string'||!/^[a-f0-9]{64}$/.test(b.fileId)))return res.status(400).json({message:'Yêu cầu xóa không hợp lệ.'});
   if(!(await read(roundsPath,[])).data.some(r=>r.id===b.roundId))return res.status(404).json({message:'Không tìm thấy đợt nộp.'});
   const path='data/report-submissions/'+b.roundId+'.json',submissions=(await read(path,[])).data;
   const files=submissions.filter(s=>b.action==='deleteRound'||s.id===b.submissionId).flatMap(s=>(s.files||[]).filter(f=>b.action==='deleteRound'||f.id===b.fileId));
   if(b.action==='deleteFile'&&!files.length)return res.status(404).json({message:'Không tìm thấy file.'});
   for(const file of files){
    if(typeof file.path!=='string'||!file.path.startsWith('uploads/bao-cao/'+b.roundId+'/')||file.path.includes('..'))throw Error('Đường dẫn không hợp lệ.');
    for(let attempt=0;attempt<4;attempt++){
     const current=await request(file.path);if(!current)break;
     try{await request(file.path,'DELETE',{message:'Delete report file',sha:current.sha});break}catch(e){if(![409,422].includes(e.status)||attempt===3)throw e}
    }
   }
   if(b.action==='deleteRound'){
    await update(path,[],()=>[]);
    await update(roundsPath,[],list=>list.filter(r=>r.id!==b.roundId));
   }else await update(path,[],list=>list.map(s=>s.id===b.submissionId?{...s,files:s.files.filter(f=>f.id!==b.fileId)}:s).filter(s=>s.files.length));
   const logged=await audit(b.action==='deleteRound'?'report.round.delete':'report.file.delete',{actor:'editor',roundId:b.roundId});res.setHeader('X-Audit-Status',logged?'saved':'failed');
   return res.status(200).json({deleted:true});
  }
  if(['create','edit'].includes(b.action)){
   if(!editor(req))return res.status(401).json({message:'Bật Edit mode để tạo hoặc sửa đợt nộp.'});
   const title=String(b.title||'').trim(),description=String(b.description||'').trim(),opensAt=new Date(b.opensAt),closesAt=new Date(b.closesAt);
   if(!title||title.length>160||description.length>3000||!Number.isFinite(+opensAt)||!Number.isFinite(+closesAt)||closesAt<=opensAt)return res.status(400).json({message:'Nhập tên và thời gian kết thúc sau thời gian bắt đầu.'});
   if(b.action==='edit'&&!validId(b.id))return res.status(400).json({message:'Đợt nộp không hợp lệ.'});
   const round={id:b.action==='edit'?b.id:randomUUID(),title,description,opensAt:opensAt.toISOString(),closesAt:closesAt.toISOString(),updatedAt:Date.now()};
   await update(roundsPath,[],list=>{if(b.action==='edit'&&!list.some(r=>r.id===round.id))throw Error('Không tìm thấy đợt nộp.');return [...list.filter(r=>r.id!==round.id),round]});
   const logged=await audit('report.round.'+b.action,{actor:'editor',roundId:round.id,title});res.setHeader('X-Audit-Status',logged?'saved':'failed');
   return res.status(201).json({round});
  }
  if(b.action!=='submit'||!validId(b.roundId)||!validId(b.submissionId))return res.status(400).json({message:'Yêu cầu nộp không hợp lệ.'});
  const name=typeof b.name==='string'?b.name.trim():'',studentId=typeof b.studentId==='string'?b.studentId.trim():'';
  if(!name||name.length>80||!studentId||studentId.length>80)return res.status(400).json({message:'Nhập họ tên và số thứ tự (tối đa 80 ký tự).'});
  const round=(await read(roundsPath,[])).data.find(r=>r.id===b.roundId);
  if(!round)return res.status(404).json({message:'Không tìm thấy đợt nộp.'});
  const now=Date.now();if(now<Date.parse(round.opensAt)||now>Date.parse(round.closesAt))return res.status(403).json({message:'Đợt nộp chưa mở hoặc đã hết hạn.'});
  const file=b.file||{};
  if(typeof file.name!=='string'||file.name.length>200||! /\.(pdf|docx?|xlsx?|pptx?|zip|txt|csv|png|jpe?g|webp)$/i.test(file.name)||typeof file.content!=='string'||file.content.length>4*1024*1024||!file.content||!/^[A-Za-z0-9+/]+={0,2}$/.test(file.content))return res.status(400).json({message:'Tệp không hợp lệ hoặc vượt 3 MB.'});
  const bytes=Buffer.from(file.content,'base64');if(bytes.length>3*1024*1024||!bytes.length)return res.status(400).json({message:'Tệp vượt 3 MB hoặc rỗng.'});
  const hash=createHash('sha256').update(bytes).digest('hex');
  const ext=file.name.split('.').pop().toLowerCase();const path='uploads/bao-cao/'+round.id+'/'+b.submissionId+'/'+hash+'.'+ext;
  const existing=await request(path);
  let uploaded=existing;
  if(!existing)uploaded=(await request(path,'PUT',{message:'Submit report file',content:file.content})).content;
  const g=settings();const link=uploaded?.download_url||'https://raw.githubusercontent.com/'+g.repo+'/'+encodeURIComponent(g.branch)+'/'+path;
  const entry={id:hash,name:file.name,path,url:link,size:bytes.length,submittedAt:now};
  const saved=await update('data/report-submissions/'+round.id+'.json',[],list=>{
   const old=list.find(s=>s.id===b.submissionId);
   if(old&&(old.name!==name||old.studentId!==studentId))throw Error('Mã lần nộp đã được sử dụng.');
   const files=old?.files||[];if(files.length>=30&&!files.some(f=>f.path===path))throw Error('Tối đa 30 tệp trong một lần nộp.');
   const submission={id:b.submissionId,name,studentId,submittedAt:old?.submittedAt||now,updatedAt:now,files:[...files.filter(f=>f.path!==path),entry]};
   return [...list.filter(s=>s.id!==b.submissionId),submission];
  });
  const logged=await audit('report.file.submit',{actor:name,studentId,roundId:round.id,submissionId:b.submissionId,path,size:bytes.length});res.setHeader('X-Audit-Status',logged?'saved':'failed');
  return res.status(201).json({submission:saved.data.find(s=>s.id===b.submissionId)});
 }catch(e){return res.status(502).json({message:e.message||'Không lưu được báo cáo. Vui lòng thử lại.'})}
};
