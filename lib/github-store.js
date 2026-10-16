const {randomUUID,timingSafeEqual}=require('node:crypto');
function settings(){
 const token=(process.env.GITHUB_TOKEN||'').trim();if(!token)throw Error('Vercel chưa cấu hình GITHUB_TOKEN.');
 return {token,repo:process.env.GITHUB_REPO||'tranhodat/tcct2026',branch:process.env.GITHUB_BRANCH||'main'};
}
function editor(req){const value=process.env.EDIT_PASSWORD;if(!value)return false;const a=Buffer.from(String(req.headers['x-edit-password']||'')),b=Buffer.from(value);return a.length===b.length&&timingSafeEqual(a,b)}
async function request(path,method='GET',body){const g=settings();const url='https://api.github.com/repos/'+g.repo+'/contents/'+path.split('/').map(encodeURIComponent).join('/')+(method==='GET'?'?ref='+encodeURIComponent(g.branch):'');const r=await fetch(url,{method,headers:{Authorization:'Bearer '+g.token,Accept:'application/vnd.github+json','Content-Type':'application/json'},...(body?{body:JSON.stringify({...body,branch:g.branch})}:{}),cache:'no-store'});if(r.status===404&&method==='GET')return null;const data=await r.json();if(!r.ok)throw Object.assign(Error('GitHub ('+r.status+'). Kiểm tra cấu hình hoặc thử lại.'),{status:r.status});return data}
async function read(path,fallback){const file=await request(path);return {data:file?JSON.parse(Buffer.from(file.content||'','base64').toString('utf8')):fallback,sha:file?.sha}}
async function update(path,fallback,fn){for(let i=0;i<4;i++){const current=await read(path,fallback);const next=fn(current.data);const encoded=Buffer.from(JSON.stringify(next));if(encoded.length>700*1024)throw Error('Kho dữ liệu đã đầy.');try{const result=await request(path,'PUT',{message:'Update '+path,content:encoded.toString('base64'),...(current.sha?{sha:current.sha}:{})});return {data:next,result}}catch(e){if(![409,422].includes(e.status)||i===3)throw e}}}
async function audit(action,details={}){
 const event={id:randomUUID(),at:new Date().toISOString(),action,...details};
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 try{await request('data/logs/'+day+'/'+Date.now()+'-'+event.id+'.json','PUT',{message:'Audit '+action,content:Buffer.from(JSON.stringify(event)).toString('base64')});return true}
 catch{console.error(JSON.stringify({type:'AUDIT_PERSIST_FAILED',event}));return false}
}
module.exports={settings,editor,request,read,update,audit};
