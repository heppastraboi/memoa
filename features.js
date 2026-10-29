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
  const c=lineCount(host);
  if(c>IDEA_MAX){if(hint)hint.remove();A.ideaToMemo?.(n,host);return}
  if(!hint){hint=document.createElement('div');hint.className='idea-hint';host.after(hint)}
  hint.innerHTML=`<span>✧ ${c}/${IDEA_MAX}줄 · 넘으면 일반 메모로 바뀝니다</span>`;
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

/* ===== 4차 (2026-10-29): 아이디어 = 긴 포스트잇, 독서노트 Tab 이동 ===== */
(function(){'use strict';
const A=window.MEMOAApp;
const COLORS=[['#f8e7a0','노랑'],['#c6e1c0','초록'],['#c5d9ed','파랑'],['#f2c8d1','분홍'],['#d9caec','보라']];
const DEF='#f8e7a0';
const colorOf=n=>COLORS.some(([c])=>c===n?.color)?n.color:DEF;
const css=`
#paper.idea-mode #document-format,#paper.idea-mode #toolbar,#paper.idea-mode #title,#paper.idea-mode .eyebrow{display:none!important}
#paper.idea-mode #editor{background:var(--idea-color,#f8e7a0);border-radius:6px;padding:12px 14px;min-height:0;box-shadow:0 1px 3px rgba(0,0,0,.08);line-height:1.6}
#paper.idea-mode #editor:empty:before{content:'떠오른 생각을 한 줄로…';color:#9a9585}
.idea-bar{display:flex;gap:8px;align-items:center;margin:0 0 10px;flex-wrap:wrap}
.idea-bar .swatch{width:22px;height:22px;border-radius:50%;border:2px solid transparent;cursor:pointer;padding:0}
.idea-bar .swatch.on{border-color:#5f6758}
.idea-bar .label{font-size:12px;color:#8a9083;margin-right:4px}
.idea-bar .link-btn{margin-left:auto}
.note.idea-card{background:var(--idea-color,#f8e7a0)!important}
.quick-note.idea-quick{background:var(--idea-color,#f8e7a0)!important}
#quick-body.idea-quick{background:var(--idea-color,#f8e7a0);border-radius:6px;padding:12px;min-height:3em}
.quick-idea-bar{display:flex;gap:8px;align-items:center;margin:6px 0}
.quick-idea-bar .swatch{width:26px;height:26px;border-radius:50%;border:2px solid transparent;padding:0}
.quick-idea-bar .swatch.on{border-color:#5f6758}
.idea-quick-mode .quick-tools button[onclick*="quick-image"]{display:none}`;
const st=document.createElement('style');st.textContent=css;document.head.append(st);
const firstLine=n=>{const d=document.createElement('div');d.innerHTML=String(n.html||'').replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|li|h[1-6])>/gi,'\n');return (d.textContent||'').split('\n').map(s=>s.trim()).find(Boolean)||''};
const swatches=(n,cls)=>COLORS.map(([c,l])=>`<button type="button" class="swatch ${colorOf(n)===c?'on':''}" data-color="${c}" style="background:${c}" aria-label="${l}"></button>`).join('');
function setColor(n,c){if(!n||!COLORS.some(([x])=>x===c))return;n.color=c;persist();applyIdea();renderList()}

