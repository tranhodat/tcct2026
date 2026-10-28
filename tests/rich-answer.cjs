const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const js=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tcct-rich-'));
const file=path.join(dir,'test.html');
const checks=()=>{
 const check=(condition,message)=>{if(!condition)throw Error(message)};
 const raw='<p style="text-align: center;color:#ff0000"><b>Bold</b> <i>Italic</i> <u>Underline</u></p><div align="justify">'+ 'Text '.repeat(65)+'</div>';
 const clean=sanitizeAnswerHtml(raw+'<script>alert(1)<\/script><img src=x onerror=alert(1)><span onclick="bad()" style="position:fixed;color:blue">safe</span>');
 check(!/script|onerror|onclick|position:|<img/i.test(clean),'Unsafe HTML removed');
 check(clean.includes('text-align:center')&&clean.includes('text-align:justify')&&clean.includes('color:'),'Alignment and color preserved');
 const q={question:'Question',answer:'Bold Italic Underline '+'Text '.repeat(65),answerHtml:sanitizeAnswerHtml(raw)};
 const c={name:'Course',lectures:[{id:'l',title:'Lesson',reviewQuestions:[q]}]};
 const view=reviewQuestionsHtml(c.lectures[0]),word=courseWordHtml(c);
 for(const part of ['<b>Bold</b>','<i>Italic</i>','<u>Underline</u>','text-align:justify','color:']){check(view.includes(part),'Display '+part);check(word.includes(part),'Word '+part);}
 check(view.includes('text-align:center'),'Display retains original alignment');check(!word.includes('text-align:center'),'Word normalizes alignment to justify');
 const preview=answerPreview(q.answerHtml,200),box=document.createElement('div');box.innerHTML=preview;check(Array.from(box.textContent).length===200,'Preview limited to 200 characters');check(preview.includes('<b>Bold</b>'),'Preview keeps formatting');
 const form=document.createElement('form');form.innerHTML=fieldHtml({name:'answer',label:'Nội dung trả lời',type:'richtext',html:q.answerHtml});document.body.append(form);setupRichEditors(form);
 check(form.querySelectorAll('[data-command]').length===7,'Seven formatting buttons');check(form.querySelector('input[type=color]'),'Color picker');
 const editor=form.querySelector('.rich-input');check(editor.innerHTML.includes('<b>Bold</b>'),'Editing retains markup');
 editor.innerHTML='Selected text';editor.focus();const range=document.createRange();range.selectNodeContents(editor);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);editor.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));form.querySelector('[data-command=bold]').click();check(/<b>|font-weight/.test(editor.innerHTML),'Bold toolbar applies selection');
 for(const [command,pattern] of [['italic',/<i>|font-style/],['underline',/<u>|text-decoration/]]){form.querySelector('[data-command='+command+']').click();check(pattern.test(editor.innerHTML),command+' toolbar applies selection');}
 for(const [command,alignment] of [['justifyCenter','center'],['justifyRight','right'],['justifyFull','justify'],['justifyLeft','left']]){form.querySelector('[data-command='+command+']').click();check(sanitizeAnswerHtml(editor.innerHTML).includes('text-align:'+alignment),command+' alignment retained');}
 const color=form.querySelector('input[type=color]');color.value='#ff0000';color.dispatchEvent(new Event('input',{bubbles:true}));check(/color:(rgb\(255, 0, 0\)|#ff0000)/.test(sanitizeAnswerHtml(editor.innerHTML)),'Selected text color retained');
 const style=document.createElement('style');style.textContent='.expand-content[open]>summary .expand-preview,.expand-content[open]>summary .expand-more{display:none}';document.head.append(style);box.innerHTML=view;document.body.append(box);const details=box.querySelector('details');details.open=true;check(getComputedStyle(details.querySelector('.expand-preview')).display==='none','Open preview hidden');
 document.body.innerHTML='<pre id="result">PASS: rich answer toolbar, formatting, sanitization, preview, editing and Word HTML.</pre>';
};
const browserJs=js.replace('init();','try{('+checks.toString()+')()}catch(e){document.body.innerHTML="<pre>FAIL: "+e.message+"</pre>"}');
fs.writeFileSync(file,'<!doctype html><meta charset="utf-8"><body><script>'+browserJs+'</script>');
const browser=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
assert(browser,'Chrome or Edge required for browser checks');
try{
 const result=cp.spawnSync(browser,['--headless','--no-sandbox','--disable-gpu','--disable-software-rasterizer','--no-first-run','--disable-background-networking','--virtual-time-budget=1000','--user-data-dir='+path.join(dir,'profile'),'--dump-dom',require('node:url').pathToFileURL(file).href],{encoding:'utf8',timeout:20000,windowsHide:true,maxBuffer:2*1024*1024});
 assert(!result.error,result.error?.message);assert(result.stdout.includes('<pre id="result">PASS:'),result.stdout.slice(-2000)||result.stderr.slice(-1000));console.log(result.stdout.match(/<pre id="result">([^<]+)/)[1]);
}finally{fs.rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
