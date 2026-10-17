import {groups,nodes,routes,nodeById,groupById,sources,updatedAt} from './content.js';
import {STORAGE_KEY,sanitizeProgress,searchNodes} from './state.js';
import {treeLayout,treeSize} from './tree-layout.js';

const $ = selector=>document.querySelector(selector);
const $$ = selector=>[...document.querySelectorAll(selector)];
const escape = value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const ids = nodes.map(node=>node.id);
let progress;
let storageAvailable = true;
try { progress = sanitizeProgress(JSON.parse(localStorage.getItem(STORAGE_KEY)),ids); }
catch { progress = sanitizeProgress(null,ids); }
let currentNode = null;
let currentGroup = null;
let activeView = 'tree';
let listMode = false;
let activeRoute = null;
let reviewFilter = 'saved';
let readerReturnFocus = null;
let toastTimer;
let transform = {x:0,y:0,scale:1};
const viewport = $('#map');
const canvas = $('#map-canvas');
const groupNodes = group=>nodes.filter(node=>node.group===group);

function toast(message) {
  $('#toast').textContent=message; $('#toast').classList.add('visible');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3000);
}
function saveProgress() {
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify(progress)); }
  catch { storageAvailable=false; toast('浏览器无法保存进度，请导出记录备份。'); }
  updateProgress(); renderTree();
  if(activeView==='review') renderReview();
  if(activeView==='routes') renderRoutes();
  if(listMode) renderList();
  renderRouteBanner();
}
function updateProgress() {
  const read=Object.keys(progress.status).length;
  const mastered=Object.values(progress.status).filter(value=>value==='mastered').length;
  $('#progress-count').innerHTML=`${read} <small>/ ${nodes.length} 个知识点</small>`;
  $('#progress-bar').style.width=`${read/nodes.length*100}%`;
  $('#progress-caption').textContent=read?`已阅读 ${read} 个 · 自测通过 ${mastered} 个`:'今天，种下第一个知识点。';
  $('#saved-count').textContent=progress.bookmarks.length;
}
function markRead(node) {
  if(!progress.status[node.id]) { progress.status[node.id]='read'; saveProgress(); }
}
function stateLabel(id) { return progress.status[id]==='mastered'?'✓ 自测通过':progress.status[id]==='read'?'已阅读':'待探索'; }
function renderTree() {
  $('#tree-nodes').innerHTML=groups.map(group=>{
    const position=treeLayout[group.id];
    const members=groupNodes(group.id);
    const read=members.filter(node=>progress.status[node.id]).length;
    const mastered=members.every(node=>progress.status[node.id]==='mastered');
    const dimmed=activeRoute&&!members.some(node=>activeRoute.ids.includes(node.id));
    const shape=position.side==='left'?'M248 113 C148 151 5 109 12 13 C147 -7 244 25 248 113Z':'M12 113 C112 151 255 109 248 13 C113 -7 16 25 12 113Z';
    const vein=position.side==='left'?'M245 112 Q144 64 34 28':'M15 112 Q116 64 226 28';
    return `<button class="chapter-leaf ${position.side} ${read?'read':''} ${mastered?'mastered':''} ${dimmed?'dimmed':''}" id="branch-${group.id}" data-group="${group.id}" style="left:${position.x-130}px;top:${position.y-70}px;--leaf-fill:${position.fill};--leaf-stroke:${position.stroke}" aria-label="${escape(group.title)}，${members.length} 个知识点，已阅读 ${read} 个"><svg viewBox="0 0 260 140" aria-hidden="true"><path class="leaf-shape" d="${shape}"/><path class="leaf-vein" d="${vein}"/></svg><span>${escape(group.title)}</span></button>`;
  }).join('');
  $('#branch-nav').innerHTML=groups.map(group=>`<button class="branch-nav-item" data-locate="${group.id}" style="--branch:${group.color}"><span class="branch-dot"></span>${group.title}<span class="branch-nav-count">${groupNodes(group.id).length}</span></button>`).join('');
}
function renderLines() {
  const branchPaths=Object.values(treeLayout).map(p=>{
    const endX=p.x+(p.side==='left'?116:-116),endY=p.y+42;
    return `<path d="M600 ${p.joint} C${p.side==='left'?540:660} ${p.joint-40} ${endX+(p.side==='left'?80:-80)} ${endY+45} ${endX} ${endY}" stroke-width="${p.width}"/>`;
  });
  $('#tree-lines').setAttribute('viewBox',`0 0 ${treeSize.width} ${treeSize.height}`);
  $('#tree-lines').innerHTML=`<defs><linearGradient id="bark" x1="0" y1="1" x2=".2" y2="0"><stop stop-color="#9a8968"/><stop offset=".48" stop-color="#8c9974"/><stop offset="1" stop-color="#a6b68a"/></linearGradient><radialGradient id="tree-glow"><stop stop-color="#e4edd7" stop-opacity=".45"/><stop offset="1" stop-color="#e4edd7" stop-opacity="0"/></radialGradient></defs><ellipse cx="600" cy="505" rx="540" ry="470" fill="url(#tree-glow)"/><path d="M566 987 C587 866 581 737 585 640 C590 503 583 384 599 194 C618 363 610 503 617 640 C619 768 614 875 638 987 Q603 974 566 987Z" fill="url(#bark)"/><g fill="none" stroke="#95a47e" stroke-linecap="round">${branchPaths.join('')}</g><g fill="none" stroke="#b0b89c" stroke-linecap="round"><path d="M593 972 Q565 1011 493 1022 Q469 1025 452 1040" stroke-width="6"/><path d="M603 981 Q623 1017 691 1027 Q723 1031 741 1043" stroke-width="5"/><path d="M599 981 Q586 1027 565 1049" stroke-width="4"/><path d="M610 983 Q623 1028 652 1049" stroke-width="3"/><path d="M523 1018 Q515 1038 495 1047M679 1024 Q684 1044 706 1052" stroke-width="2"/></g><g fill="#b8c99a" opacity=".8"><path d="M584 274 Q541 276 545 240 Q575 239 584 274"/><path d="M616 456 Q655 455 659 420 Q627 419 616 456"/><path d="M582 661 Q540 658 537 625 Q570 624 582 661"/><path d="M622 838 Q662 838 668 805 Q633 805 622 838"/></g>`;
}
function applyTransform() {
  canvas.style.setProperty('--map-scale',transform.scale);
  canvas.style.transform=`translate(${transform.x}px,${transform.y}px) scale(${transform.scale})`;
  $('#zoom-label').textContent=`${Math.round(transform.scale*100)}%`;
}
function fitMap() {
  if(viewport.hidden) return;
  const width=viewport.clientWidth,height=viewport.clientHeight;
  // 叶片与枝干使用同一坐标系等比例缩放，始终保留各章节间的间距。
  transform.scale=Math.max(.12,Math.min((width-32)/treeSize.width,(height-28)/treeSize.height,1));
  transform.x=(width-treeSize.width*transform.scale)/2;
  transform.y=(height-treeSize.height*transform.scale)/2;
  applyTransform();
}
function zoom(factor,cx=viewport.clientWidth/2,cy=viewport.clientHeight/2) {
  const next=Math.min(1.6,Math.max(.12,transform.scale*factor));
  transform.x=cx-(cx-transform.x)*next/transform.scale;
  transform.y=cy-(cy-transform.y)*next/transform.scale;
  transform.scale=next; applyTransform();
}
function focusGroup(id) {
  const group=treeLayout[id]; if(!group)return;
  if(activeView!=='tree'||listMode){ listMode=false;setView('tree'); }
  const width=viewport.clientWidth,height=viewport.clientHeight;
  transform.scale=Math.min(1.05,(width-35)/380,(height-35)/260);
  transform.x=width/2-group.x*transform.scale;
  transform.y=height/2-group.y*transform.scale;
  applyTransform();
}
function flowMarkup(flow) {
  return flow.length?`<section class="reader-section"><h3>HOW IT WORKS · 理解流程</h3><div class="flow-diagram">${flow.map((step,i)=>`${i?'<b>→</b>':''}<span>${escape(step)}</span>`).join('')}</div></section>`:'';
}
function setReaderVisible(visible) {
  $('#reader').hidden=!visible; $('#reader-backdrop').hidden=!visible;
  $('.workspace').inert=visible; $('.header').inert=visible;
  if(visible) { $('#reader').scrollTop=0; $('#reader-close').focus(); }
}
function captureReaderFocus() { if($('#reader').hidden) readerReturnFocus=document.activeElement; }
function openNode(id,options={}) {
  const node=nodeById[id];if(!node)return;
  captureReaderFocus();currentNode=node;currentGroup=null;
  const group=groupById[node.group];
  markRead(node);
  $('#reader').style.setProperty('--branch',group.color);
  $('#reader-breadcrumb').textContent=`${group.number} / ${group.title}`;
  $('#bookmark-node').hidden=false;updateBookmarkButton();
  const related=node.related.map(id=>nodeById[id]).filter(Boolean);
  const source=sources[node.source||group.source];
  const routeIndex=activeRoute?.ids.indexOf(id)??-1;
  const next=routeIndex>=0?nodeById[activeRoute.ids[routeIndex+1]]:nodeById[ids[ids.indexOf(id)+1]];
  $('#reader-content').innerHTML=`<span class="reader-tag">LEAF ${String(ids.indexOf(id)+1).padStart(2,'0')} · ${group.en}</span><h2>${escape(node.title)}</h2><div class="reader-english">${escape(node.en)}</div><div class="reader-meta"><span>约 ${node.minutes} 分钟</span><span id="reader-status">${stateLabel(id)}</span><span>更新 ${updatedAt}</span></div><div class="definition">${escape(node.definition)}</div>${flowMarkup(node.flow)}<section class="reader-section case-box"><h3>A REAL SCENARIO · 产品场景</h3><p>${escape(node.example)}</p></section><section class="reader-section pm-box"><h3>ASK LIKE A PM · 产品经理应该追问</h3><p>${escape(node.pm)}</p></section><section class="reader-section"><h3>COMMON PITFALL · 常见误区</h3><p>${escape(node.pitfall)}</p></section><section class="quiz"><span class="eyebrow">CHECK YOUR UNDERSTANDING</span><h3>给理解，做一个小检查。</h3><p>${escape(node.quiz.question)}</p><div class="quiz-options">${node.quiz.options.map((option,index)=>`<button class="quiz-option" data-answer="${index}">${String.fromCharCode(65+index)}. ${escape(option)}</button>`).join('')}</div><div id="quiz-feedback" class="quiz-feedback" role="status"></div></section><div class="reader-bottom">${next?`<button class="primary-button" data-node="${next.id}">下一个：${escape(next.title)} →</button>`:'<button class="primary-button" data-close-reader>回到知识树 ↗</button>'}<button class="secondary-button" id="mark-unread">重新学习</button></div>${related.length?`<section class="reader-section"><h3>CONNECTED LEAVES · 关联知识</h3><div class="related">${related.map(item=>`<button data-node="${item.id}">${escape(item.title)} ↗</button>`).join('')}</div></section>`:''}<section class="reader-section"><h3>READ FURTHER · 原始资料</h3><a class="source-link" href="${source[1]}" target="_blank" rel="noopener noreferrer">${escape(source[0])} ↗</a><p class="reader-note">本站为面向产品实践的学习笔记与情境示例；示例不是模型测量结果或可直接套用的业务结论。</p></section>`;
  if(!options.fromHash) history.replaceState(null,'',`#node/${id}`);
  setReaderVisible(true);renderTree();
}
function openGroup(id) {
  const group=groupById[id];if(!group)return;
  captureReaderFocus(); currentNode=null; currentGroup=group;
  $('#reader').style.setProperty('--branch',group.color);
  $('#reader-breadcrumb').textContent=`知识分支 / ${group.number}`;
  $('#bookmark-node').hidden=true;
  $('#reader-content').innerHTML=`<span class="reader-tag">${group.en}</span><h2>${group.title}</h2><div class="reader-meta"><span>${groupNodes(id).length} 个知识点</span><span>由浅入深，逐叶探索</span></div><div class="definition">${group.description}</div><section class="reader-section"><h3>START WITH A QUESTION · 带着问题学习</h3><p>${group.question}</p></section><div class="overview-list">${groupNodes(id).map((node,i)=>`<button class="overview-item" data-node="${node.id}"><div><strong>${String(i+1).padStart(2,'0')} · ${escape(node.title)}</strong><small>${escape(node.en)}</small></div><span>${stateLabel(node.id)} →</span></button>`).join('')}</div><section class="reader-section"><p class="reader-note">每个知识点包含概念、案例、PM 追问、常见误区和自测。点击即可开始，学习进度自动保存在当前浏览器。</p></section>`;
  history.replaceState(null,'',`#branch/${id}`);setReaderVisible(true);
}
function closeReader() {
  currentNode=null;currentGroup=null;setReaderVisible(false);history.replaceState(null,'',location.pathname+location.search);renderTree();
  if(readerReturnFocus?.isConnected)readerReturnFocus.focus();else $('#guide-open').focus();
}
function updateBookmarkButton() {
  const saved=progress.bookmarks.includes(currentNode?.id);
  $('#bookmark-node').classList.toggle('bookmarked',saved);
  $('#bookmark-node').textContent=saved?'◆':'◇';
  $('#bookmark-node').setAttribute('aria-label',saved?'取消收藏知识点':'收藏知识点');
  $('#bookmark-node').setAttribute('aria-pressed',String(saved));
}
function answerQuiz(index) {
  if(!currentNode)return;
  const quiz=currentNode.quiz,correct=index===quiz.answer;
  $$('.quiz-option').forEach((button,i)=>{button.classList.remove('correct','incorrect');if(i===index)button.classList.add(correct?'correct':'incorrect');});
  const feedback=$('#quiz-feedback');feedback.classList.toggle('wrong',!correct);
  feedback.textContent=`${correct?'✓ 理解正确。':'再想一想。'} ${quiz.explanation}`;
  if(correct){progress.status[currentNode.id]='mastered';saveProgress();$('#reader-status').textContent=stateLabel(currentNode.id);}
}
function nodeCard(node) {
  return `<button class="list-card" data-node="${node.id}"><span class="card-status">${stateLabel(node.id)}</span><strong>${escape(node.title)}</strong><small>${escape(node.en)}</small><p>${escape(node.definition.slice(0,72))}${node.definition.length>72?'…':''}</p></button>`;
}
function renderList() {
  $('#list-content').innerHTML=groups.map(group=>`<section class="list-group" style="--branch:${group.color}"><h3>${group.number} · ${group.title}</h3><div class="list-grid">${groupNodes(group.id).map(nodeCard).join('')}</div></section>`).join('');
}
function renderRoutes() {
  $('#routes-content').innerHTML=routes.map((route,index)=>{
    const completed=route.ids.filter(id=>progress.status[id]==='mastered').length;
    return `<article class="route-card"><span class="eyebrow">PATH ${String(index+1).padStart(2,'0')} · ${route.en}</span><h3>${route.title}</h3><p>${route.description}</p><div class="route-steps">${route.ids.map((id,i)=>`${i?'<b>→</b>':''}<span>${escape(nodeById[id].title)}</span>`).join('')}</div><p>${route.ids.length} 个知识点 · 约 ${route.minutes} 分钟 · 自测通过 ${completed}/${route.ids.length}</p><button class="primary-button" data-route="${route.id}">${completed?'继续这条路线':'沿着这条路线生长'} ↗</button></article>`;
  }).join('');
}
function renderReview() {
  const chosen=nodes.filter(node=>reviewFilter==='saved'?progress.bookmarks.includes(node.id):reviewFilter==='mastered'?progress.status[node.id]==='mastered':progress.status[node.id]==='read');
  $('#review-content').innerHTML=`<p class="review-summary">收藏值得再看的问题，检验你是否能解释技术背后的产品取舍。已阅读不等于已掌握。</p><div class="review-backup"><span>学习进度保存在当前浏览器</span><button data-export>导出备份 ↗</button><button data-import>导入记录</button></div><div class="review-filters"><button data-filter="saved" class="${reviewFilter==='saved'?'active':''}">◇ 我的收藏</button><button data-filter="read" class="${reviewFilter==='read'?'active':''}">待自测</button><button data-filter="mastered" class="${reviewFilter==='mastered'?'active':''}">✓ 自测通过</button></div>${chosen.length?`<div class="list-grid">${chosen.map(nodeCard).join('')}</div>`:`<div class="empty-state"><span class="empty-icon">♧</span>${reviewFilter==='saved'?'还没有收藏的叶子。<br>打开知识点，点击右上角的 ◇，为下次复习留下路标。':reviewFilter==='read'?'这里会收集已经阅读、尚未通过自测的知识点。':'每通过一道自测，就有一片叶子在这里点亮。'}<br><button class="secondary-button" data-begin>从根系开始 →</button></div>`}`;
}
function setView(view) {
  activeView=view;
  $$('.nav-tab').forEach(button=>button.classList.toggle('active',button.dataset.view===view));
  viewport.hidden=view!=='tree'||listMode;
  $('#list-content').hidden=view!=='tree'||!listMode;
  $('#routes-content').hidden=view!=='routes';$('#review-content').hidden=view!=='review';
  $('.map-toolbar').hidden=view!=='tree';$('.map-footer').hidden=view!=='tree';
  $('#view-title').innerHTML=view==='tree'?'AI 产品经理的技术全景<span class="beta">持续生长中</span>':view==='routes'?'沿着一条路线，长出完整理解。':'把读过的知识，变成自己的判断。';
  $('#view-subtitle').textContent=view==='tree'?'根系是原理，枝干是能力，树冠是你能创造的产品。':view==='routes'?'从具体的产品任务出发，把相互关联的知识串起来。':'在案例里回忆，在追问中连接，在自测后确认。';
  $('#tree-view').classList.toggle('active',!listMode);$('#list-view').classList.toggle('active',listMode);
  if(view==='routes')renderRoutes();if(view==='review')renderReview();if(view==='tree'&&listMode)renderList();
  renderRouteBanner();
}
function renderRouteBanner() {
  $('#route-banner').hidden=!activeRoute||activeView!=='tree';$('#route-clear').hidden=!activeRoute;
  if(!activeRoute)return;
  const done=activeRoute.ids.filter(id=>progress.status[id]==='mastered').length;
  const next=activeRoute.ids.find(id=>progress.status[id]!=='mastered');
  $('#route-banner').innerHTML=`${escape(activeRoute.title)} · 自测通过 ${done}/${activeRoute.ids.length}${next?`<button data-node="${next}">继续：${escape(nodeById[next].title)} →</button>`:' · 这条路线已点亮，随时可以重新复习。'}`;
}
function beginRoute(id) {
  activeRoute=routes.find(route=>route.id===id);if(!activeRoute)return;
  listMode=false;setView('tree');renderTree();
  const next=activeRoute.ids.find(id=>progress.status[id]!=='mastered')||activeRoute.ids[0];
  focusGroup(nodeById[next].group);openNode(next);
}
function openSearch() {
  if(!$('#reader').hidden)closeReader();
  $('#search-dialog').showModal();$('#search-input').value='';renderSearch('');$('#search-input').focus();
}
function renderSearch(query) {
  const found=query.trim()?searchNodes(nodes,query):nodes.filter(node=>['token','rag-intro','tool-calling','eval-dataset','context-engineering'].includes(node.id));
  $('#search-results').innerHTML=found.length?found.slice(0,25).map(node=>`<button class="search-result" data-search-node="${node.id}"><strong>${escape(node.title)}</strong> <small>${escape(node.en)} · ${groupById[node.group].title}</small></button>`).join(''):`<div class="empty-state">没有找到相关叶子。<br>试试英文缩写、中文概念或产品问题。</div>`;
}
function readHash() {
  const parts=location.hash.slice(1).split('/');
  if(parts[0]==='node'&&nodeById[parts[1]])openNode(parts[1],{fromHash:true});
  else if(parts[0]==='branch'&&groupById[parts[1]])openGroup(parts[1]);
  else if(!$('#reader').hidden)closeReader();
}

