const { randomUUID, createHash } = require('node:crypto');
const {audit,editor}=require('../lib/github-store');
const publicComment=c=>{const {voters,...rest}=c;return {...rest,votes:Array.isArray(voters)?voters.length:0}};

module.exports = async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  const fail=(code,message)=>res.status(code).json({message});
  if(!['GET','POST'].includes(req.method))return fail(405,'Method not allowed');
  const token=(process.env.GITHUB_TOKEN||'').trim();
  if(!token)return fail(503,'Vercel chưa cấu hình GITHUB_TOKEN.');
  const repo=process.env.GITHUB_REPO||'tranhodat/tcct2026';
  const branch=process.env.GITHUB_BRANCH||'main';
  const url='https://api.github.com/repos/'+repo+'/contents/data/comments.json';
  const headers={Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json'};
  let comment,body,action;
  if(req.method==='POST'){
    if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return fail(403,'Nguồn gửi không hợp lệ.')}catch{return fail(403,'Nguồn gửi không hợp lệ.')}}
    try{body=typeof req.body==='string'?JSON.parse(req.body):req.body}catch{return fail(400,'Dữ liệu không hợp lệ.')}
    action=body?.action||'add';
    if(!['add','vote','delete'].includes(action))return fail(400,'Thao tác không hợp lệ.');
    if(action==='delete'&&!editor(req))return fail(403,'Vui lòng bật Edit mode để xoá ý kiến.');
    if(action!=='add'&&(typeof body.id!=='string'||!body.id))return fail(400,'Thiếu mã ý kiến.');
    if(action==='vote'&&(typeof body.voterId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(body.voterId)||typeof body.voted!=='boolean'))return fail(400,'Thông tin vote không hợp lệ.');
    if(action==='add'){
    const name=typeof body?.name==='string'?body.name.trim():'';
    const text=typeof body?.text==='string'?body.text.trim():'';
    if(!name||name.length>80||!text||text.length>2000)return fail(400,'Nhập tên (tối đa 80 ký tự) và ý kiến (tối đa 2.000 ký tự).');
    comment={id:randomUUID(),name,text,createdAt:Date.now()};
    }
  }
  try{
    for(let attempt=0;attempt<3;attempt++){
      const current=await fetch(url+'?ref='+encodeURIComponent(branch),{headers,cache:'no-store'});
      if(!current.ok&&current.status!==404)return fail(current.status===401?502:current.status,'Không đọc được ý kiến từ GitHub ('+current.status+').');
      const file=current.ok?await current.json():null;
      const comments=file?JSON.parse(Buffer.from(file.content||'','base64').toString('utf8')):[];
      if(!Array.isArray(comments))throw Error('Invalid comment data');
      if(req.method==='GET')return res.status(200).json({comments:comments.map(publicComment)});
      let next;
      if(action==='add'){
        if(comments.length>=2000)return fail(409,'Mục ý kiến đã đầy. Vui lòng liên hệ người quản lý lớp.');
        next=[...comments,comment];
      }else{
        const target=comments.find(c=>c.id===body.id);if(!target)return fail(404,'Ý kiến đã bị xoá hoặc không tồn tại.');
        if(action==='delete')next=comments.filter(c=>c.id!==body.id);
        else{
          const voter=createHash('sha256').update(body.voterId).digest('hex'),voters=new Set(target.voters||[]);
          if(body.voted)voters.add(voter);else voters.delete(voter);
          comment={...target,voters:[...voters]};next=comments.map(c=>c.id===body.id?comment:c);
        }
      }
      const content=Buffer.from(JSON.stringify(next));
      if(content.length>700*1024)return fail(409,'Kho ý kiến đã đầy. Vui lòng liên hệ người quản lý lớp.');
      const saved=await fetch(url,{method:'PUT',headers,body:JSON.stringify({branch,message:'Add class feedback',content:content.toString('base64'),...(file?{sha:file.sha}:{})})});
      if(saved.ok){if(action!=='vote'){const logged=await audit('comment.'+action,{actor:action==='add'?comment.name:'editor',commentId:action==='add'?comment.id:body.id});res.setHeader('X-Audit-Status',logged?'saved':'failed');}return res.status(action==='add'?201:200).json(action==='delete'?{deleted:body.id}:{comment:publicComment(comment),...(action==='vote'?{voted:body.voted}:{})});}
      if(![409,422].includes(saved.status))return fail(502,'Không gửi được ý kiến lên GitHub ('+saved.status+').');
    }
    return fail(409,'Có người vừa gửi ý kiến. Vui lòng thử lại.');
  }catch{return fail(502,'Không kết nối được kho ý kiến. Vui lòng thử lại.');}
};
