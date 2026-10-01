const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const base=process.env.ZENMAR_TEST_URL||'http://127.0.0.1:4173';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.ZENMAR_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const report=[];
 try{
  const context=await browser.newContext({locale:'en-US',viewport:{width:1440,height:1000}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  assert.match(await page.locator('h1').textContent(),/Make more/);
  assert.equal(await page.locator('#supportFrame').getAttribute('src'),null);
  const before=await page.evaluate(()=>JSON.stringify(options()));
  for(const language of ['pl','en','de','fr','es','zh','ko','vi']){
   await page.locator('#language').selectOption(language);
   assert.equal(await page.locator('html').getAttribute('lang'),language==='zh'?'zh-Hans':language);
   assert.equal(await page.evaluate(()=>JSON.stringify(options())),before,'Language must not change settings');
   assert.equal(await page.locator('#language').inputValue(),language);
   await page.setViewportSize({width:390,height:844});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),language+' mobile overflow');
   report.push({language,heading:await page.locator('h1').textContent()});
  }
  await page.reload();
  assert.equal(await page.locator('#language').inputValue(),'vi','Explicit language survives reload');
  await page.locator('#language').selectOption('en');
  await page.locator('#projectInput').setInputFiles('references/zenmar-optimized.json');
  await page.waitForFunction(()=>!!result);
  const city=await page.evaluate(()=>JSON.stringify(E.projectFile(activeOptions,result.choices[chosen])));
  for(const language of ['de','fr','es','zh','ko','vi','pl','en']){
   await page.locator('#language').selectOption(language);
   assert.equal(await page.evaluate(()=>JSON.stringify(E.projectFile(activeOptions,result.choices[chosen]))),city,'Language must not mutate saved layout');
   assert.ok(await page.locator('#map svg').count());
   await page.setViewportSize({width:390,height:844});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),language+' result overflow');
  }
  const leftovers=await page.evaluate(()=>{
   const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),found=[];
   while(walker.nextNode()){const n=walker.currentNode;if(!n.parentElement.closest('script,style,pre,[translate="no"]')&&/[ąćęłńóśźż]/i.test(n.nodeValue))found.push(n.nodeValue);}
   return found;
  });
  assert.deepEqual(leftovers,[],'Untranslated Polish in English result');
  await page.locator('#editBuildings').click();
  await page.locator('#map .building').first().click();
  const activeEdit=await page.evaluate(()=>HOH_EDITOR.active);
  await page.locator('#language').selectOption('ko');
  assert.equal(await page.evaluate(()=>HOH_EDITOR.active),activeEdit);
  await page.locator('#cancelEdit').click();
  await page.locator('#language').selectOption('en');
  const downloaded=page.waitForEvent('download');
  await page.locator('#download').click();
  const file=await downloaded,svg=fs.readFileSync(await file.path(),'utf8');
  assert.match(svg,/Generated city layout/);
  assert.doesNotMatch(svg,/[ąćęłńóśźż]/i);
  await page.locator('[name=searchSeconds]').selectOption('30');
  await page.locator('[name=compareSparks]').uncheck();
  await page.locator('#refreshProject').click();
  await page.waitForFunction(()=>!!worker);
  const runningSettings=await page.evaluate(()=>JSON.stringify(activeOptions));
  await page.locator('#language').selectOption('zh');
  assert.equal(await page.evaluate(()=>JSON.stringify(activeOptions)),runningSettings);
  assert.equal(await page.evaluate(()=>!!worker),true,'Language must not stop the search');
  await page.waitForFunction(()=>!!result,{},{timeout:45000});
  await page.locator('#cancel').click();
  assert.equal(await page.evaluate(()=>!!worker),false);
  assert.ok(await page.locator('#map svg').count());
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('#language').selectOption('zh');
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:'qa/i18n-zh-desktop.png'});
  await page.locator('#language').selectOption('vi');
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:'qa/i18n-vi-mobile.png'});
  await page.route('https://ko-fi.com/**',route=>route.abort());
  await page.locator('#supportPanel summary').click();
  await page.waitForFunction(()=>document.querySelector('#supportFrame').hasAttribute('src'));
  assert.match(await page.locator('#supportFrame').getAttribute('src'),/^https:\/\/ko-fi.com\/zenmar/);
  assert.ok(await page.locator('.support-content>a').isVisible(),'Payment fallback visible');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Support overflow');
  await page.screenshot({path:'qa/i18n-support-mobile.png'});
  await page.locator('#closeSupport').click();
  assert.equal(await page.locator('#supportPanel').getAttribute('open'),null);
  assert.deepEqual(errors,[]);
  await context.close();
  for(const [locale,want] of [['de-DE','de'],['es-MX','es'],['zh-TW','zh-Hans'],['ko-KR','ko'],['vi-VN','vi'],['ja-JP','en']]){
   const c=await browser.newContext({locale});const p=await c.newPage();await p.goto(base);
   assert.equal(await p.locator('html').getAttribute('lang'),want,locale);
   await c.close();
  }
  const c=await browser.newContext({locale:'fr-FR'});
  await c.addInitScript(()=>{Object.defineProperty(Storage.prototype,'getItem',{value(){throw Error('blocked');}});Object.defineProperty(Storage.prototype,'setItem',{value(){throw Error('blocked');}});});
  const p=await c.newPage();await p.goto(base);assert.equal(await p.locator('html').getAttribute('lang'),'fr');await p.locator('#language').selectOption('ko');assert.equal(await p.locator('html').getAttribute('lang'),'ko');await c.close();
  fs.writeFileSync('qa/i18n-report.json',JSON.stringify({passed:true,languages:report,errors},null,2));
  console.log('PASS: eight languages, locale detection/fallback, storage failure, preserved settings/map/editor, translated SVG, responsive layouts, lazy payment form and fallback.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
