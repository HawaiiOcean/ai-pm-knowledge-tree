export const STORAGE_KEY = 'zhizhi.learning.v1';
const allowed = new Set(['read','mastered']);
export function sanitizeProgress(value, validIds) {
  const ids = new Set(validIds);
  const clean = {version:1, status:{}, bookmarks:[]};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return clean;
  if(value.status && typeof value.status === 'object') {
    for(const [id,status] of Object.entries(value.status)) {
      if(ids.has(id) && allowed.has(status)) clean.status[id] = status;
    }
  }
  if(Array.isArray(value.bookmarks)) clean.bookmarks = [...new Set(value.bookmarks.filter(id=>ids.has(id)))];
  return clean;
}
export function searchNodes(nodes, query) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if(!terms.length) return [];
  return nodes.map(node=>{
    const title = `${node.title} ${node.en}`.toLocaleLowerCase();
    const text = `${title} ${node.definition} ${node.example} ${node.pm} ${node.pitfall}`.toLocaleLowerCase();
    return {node,score:terms.every(term=>text.includes(term)) ? terms.reduce((score,term)=>score+(title.includes(term)?5:1),0):0};
  }).filter(result=>result.score>0).sort((a,b)=>b.score-a.score).map(result=>result.node);
}
