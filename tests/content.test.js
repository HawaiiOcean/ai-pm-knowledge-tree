import test from 'node:test';
import assert from 'node:assert/strict';
import {nodes,groups,routes,sources} from '../dist/content.js';
import {sanitizeProgress,searchNodes} from '../dist/state.js';
test('all nodes have valid groups, meaningful content, references and valid quizzes',()=>{
  assert.equal(new Set(nodes.map(n=>n.id)).size,nodes.length);
  assert.equal(groups.length,10);
  for(const n of nodes){
    assert.ok(groups.some(g=>g.id===n.group),n.id);
    for(const key of ['title','en','definition','example','pm','pitfall'])assert.ok(n[key]?.length>0,`${n.id}.${key}`);
    for(const key of ['definition','example','pm','pitfall'])assert.ok(n[key].length>=20,`${n.id}.${key} is too short`);
    assert.equal(n.quiz.options.length,3);
    assert.ok(n.quiz.answer>=0&&n.quiz.answer<n.quiz.options.length,n.id);
    assert.ok(n.quiz.explanation.length>15,n.id);
    const source=sources[n.source||groups.find(g=>g.id===n.group).source];
    assert.ok(new URL(source[1]).protocol==='https:',n.id);
    for(const id of n.related)assert.ok(nodes.some(n=>n.id===id),`${n.id} → ${id}`);
  }
});
test('learning paths only reference existing nodes and avoid duplicates',()=>{
  for(const route of routes){assert.equal(new Set(route.ids).size,route.ids.length);for(const id of route.ids)assert.ok(nodes.some(n=>n.id===id));}
});
test('import drops unknown nodes and invalid statuses, deduplicates bookmarks',()=>{
  assert.deepEqual(sanitizeProgress({status:{token:'mastered',api:'fake',unknown:'read'},bookmarks:['token','token','unknown']},nodes.map(n=>n.id)),{version:1,status:{token:'mastered'},bookmarks:['token']});
  assert.deepEqual(sanitizeProgress(null,[]),{version:1,status:{},bookmarks:[]});
});
test('search handles Chinese, English, multiword queries and irrelevant input',()=>{
  assert.equal(searchNodes(nodes,'RAG')[0].id,'rag-intro');
  assert.equal(searchNodes(nodes,'重排序')[0].id,'reranking');
  assert.equal(searchNodes(nodes,'context window')[0].id,'context-window');
  assert.equal(searchNodes(nodes,'xyz-no-such-leaf-123').length,0);
  assert.equal(searchNodes(nodes,'  ').length,0);
});
