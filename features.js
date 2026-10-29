/* MEMOA 기능 추가 (2026-10-29, Claude) — 1차: 아이디어 짧은 기록, 링크 자동 붙여넣기, 카드 드래그, 폴더 휴지통 */
(function(){'use strict';
const A=window.MEMOAApp;
db.folderTomb ||= {};

/* ---------- 공통 ---------- */
const css=`
.note.idea-card{padding:9px 12px;margin:4px 0}
.note.idea-card .typebadge{font-size:10px;margin-bottom:2px}
.note.idea-card p{-webkit-line-clamp:5;white-space:pre-line;font-size:13px;line-height:1.5;color:inherit}
.note.idea-card.no-title h3{display:none}
.note.idea-card .chip{font-size:10px}
.folderrow.dropnote,[data-view="trash"].dropnote{outline:2px dashed var(--typecolor,#748b68);outline-offset:-2px;background:rgba(116,139,104,.12)}
[data-view="trash"].dropnote{outline-color:#b5533c;background:rgba(181,83,60,.1)}
.idea-hint{font-size:12px;color:#8a9083;margin:8px 0 0;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.idea-hint.over{color:#b5533c}
.idea-hint button{font-size:12px;padding:3px 9px}
.folder-trash{border:1px dashed #c9b9a6;border-radius:9px;padding:8px 10px;margin:6px 0 10px;background:#fbf7f1}
.folder-trash .label{font-size:11px;color:#8a9083;margin-bottom:4px}
.ftrash-row{display:flex;align-items:center;gap:8px;font-size:13px;padding:4px 0}
.ftrash-row span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ftrash-row small{color:#8a9083}
.btn-danger{background:#b5533c!important;border-color:#b5533c!important;color:#fff!important}
.clip-auto{font-size:12px;color:#748b68;margin:-4px 0 6px}`;
const st=document.createElement('style');st.id='memoa-features-style';st.textContent=css;document.head.append(st);
const httpUrl=s=>{try{const u=new URL(String(s||'').trim());return ['http:','https:'].includes(u.protocol)?u.href:null}catch{return null}};
const lineCount=el=>{if(!el)return 0;const t=(el.innerText||el.textContent||'').replace(/\u00a0/g,' ');return t.split('\n').filter(l=>l.trim()).length};
const linesOf=html=>{const d=document.createElement('div');d.innerHTML=String(html||'').replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|li|h[1-6]|blockquote|pre)>/gi,'\n');return (d.textContent||'').replace(/\u00a0/g,' ').split('\n').map(l=>l.trim()).filter(Boolean).join('\n')};
const subtree=f=>[f,...(typeof descendants==='function'?descendants(f):[])];
const refresh=()=>{setView(view)};

/* ---------- #1 아이디어 = 5줄 이내 짧은 기록 ---------- */
const IDEA_MAX=5;
function ideaHint(host,n){
  if(!host)return;
  let hint=host.nextElementSibling&&host.nextElementSibling.classList?.contains('idea-hint')?host.nextElementSibling:null;
  if(!n||n.type!=='idea'||host.hidden){if(hint)hint.remove();return}
  if(!hint){hint=document.createElement('div');hint.className='idea-hint';host.after(hint)}
  const c=lineCount(host),over=c>IDEA_MAX;
  hint.classList.toggle('over',over);
  hint.innerHTML=over?`<span>✧ 아이디어는 ${IDEA_MAX}줄까지예요 (${c}줄). 길어진 생각은 메모로 바꿔 두세요.</span><button type="button">메모로 전환</button>`:`<span>✧ 아이디어 · ${c}/${IDEA_MAX}줄</span>`;
  const b=hint.querySelector('button');if(b)b.onclick=()=>{n.type='note';persist();hint.remove();renderEditor();renderList();toast('메모로 전환했습니다.')};
}
A.ideaHint=()=>{ideaHint($('editor'),note());ideaHint($('quick-body'),note())};
['editor','quick-body'].forEach(id=>{const el=$(id);if(el)el.addEventListener('input',()=>setTimeout(A.ideaHint,0))});
const prevEditor=renderEditor;renderEditor=function(){prevEditor.apply(this,arguments);A.ideaHint()};
// 휴대폰 기록 화면은 별도 렌더 → 열릴 때도 표시
if($('quick-body'))new MutationObserver(()=>A.ideaHint()).observe($('quick-body'),{attributes:true,attributeFilter:['hidden']});

/* ---------- 목록: 아이디어 카드 + 휴지통의 폴더 ---------- */
const prevList=renderList;renderList=function(){
  prevList.apply(this,arguments);
  document.querySelectorAll('#notes .note[data-id]').forEach(el=>{
    const n=db.notes.find(x=>x.id===el.dataset.id);if(!n||n.type!=='idea')return;
    el.classList.add('idea-card');
    const p=el.querySelector('p'),txt=linesOf(n.html);
    if(p)p.textContent=txt;
    const first=(txt.split('\n').find(l=>l.trim())||'').trim();
    if(n.autoTitle||!n.title||n.title.trim()===first)el.classList.add('no-title');
  });
  if(view==='trash')renderFolderTrash();
};
function trashedGroups(){
  const groups=new Map();
  for(const [name,t] of Object.entries(db.folderTomb||{})){
    if(t.rename||db.folders.includes(name))continue;
    const g=groups.get(t.group)||{group:t.group,top:t.top||name,at:t.at,names:[]};g.names.push(name);groups.set(t.group,g);
  }
  return [...groups.values()].sort((a,b)=>b.at-a.at);
}
function renderFolderTrash(){
  const list=$('notes');if(!list)return;list.querySelector('.folder-trash')?.remove();
  const gs=trashedGroups();if(!gs.length)return;
  const box=document.createElement('div');box.className='folder-trash';
  box.innerHTML='<div class="label">휴지통의 폴더</div>'+gs.map(g=>{const cnt=db.notes.filter(n=>n.deleted&&n.trashedWithFolder===g.group).length;return `<div class="ftrash-row"><span>▱ ${esc(g.top)}${g.names.length>1?` 외 하위 ${g.names.length-1}개`:''}</span><small>메모 ${cnt}개 · ${new Date(g.at).toLocaleDateString('ko',{month:'short',day:'numeric'})}</small><button type="button" data-restorefolder="${esc(g.group)}">복원</button></div>`}).join('');
  list.prepend(box);
  const empty=list.querySelector('.empty');if(empty)empty.remove();
  box.querySelectorAll('[data-restorefolder]').forEach(b=>b.onclick=()=>A.restoreFolder(b.dataset.restorefolder));
}