document.addEventListener('click',event=>{
  const element=event.target.closest('button');if(!element)return;
  if(element.dataset.node)openNode(element.dataset.node);
  else if(element.dataset.group)openGroup(element.dataset.group);
  else if(element.dataset.expand)focusGroup(element.dataset.expand);
  else if(element.dataset.locate){focusGroup(element.dataset.locate);openGroup(element.dataset.locate);}
  else if(element.dataset.view)setView(element.dataset.view);
  else if(element.dataset.route)beginRoute(element.dataset.route);
  else if(element.dataset.filter){reviewFilter=element.dataset.filter;renderReview();}
  else if(element.dataset.answer!==undefined)answerQuiz(Number(element.dataset.answer));
  else if(element.dataset.searchNode){$('#search-dialog').close();focusGroup(nodeById[element.dataset.searchNode].group);openNode(element.dataset.searchNode);}
  else if(element.hasAttribute('data-close-reader'))closeReader();
  else if(element.hasAttribute('data-export'))$('#export-progress').click();
  else if(element.hasAttribute('data-import'))$('#import-progress').click();
  else if(element.hasAttribute('data-begin')){listMode=false;setView('tree');focusGroup('fundamentals');openNode('token');}
});
$('#reader-close').onclick=closeReader;$('#reader-backdrop').onclick=closeReader;
$('#bookmark-node').onclick=()=>{
  if(!currentNode)return;
  const index=progress.bookmarks.indexOf(currentNode.id);
  if(index===-1)progress.bookmarks.push(currentNode.id);else progress.bookmarks.splice(index,1);
  saveProgress();updateBookmarkButton();toast(index===-1?'已收藏，为下次复习留一片叶子。':'已取消收藏。');
};
$('#reader-content').addEventListener('click',event=>{
  if(event.target.closest('#mark-unread')&&currentNode){delete progress.status[currentNode.id];saveProgress();$('#reader-status').textContent='待重新学习';$('#quiz-feedback').textContent='已重置，可以重新自测。';$$('.quiz-option').forEach(button=>button.classList.remove('correct','incorrect'));toast('已重置这个知识点的学习状态。');}
});
$('#share-node').onclick=async()=>{
  try {await navigator.clipboard.writeText(location.href);toast('知识点链接已复制。');}
  catch {toast('当前浏览器无法复制，请从地址栏复制知识点链接。');}
};
$('#search-open').onclick=openSearch;$('#search-close').onclick=()=>$('#search-dialog').close();
$('#search-input').addEventListener('input',event=>renderSearch(event.target.value));
$('#search-dialog').addEventListener('click',event=>{if(event.target===$('#search-dialog'))$('#search-dialog').close();});
$('#guide-open').onclick=()=>$('#guide-dialog').showModal();$('#guide-close').onclick=()=>$('#guide-dialog').close();
$('#guide-start').onclick=()=>{$('#guide-dialog').close();focusGroup('fundamentals');openNode('token');};
$('#start-learning').onclick=()=>{focusGroup('fundamentals');openNode('token');};
$('#explore-all').onclick=()=>{activeRoute=null;listMode=false;setView('tree');renderTree();fitMap();};
$('#route-shortcut').onclick=()=>setView('routes');
$('#tree-view').onclick=()=>{listMode=false;setView('tree');fitMap();};$('#list-view').onclick=()=>{listMode=true;setView('tree');};
$('#zoom-in').onclick=()=>zoom(1.25);$('#zoom-out').onclick=()=>zoom(.8);$('#fit-map').onclick=fitMap;
$('#route-clear').onclick=()=>{activeRoute=null;renderTree();renderRouteBanner();fitMap();};
$('#export-progress').onclick=()=>{
  const blob=new Blob([JSON.stringify({...progress,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='zhizhi-learning.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('学习记录已导出。');
};
$('#import-progress').onclick=()=>$('#import-file').click();
$('#import-file').onchange=async event=>{
  const file=event.target.files[0];if(!file)return;
  try {if(file.size>1024*1024)throw new Error('large');const raw=JSON.parse(await file.text());if(raw.version!==1||!raw.status||!Array.isArray(raw.bookmarks))throw new Error('invalid');const imported=sanitizeProgress(raw,ids);for(const [id,status]of Object.entries(imported.status)){if(progress.status[id]!=='mastered')progress.status[id]=status;}progress.bookmarks=[...new Set([...progress.bookmarks,...imported.bookmarks])];saveProgress();toast('已合并学习记录，不会覆盖已有的自测通过状态。');}
  catch {toast('无法导入：请使用本站导出的学习记录文件（小于 1MB）。');}
  event.target.value='';
};

// 鼠标拖动 / 单指平移 / 双指缩放。按钮点击不会触发拖动。
const pointers=new Map();let gesture=null;let moved=false;
viewport.addEventListener('pointerdown',event=>{
  if(event.target.closest('button'))return;
  pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});viewport.setPointerCapture(event.pointerId);moved=false;
  if(pointers.size===1)gesture={x:event.clientX,y:event.clientY,tx:transform.x,ty:transform.y};
  else if(pointers.size===2){const [a,b]=[...pointers.values()];gesture={distance:Math.hypot(a.x-b.x,a.y-b.y)};}
  viewport.classList.add('dragging');
});
viewport.addEventListener('pointermove',event=>{
  if(!pointers.has(event.pointerId))return;
  pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(pointers.size===2){const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);const rect=viewport.getBoundingClientRect();if(gesture?.distance>0)zoom(distance/gesture.distance,(a.x+b.x)/2-rect.left,(a.y+b.y)/2-rect.top);gesture={distance};}
  else if(gesture&&'tx'in gesture){const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;if(Math.abs(dx)+Math.abs(dy)>3)moved=true;transform.x=gesture.tx+dx;transform.y=gesture.ty+dy;applyTransform();}
});
function releasePointer(event){pointers.delete(event.pointerId);if(!pointers.size){gesture=null;viewport.classList.remove('dragging');}else{const a=[...pointers.values()][0];gesture={x:a.x,y:a.y,tx:transform.x,ty:transform.y};}}
viewport.addEventListener('pointerup',releasePointer);viewport.addEventListener('pointercancel',releasePointer);
viewport.addEventListener('wheel',event=>{event.preventDefault();const rect=viewport.getBoundingClientRect();if(event.ctrlKey||event.metaKey)zoom(Math.exp(-event.deltaY*.006),event.clientX-rect.left,event.clientY-rect.top);else{transform.x-=event.deltaX;transform.y-=event.deltaY;applyTransform();}},{passive:false});
viewport.addEventListener('keydown',event=>{if(event.target.closest('button'))return;const movement={ArrowLeft:[50,0],ArrowRight:[-50,0],ArrowUp:[0,50],ArrowDown:[0,-50]}[event.key];if(movement){event.preventDefault();transform.x+=movement[0];transform.y+=movement[1];applyTransform();}else if(event.key==='+')zoom(1.25);else if(event.key==='-')zoom(.8);});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!$('#reader').hidden)closeReader();
  if(event.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)&&!$('#guide-dialog').open&&!$('#search-dialog').open){event.preventDefault();openSearch();}
  if(event.key==='Tab'&&!$('#reader').hidden){const focusable=$$('#reader button:not([hidden]):not(:disabled), #reader a[href]');const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
});
window.addEventListener('hashchange',readHash);
new ResizeObserver(()=>{if(activeView==='tree'&&!listMode)fitMap();}).observe(viewport);
$('#total-label').textContent=`${nodes.length} 个知识点`;
renderLines();renderTree();updateProgress();setView('tree');requestAnimationFrame(fitMap);readHash();
