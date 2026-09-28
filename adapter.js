(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ExamAdapter=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const DEPTS=[['01','産婦人科'],['02','消化器'],['03','肝胆膵'],['04','耳鼻咽喉科'],['05','整形外科'],['06','中毒'],['07','眼科'],['08','感染症'],['09','救急'],['10','皮膚科'],['11','放射線科'],['12','精神科'],['13','神経内科、神経外科'],['14','腎泌尿器'],['15','医学一般'],['16','呼吸器'],['17','循環器'],['18','小児科'],['19','代謝・内分泌'],['20','免疫・膠原病'],['21','血液内科'],['22','公衆衛生'],['23','麻酔科']].map(([department_id,name])=>({department_id,name}));
  function arr(v){return Array.isArray(v)?v:[]}
  function normalizedSets(v){return arr(v).map(s=>arr(s).slice().sort().join('|')).sort().join('||')}
  function adapt(raw){const p=raw.payload||raw;const serial=new Map(arr(p.serial_groups).map(x=>[x.連問ID||x.serial_group_id,x]));const assets=new Map(arr(p.assets).map(x=>[x.asset_id,x]));const bindings=arr(p.asset_bindings);const questions=arr(p.questions||p.問題).map(q=>{
    const id=q.question_id||q.問題ID, sg=q.連問ID||q.serial_group_id||null, order=q.連問内順序??q.serial_order??null;
    const deps=arr(q.departments).length?arr(q.departments):arr(q.診療科).map(v=>{const m=String(v).match(/^(\d{2})\.\s*(.*)$/);return {department_id:m?m[1]:null,name:m?m[2]:String(v),confirmation_status:'unclassified'}});
    const diseases=arr(q.diseases); const themes=arr(q.themes);
    const activeBindings=bindings.filter(b=>(b.question_id===id||(!b.question_id&&b.serial_group_id===sg)) && Number(b.reveal_order||0)<=Number(order||0));
    const qAssets=activeBindings.map(b=>({...assets.get(b.asset_id),...b})).filter(Boolean);
    const related=arr(q.related_questions).length?q.related_questions:arr(q.関連問題).map(r=>({question_id:typeof r==='string'?r:r.question_id,types:['関連問題'],confirmation_status:'unclassified'}));
    const accepted=arr(q.grading_rule?.accepted_sets),acceptedCounts=[...new Set(accepted.map(x=>arr(x).length))];
    const override=q.user_grading_override||{},overrideActive=q.grading_rule?.type==='exact_set'&&override.authority==='利用者指定'&&typeof override.decided_on==='string'&&override.decided_on&&typeof override.note==='string'&&override.note.trim()&&normalizedSets(override.accepted_sets)===normalizedSets(accepted);
    const inferredAllSelectCount=q.指定選択数==null&&String(q.設問文||'').includes('すべて選べ')&&acceptedCounts.length===1&&acceptedCounts[0]>1?acceptedCounts[0]:null;
    const inferredOverrideCount=q.指定選択数==null&&overrideActive&&acceptedCounts.length===1?acceptedCounts[0]:null;
    const overrideDisplay=overrideActive?accepted.map(s=>s.join('・')).join(' または '):null;
    return {
      id, code:q.question_code||q.問題コード, examId:q.exam_id||q.試験ID, term:q.term??null, session:q.session_no??null, examType:q.exam_type??null, examHalf:q.exam_half??null, examDay:q.exam_day??null, booklet:q.booklet||q.冊子区分, number:q.question_number??q.問題番号, examDate:q.exam_date||null, displayLabel:q.display_label||`${q.exam_id||q.試験ID} ${q.booklet||q.冊子区分} 第${q.question_number??q.問題番号}問`,
      stem:q.問題本文||q.stem_text||'', prompt:q.設問文||q.prompt_text||'', choices:arr(q.選択肢).map(c=>({label:c.記号,text:c.本文,order:c.表示順})).sort((a,b)=>a.order-b.order),
      serialGroupId:sg, serialOrder:order, serialContext:sg?(serial.get(sg)?.共通本文||''):null, additionalInfo:q.追加提示情報||null,
      answer:arr(q['教室解答（採用版）']||q.correct_answers), answerDisplay:overrideDisplay||(q.official_grading_rule?.type==='all_correct'?'全員正解':q.grading_rule?.type==='exact_set'&&q.grading_rule.accepted_sets?.length>1?q.grading_rule.accepted_sets.map(s=>s.join('・')).join(' または '):q.official_grading_rule?.accepted_sets?.length>1?q.official_grading_rule.accepted_sets.map(s=>s.join('・')).join(' または '):null), answerCandidate:arr(q.解答候補), answerStatus:q.解答確認状態||'未確認', questionFormat:q.設問形式||null, requiredCount:q.指定選択数??inferredAllSelectCount??inferredOverrideCount, selectionCountInferred:inferredAllSelectCount!=null,
      questionRevisionId:q.question_revision_id??null, answerVersionId:q.answer_version_id??null, gradingRule:q.grading_rule||null,
      category:q.question_category??null, categoryStatus:q.category_confirmation_status||'unclassified', categoryEvidence:q.category_evidence||null, categoryQuestionRevisionId:q.category_question_revision_id??null,
      departments:deps, diseases, themes, diseaseClassificationStatus:q.disease_classification_status||((diseases.length)?'provisional':'unclassified'), diagnosisContext:q.diagnosis_context||null,
      explanation:q.explanation||null, intent:q.intent||null, learningPoints:arr(q.学習要点||q.learning_points),
      sourceImagePresence:q.source_image_presence||'unknown', sourceImageEvidence:q.source_image_evidence||null, assetIds:arr(q.asset_ids), assets:qAssets,
      sameQuestionGroup:q.same_question_group||null, sameQuestionSearchStatus:q.same_question_search_status||'not_assessed_across_exams', related, relationshipCoverage:q.relationship_coverage||{complete:false,other_exams:'未調査'},
      calibrationStatus:q.校正状態||null
    };
  });
  return {questions,serialGroups:arr(p.serial_groups),assets:arr(p.assets),assetBindings:bindings,departmentMaster:arr(p.department_master).length?p.department_master:DEPTS,diseaseMaster:arr(p.disease_master),references:arr(p.references),policies:{learning:p.learning_data_policy||{},import:p.import_policy||{}},openIssues:arr(p.open_issues)};
  }
  return {adapt,DEPTS};
});