/* ---------- #4 폴더 휴지통 ---------- */
A.trashFolder=function(f){
  if(!db.folders.includes(f))return;
  const all=subtree(f).filter(x=>db.folders.includes(x));
  const live=db.notes.filter(n=>!n.deleted&&all.includes(n.folder));
  if(db.folders.length-all.length<1)return toast('마지막 폴더는 휴지통으로 보낼 수 없습니다.');
  modal(`<div class="eyebrow">MOVE TO TRASH</div><h2>‘${esc(f)}’ 폴더를 휴지통으로 보낼까요?</h2><p>${all.length>1?`하위 폴더 ${all.length-1}개와 `:''}메모 ${live.length}개가 함께 휴지통으로 이동합니다.<br>휴지통에서 폴더를 복원하면 메모도 함께 돌아옵니다.</p><div class="row"><button type="button" onclick="closeModal()">취소</button><button type="button" class="primary btn-danger" id="confirm-folder-trash">휴지통으로 이동</button></div>`);
  $('confirm-folder-trash').onclick=()=>{
    const at=Date.now(),group=f+'@'+at;
    for(const x of all){const m=db.folderMeta[x]||{};db.folderTomb[x]={at,group,top:f,parent:m.parent||'',type:m.type||'general',color:m.color||'',count:0,index:db.folders.indexOf(x)}}
    for(const n of live){n.deleted=true;n.trashedWithFolder=group}
    db.folderTomb[f].count=live.length;
    db.folders=db.folders.filter(x=>!all.includes(x));
    for(const x of all){delete db.folderMeta[x];delete db.sorts['folder:'+x]}
    if(view.startsWith('folder:')&&all.includes(view.slice(7)))view='all';
    persist();closeModal();refresh();toast(`‘${f}’ 폴더를 휴지통으로 옮겼습니다.`);
  };
};
A.restoreFolder=function(group){
  const entries=Object.entries(db.folderTomb||{}).filter(([,t])=>t.group===group);if(!entries.length)return;
  const now=Date.now(),names=entries.map(([k])=>k);
  entries.sort((a,b)=>(a[1].index??1e9)-(b[1].index??1e9));
  for(const [name,t] of entries){
    if(!db.folders.includes(name)){const i=Number.isInteger(t.index)&&t.index>=0?Math.min(t.index,db.folders.length):db.folders.length;db.folders.splice(i,0,name)}
    const parent=t.parent&&(db.folders.includes(t.parent)||names.includes(t.parent))?t.parent:'';
    db.folderMeta[name]={...(db.folderMeta[name]||{}),parent,type:t.type||'general',color:t.color||'#748b68',collapsed:false,revivedAt:now};
    delete db.folderTomb[name];
  }
  let cnt=0;for(const n of db.notes)if(n.trashedWithFolder===group){n.deleted=false;delete n.trashedWithFolder;cnt++}
  persist();refresh();toast(`폴더와 메모 ${cnt}개를 복원했습니다.`);
};
// 폴더 설정 창에 '휴지통으로' 버튼
if(typeof folderDialog==='function'){const prevFD=folderDialog;folderDialog=function(edit='',parent=''){prevFD(edit,parent);if(!edit)return;const row=$('dialog').querySelector('.row');if(!row)return;const b=document.createElement('button');b.type='button';b.textContent='휴지통으로';b.style.marginRight='auto';b.style.color='#b5533c';b.onclick=()=>A.trashFolder(edit);row.prepend(b)}}
// 이름 바꾸기·새 폴더: 동기화에서 옛 이름이 되살아나지 않게 기록
if(typeof saveFolder==='function'){const prevSF=saveFolder;saveFolder=function(edit){const before=new Set(db.folders);prevSF(edit);const now=Date.now();let changed=false;for(const f of db.folders)if(!before.has(f)){db.folderMeta[f]={...(db.folderMeta[f]||{}),revivedAt:now};if(db.folderTomb[f])delete db.folderTomb[f];changed=true}if(edit&&!db.folders.includes(edit)){db.folderTomb[edit]={at:now,group:'rename:'+edit+'@'+now,top:edit,rename:true};changed=true}if(changed)persist()}}
// 메모 하나를 복원했는데 원래 폴더가 휴지통에 있으면 수집함으로
const prevRemove=removeNote;removeNote=function(){const id=current;prevRemove.apply(this,arguments);const n=db.notes.find(x=>x.id===id);if(n&&!n.deleted)rescue(n)};
function rescue(n){if(n.trashedWithFolder)delete n.trashedWithFolder;if(db.folders.includes(n.folder))return;const home='수집함';if(!db.folders.includes(home)){db.folders.push(home);db.folderMeta[home]={parent:'',type:'ref',collapsed:false,revivedAt:Date.now()}}toast(`원래 폴더 ‘${n.folder}’가 휴지통에 있어 ${home}(으)로 복원했습니다.`);n.folder=home;persist();refresh()}

