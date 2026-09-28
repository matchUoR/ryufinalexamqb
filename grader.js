(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ExamGrader=api;})(globalThis,function(){
function sameSet(a,b){return a.length===b.length&&[...new Set(a)].sort().join('|')===[...new Set(b)].sort().join('|')}
function grade(q,selected){const r=q.gradingRule;if(r?.type==='hold')return {status:'hold',reason:r.hold_reason||'原本照合待ち'};if(!r||r.type!=='exact_set') return {status:'hold',reason:'未対応の採点規則'};if(r.required_selection_count!=null&&selected.length!==r.required_selection_count)return {status:'invalid',reason:`${r.required_selection_count}つ選択してください`};const ok=(r.accepted_sets||[]).some(s=>sameSet(s,selected));return {status:ok?'correct':'incorrect',correctSets:r.accepted_sets,reason:null};}
return {sameSet,grade};});