/* 아이디어 링크: 복사해 둔 주소를 기본값으로 */
A.ideaLink=async function(){let clip='';try{const t=await navigator.clipboard.readText();if(/^https?:\/\//i.test(t.trim()))clip=t.trim()}catch{}const url=prompt('링크 주소 (https://...)',clip);if(!url)return;try{const u=new URL(url);if(!['http:','https:'].includes(u.protocol))throw 0;const host=document.activeElement===$('quick-body')||$('quick-body')?.contains(document.activeElement)?$('quick-body'):$('editor');host.focus();document.execCommand('insertHTML',false,` <a href="${esc(u.href)}" target="_blank" rel="noopener">${esc(u.hostname+u.pathname.replace(/\/$/,''))}</a> `);if(host.id==='editor')update();else host.dispatchEvent(new Event('input',{bubbles:true}))}catch{toast('올바른 웹 주소를 입력해주세요.')}};

/* 6줄째에서 일반 메모로 전환 — 커서를 잃지 않게 화면만 바꿈 */
A.ideaToMemo=function(n,host){if(!n||n.type!=='idea')return;if(host&&host.id==='editor')update();n.type='note';if(!n.title||n.autoTitle){n.title=firstLine(n).slice(0,80);delete n.autoTitle}persist();applyIdea();const t=$('title');if(t&&!t.value)t.value=n.title;const nt=$('notetype');if(nt)nt.value='note';renderList();toast('다섯 줄을 넘어 일반 메모로 바뀌었습니다.')};

/* PC 편집기: 아이디어면 색 상자 + 색상·링크만 */
function applyIdea(){const n=note(),paper=$('paper'),ed=$('editor');if(!paper||!ed)return;const idea=n&&n.type==='idea'&&!n.deleted;paper.classList.toggle('idea-mode',!!idea);let bar=$('idea-bar');
  if(!idea){bar?.remove();paper.style.removeProperty('--idea-color');return}
  paper.style.setProperty('--idea-color',colorOf(n));
  if(!bar){bar=document.createElement('div');bar.id='idea-bar';bar.className='idea-bar';ed.before(bar)}
  bar.innerHTML=`<span class="label">✧ 아이디어</span>${swatches(n)}<button type="button" class="link-btn" onclick="MEMOAApp.ideaLink()">↗ 링크</button>`;
  bar.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>setColor(note(),b.dataset.color));
  applyQuick()}
/* 휴대폰 기록 화면도 같은 색 상자 */
function applyQuick(){const qb=$('quick-body');if(!qb)return;const n=note(),idea=n&&n.type==='idea'&&!qb.hidden;qb.classList.toggle('idea-quick',!!idea);document.body.classList.toggle('idea-quick-mode',!!idea);let bar=$('quick-idea-bar');
  if(!idea){bar?.remove();return}
  qb.style.setProperty('--idea-color',colorOf(n));
  if(!bar){bar=document.createElement('div');bar.id='quick-idea-bar';bar.className='quick-idea-bar';qb.before(bar)}
  bar.innerHTML=swatches(n);bar.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>setColor(note(),b.dataset.color))}
const prevRE=renderEditor;renderEditor=function(){prevRE.apply(this,arguments);applyIdea()};
if($('quick-body')){let qt=null;new MutationObserver(()=>{clearTimeout(qt);qt=setTimeout(applyQuick,30)}).observe($('quick-body'),{attributes:true,attributeFilter:['hidden'],childList:true})}
const prevNew=newNote;newNote=function(data={}){if(data&&data.type==='idea'&&!data.color)data={...data,color:DEF};return prevNew.call(this,data)};

/* 목록 카드 색 (PC·휴대폰) */
const prevRL=renderList;renderList=function(){prevRL.apply(this,arguments);document.querySelectorAll('#notes .note.idea-card[data-id]').forEach(el=>{const n=db.notes.find(x=>x.id===el.dataset.id);el.style.setProperty('--idea-color',colorOf(n))})};
const qn=$('quick-notes');if(qn){const paint=()=>qn.querySelectorAll('[data-quick-note]').forEach(el=>{const n=db.notes.find(x=>x.id===el.dataset.quickNote);const idea=n?.type==='idea';el.classList.toggle('idea-quick',idea);if(idea)el.style.setProperty('--idea-color',colorOf(n))});new MutationObserver(paint).observe(qn,{childList:true});paint()}

/* 독서노트: Tab = 다음 칸, 마지막 칸에서 Tab = 새 챕터, Shift+Tab = 이전 칸 */
$('editor').addEventListener('keydown',e=>{if(e.key!=='Tab')return;const td=e.target.closest?.('.chapter-table td')||window.getSelection()?.anchorNode?.parentElement?.closest?.('.chapter-table td');if(!td||!$('editor').contains(td))return;e.preventDefault();e.stopPropagation();const cells=[...$('editor').querySelectorAll('.chapter-table tbody td')];let i=cells.indexOf(td)+(e.shiftKey?-1:1);if(i>=cells.length){window.MEMOADoc?.addChapter?.();return}if(i<0)return;const next=cells[i],r=document.createRange();r.selectNodeContents(next);r.collapse(false);const s=window.getSelection();s.removeAllRanges();s.addRange(r);next.focus?.()},true);
const prevAdd=window.MEMOADoc?.addChapter;if(prevAdd)window.MEMOADoc.addChapter=function(){prevAdd();const row=$('editor').querySelector('.chapter-table tbody tr:last-child td');if(row){const r=document.createRange();r.selectNodeContents(row);r.collapse(true);const s=window.getSelection();s.removeAllRanges();s.addRange(r)}};
applyIdea();renderList();
})();