/* ---------- #3 카드 드래그 → 폴더 / 휴지통 ---------- */
function moveNote(id,f){const n=db.notes.find(x=>x.id===id);if(!n||!db.folders.includes(f))return;const wasDeleted=n.deleted;if(n.folder===f&&!wasDeleted)return;n.folder=f;if(wasDeleted){n.deleted=false;delete n.trashedWithFolder}persist();refresh();toast(`${wasDeleted?'복원해서 ':''}‘${f}’(으)로 옮겼습니다.`)}
function trashNote(id){const n=db.notes.find(x=>x.id===id);if(!n||n.deleted)return;n.deleted=true;persist();refresh();toast('휴지통으로 옮겼습니다.')}
const prevSide=renderSide;renderSide=function(){
  prevSide.apply(this,arguments);
  document.querySelectorAll('#folders .folderrow[data-folder]').forEach(el=>{
    el.addEventListener('dragover',e=>{if(drag?.id){e.preventDefault();el.classList.add('dropnote')}});
    el.addEventListener('dragleave',()=>el.classList.remove('dropnote'));
    el.addEventListener('drop',e=>{el.classList.remove('dropnote');if(!drag?.id)return;e.preventDefault();e.stopPropagation();const id=drag.id;drag=null;moveNote(id,el.dataset.folder)});
  });
};
const trashNav=document.querySelector('.sidebottom [data-view="trash"]')||document.querySelector('[data-view="trash"]');
if(trashNav){
  trashNav.addEventListener('dragover',e=>{if(drag?.id||drag?.folder){e.preventDefault();trashNav.classList.add('dropnote')}});
  trashNav.addEventListener('dragleave',()=>trashNav.classList.remove('dropnote'));
  trashNav.addEventListener('drop',e=>{trashNav.classList.remove('dropnote');if(!drag)return;e.preventDefault();const d=drag;drag=null;if(d.id)trashNote(d.id);else if(d.folder)A.trashFolder(d.folder)});
}
document.addEventListener('dragend',()=>document.querySelectorAll('.dropnote').forEach(x=>x.classList.remove('dropnote')));

/* ---------- #2 링크 버튼: 복사해 둔 링크 자동 입력 ---------- */
const prevLink=linkDialog;linkDialog=function(){
  prevLink.apply(this,arguments);
  const input=$('linkurl');
  if(!input||input.value.trim()||(typeof captureDraft!=='undefined'&&captureDraft))return;
  if(!navigator.clipboard?.readText)return;
  navigator.clipboard.readText().then(text=>{
    const url=httpUrl(text);if(!url||input.value.trim()||!document.body.contains(input))return;
    input.value=url;input.dispatchEvent(new Event('input',{bubbles:true}));
    const tip=document.createElement('div');tip.className='clip-auto';tip.textContent='복사해 둔 링크를 붙였습니다.';input.after(tip);
    const t=$('linktitle');if(t&&!t.value.trim()){try{t.placeholder=new URL(url).hostname+' (제목을 입력하세요)'}catch{}}
  }).catch(()=>{});
};

refresh();
})();

