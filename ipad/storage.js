(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ExamStorage=api;})(globalThis,function(){
const ATTEMPTS='exam-study-minimal.answer-attempts.v1';const REVIEW='exam-study-minimal.review-schedule.v1';const ASSETS='exam-study-minimal.asset-state.v1';const ERRORS='exam-study-minimal.error-reasons.v1';
function read(k,fallback){try{return JSON.parse(WebStore.memory.getItem(k))??fallback}catch{return fallback}}
function write(k,v){WebStore.memory.setItem(k,JSON.stringify(v));if(k===ATTEMPTS)summaryCache=null;if(k===FLAGS)flagCache=null}
function attempts(){return read(ATTEMPTS,[])}
function addAttempt(a){const x=attempts();if(!x.some(z=>z.id===a.id)){x.push(a);write(ATTEMPTS,x)}return x}
function patchAttempt(id,p){const x=attempts();const i=x.findIndex(z=>z.id===id);if(i>=0){x[i]={...x[i],...p};write(ATTEMPTS,x)}return x[i]}
function reviews(){return read(REVIEW,{})}function setReview(qid,value){const r=reviews();r[qid]=value;write(REVIEW,r);return r[qid]}function clearReview(qid){const r=reviews();delete r[qid];write(REVIEW,r);return null}
function errors(){const saved=read(ERRORS,{}),attemptsByQuestion={};attempts().forEach(a=>{if(a.questionId&&(a.errorReasons?.length||a.errorNote)){const old=attemptsByQuestion[a.questionId];if(!old||String(a.answeredAtClient||'')>=String(old.answeredAtClient||''))attemptsByQuestion[a.questionId]=a}});let changed=false;for(const [qid,a] of Object.entries(attemptsByQuestion)){if(saved[qid])continue;saved[qid]={reasons:[...(a.errorReasons||[])],note:a.errorNote||'',updatedAt:a.answeredAtClient||null};changed=true}if(changed)write(ERRORS,saved);return saved}
function setError(qid,value){const all=errors();all[qid]={reasons:[...(value.reasons||[])],note:String(value.note||''),updatedAt:value.updatedAt||new Date().toISOString()};write(ERRORS,all);return all[qid]}
function assetState(){return read(ASSETS,{})}function setAsset(id,value){const s=assetState();s[id]={...(s[id]||{}),...value};write(ASSETS,s);return s[id]}
// Rebuild once when attempts change, never inside a comparison or per-question history scan.
let summaryCache=null,summarySource=null;
const emptySummary=Object.freeze({attempted:0,correct:0,incorrect:0,hold:0,consecutiveCorrect:0,last:null});
function prepareSummaries(){const raw=WebStore.memory.getItem(ATTEMPTS);if(summaryCache&&raw===summarySource)return;summarySource=raw;summaryCache=new Map();let rows;try{rows=JSON.parse(raw)||[]}catch{rows=[]}if(!Array.isArray(rows))rows=[];const unique=new Map();rows.forEach((a,i)=>{if(a?.questionId)unique.set(a.id||`legacy-${i}`,a)});const grouped=new Map();for(const a of unique.values()){if(a.committed===false)continue;const list=grouped.get(a.questionId)||[];list.push(a);grouped.set(a.questionId,list)}for(const [id,list] of grouped){list.sort((a,b)=>String(a.answeredAtClient||'').localeCompare(String(b.answeredAtClient||'')));const sum={...emptySummary};for(const a of list){sum.attempted++;if(a.gradeStatus==='correct'){sum.correct++;sum.consecutiveCorrect++}else if(a.gradeStatus==='incorrect'){sum.incorrect++;sum.consecutiveCorrect=0}else{sum.hold++;sum.consecutiveCorrect=0}if(a.answeredAtClient)sum.last=a.answeredAtClient}summaryCache.set(id,Object.freeze(sum))}}
function summary(qid){if(!summaryCache)prepareSummaries();return summaryCache.get(qid)||emptySummary}
const FLAGS='exam-study-minimal.flags.v1',flagIds=['review','important','edit'];
const flagDefaults={review:'要復習',important:'重要問題',edit:'問題編集待ち'};let flagCache=null;
function flagData(){if(!flagCache){const raw=read(FLAGS,{});flagCache={...raw,version:1,names:{...flagDefaults,...raw.names},questions:{...raw.questions}}}return flagCache}
function flags(){return {...flagData().names}}
function questionFlags(qid){return [...(flagData().questions[qid]||[])].filter(x=>flagIds.includes(x))}
function setQuestionFlags(qid,ids){const data=flagData(),next={...data,questions:{...data.questions,[qid]:[...new Set(ids)].filter(x=>flagIds.includes(x))}};write(FLAGS,next);return questionFlags(qid)}
function renameFlags(names){const clean=Object.fromEntries(flagIds.map(id=>[id,String(names[id]||'').trim()]));if(Object.values(clean).some(x=>!x||x.length>30)||new Set(Object.values(clean)).size!==3)throw new Error('フラグ名は重複しない1〜30文字で入力してください。');write(FLAGS,{...flagData(),names:clean});return flags()}
if(typeof addEventListener==='function')addEventListener('storage',e=>{if(e.key===ATTEMPTS||e.key===null)summaryCache=null;if(e.key===FLAGS||e.key===null)flagCache=null});
function confidenceLabel(value){return {confident:'確信あり',uncertain:'迷った',guess:'推測'}[value]||'未設定'}

return {ATTEMPTS,REVIEW,ASSETS,ERRORS,FLAGS,flagIds,flags,questionFlags,setQuestionFlags,renameFlags,confidenceLabel,prepareSummaries,attempts,addAttempt,patchAttempt,reviews,setReview,clearReview,errors,setError,assetState,setAsset,summary};});