/* ===== 5차 (2026-10-29): 백업 알림 — 마지막 백업 후 30일 ===== */
(function(){'use strict';
const A=window.MEMOAApp,DAY=864e5,LIMIT=30,SNOOZE=3;
const SINCE='memoa-backup-since',LATER='memoa-backup-later';
const st=document.createElement('style');st.textContent=`
.backup-nudge{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:9998;display:flex;gap:10px;align-items:center;padding:10px 10px 10px 16px;border-radius:12px;background:#fffaf0;border:1px solid #e3c98f;box-shadow:0 6px 20px rgba(0,0,0,.12);font-size:14px;max-width:calc(100vw - 24px)}
.backup-nudge b{color:#8a5a12}
.backup-nudge button{white-space:nowrap}`;document.head.append(st);
const lastAt=()=>Number(db.backupInfo?.at)||0;
const get=k=>{try{return Number(localStorage.getItem(k))||0}catch{return 0}};
const set=(k,v)=>{try{localStorage.setItem(k,String(v))}catch{}};
if(!get(SINCE))set(SINCE,Date.now());
// 백업할 때마다 기록 → Drive 동기화로 다른 기기도 알림 해제
const prevBackup=A.backup;A.backup=async function(){const r=await prevBackup.apply(this,arguments);db.backupInfo={at:Date.now(),by:A.device||''};persist();hide();return r};
function daysSince(){const base=lastAt()||get(SINCE);return Math.floor((Date.now()-base)/DAY)}
function due(){if(!db.notes.some(n=>!n.deleted&&!n._sample))return false;if(Date.now()-get(LATER)<SNOOZE*DAY)return false;return daysSince()>=LIMIT}
let bar=null;
function hide(){bar?.remove();bar=null}
function show(){if(bar||!due())return;const d=daysSince(),never=!lastAt();const mobile=matchMedia('(max-width:767px)').matches;
  bar=document.createElement('div');bar.className='backup-nudge';bar.setAttribute('role','status');
  bar.innerHTML=`<span><b>${never?'아직 백업 파일이 없습니다':`마지막 백업 후 ${d}일이 지났습니다`}</b><br><small>${mobile?'PC에서 전체 백업을 받아두면 모든 기기의 알림이 사라집니다.':'백업 파일은 메모가 망가져도 되살릴 수 있는 독립 사본입니다.'}</small></span>${mobile?'':'<button type="button" class="primary" data-act="now">지금 백업</button>'}<button type="button" data-act="later">${SNOOZE}일 뒤에</button>`;
  bar.querySelector('[data-act="now"]')?.addEventListener('click',()=>A.backup());
  bar.querySelector('[data-act="later"]').onclick=()=>{set(LATER,Date.now());hide()};
  document.body.append(bar)}
A.backupNudge=show;
Promise.resolve().then(()=>A.ready).then(()=>setTimeout(show,1500)).catch(()=>{});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(show,1500)});
const prevSync=A.sync;A.sync=function(){const p=prevSync.apply(this,arguments);Promise.resolve(p).then(()=>{if(bar&&!due())hide()},()=>{});return p};
})();

