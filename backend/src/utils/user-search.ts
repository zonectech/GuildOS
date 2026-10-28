export function userSearchTerms(query: string) {
 let value=query.trim().slice(0,200);
 if(/^https?:\/\//i.test(value)){try{const url=new URL(value);value=decodeURIComponent(url.pathname.replace(/^\/(u|profile|portfolio)\//,'').replace(/\/$/,''));}catch{return [];}}
 return value.replace(/^@/,'').trim().split(/\s+/).filter(Boolean).slice(0,6).map(term=>new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
}