/* ===== 2차 (2026-10-29): 독서노트, 메모 연결, 휴대폰 링크 자동 입력 ===== */
(function(){'use strict';
const A=window.MEMOAApp,D=window.MEMOADoc;
const css=`
.reading-sheet table{width:100%;border-collapse:collapse;margin:0 0 16px;font-size:14px}
.reading-sheet th,.reading-sheet td{border:1px solid #e3ddd2;padding:7px 9px;vertical-align:top;text-align:left}
.reading-sheet th{background:#f6f2ea;color:#5f6758;font-weight:600;white-space:nowrap;width:1%}
.reading-sheet .book-info td{min-width:160px}
.reading-sheet .chapter-table th{width:auto}
.reading-sheet .chapter-table td[data-col="chapter"]{width:18%}
.reading-sheet .chapter-table td[data-col="keyword"]{width:24%}
.reading-sheet select,.reading-sheet input{font:inherit;border:1px solid #ddd6c9;border-radius:6px;padding:3px 6px;background:#fff}
.book-results{display:flex;flex-direction:column;gap:6px;max-height:55vh;overflow:auto;margin:10px 0}
.book-hit{display:flex;gap:10px;align-items:flex-start;text-align:left;padding:8px;border:1px solid #e3ddd2;border-radius:8px;background:#fffefa;cursor:pointer;width:100%}
.book-hit:hover{border-color:#748b68}
.book-hit img{width:42px;height:60px;object-fit:cover;border-radius:3px;flex:none;background:#eee}
.book-hit b{display:block;font-size:14px}.book-hit small{color:#8a9083}
.book-keys{border-top:1px solid #eee;margin-top:10px;padding-top:10px;font-size:13px}
.book-keys input{width:100%;margin:4px 0 8px}
.book-keys details summary{cursor:pointer;color:#5f6758}
.note-links{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:10px 0 0;font-size:12px}
.note-links .label{color:#8a9083;margin-right:2px}
.link-chip{display:inline-flex;align-items:center;gap:4px;border:1px solid #d9d2c4;border-radius:999px;padding:2px 4px 2px 9px;background:#fbf8f2;cursor:pointer;max-width:240px}
.link-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.link-chip.in{border-style:dashed}
.link-chip button{border:0;background:none;padding:0 4px;cursor:pointer;color:#8a9083;font-size:13px}
.note-links .add-link{border:1px dashed #b9c4ae;border-radius:999px;padding:2px 10px;background:none;cursor:pointer;color:#5f6758}
.link-count{font-size:11px;color:#5f6758;margin-left:4px}
.link-pick{display:flex;flex-direction:column;gap:4px;max-height:50vh;overflow:auto;margin:8px 0}
.link-pick button{text-align:left;padding:7px 9px;border:1px solid #e9e3d8;border-radius:7px;background:#fffefa;cursor:pointer}
.link-pick button small{color:#8a9083;margin-left:6px}`;
const st=document.createElement('style');st.textContent=css;document.head.append(st);
const httpUrl=s=>{try{const u=new URL(String(s||'').trim());return ['http:','https:'].includes(u.protocol)?u.href:null}catch{return null}};

/* ---------- #2 보강: 휴대폰 기록 화면 ↗ 링크 ---------- */
if(typeof A.quickLink==='function'){const prevQL=A.quickLink;A.quickLink=function(){prevQL.apply(this,arguments);const input=$('quick-link-url');if(!input||!navigator.clipboard?.readText)return;navigator.clipboard.readText().then(t=>{const u=httpUrl(t);if(u&&!input.value.trim()&&document.body.contains(input))input.value=u}).catch(()=>{})}}

/* ---------- #5 독서노트 ---------- */
if(D&&D.formats){
const CATS=['소설','시·에세이','인문','사회','경제·경영','자기계발','과학','역사','예술','만화','어린이·청소년','기타'];
const INFO=[['title','제목'],['author','작가'],['publisher','출판사'],['year','출판연도'],['isbn','ISBN']];
D.formats.reading={name:'독서노트',icon:'❒',desc:'책 정보 · 챕터별 키워드와 요약'};
const today=()=>new Date().toLocaleDateString('en-CA');
const row=(ch='',kw='',sum='')=>`<tr class="chapter-row"><td data-col="chapter">${ch||'<br>'}</td><td data-col="keyword">${kw||'<br>'}</td><td data-col="summary">${sum||'<br>'}</td></tr>`;
const catSelect=(v='')=>`<select data-book="category" aria-label="분류"><option value="" ${v?'':'selected'}>분류 선택</option>${CATS.map(c=>`<option value="${c}" ${v===c?'selected':''}>${c}</option>`).join('')}</select>`;
D.readingHTML=(body='')=>`<div class="reading-sheet"><table class="book-info"><tbody><tr><th contenteditable="false">분류</th><td contenteditable="false">${catSelect()}</td></tr>${INFO.map(([k,l])=>`<tr><th contenteditable="false">${l}</th><td data-book="${k}"><br></td></tr>`).join('')}<tr><th contenteditable="false">독서 시작일</th><td contenteditable="false"><input type="date" data-book="start" value="${today()}" aria-label="독서 시작일"></td></tr><tr><th contenteditable="false">독서 완료일</th><td contenteditable="false"><input type="date" data-book="end" aria-label="독서 완료일"></td></tr></tbody></table><table class="chapter-table"><thead><tr><th contenteditable="false">챕터</th><th contenteditable="false">키워드</th><th contenteditable="false">요약</th></tr></thead><tbody>${row(body&&body!=='<p><br></p>'?'':'')}${row()}${row()}</tbody></table>${body&&body.trim()!=='<p><br></p>'?`<div class="reading-extra">${body}</div>`:''}</div>`;
const prevHtml=D.html;D.html=function(format,html=''){return format==='reading'?D.readingHTML(html):prevHtml.apply(this,arguments)};
const prevLinear=D.linear;D.linear=function(n){if(n?.template!=='reading')return prevLinear.apply(this,arguments);const w=document.createElement('div');w.innerHTML=n.html||'';const b=readBook(w);let out='<h3>책 정보</h3>'+[['분류',b.category],...INFO.map(([k,l])=>[l,b[k]]),['독서 시작일',b.start],['독서 완료일',b.end]].filter(([,v])=>v).map(([l,v])=>`<p>${esc(l)}: ${esc(v)}</p>`).join('');const rows=[...w.querySelectorAll('.chapter-row')].map(r=>[...r.children].map(td=>td.innerHTML.replace(/^<br>$/,'').trim()));if(rows.some(r=>r.some(Boolean)))out+='<h3>챕터 · 키워드 · 요약</h3>'+rows.filter(r=>r.some(Boolean)).map(([c,k,s])=>`<p><strong>${c||'—'}</strong>${k?` · ${k}`:''}</p>${s?`<p>${s}</p>`:''}`).join('');const extra=w.querySelector('.reading-extra');if(extra)out+=extra.innerHTML;return out};
function readBook(root){const b={};if(!root)return b;for(const [k] of INFO){const el=root.querySelector(`[data-book="${k}"]`);b[k]=(el?.textContent||'').trim()}const sel=root.querySelector('select[data-book="category"]');b.category=(sel?.querySelector('option[selected]')?.value??sel?.value)||'';for(const k of ['start','end']){const el=root.querySelector(`input[data-book="${k}"]`);b[k]=el?.getAttribute('value')||el?.value||''}b.chapters=root.querySelectorAll('.chapter-row').length;return b}
// 분류 선택은 저장 전에 selected 속성 반영 (기존 change 처리보다 먼저)
$('editor').addEventListener('change',e=>{const s=e.target;if(s.matches?.('select[data-book]'))[...s.options].forEach(o=>o.toggleAttribute('selected',o.value===s.value))},true);
// 저장할 때 책 정보를 구조화 필드로도 보관
const prevUpdate=update;update=function(){const n=note();if(n&&n.template==='reading'){const b=readBook($('editor'));const prevTitle=n.book?.title||'';n.book={category:b.category,title:b.title,author:b.author,publisher:b.publisher,year:b.year,isbn:b.isbn,start:b.start,end:b.end};const tEl=$('title');if(b.title&&tEl&&(!tEl.value.trim()||tEl.value.trim()===prevTitle))tEl.value=b.title}return prevUpdate.apply(this,arguments)};
D.addChapter=()=>{const body=$('editor').querySelector('.chapter-table tbody');if(!body)return;body.insertAdjacentHTML('beforeend',row());update();body.lastElementChild?.firstElementChild?.focus()};
const prevRE=renderEditor;renderEditor=function(){prevRE.apply(this,arguments);const n=note(),panel=$('document-format');if(!n||!panel||n.template!=='reading')return;panel.insertAdjacentHTML('beforeend','<button type="button" onclick="MEMOAApp.bookSearch()">⌕ 책 검색</button><button type="button" onclick="MEMOADoc.addChapter()">＋ 챕터</button>')};

/* 책 검색: 카카오(한국 책) 우선, Google Books 예비. 키는 코드가 아니라 기기 데이터(db.bookSearch)에 저장 → Drive 동기화로 다른 기기에 전달 */
const GMAP=[[/fiction|novel/i,'소설'],[/poetry|essay/i,'시·에세이'],[/business|economics|finance|management/i,'경제·경영'],[/self-help|personal development/i,'자기계발'],[/social|political|law|education/i,'사회'],[/history/i,'역사'],[/science|technology|mathematics|medical|nature/i,'과학'],[/art|music|design|photography|architecture/i,'예술'],[/comic|graphic novel/i,'만화'],[/juvenile|young adult/i,'어린이·청소년'],[/philosophy|religion|psychology|literary criticism/i,'인문']];
const keys=()=>db.bookSearch||{};
async function searchBooks(q){const k=keys(),isbn=q.replace(/[-\s]/g,'');const isIsbn=/^(\d{10}|\d{13}|\d{9}X)$/i.test(isbn);
  if(k.kakao){const r=await fetch('https://dapi.kakao.com/v3/search/book?size=15&'+new URLSearchParams(isIsbn?{query:isbn,target:'isbn'}:{query:q}),{headers:{Authorization:'KakaoAK '+k.kakao}});if(r.status===401)throw Error('카카오 키를 확인해주세요.');if(!r.ok)throw Error('카카오 검색 실패 ('+r.status+')');const j=await r.json();return (j.documents||[]).map(d=>({title:d.title,author:(d.authors||[]).join(', ')+((d.translators||[]).length?` (옮김 ${d.translators.join(', ')})`:''),publisher:d.publisher||'',year:(d.datetime||'').slice(0,4),isbn:(d.isbn||'').split(' ').find(x=>x.length===13)||(d.isbn||'').trim(),thumb:d.thumbnail||'',category:''}))}
  if(k.google){const r=await fetch('https://www.googleapis.com/books/v1/volumes?'+new URLSearchParams({q:isIsbn?'isbn:'+isbn:q,maxResults:'15',printType:'books',key:k.google}));if(!r.ok)throw Error('Google Books 검색 실패 ('+r.status+')');const j=await r.json();return (j.items||[]).map(i=>{const v=i.volumeInfo||{},ids=v.industryIdentifiers||[];const cat=(v.categories||[]).join(' ');return {title:v.title+(v.subtitle?': '+v.subtitle:''),author:(v.authors||[]).join(', '),publisher:v.publisher||'',year:(v.publishedDate||'').slice(0,4),isbn:(ids.find(x=>x.type==='ISBN_13')||ids[0]||{}).identifier||'',thumb:(v.imageLinks?.thumbnail||'').replace(/^http:/,'https:'),category:(GMAP.find(([re])=>re.test(cat))||[])[1]||''}})}
  throw Error('NO_KEY')}
function keyForm(){const k=keys();return `<div class="book-keys"><details ${k.kakao||k.google?'':'open'}><summary>검색 키 설정</summary><p>한국 책은 카카오가 가장 정확합니다. 둘 중 하나만 있으면 됩니다. 키는 이 메모 데이터에 저장되어 Google Drive 동기화로 다른 기기에도 전달됩니다.</p><label>카카오 REST API 키</label><input id="key-kakao" value="${esc(k.kakao||'')}" placeholder="developers.kakao.com → 내 애플리케이션 → 앱 키"><label>Google Books API 키 (예비)</label><input id="key-google" value="${esc(k.google||'')}" placeholder="Google Cloud → 사용자 인증 정보 → API 키"><div class="row"><button type="button" class="primary" id="key-save">키 저장</button></div></details></div>`}
A.bookSearch=function(){const n=note();if(!n)return;const b=n.book||{};const pre=b.title||(n.title&&!/^제목 없는/.test(n.title)?n.title:'');
  modal(`<div class="eyebrow">BOOK SEARCH</div><h2>책 검색</h2><div class="row" style="justify-content:stretch"><input id="book-q" style="flex:1" placeholder="책 제목, 작가 또는 ISBN" value="${esc(pre)}"><button type="button" class="primary" id="book-go">검색</button></div><div id="book-results" class="book-results"></div>${keyForm()}<div class="row"><button type="button" onclick="closeModal()">닫기</button></div>`);
  const go=async()=>{const q=$('book-q').value.trim(),box=$('book-results');if(!q)return;box.textContent='검색 중…';try{const hits=await searchBooks(q);if(!hits.length){box.textContent='검색 결과가 없습니다. 제목을 줄이거나 ISBN으로 찾아보세요.';return}box.innerHTML=hits.map((h,i)=>`<button type="button" class="book-hit" data-hit="${i}">${h.thumb?`<img src="${esc(h.thumb)}" alt="">`:'<img alt="">'}<span><b>${esc(h.title)}</b><small>${esc([h.author,h.publisher,h.year].filter(Boolean).join(' · '))}</small><br><small>${esc(h.isbn?'ISBN '+h.isbn:'')}</small></span></button>`).join('');box.querySelectorAll('[data-hit]').forEach(el=>el.onclick=()=>fillBook(hits[+el.dataset.hit]))}catch(e){box.textContent=e.message==='NO_KEY'?'아래 "검색 키 설정"에 카카오 또는 Google Books 키를 먼저 넣어주세요.':e.message}};
  $('book-go').onclick=go;$('book-q').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();go()}};
  $('key-save').onclick=()=>{db.bookSearch={kakao:$('key-kakao').value.trim(),google:$('key-google').value.trim(),at:Date.now()};persist();toast('검색 키를 저장했습니다.');if($('book-q').value.trim())go()};
  if(pre&&(keys().kakao||keys().google))go();
};
function fillBook(h){const ed=$('editor'),n=note();if(!n||!ed)return;A.checkpoint?.('책 정보 입력 전');
  for(const [k] of INFO){const el=ed.querySelector(`[data-book="${k}"]`);if(el)el.textContent=h[k]||''}
  const sel=ed.querySelector('select[data-book="category"]');if(sel&&h.category){sel.value=h.category;[...sel.options].forEach(o=>o.toggleAttribute('selected',o.value===h.category))}
  if(!n.title||/^제목 없는/.test(n.title)||n.title===(n.book?.title||'')){n.title=h.title;$('title').value=h.title}
  update();closeModal();toast('책 정보를 채웠습니다.'+(h.category?'':' 분류는 직접 골라주세요.'))}

/* 목록 카드: 독서노트는 작가 · 출판사 · 읽은 기간 */
const prevRL=renderList;renderList=function(){prevRL.apply(this,arguments);document.querySelectorAll('#notes .note[data-id]').forEach(el=>{const n=db.notes.find(x=>x.id===el.dataset.id);if(!n||n.template!=='reading'||!n.book)return;const p=el.querySelector('p');if(!p)return;const b=n.book;const period=b.start?(b.start.slice(5).replace('-','.')+(b.end?' ~ '+b.end.slice(5).replace('-','.'):' ~ 읽는 중')):'';p.textContent=['❒ '+[b.author,b.publisher].filter(Boolean).join(' · '),b.category,period].filter(x=>x&&x!=='❒ ').join('  |  ')})};
}