/* ===== 6차 (2026-10-29): 링크 바로 열기 + 주소 자동 링크 ===== */
(function(){'use strict';
const st=document.createElement('style');st.textContent=`
#editor a[href],#quick-body a[href],#quick-read a[href]{color:#3d6b8f;text-decoration:underline;text-underline-offset:2px;cursor:pointer;word-break:break-all}
#editor a[href]:hover,#quick-body a[href]:hover{color:#24506f}`;document.head.append(st);
const hosts=()=>['editor','quick-body'].map(id=>$(id)).filter(Boolean);
const URL_RE=/https?:\/\/[^\s<>"'`]+/g;
const trimTail=u=>{let m=u.match(/[.,;:!?)\]}'"…]+$/);if(m&&!(m[0].startsWith(')')&&u.includes('(')))u=u.slice(0,-m[0].length);return u};
const valid=u=>{try{const x=new URL(u);return ['http:','https:'].includes(x.protocol)?x.href:null}catch{return null}};
// 텍스트 안의 주소를 <a>로. caret: {node,offset} → 바뀐 뒤 커서 위치를 돌려줌
function linkify(root,caret,keepCaretNode){
  let moved=null;const tw=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement?.closest('a,button,select,option,textarea,input,[contenteditable="false"]')?NodeFilter.FILTER_REJECT:URL_RE.test(n.data)?(URL_RE.lastIndex=0,NodeFilter.FILTER_ACCEPT):NodeFilter.FILTER_SKIP});
  const nodes=[];while(tw.nextNode())nodes.push(tw.currentNode);
  for(const node of nodes){
    if(keepCaretNode&&caret&&caret.node===node)continue;
    const text=node.data;URL_RE.lastIndex=0;let m,last=0;const frag=document.createDocumentFragment();let changed=false,caretAt=null;
    while((m=URL_RE.exec(text))){const raw=trimTail(m[0]),href=valid(raw);if(!href)continue;const s=m.index,e=s+raw.length;
      if(s>last){const t=document.createTextNode(text.slice(last,s));frag.append(t);if(caret?.node===node&&caret.offset>=last&&caret.offset<=s)caretAt={node:t,offset:caret.offset-last}}
      const a=document.createElement('a');a.href=href;a.target='_blank';a.rel='noopener noreferrer';a.textContent=raw;frag.append(a);
      if(caret?.node===node&&caret.offset>s&&caret.offset<=e)caretAt={after:a};
      last=e;changed=true;URL_RE.lastIndex=e}
    if(!changed)continue;
    const tail=document.createTextNode(text.slice(last)||'');frag.append(tail);
    if(caret?.node===node&&!caretAt&&caret.offset>=last)caretAt={node:tail,offset:caret.offset-last};
    node.replaceWith(frag);if(caretAt)moved=caretAt}
  return moved}
function caretInfo(){const s=getSelection();if(!s.rangeCount||!s.isCollapsed)return null;const r=s.getRangeAt(0);return r.startContainer.nodeType===3?{node:r.startContainer,offset:r.startOffset}:null}
function placeCaret(c){if(!c)return;const r=document.createRange();if(c.after){r.setStartAfter(c.after)}else{r.setStart(c.node,Math.min(c.offset,c.node.length))}r.collapse(true);const s=getSelection();s.removeAllRanges();s.addRange(r)}
function save(host){if(host.id==='editor')update();else host.dispatchEvent(new Event('input',{bubbles:true}))}
function run(host,{keepCaret}){const c=caretInfo();const inside=c&&host.contains(c.node);const moved=linkify(host,inside?c:null,keepCaret);if(moved&&!keepCaret)placeCaret(moved);save(host)}
for(const host of hosts()){
  // 붙여넣기: 기존 처리(일반 텍스트 삽입) 뒤에 바로 링크로
  host.addEventListener('paste',()=>setTimeout(()=>{if(URL_RE.test(host.textContent)){URL_RE.lastIndex=0;run(host,{keepCaret:false})}},0));
  // 입력: Enter 뒤(이전 줄), 다른 곳으로 나갈 때
  host.addEventListener('keyup',e=>{if(e.key==='Enter'){URL_RE.lastIndex=0;if(URL_RE.test(host.textContent)){URL_RE.lastIndex=0;run(host,{keepCaret:true})}}});
  host.addEventListener('focusout',()=>{URL_RE.lastIndex=0;if(URL_RE.test(host.textContent)){URL_RE.lastIndex=0;linkify(host,null,false);save(host)}});
  // 클릭하면 새 탭으로. Alt+클릭은 편집(커서 넣기)
  host.addEventListener('click',e=>{const a=e.target.closest?.('a[href]');if(!a||!host.contains(a)||e.altKey)return;const s=getSelection();if(s&&!s.isCollapsed&&a.contains(s.anchorNode))return;e.preventDefault();const href=valid(a.getAttribute('href'));if(href)window.open(href,'_blank','noopener,noreferrer')});
  host.addEventListener('mouseover',e=>{const a=e.target.closest?.('a[href]');if(a&&!a.title)a.title='클릭: 새 탭에서 열기 · Alt+클릭: 글자 고치기'});
}
})();

