const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
let js=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace('function openForm(o){','function openForm(o){globalThis.form=o;return;').replace('init();','globalThis.test={S,act,courseDetail,lectureNotes,courseWordHtml};');
const data=new Map(),ctx={console,URL,location:{href:'https://example.com/'},crypto:require('node:crypto').webcrypto,window:{},document:{addEventListener(){}},localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},requestAnimationFrame:()=>1,cancelAnimationFrame(){},setTimeout,clearTimeout};
vm.createContext(ctx);vm.runInContext(js,ctx);
(async()=>{
 const t=ctx.test,c={id:'c',name:'Course',lectures:[{id:'l',title:'First',note:'Legacy note',materials:[{kind:'link',name:'Document',link:'https://example.com/doc'}]},{id:'l2',title:'Second',notes:['x'.repeat(600),'Last note']}]};
 t.S.courses=[c];t.S.courseId='c';t.S.lectureId='l';t.S.editMode=false;
 let view=t.courseDetail(c);assert(view.includes('exportCourseWord'));assert(!view.includes('data-act="editCourse"'));assert(view.includes('Legacy note'));
 assert(html.includes("readActions=['exportCourseWord'"));
 t.S.editMode=true;view=t.courseDetail(c);assert(view.indexOf('exportCourseWord')<view.indexOf('data-act="editCourse"'));
 t.act.addNote();await ctx.form.onSubmit({note:'New note'});assert.equal(t.S.courses[0].lectures[0].notes.join('|'),'Legacy note|New note');
 t.act.editNote({dataset:{i:'1'}});await ctx.form.onSubmit({note:'Updated'});assert.equal(t.S.courses[0].lectures[0].notes[1],'Updated');
 await t.act.delNote({dataset:{i:'0'}});assert.equal(t.S.courses[0].lectures[0].notes.join('|'),'Updated');
 t.S.lectureId='l2';assert(t.courseDetail(t.S.courses[0]).includes('<details>'));
 const word=t.courseWordHtml(t.S.courses[0]);for(const text of ['First','Second','Updated','Last note','x'.repeat(600),'https://example.com/doc'])assert(word.includes(text));assert(!word.includes('<details>'));
 console.log('PASS: public Word export, button order, legacy notes, multiple-note CRUD, collapsed long notes and complete export.');
})().catch(e=>{console.error(e);process.exitCode=1});