/* ---------- #7 메모 연결 (양방향 표시, 한쪽에만 저장) ---------- */
const ids=n=>Array.isArray(n?.links)?n.links.filter(x=>typeof x==='string'):[];
function backlinkMap(){const m=new Map();for(const n of db.notes){if(n.deleted)continue;for(const id of ids(n)){if(!m.has(id))m.set(id,new Set());m.get(id).add(n.id)}}return m}
function related(n,bm=backlinkMap()){const out=new Map();for(const id of ids(n)){const t=db.notes.find(x=>x.id===id&&!x.deleted);if(t)out.set(id,{note:t,dir:'out'})}for(const id of bm.get(n.id)||[]){if(out.has(id))continue;const t=db.notes.find(x=>x.id===id&&!x.deleted);if(t)out.set(id,{note:t,dir:'in'})}return [...out.values()]}
A.related=n=>related(n);
const icon=n=>{try{return typeof typeOf==='function'?typeOf(n).icon:'▤'}catch{return '▤'}};
A.linkNotes=(a,b)=>{const n=db.notes.find(x=>x.id===a);if(!n||a===b)return;if(ids(n).includes(b)||ids(db.notes.find(x=>x.id===b)).includes(a))return;n.links=[...ids(n),b];persist();renderEditor();renderList()};
A.unlinkNotes=(a,b)=>{for(const [x,y] of [[a,b],[b,a]]){const n=db.notes.find(z=>z.id===x);if(n&&ids(n).includes(y))n.links=ids(n).filter(i=>i!==y)}persist();renderEditor();renderList()};
function renderLinks(){const n=note(),tags=$('tags');let bar=$('note-links');if(!n||!tags||n.deleted){bar?.remove();return}if(!bar){bar=document.createElement('div');bar.id='note-links';bar.className='note-links';tags.after(bar)}
  const rel=related(n);
  bar.innerHTML='<span class="label">연결된 메모</span>'+rel.map(({note:t,dir})=>`<span class="link-chip ${dir}" data-open="${esc(t.id)}" title="${dir==='in'?'이 메모를 연결한 메모':'이 메모에서 연결한 메모'}"><span>${icon(t)} ${esc(t.title||'제목 없는 메모')}</span><button type="button" data-unlink="${esc(t.id)}" aria-label="연결 해제">×</button></span>`).join('')+'<button type="button" class="add-link">＋ 연결</button>';
  bar.querySelectorAll('[data-open]').forEach(el=>el.onclick=e=>{if(e.target.closest('[data-unlink]'))return;const id=el.dataset.open;if(typeof openMemo==='function')openMemo(id);else{current=id;renderEditor();renderList()}});
  bar.querySelectorAll('[data-unlink]').forEach(b=>b.onclick=e=>{e.stopPropagation();A.unlinkNotes(n.id,b.dataset.unlink)});
  bar.querySelector('.add-link').onclick=()=>linkPicker(n);
}
function linkPicker(n){const linked=new Set(related(n).map(r=>r.note.id));
  modal(`<div class="eyebrow">LINK NOTES</div><h2>연결할 메모</h2><input id="link-q" placeholder="제목·내용·태그로 찾기" autocomplete="off"><div id="link-pick" class="link-pick"></div><div class="row"><button type="button" onclick="closeModal()">닫기</button></div>`);
  const draw=()=>{const q=$('link-q').value.trim().toLowerCase();const list=db.notes.filter(x=>!x.deleted&&x.id!==n.id&&!linked.has(x.id)&&(!q||[x.title,textOf(x.html||''),...(x.tags||[])].join(' ').toLowerCase().includes(q))).sort((a,b)=>b.modified-a.modified).slice(0,60);
    $('link-pick').innerHTML=list.map(x=>`<button type="button" data-pick="${esc(x.id)}">${icon(x)} ${esc(x.title||'제목 없는 메모')}<small>${esc(typeof folderPath==='function'?folderPath(x.folder):x.folder)}</small></button>`).join('')||'<p>연결할 메모가 없습니다.</p>';
    $('link-pick').querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{A.linkNotes(n.id,b.dataset.pick);closeModal();toast('메모를 연결했습니다.')})};
  $('link-q').oninput=draw;draw();setTimeout(()=>$('link-q').focus(),0)}