/* ===== 7차 (2026-10-29): 링크 길게 누르기 메뉴(열기/삭제), 메모 내보내기(Word·PDF·Markdown) ===== */
(function(){'use strict';
const A=window.MEMOAApp,D=window.MEMOADoc;
const st=document.createElement('style');st.textContent=`
@media (pointer:coarse){#editor a[href],#quick-body a[href]{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}}
.link-sheet p{word-break:break-all;color:#5f6758;font-size:13px}
.link-sheet .row{flex-wrap:wrap}
.export-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:12px 0}
.export-grid button{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:12px;text-align:left;border:1px solid #e3ddd2;border-radius:9px;background:#fffefa;cursor:pointer}
.export-grid button b{font-size:15px}.export-grid button small{color:#8a9083}`;document.head.append(st);
const valid=u=>{try{const x=new URL(u);return ['http:','https:'].includes(x.protocol)?x.href:null}catch{return null}};

/* ---------- 링크 길게 누르기(휴대폰) / 오른쪽 클릭(PC): 열기 · 삭제 ---------- */
let suppressUntil=0;
function save(host){if(host.id==='editor')update();else host.dispatchEvent(new Event('input',{bubbles:true}))}
function linkMenu(a,host){const href=valid(a.getAttribute('href'));if(!href)return;suppressUntil=Date.now()+700;
  modal(`<div class="link-sheet"><div class="eyebrow">LINK</div><h2>${esc(a.textContent.trim().slice(0,60)||'링크')}</h2><p>${esc(href)}</p><div class="row"><button type="button" onclick="closeModal()">취소</button><button type="button" id="link-del" style="color:#b5533c">링크 삭제</button><button type="button" class="primary" id="link-open">열기</button></div></div>`);
  $('link-open').onclick=()=>{closeModal();window.open(href,'_blank','noopener,noreferrer')};
  $('link-del').onclick=()=>{A.checkpoint?.('링크 삭제 전');const prev=a.previousSibling,next=a.nextSibling;a.remove();if(prev?.nodeType===3&&next?.nodeType===3&&/\s$/.test(prev.data)&&/^\s/.test(next.data))next.data=next.data.replace(/^\s+/,'');save(host);closeModal();toast('링크를 삭제했습니다.')}}
for(const host of ['editor','quick-body'].map(id=>$(id)).filter(Boolean)){
  host.addEventListener('contextmenu',e=>{const a=e.target.closest?.('a[href]');if(!a||!host.contains(a))return;e.preventDefault();if(Date.now()<suppressUntil)return;linkMenu(a,host)});
  let timer=null,sx=0,sy=0;
  host.addEventListener('touchstart',e=>{const a=e.target.closest?.('a[href]');if(!a||!host.contains(a)||e.touches.length>1)return;sx=e.touches[0].clientX;sy=e.touches[0].clientY;clearTimeout(timer);timer=setTimeout(()=>{timer=null;linkMenu(a,host)},550)},{passive:true});
  host.addEventListener('touchmove',e=>{if(timer&&(Math.abs(e.touches[0].clientX-sx)>10||Math.abs(e.touches[0].clientY-sy)>10)){clearTimeout(timer);timer=null}},{passive:true});
  host.addEventListener('touchend',()=>{clearTimeout(timer);timer=null});
  // 길게 누른 뒤 따라오는 클릭은 무시(열기 중복 방지)
  host.addEventListener('click',e=>{if(Date.now()<suppressUntil&&e.target.closest?.('a[href]')){e.preventDefault();e.stopImmediatePropagation()}},true);
}

/* ---------- 내보내기 ---------- */
const fname=n=>(n.title||'메모').replace(/[\\/:*?"<>|]/g,'_').trim().slice(0,80)||'메모';
const bodyHTML=n=>{const raw=n.template&&n.template!=='free'&&D?.linear?D.linear(n):(n.html||'');const w=document.createElement('div');w.innerHTML=A.safe?A.safe(raw):raw;w.querySelectorAll('button,select,input,[data-sticky-drag]').forEach(x=>x.remove());w.querySelectorAll('[contenteditable]').forEach(x=>x.removeAttribute('contenteditable'));return w};
const metaLine=n=>[new Date(n.created||Date.now()).toLocaleDateString('ko'),typeof folderPath==='function'?folderPath(n.folder):n.folder,(n.tags||[]).map(t=>'#'+t).join(' ')].filter(Boolean).join(' · ');
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)}

/* Markdown */
function toMD(root){
  const inline=node=>[...node.childNodes].map(c=>{if(c.nodeType===3)return c.data.replace(/\u00a0/g,' ').replace(/([*_`\\])/g,'\\$1');if(c.nodeType!==1)return '';const t=c.tagName,inner=()=>inline(c);
    if(t==='BR')return '  \n';if(t==='B'||t==='STRONG')return wrap(inner(),'**');if(t==='I'||t==='EM')return wrap(inner(),'*');if(t==='S'||t==='STRIKE')return wrap(inner(),'~~');if(t==='CODE')return '`'+c.textContent+'`';
    if(t==='A'){const h=valid(c.getAttribute('href'));const tx=inner().trim()||h;return h?`[${tx}](${h})`:tx}
    if(t==='IMG'){const s=c.getAttribute('src')||'';return /^https?:/.test(s)?`![${c.alt||''}](${s})`:`*[이미지: ${c.alt||'붙여넣은 이미지'}]*`}
    return inner()}).join('');
  const wrap=(s,m)=>{const t=s.trim();return t?m+t+m:''};
  const out=[];
  const block=(el,depth=0)=>{for(const c of el.childNodes){if(c.nodeType===3){if(c.data.trim())out.push(inline({childNodes:[c]}).trim(),'');continue}if(c.nodeType!==1)continue;const t=c.tagName;
    if(/^H[1-6]$/.test(t)){out.push('#'.repeat(Math.min(6,+t[1]+1))+' '+inline(c).trim(),'');continue}
    if(t==='UL'||t==='OL'){let i=1;for(const li of c.children){if(li.tagName!=='LI')continue;const sub=[...li.children].filter(x=>x.tagName==='UL'||x.tagName==='OL');const clone=li.cloneNode(true);clone.querySelectorAll(':scope>ul,:scope>ol').forEach(x=>x.remove());out.push('  '.repeat(depth)+(t==='OL'?(i++)+'. ':'- ')+inline(clone).trim());for(const s of sub)block({childNodes:[s]},depth+1)}if(!depth)out.push('');continue}
    if(t==='TABLE'){const rows=[...c.querySelectorAll('tr')].map(r=>[...r.children].map(td=>inline(td).replace(/\|/g,'\\|').replace(/\n+/g,' ').trim()));if(rows.length){const w=Math.max(...rows.map(r=>r.length));const pad=r=>[...r,...Array(w-r.length).fill('')];out.push('| '+pad(rows[0]).join(' | ')+' |','|'+Array(w).fill(' --- ').join('|')+'|',...rows.slice(1).map(r=>'| '+pad(r).join(' | ')+' |'),'')}continue}
    if(t==='BLOCKQUOTE'){out.push(inline(c).trim().split('\n').map(l=>'> '+l).join('\n'),'');continue}
    if(t==='PRE'){out.push('```',c.textContent,'```','');continue}
    if(t==='HR'){out.push('---','');continue}
    if(t==='IMG'){out.push(inline({childNodes:[c]}),'');continue}
    if([...c.children].some(x=>/^(P|DIV|H[1-6]|UL|OL|TABLE|BLOCKQUOTE|PRE|SECTION|ARTICLE)$/.test(x.tagName))){block(c,depth);continue}
    const s=inline(c).trim();if(s)out.push(s,'')}};
  block(root);return out.join('\n').replace(/\n{3,}/g,'\n\n').trim()}
const yaml=v=>JSON.stringify(String(v??''));
A.exportMD=function(n=note()){if(!n)return;const front=['---',`title: ${yaml(n.title||'제목 없는 메모')}`,`created: ${new Date(n.created||Date.now()).toISOString()}`,`modified: ${new Date(n.modified||Date.now()).toISOString()}`,`folder: ${yaml(n.folder)}`,`type: ${yaml(n.type||'note')}`,`format: ${yaml(n.template||'free')}`,`tags: [${(n.tags||[]).map(yaml).join(', ')}]`];
  if(n.book)for(const [k,v] of Object.entries(n.book))if(v)front.push(`book_${k}: ${yaml(v)}`);if(n.schedulerDate&&n.template==='scheduler')front.push(`date: ${yaml(n.schedulerDate)}`);
  const links=(n.links||[]).map(id=>db.notes.find(x=>x.id===id)).filter(Boolean).map(x=>x.title||'제목 없는 메모');if(links.length)front.push(`linked: [${links.map(yaml).join(', ')}]`);front.push('---','');
  const md=front.join('\n')+'# '+(n.title||'제목 없는 메모')+'\n\n'+toMD(bodyHTML(n))+'\n';
  download(new Blob([md],{type:'text/markdown;charset=utf-8'}),fname(n)+'.md');closeModal();toast('Markdown으로 내보냈습니다.')};

/* PDF: 깔끔한 인쇄용 페이지 → 'PDF로 저장' */
const pageCSS=`body{font-family:'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#2b2f27;max-width:720px;margin:40px auto;padding:0 24px;line-height:1.75;font-size:15px}h1{font-size:26px;margin:0 0 4px}.meta{color:#8a9083;font-size:12px;margin-bottom:28px}h2,h3,h4{margin:1.4em 0 .4em}img{max-width:100%;height:auto}table{border-collapse:collapse;width:100%;margin:12px 0}th,td{border:1px solid #d9d2c4;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f6f2ea}a{color:#2f5f86}blockquote{border-left:3px solid #d9d2c4;margin:0;padding-left:12px;color:#5f6758}.sticky-card{border:1px solid #e3ddd2;border-radius:6px;padding:10px;margin:8px 0}@page{margin:18mm}@media print{body{margin:0 auto}}`;
A.exportPDF=function(n=note()){if(!n)return;const w=window.open('','_blank');if(!w)return toast('팝업이 막혔습니다. 브라우저에서 팝업을 허용해주세요.');const body=bodyHTML(n).innerHTML;
  w.document.open();w.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(fname(n))}</title><style>${pageCSS}</style></head><body><h1>${esc(n.title||'제목 없는 메모')}</h1><div class="meta">${esc(metaLine(n))}</div>${body}<script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`);w.document.close();closeModal()};

/* Word (.docx) */
let docxLib=null;const loadDocx=()=>docxLib||(docxLib=new Promise((ok,no)=>{if(window.docx)return ok(window.docx);const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js';s.onload=()=>ok(window.docx);s.onerror=()=>{docxLib=null;no(Error('Word 변환 도구를 불러오지 못했습니다. 인터넷 연결을 확인해주세요.'))};document.head.append(s)}));
async function imgData(src){try{let bytes,type;if(src.startsWith('data:')){const m=src.match(/^data:image\/(png|jpe?g|gif|webp);base64,(.*)$/i);if(!m)return null;type=m[1].toLowerCase().replace('jpeg','jpg');const bin=atob(m[2]);bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i)}else{const r=await fetch(src);if(!r.ok)return null;bytes=new Uint8Array(await r.arrayBuffer());type=(r.headers.get('content-type')||'').split('/')[1]||'png'}
  const size=await new Promise(res=>{const im=new Image();im.onload=()=>res([im.naturalWidth,im.naturalHeight]);im.onerror=()=>res([400,300]);im.src=src});const scale=Math.min(1,600/size[0]);
  if(type==='webp'||type==='gif'){/* Word 호환을 위해 PNG로 변환 */const c=document.createElement('canvas');c.width=size[0];c.height=size[1];const im=new Image();im.src=src;await im.decode().catch(()=>{});c.getContext('2d').drawImage(im,0,0);const b=await new Promise(r=>c.toBlob(r,'image/png'));if(!b)return null;bytes=new Uint8Array(await b.arrayBuffer());type='png'}
  return {bytes,type:type==='jpg'?'jpg':'png',w:Math.round(size[0]*scale),h:Math.round(size[1]*scale)}}catch{return null}}
A.exportDOCX=async function(n=note()){if(!n)return;closeModal();toast('Word 파일을 만드는 중…');try{const X=await loadDocx();const {Document,Packer,Paragraph,TextRun,HeadingLevel,ExternalHyperlink,ImageRun,Table,TableRow,TableCell,WidthType,AlignmentType,LevelFormat}=X;
  const H=[HeadingLevel.HEADING_1,HeadingLevel.HEADING_2,HeadingLevel.HEADING_3,HeadingLevel.HEADING_4,HeadingLevel.HEADING_5,HeadingLevel.HEADING_6];
  async function runs(node,s={}){const out=[];for(const c of node.childNodes){if(c.nodeType===3){const t=c.data.replace(/\u00a0/g,' ');if(t)out.push(new TextRun({text:t,...s}));continue}if(c.nodeType!==1)continue;const t=c.tagName;
    if(t==='BR'){out.push(new TextRun({text:'',break:1,...s}));continue}
    if(t==='B'||t==='STRONG'){out.push(...await runs(c,{...s,bold:true}));continue}if(t==='I'||t==='EM'){out.push(...await runs(c,{...s,italics:true}));continue}if(t==='U'){out.push(...await runs(c,{...s,underline:{}}));continue}if(t==='S'||t==='STRIKE'){out.push(...await runs(c,{...s,strike:true}));continue}if(t==='CODE'){out.push(new TextRun({text:c.textContent,font:'Consolas',...s}));continue}
    if(t==='A'){const h=valid(c.getAttribute('href'));const kids=await runs(c,{...s,style:'Hyperlink'});out.push(h?new ExternalHyperlink({link:h,children:kids.length?kids:[new TextRun({text:h,style:'Hyperlink'})]}):kids);continue}
    if(t==='IMG'){const d=await imgData(c.getAttribute('src')||'');if(d)out.push(new ImageRun({data:d.bytes,type:d.type,transformation:{width:d.w,height:d.h}}));continue}
    out.push(...await runs(c,s))}return out.flat()}
  const blocks=[];
  async function walk(el,lv=0){for(const c of el.childNodes){if(c.nodeType===3){if(c.data.trim())blocks.push(new Paragraph({children:[new TextRun(c.data.trim())]}));continue}if(c.nodeType!==1)continue;const t=c.tagName;
    if(/^H[1-6]$/.test(t)){blocks.push(new Paragraph({heading:H[Math.min(5,+t[1])],children:await runs(c)}));continue}
    if(t==='UL'||t==='OL'){for(const li of c.children){if(li.tagName!=='LI')continue;const clone=li.cloneNode(true);clone.querySelectorAll(':scope>ul,:scope>ol').forEach(x=>x.remove());blocks.push(new Paragraph({children:await runs(clone),...(t==='OL'?{numbering:{reference:'memoa-num',level:Math.min(lv,8)}}:{bullet:{level:Math.min(lv,8)}})}));for(const sub of li.querySelectorAll(':scope>ul,:scope>ol'))await walk({childNodes:[sub]},lv+1)}continue}
    if(t==='TABLE'){const rows=[];for(const tr of c.querySelectorAll('tr')){const cells=[];for(const td of tr.children){let inner;if([...td.children].some(x=>/^(P|DIV|H[1-6]|UL|OL|TABLE|BLOCKQUOTE|PRE)$/.test(x.tagName))){const tmp=blocks.length;await walk(td);inner=blocks.splice(tmp)}else inner=[new Paragraph({children:await runs(td)})];cells.push(new TableCell({children:inner.length?inner:[new Paragraph({children:await runs(td)})],shading:td.tagName==='TH'?{fill:'F6F2EA'}:undefined}))}if(cells.length)rows.push(new TableRow({children:cells}))}if(rows.length)blocks.push(new Table({rows,width:{size:100,type:WidthType.PERCENTAGE}}));continue}
    if(t==='BLOCKQUOTE'){blocks.push(new Paragraph({indent:{left:480},children:await runs(c,{color:'5F6758'})}));continue}
    if(t==='PRE'){for(const line of c.textContent.split('\n'))blocks.push(new Paragraph({children:[new TextRun({text:line,font:'Consolas'})]}));continue}
    if(t==='HR'){blocks.push(new Paragraph({border:{bottom:{style:'single',size:6,color:'D9D2C4'}},children:[]}));continue}
    if([...c.children].some(x=>/^(P|DIV|H[1-6]|UL|OL|TABLE|BLOCKQUOTE|PRE|SECTION|ARTICLE)$/.test(x.tagName))){await walk(c,lv);continue}
    const r=await runs(c);blocks.push(new Paragraph({children:r}))}}
  await walk(bodyHTML(n));
  const doc=new Document({creator:'MEMOA',title:n.title||'메모',styles:{default:{document:{run:{font:'Malgun Gothic',size:22},paragraph:{spacing:{after:120,line:300}}}}},numbering:{config:[{reference:'memoa-num',levels:Array.from({length:9},(_,i)=>({level:i,format:LevelFormat.DECIMAL,text:`%${i+1}.`,alignment:AlignmentType.START,style:{paragraph:{indent:{left:720*(i+1),hanging:360}}}}))}]},
    sections:[{children:[new Paragraph({heading:HeadingLevel.TITLE,children:[new TextRun({text:n.title||'제목 없는 메모'})]}),new Paragraph({children:[new TextRun({text:metaLine(n),color:'8A9083',size:18})]}),...blocks]}]});
  download(await Packer.toBlob(doc),fname(n)+'.docx');toast('Word 파일로 내보냈습니다.')}catch(e){toast(e.message||'Word 파일을 만들지 못했습니다.')}};

/* 내보내기 메뉴 */
A.exportMenu=function(){const n=note();if(!n)return;modal(`<div class="eyebrow">EXPORT</div><h2>‘${esc(n.title||'제목 없는 메모')}’ 내보내기</h2><div class="export-grid"><button type="button" onclick="MEMOAApp.exportDOCX()"><b>Word</b><small>.docx · 한글·워드·구글 문서</small></button><button type="button" onclick="MEMOAApp.exportPDF()"><b>PDF</b><small>인쇄 창에서 'PDF로 저장'</small></button><button type="button" onclick="MEMOAApp.exportMD()"><b>Markdown</b><small>.md · 옵시디언·노션·깃허브</small></button><button type="button" onclick="closeModal();exportTxt()"><b>텍스트</b><small>.txt · 서식 없이</small></button></div><div class="row"><button type="button" onclick="closeModal()">닫기</button></div>`)};
const txtBtn=document.querySelector('button[onclick="exportTxt()"]');if(txtBtn){txtBtn.textContent='내보내기 ↓';txtBtn.setAttribute('onclick','MEMOAApp.exportMenu()')}
const qt=document.querySelector('.quick-tools');if(qt&&!qt.querySelector('[data-export]')){const b=document.createElement('button');b.type='button';b.dataset.export='1';b.textContent='내보내기';b.onclick=()=>A.exportMenu();qt.append(b)}
})();
