const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let js=fs.readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
js=js.replace('function openForm(o){','function openForm(o){globalThis.form=o;return;').replace('init();','globalThis.test={S,G,act,reports,viewBaoCao,viewNhatKy,reportLocal};');
const ctx={console,TextEncoder,URL,crypto:require('node:crypto').webcrypto,window:{},document:{addEventListener(){}},localStorage:{getItem:()=>null,setItem(){}},requestAnimationFrame:()=>1,cancelAnimationFrame(){},setTimeout,clearTimeout,FileReader:class{readAsDataURL(file){this.result='data:application/pdf;base64,'+Buffer.from(file.name).toString('base64');this.onload()}}};
vm.createContext(ctx);vm.runInContext(js,ctx);
(async()=>{
 const t=ctx.test;t.reports.rounds=[{id:'round',title:'Reports',opensAt:new Date(Date.now()-60000).toISOString(),closesAt:new Date(Date.now()+60000).toISOString()}];t.reports.selected='round';
 assert(t.viewBaoCao().includes('reportSubmit'));assert(!t.viewBaoCao().includes('reportCreate'));
 t.S.editMode=true;assert(t.viewBaoCao().includes('reportCreate'));t.act.reportCreate();assert(ctx.form.fields.some(f=>f.type==='datetime-local'));
 assert.equal(t.reportLocal('2026-10-16T00:00:00Z'),'2026-10-16T07:00');
 t.S.editMode=false;t.act.reportSubmit();assert(ctx.form.fields.find(f=>f.type==='file').multiple);
 let fail=true,calls=[];
 ctx.fetch=async(url,options)=>{
  if(options?.method==='POST'){const b=JSON.parse(options.body);calls.push(b);if(b.file.name==='second.pdf'&&fail)return {ok:false,json:async()=>({message:'Try again'})};return {ok:true,json:async()=>({submission:{}})}}
  return {ok:true,json:async()=>({rounds:t.reports.rounds,submissions:[]})};
 };
 const v={name:'Reader',studentId:'SV01',files:[{name:'first.pdf',size:10,lastModified:1},{name:'second.pdf',size:20,lastModified:2}]};
 await assert.rejects(ctx.form.onSubmit(v,()=>{}),/Try again/);fail=false;
 await ctx.form.onSubmit(v,()=>{});
 assert.equal(calls.filter(c=>c.file.name==='first.pdf').length,1);
 assert.equal(new Set(calls.map(c=>c.submissionId)).size,1);assert(calls.every(c=>c.roundId==='round'));
 assert(t.viewNhatKy().includes('Bật Edit mode'));
 console.log('PASS: report role controls, UTC+7 inputs, multi-file selection, partial upload retry and stable submission identity.');
})().catch(e=>{console.error(e);process.exitCode=1});
