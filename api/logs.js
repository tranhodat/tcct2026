const {editor,request,read}=require('../lib/github-store');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({message:'Method not allowed'});
 if(!editor(req))return res.status(401).json({message:'Bật Edit mode để xem nhật ký.'});
 const date=String(req.query.date||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return res.status(400).json({message:'Ngày không hợp lệ.'});
 try{const list=await request('data/logs/'+date)||[];const files=(Array.isArray(list)?list:[]).filter(f=>f.type==='file'&&f.name.endsWith('.json')).sort((a,b)=>b.name.localeCompare(a.name));const events=[];for(let i=0;i<Math.min(files.length,50);i+=5)events.push(...await Promise.all(files.slice(i,Math.min(i+5,50)).map(f=>read('data/logs/'+date+'/'+f.name,{}).then(r=>r.data))));return res.status(200).json({events,date,total:files.length})}catch(e){return res.status(502).json({message:e.message})}
};
