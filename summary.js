/* Deterministic, local extractive summarization. No network or model calls. */
(function(root){
'use strict';
const stop=new Set('그리고 그러나 하지만 그래서 또는 또한 대한 대해 위한 통해 것은 것이 것을 있다 있는 합니다 됩니다 위해 이번 기사 영상 여러분 오늘 이번 정말 매우 the and that this with from have has are was were you your for not but into about which will can our its they their'.split(' '));
function tokens(text){return (String(text).toLowerCase().match(/[가-힣a-z0-9]{2,}/g)||[]).map(t=>t.replace(/(에서는|으로는|에게는|에서|으로|까지|부터|처럼|보다|에는|에게|은|는|이|가|을|를|의|와|과|에|도|로)$/,'')).filter(t=>t.length>1&&!stop.has(t))}
function summarize(text,options={}){
 let maxSentences=Math.max(1,Math.min(5,Number(options.maxSentences)||3)),maxChars=Math.max(100,Number(options.maxChars)||650);
 let cleaned=String(text||'').replace(/\r/g,'').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').replace(/^\s*\d{1,2}:\d{2}(?::\d{2})?\s*/gm,'').trim().slice(0,60000);
 if(cleaned.length<25)return {summary:cleaned,sentences:cleaned?[cleaned]:[],method:'extractive',sourceChars:cleaned.length};
 let parts=cleaned.split(/\n+|(?<=[.!?。！？])\s+/u).map(s=>s.trim()).filter(s=>s.length>=15&&!/^(https?:\/\/|구독|좋아요|댓글|공유하기|로그인|로그아웃|무단전재|copyright|all rights reserved)/i.test(s));
 let seen=new Set();parts=parts.filter(s=>{let k=s.replace(/\s+/g,'').toLowerCase();if(seen.has(k))return false;seen.add(k);return true}).slice(0,250);
 if(!parts.length)parts=[cleaned];let termLists=parts.map(tokens),freq=new Map();termLists.forEach(ts=>new Set(ts).forEach(t=>freq.set(t,(freq.get(t)||0)+1)));
 let ranked=parts.map((s,i)=>({s,i,terms:new Set(termLists[i]),score:termLists[i].reduce((v,t)=>v+Math.log(1+(freq.get(t)||0)),0)/Math.sqrt(Math.max(termLists[i].length,1))+(i===0?1.3:1/(i+2))+(s.length>=40&&s.length<300?.7:0)})).sort((a,b)=>b.score-a.score);
 let selected=[];for(let item of ranked){let redundant=selected.some(old=>{let both=[...item.terms].filter(t=>old.terms.has(t)).length;return both/Math.max(Math.min(item.terms.size,old.terms.size),1)>.8});if(!redundant)selected.push(item);if(selected.length>=maxSentences)break}
 selected.sort((a,b)=>a.i-b.i);let lines=[],used=0;for(const item of selected){let s=item.s;let room=maxChars-used-(lines.length?1:0);if(room<35)break;if(s.length>Math.min(room,330))s=s.slice(0,Math.min(room,330)-1).trimEnd()+'…';lines.push(s);used+=s.length+1}
 return {summary:lines.join('\n'),sentences:lines,method:'extractive',sourceChars:cleaned.length};
}
root.MEMOASummary={summarize};if(typeof module!=='undefined'&&module.exports)module.exports=root.MEMOASummary;
})(typeof globalThis!=='undefined'?globalThis:this);
