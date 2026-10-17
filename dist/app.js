import {groups,nodes,routes,nodeById,groupById,sources,updatedAt} from './content.js';
import {STORAGE_KEY,sanitizeProgress,searchNodes} from './state.js';

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
function leafMarkup(node) {
  return `<button class="leaf ${progress.status[node.id]||''} ${progress.bookmarks.includes(node.id)?'saved':''} ${currentNode?.id===node.id?'selected':''} ${activeRoute?.ids.includes(node.id)?'route-node':''}" data-node="${node.id}" aria-label="${escape(node.title)}，${stateLabel(node.id)}">${escape(node.title)}</button>`;
}
function renderTree() {
  $('#tree-nodes').innerHTML=groups.map(group=>`<section class="branch-card ${activeRoute&&!groupNodes(group.id).some(node=>activeRoute.ids.includes(node.id))?'dimmed':''}" id="branch-${group.id}" style="left:${group.x}px;top:${group.y}px;--branch:${group.color}"><button class="branch-title" data-group="${group.id}"><span class="branch-symbol">${group.symbol}</span>${group.title}<span class="branch-number">${group.number}</span></button><div class="branch-en">${group.en}</div><p class="branch-description">${group.description}</p><button class="overview-expand" data-expand="${group.id}">${groupNodes(group.id).length} 个知识点 <span>展开叶子 ↗</span></button><div class="leaf-list">${groupNodes(group.id).map(leafMarkup).join('')}</div></section>`).join('');
  $('#branch-nav').innerHTML=groups.map(group=>`<button class="branch-nav-item" data-locate="${group.id}" style="--branch:${group.color}"><span class="branch-dot"></span>${group.title}<span class="branch-nav-count">${groupNodes(group.id).length}</span></button>`).join('');
}
function renderLines() {
  const branches=[
    ['M720 1310 C660 1240 685 1140 720 1080', '#a5b797',7],
    ['M720 1100 C780 1060 960 1200 1010 1185','#c3b59b',4],
    ['M720 1120 C720 1030 720 1000 720 935','#a2b88d',7],
    ['M720 895 C620 875 555 875 425 875','#9bbbad',5],
    ['M720 895 C820 870 900 875 1015 875','#c9b39a',5],
    ['M720 900 C710 780 700 680 700 570','#b1c39f',7],
    ['M715 800 C570 770 510 610 410 585','#b6c399',5],
    ['M715 780 C850 720 900 610 1030 585','#a8bac7',5],
    ['M700 565 C690 460 570 315 530 300','#c6bb95',5],
    ['M700 565 C700 380 795 295 835 280','#9fb396',6],
    ['M690 1240 C640 1310 560 1340 510 1340','#c3cdb5',2],
    ['M695 1280 C670 1335 635 1360 615 1360','#c3cdb5',2],
    ['M725 1260 C770 1320 845 1345 910 1345','#c3cdb5',2],
    ['M720 1290 C740 1350 780 1360 800 1360','#c3cdb5',2],
  ];
  $('#tree-lines').innerHTML=`<defs><radialGradient id="canopy"><stop offset="0" stop-color="#dce7cf" stop-opacity=".27"/><stop offset="1" stop-color="#dce7cf" stop-opacity="0"/></radialGradient></defs><ellipse cx="715" cy="640" rx="680" ry="590" fill="url(#canopy)"/>${branches.map(([d,color,width])=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" opacity=".7"/>`).join('')}<g fill="#becdad" opacity=".7"><path d="M702 418q-39-49-43-14q3 23 43 14"/><path d="M712 722q37-49 43-18q-1 22-43 18"/><path d="M658 1067q-37-41-41-12q5 24 41 12"/><path d="M776 393q29-39 33-13q-4 17-33 13"/><path d="M568 711q-34-25-29-1q9 16 29 1"/></g><text x="720" y="70" text-anchor="middle" font-size="10" fill="#9daa90" letter-spacing="4" font-family="Georgia,serif">GROW YOUR UNDERSTANDING</text>`;
}
function applyTransform() {
  canvas.style.setProperty('--map-scale',transform.scale);
  canvas.classList.toggle('overview',transform.scale<.65);
  canvas.style.transform=`translate(${transform.x}px,${transform.y}px) scale(${transform.scale})`;
  $('#zoom-label').textContent=`${Math.round(transform.scale*100)}%`;
}
function fitMap() {
  if(viewport.hidden) return;
  const width=viewport.clientWidth,height=viewport.clientHeight;
  // 全树保持可见；文字太小时可点击分支导航或切换清单阅读。
  transform.scale=Math.max(.18,Math.min((width-28)/1440,(height-25)/1480,1));
  transform.x=(width-1440*transform.scale)/2;
  transform.y=(height-1480*transform.scale)/2+3;
  applyTransform();
}
function zoom(factor,cx=viewport.clientWidth/2,cy=viewport.clientHeight/2) {
  const next=Math.min(1.6,Math.max(.18,transform.scale*factor));
  transform.x=cx-(cx-transform.x)*next/transform.scale;
  transform.y=cy-(cy-transform.y)*next/transform.scale;
  transform.scale=next; applyTransform();
}
function focusGroup(id) {
  const group=groupById[id]; if(!group)return;
  if(activeView!=='tree'||listMode){ listMode=false;setView('tree'); }
  const width=viewport.clientWidth,height=viewport.clientHeight;
  transform.scale=Math.min(1.05,(width-35)/380,(height-35)/260);
  transform.x=width/2-(group.x+165)*transform.scale;
  transform.y=height/2-(group.y+105)*transform.scale;
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
