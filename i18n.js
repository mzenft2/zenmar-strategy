/* Local dictionaries: no translation service receives settings, maps or payment data. */
'use strict';
globalThis.ZENMAR_I18N = (() => {
  const languages = {pl:'Polski',en:'English',de:'Deutsch',fr:'Français',es:'Español',zh:'简体中文',ko:'한국어',vi:'Tiếng Việt'};
  const storageKey = 'zenmar-language';
  const normalize = value => String(value || '').toLowerCase().split(/[-_]/)[0];
  const detect = (preferred = navigator.languages || [navigator.language]) => preferred.map(normalize).find(code => languages[code]) || 'en';
  let saved; try { saved = localStorage.getItem(storageKey); } catch {}
  let language = languages[saved] ? saved : detect();
  const entries = globalThis.ZENMAR_TRANSLATIONS;
  const columns = ['pl','en','de','fr','es','zh','ko','vi'];
  const dictionary = new Map(entries.map(row => [row[0], row]));
  const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Longest phrases win; translated output is never fed back into replacement.
  const pattern = new RegExp('(?<![\\p{L}])(?:' + [...dictionary.keys()].sort((a,b)=>b.length-a.length).map(escapeRegex).join('|') + ')(?![\\p{L}])', 'gu');
  function text(source) {
    source = String(source);
    if (language === 'pl') return source;
    return source.replace(pattern, match => {
      const row = dictionary.get(match);
      return row[columns.indexOf(language)] || row[1];
    });
  }
  const originals = new WeakMap();
  const attributes = ['title','aria-label','placeholder'];
  function update(node, key, read, write) {
    let record = originals.get(node);
    if (!record) { record = new Map(); originals.set(node, record); }
    const current = read(), old = record.get(key);
    const source = old && old.output === current ? old.source : current;
    const output = text(source);
    record.set(key, {source,output});
    if (current !== output) write(output);
  }
  function translate(root) {
    if (!root || root.nodeType !== 1 && root.nodeType !== 3) return;
    const element = root.nodeType === 1 ? root : root.parentElement;
    if (!element || element.closest('script,style,pre,[translate="no"]')) return;
    if (root.nodeType === 3) {
      update(root,'text',()=>root.nodeValue,value=>{root.nodeValue=value;});
      return;
    }
    for (const name of attributes) if (root.hasAttribute(name)) update(root,name,()=>root.getAttribute(name),value=>root.setAttribute(name,value));
    for (const child of root.childNodes) translate(child);
  }
  function svg(source) {
    const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
    translate(doc.documentElement);
    return new XMLSerializer().serializeToString(doc.documentElement);
  }
  function setLanguage(code) {
    if (!languages[code]) return;
    language = code;
    try { localStorage.setItem(storageKey,code); } catch {}
    document.documentElement.lang = code === 'zh' ? 'zh-Hans' : code;
    translate(document.documentElement);
    document.getElementById('language').value = code;
    document.getElementById('language').setAttribute('aria-label',text('Język'));
    window.dispatchEvent(new Event('zenmar-language'));
  }
  document.documentElement.lang = language === 'zh' ? 'zh-Hans' : language;
  function start() {
    const select = document.getElementById('language');
    for (const [code,label] of Object.entries(languages)) select.add(new Option(label,code));
    select.value = language;
    select.setAttribute('aria-label',text('Język'));
    select.addEventListener('change',()=>setLanguage(select.value));
    translate(document.documentElement);
    // Observe only presentation changes: no model objects or saved projects are translated.
    const observer = new MutationObserver(records => {
      observer.disconnect();
      for (const record of records) {
        if (record.type === 'childList') for (const node of record.addedNodes) translate(node);
        else translate(record.target);
      }
      observe();
    });
    function observe(){observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributes});}
    observe();
  }
  document.addEventListener('DOMContentLoaded',start,{once:true});
  return {text,translate,svg,detect,setLanguage,languages,get language(){return language;},get locale(){return language==='zh'?'zh-CN':language;}};
})();
