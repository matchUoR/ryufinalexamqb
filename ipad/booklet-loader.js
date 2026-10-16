(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BookletData=api;})(globalThis,function(){
async function load(readJSON){
 const index=await readJSON('index.json'),common=await readJSON(index.common);
 const books=await Promise.all(index.booklets.map(b=>readJSON(b.file)));
 const result={...common,questions:[],serial_groups:[],asset_bindings:[],exams:[]};const ids=new Set(),exams=new Map();
 books.forEach((b,i)=>{if(b.booklet_id!==index.booklets[i].booklet_id)throw Error('冊子ID不一致');const rule=common.booklet_classification[b.exams[0]?.試験種別]?.[b.booklet];if(!rule||b.exam_half!=null&&b.exam_half!==rule.exam_half)throw Error('冊子分類が不一致');for(const q of b.questions){if(ids.has(q.question_id)||q.exam_id!==b.exam_id||q.booklet!==b.booklet)throw Error('問題ID重複または冊子不一致');ids.add(q.question_id);result.questions.push({...q,exam_half:rule.exam_half,exam_day:rule.exam_day})}result.serial_groups.push(...b.serial_groups);result.asset_bindings.push(...b.asset_bindings);for(const e of b.exams)exams.set(e.試験ID,e)});
 result.exams=[...exams.values()];result.schema_version='4.0-booklet-json';result.scope=`${books.length}冊子・${result.questions.length}問`;return result;
}
return {load};
});
