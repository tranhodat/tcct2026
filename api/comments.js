const { randomUUID } = require('node:crypto');
const {audit}=require('../lib/github-store');

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
  let comment;
  if(req.method==='POST'){
    if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return fail(403,'Nguồn gửi không hợp lệ.')}catch{return fail(403,'Nguồn gửi không hợp lệ.')}}
    let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body}catch{return fail(400,'Dữ liệu không hợp lệ.')}
    const name=typeof body?.name==='string'?body.name.trim():'';
    const text=typeof body?.text==='string'?body.text.trim():'';
    if(!name||name.length>80||!text||text.length>2000)return fail(400,'Nhập tên (tối đa 80 ký tự) và ý kiến (tối đa 2.000 ký tự).');
    comment={id:randomUUID(),name,text,createdAt:Date.now()};
  }
  try{
    for(let attempt=0;attempt<3;attempt++){
      const current=await fetch(url+'?ref='+encodeURIComponent(branch),{headers,cache:'no-store'});
      if(!current.ok&&current.status!==404)return fail(current.status===401?502:current.status,'Không đọc được ý kiến từ GitHub ('+current.status+').');
      const file=current.ok?await current.json():null;
      const comments=file?JSON.parse(Buffer.from(file.content||'','base64').toString('utf8')):[];
      if(!Array.isArray(comments))throw Error('Invalid comment data');
      if(req.method==='GET')return res.status(200).json({comments});
      if(comments.length>=2000)return fail(409,'Mục ý kiến đã đầy. Vui lòng liên hệ người quản lý lớp.');
      const content=Buffer.from(JSON.stringify([...comments,comment]));
      if(content.length>700*1024)return fail(409,'Kho ý kiến đã đầy. Vui lòng liên hệ người quản lý lớp.');
      const saved=await fetch(url,{method:'PUT',headers,body:JSON.stringify({branch,message:'Add class feedback',content:content.toString('base64'),...(file?{sha:file.sha}:{})})});
      if(saved.ok){const logged=await audit('comment.add',{actor:comment.name,commentId:comment.id});res.setHeader('X-Audit-Status',logged?'saved':'failed');return res.status(201).json({comment});}
      if(![409,422].includes(saved.status))return fail(502,'Không gửi được ý kiến lên GitHub ('+saved.status+').');
    }
    return fail(409,'Có người vừa gửi ý kiến. Vui lòng thử lại.');
  }catch{return fail(502,'Không kết nối được kho ý kiến. Vui lòng thử lại.');}
};