const prevRE2=renderEditor;renderEditor=function(){prevRE2.apply(this,arguments);renderLinks()};
const prevRL2=renderList;renderList=function(){prevRL2.apply(this,arguments);const bm=backlinkMap();document.querySelectorAll('#notes .note[data-id]').forEach(el=>{const n=db.notes.find(x=>x.id===el.dataset.id);if(!n)return;const c=related(n,bm).length;if(!c)return;const meta=el.querySelector('.meta span:last-child')||el.querySelector('.meta');if(meta&&!meta.querySelector('.link-count'))meta.insertAdjacentHTML('afterbegin',`<span class="link-count" title="연결된 메모 ${c}개">🔗${c}</span>`)})};
renderEditor();renderList();
})();

/* ===== 3차 (2026-10-29): 스케줄러 → Google 캘린더, 지난 일정 흐리게 ===== */
(function(){'use strict';
const A=window.MEMOAApp,C=window.MEMOACore;
const css=`
.note.past,.quick-note.past{opacity:.5}
.note.past:hover,.quick-note.past:hover{opacity:.8}
.cal-state{font-size:12px;color:#5f6758;margin-left:6px}
.cal-state.err{color:#b5533c}
.cal-card{margin-top:16px}`;
const st=document.createElement('style');st.textContent=css;document.head.append(st);
const API='https://www.googleapis.com/calendar/v3/calendars/primary/events';
const TZ=(()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Seoul'}catch{return 'Asia/Seoul'}})();
const today=()=>new Date().toLocaleDateString('en-CA');
const on=()=>!!db.calendarSync?.on;
const canPush=()=>on()&&A.drive.token&&Date.now()<A.drive.expires&&/calendar\.events/.test(A.drive.scope||'');
let lastState='',busy=false,timer=null;

/* 지난 일정 흐리게 (PC 목록 + 휴대폰 목록) */
const isPast=n=>n&&n.template==='scheduler'&&/^\d{4}-\d{2}-\d{2}$/.test(n.schedulerDate||'')&&n.schedulerDate<today();
const prevRL=renderList;renderList=function(){prevRL.apply(this,arguments);document.querySelectorAll('#notes .note[data-id]').forEach(el=>{const n=db.notes.find(x=>x.id===el.dataset.id);el.classList.toggle('past',isPast(n));if(isPast(n))el.title='지난 일정 · '+n.schedulerDate})};
const qn=$('quick-notes');if(qn){const mark=()=>qn.querySelectorAll('[data-quick-note]').forEach(el=>el.classList.toggle('past',isPast(db.notes.find(x=>x.id===el.dataset.quickNote))));new MutationObserver(mark).observe(qn,{childList:true});mark()}

/* 보낸 기록은 기기별(localStorage) — 메모를 건드리지 않아 기기 간 충돌 사본이 생기지 않음. 일정 ID가 고정이라 여러 기기가 보내도 중복되지 않음 */
const SENT='memoa-cal-sent';const loadSent=()=>{try{return JSON.parse(localStorage.getItem(SENT)||'{}')||{}}catch{return {}}};const saveSent=s=>{try{localStorage.setItem(SENT,JSON.stringify(s))}catch{}};
function rowsOf(n){const w=document.createElement('div');w.innerHTML=n.html||'';return [...w.querySelectorAll('.schedule-row')].map((r,i)=>{const time=(r.querySelector('input[type=time]')?.getAttribute('value')||'09:00').slice(0,5);const box=r.querySelector('.schedule-text');const d=document.createElement('div');d.innerHTML=(box?.innerHTML||'').replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|li)>/gi,'\n');const text=(d.textContent||'').replace(/\u00a0/g,' ').split('\n').map(s=>s.trim()).filter(Boolean);return {sid:r.dataset.sid||'i'+i,time,text}})}
const pad=x=>String(x).padStart(2,'0');
function endOf(date,time){const [h,m]=time.split(':').map(Number);const d=new Date(date+'T00:00:00');d.setHours(h+1,m||0);return `${d.toLocaleDateString('en-CA')}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`}
const eventId=(n,sid)=>'memoa'+C.hash(n.id)+C.hash(String(sid));
function desired(n){if(n.deleted||n._conflictOf||n.template!=='scheduler'||!/^\d{4}-\d{2}-\d{2}$/.test(n.schedulerDate||''))return new Map();const out=new Map();for(const r of rowsOf(n)){if(!r.text.length||/^(일정 내용|첫 번째 일정)$/.test(r.text.join(' ')))continue;const body={summary:r.text[0].slice(0,250),description:[...r.text.slice(1),'',`MEMOA · ${n.title||'스케줄러'}`].join('\n').trim(),start:{dateTime:`${n.schedulerDate}T${r.time}:00`,timeZone:TZ},end:{dateTime:endOf(n.schedulerDate,r.time),timeZone:TZ},status:'confirmed',extendedProperties:{private:{memoa:'1',note:n.id}}};out.set(r.sid,{body,hash:C.hash(JSON.stringify(body))})}return out}
async function call(method,url,body){const r=await fetch(url,{method,headers:{Authorization:'Bearer '+A.drive.token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(r.status===401){A.drive.token=null;A.lostConnection?.();throw Error('Google 연결이 만료되었습니다.')}if(r.status===403){const t=await r.text();throw Error(/accessNotConfigured|has not been used|disabled/i.test(t)?'Google Cloud에서 Calendar API를 사용 설정해주세요.':'캘린더 권한이 없습니다. 설정에서 캘린더 연결을 다시 해주세요.')}return r}
async function upsert(id,body){let r=await call('PATCH',`${API}/${id}`,body);if(r.status===404){r=await call('POST',API,{...body,id});if(r.status===409)r=await call('PUT',`${API}/${id}`,body)}if(!r.ok)throw Error('캘린더 반영 실패 ('+r.status+')')}
async function remove(id){const r=await call('DELETE',`${API}/${id}`);if(!r.ok&&![404,410].includes(r.status))throw Error('캘린더 일정 삭제 실패 ('+r.status+')')}
function pendingCount(){let c=0;const all=loadSent();for(const n of db.notes){const want=desired(n),sent=all[n.id]||{};for(const [sid,w] of want)if(sent[sid]!==w.hash)c++;for(const sid of Object.keys(sent))if(!want.has(sid))c++}return c}
A.calendarPush=async function(force){
  if(!on()||busy)return;if(!canPush()){setState(pendingCount()?'캘린더 대기 · Google 연결 필요':'');return}
  busy=true;let done=0;const all=loadSent();
  try{
    for(const n of db.notes){
      if(n.template!=='scheduler'&&!all[n.id])continue;
      const want=desired(n),sent={...(all[n.id]||{})};let touched=false;
      for(const [sid,w] of want)if(force||sent[sid]!==w.hash){await upsert(eventId(n,sid),w.body);sent[sid]=w.hash;touched=true;done++}
      for(const sid of Object.keys(sent))if(!want.has(sid)){await remove(eventId(n,sid));delete sent[sid];touched=true;done++}
      if(touched){if(Object.keys(sent).length)all[n.id]=sent;else delete all[n.id];saveSent(all)}
    }
    setState(done?`캘린더 반영 ✓ (${done}건)`:'캘린더 최신 ✓');
  }catch(e){setState(e.message,true)}finally{busy=false}
};
function schedule(){if(!on())return;clearTimeout(timer);timer=setTimeout(()=>A.calendarPush(),8000)}
function setState(text,err){lastState=text;const el=$('cal-state');if(el){el.textContent=text;el.classList.toggle('err',!!err)}if(err)toast(text)}
// 편집·동기화·화면 복귀 후 자동 반영
const prevPersist=persist;persist=function(){const r=prevPersist.apply(this,arguments);const n=note();if(on()&&(n?.template==='scheduler'||loadSent()[n?.id]))schedule();return r};
const prevSync=A.sync;A.sync=function(){const p=prevSync.apply(this,arguments);Promise.resolve(p).then(schedule,()=>{});return p};

/* 스케줄러 메모지 줄: 상태 + 지금 반영 */
const prevRE=renderEditor;renderEditor=function(){prevRE.apply(this,arguments);const n=note(),panel=$('document-format');if(!n||!panel||n.template!=='scheduler')return;panel.insertAdjacentHTML('beforeend',on()?`<button type="button" onclick="MEMOAApp.calendarPush(true)">⟳ 캘린더 반영</button><span id="cal-state" class="cal-state">${esc(lastState||(canPush()?'':'Google 연결 후 자동 반영'))}</span>`:`<button type="button" onclick="MEMOAApp.calendarSetup()">▦ 캘린더 연동</button>`)};

/* 설정: 캘린더 연동 켜기/끄기 */
A.calendarSetup=function(){modal(`<div class="eyebrow">GOOGLE CALENDAR</div><h2>스케줄러를 구글 캘린더로</h2><p>스케줄러 메모의 일정이 기본 캘린더에 자동으로 들어갑니다. 기기마다 한 번씩 켜고 권한을 승인해야 합니다. MEMOA에서 고치거나 지우면 캘린더에도 반영됩니다. 캘린더에서 고친 내용은 MEMOA로 돌아오지 않습니다.</p><p>일정은 시작 시간부터 1시간으로 등록됩니다.</p><p><small>처음 켤 때 Google 창에서 캘린더 권한을 한 번 승인해야 합니다. Google Cloud의 MEMOA 프로젝트에서 Google Calendar API가 사용 설정되어 있어야 합니다.</small></p><div class="row">${on()?'<button type="button" id="cal-off">연동 끄기</button>':''}<button type="button" onclick="closeModal()">닫기</button><button type="button" class="primary" id="cal-on">${on()?'권한 다시 연결':'연동 켜기'}</button></div>`);
  $('cal-on').onclick=()=>{db.calendarSync={...(db.calendarSync||{}),on:true};persist();closeModal();A.connectGoogle()};
  const off=$('cal-off');if(off)off.onclick=()=>{db.calendarSync={...(db.calendarSync||{}),on:false};persist();closeModal();renderEditor();toast('캘린더 연동을 껐습니다. 이미 등록된 일정은 캘린더에 그대로 남습니다.')}};
const prevSettings=settings;settings=function(){prevSettings.apply(this,arguments);const anchor=document.querySelector('#dialog .backup-actions');if(!anchor)return;const card=document.createElement('div');card.className='storage-card cal-card';card.innerHTML=`<b>Google 캘린더</b> <span class="chip">${on()?(canPush()?'연동 중':'연동 켜짐 · 권한 연결 필요'):'꺼짐'}</span><p>스케줄러 일정을 구글 캘린더로 보냅니다.</p><button type="button" class="${on()?'':'primary'}" onclick="MEMOAApp.calendarSetup()">${on()?'캘린더 설정':'캘린더 연동 켜기'}</button>`;anchor.before(card)};
})();
