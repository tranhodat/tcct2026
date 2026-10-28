const {editor,read,request,audit}=require('../lib/github-store');
const path='data/solop-static.json';
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store, max-age=0');
 if(!['GET','PUT'].includes(req.method))return res.status(405).json({message:'Method not allowed'});
 if(req.method==='PUT'&&!editor(req))return res.status(401).json({message:'Mật khẩu Edit mode không đúng.'});
 try{
  const current=await read(path,null);
  if(req.method==='GET')return res.status(200).json({state:current.data,revision:current.sha||null});
  const input=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
  if((input.revision||null)!==(current.sha||null))return res.status(409).json({message:'Máy khác vừa cập nhật dữ liệu. Hãy tắt Edit mode, đồng bộ lại rồi thử sửa. Bản chưa đồng bộ đã được giữ trên máy.'});
  const state=input.state;
  if(!state||['events','anns','folders','docs','courses','albums'].some(k=>!Array.isArray(state[k])||state[k].some(x=>!x||typeof x.id!=='string')))return res.status(400).json({message:'Dữ liệu lớp không hợp lệ.'});
  if(state.aiTools!==undefined&&(!Array.isArray(state.aiTools)||state.aiTools.some(x=>!x||typeof x.id!=='string')))return res.status(400).json({message:'Danh sách công cụ không hợp lệ.'});
  const shared=Object.fromEntries(['events','anns','folders','docs','courses','albums','cls'].map(k=>[k,state[k]??{}]));
  if(Array.isArray(state.aiTools))shared.aiTools=state.aiTools;else if(Array.isArray(current.data?.aiTools))shared.aiTools=current.data.aiTools;
  shared.updatedAt=Date.now();shared.settings={class:shared.cls};
  const bytes=Buffer.from(JSON.stringify(shared));if(bytes.length>700*1024)return res.status(413).json({message:'Dữ liệu lớp vượt giới hạn. Hãy dùng liên kết thay cho tệp nhúng base64.'});
  const result=await request(path,'PUT',{message:'Update notebook data',content:bytes.toString('base64'),...(current.sha?{sha:current.sha}:{})});
  const logged=await audit('class.data.update',{actor:'editor',path,commit:result.commit?.sha||null});res.setHeader('X-Audit-Status',logged?'saved':'failed');
  return res.status(200).json({state:shared,revision:result.content?.sha});
 }catch(e){return res.status(e.status===409||e.status===422?409:502).json({message:e.status===409||e.status===422?'Có cập nhật đồng thời. Hãy đồng bộ lại trước khi sửa.':e.message||'Không đồng bộ được dữ liệu lớp.'})}
};
