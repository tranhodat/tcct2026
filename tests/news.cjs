const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
function app(data=new Map()){
 const nodes=new Map(),listeners={};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',hidden:false,classList:{toggle(){},add(){},remove(){}},attributes:{},setAttribute(k,v){this.attributes[k]=v}});return nodes.get(id)};
 const ctx={console,TextEncoder,URL,crypto:require('node:crypto').webcrypto,window:{scrollTo(){}},document:{querySelector:node,addEventListener:(type,fn)=>{(listeners[type]||=[]).push(fn)},visibilityState:'visible',body:{classList:{remove(){}}}},localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},requestAnimationFrame:()=>1,cancelAnimationFrame(){},setTimeout:()=>0,clearTimeout(){}};
 let js=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace('function openForm(o){','function openForm(o){globalThis.form=o;return;');
 js=js.replace('init();','globalThis.test={S,G,act,news,viewTinMoi,addNewsSource,newsItems,viewThongBao,render,loadState,feedback,viewYKien,TABS};');
 vm.createContext(ctx);vm.runInContext(js,ctx);ctx.test.S.ready=true;ctx.test.S.loaded={anns:true,events:true,docs:true,courses:true,albums:true};
 return {ctx,t:ctx.test,data,node,listeners};
}
(async()=>{
 const {ctx,t,data,node,listeners}=app();
 assert.equal(t.TABS.map(x=>x[0]).join(','),'lich,thongbao,tailieu,hocphan,hinhanh,tinmoi,baocao,ykien,danhsach');
 // Exercise the tab's actual click handler and rendering, then create and pin an announcement.
 await listeners.click[0]({target:{closest:()=>({dataset:{act:'tab',tab:'thongbao'}})}});
 assert.equal(t.S.tab,'thongbao');assert(node('#view').innerHTML.includes('Chưa có thông báo'));
 t.S.editMode=true;t.act.addAnn();await ctx.form.onSubmit({title:'Class update',body:'Announcement body',pinned:false,important:true});
 t.act.tab({dataset:{tab:'thongbao'}});
 assert(node('#view').innerHTML.includes('Class update'));assert(node('#view').innerHTML.includes('Announcement body'));
 const id=t.S.anns[0].id;await t.act.pinAnn({dataset:{id}});assert.equal(t.S.anns[0].pinned,true);
 assert(t.viewThongBao().includes('Đã ghim'));
 t.S.editMode=false;
 await t.addNewsSource('example.com/feed');await t.addNewsSource('https://other.example/rss');
 await t.addNewsSource('https://example.com/feed');assert.equal(t.news.sources.length,2);
 await assert.rejects(t.addNewsSource('http://example.com'),/HTTPS/);
 t.news.cache['https://example.com/feed']={savedAt:Date.now(),items:[{title:'A saved article',link:'https://example.com/article',description:'Summary'}]};
 t.act.newsSave({dataset:{i:'0'}});assert.equal(t.news.saved.length,1);
 t.act.newsMode({dataset:{mode:'saved'}});assert(t.viewTinMoi().includes('A saved article'));
 t.act.newsRemove({dataset:{i:'0'}});assert.equal(t.news.sources.length,1);assert.equal(t.news.saved.length,1);
 const legacy=app(new Map([['solop-static-v1',JSON.stringify({announcements:[null,{id:'legacy',title:'Legacy announcement',body:'Body',createdAt:1}]})]]));legacy.t.loadState();assert.equal(legacy.t.S.anns.length,1);assert(legacy.t.viewThongBao().includes('Legacy announcement'));
 const restored=app(data);assert.equal(restored.t.news.saved.length,1);assert.equal(restored.t.news.sources.length,1);
 restored.t.act.newsMode({dataset:{mode:'saved'}});restored.t.act.newsSave({dataset:{i:'0'}});assert.equal(restored.t.news.saved.length,0);
 assert.equal(app().t.news.sources.length,0); // Separate device storage stays independent.
 assert(!JSON.parse(data.get('solop-static-v1')).newsSources);
 assert(html.indexOf('id="notifyBtn"')<html.indexOf('id="roleChip"'));
 t.render();assert.equal(node('#notifyBtn').attributes['aria-pressed'],'true');
 await t.act.notifications();assert.equal(node('#notifyBtn').attributes['aria-pressed'],'false');
 console.log('PASS: announcement tab click/render/create/pin; news sources, deduplication, saved articles, reload persistence, per-device isolation, bell position and toggle.');
})().catch(e=>{console.error(e);process.exitCode=1});
