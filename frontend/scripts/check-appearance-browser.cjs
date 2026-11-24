// Run against an isolated, signed-in Firefox test profile with BiDi enabled.
const fs=require('fs');
const path=require('path');
const os=require('os');
const puppeteer=require('puppeteer-core');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const inspect=()=>{
      const root=document.querySelector('.page-surface');
      const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none';};
      const overflow=[...root.querySelectorAll('*')].filter(e=>{if(!visible(e)||e.closest('svg'))return false;const r=e.getBoundingClientRect();if(r.right<=innerWidth+2&&r.left>=-2)return false;for(let p=e.parentElement;p&&p!==document.body;p=p.parentElement)if(['auto','scroll','hidden','clip'].includes(getComputedStyle(p).overflowX))return false;return true;}).map(e=>e.className||e.tagName).slice(0,10);
      const missingIcons=[...root.querySelectorAll('svg.ui-icon')].filter(e=>visible(e.parentElement)&&(!visible(e)||getComputedStyle(e).stroke==='none')).map(e=>e.parentElement.className);
      const collisions=[];const controls=[...root.querySelectorAll('button,input,select,textarea')].filter(visible);
      for(let a=0;a<controls.length;a++)for(let b=a+1;b<controls.length;b++){const x=controls[a],y=controls[b];if(x.contains(y)||y.contains(x)||x.closest('.input-wrapper')===y.closest('.input-wrapper')&&x.closest('.input-wrapper'))continue;if(x.closest('.modal-overlay')!==y.closest('.modal-overlay'))continue;const r=x.getBoundingClientRect(),s=y.getBoundingClientRect();if(Math.min(r.right,s.right)-Math.max(r.left,s.left)>3&&Math.min(r.bottom,s.bottom)-Math.max(r.top,s.top)>3)collisions.push([x.className,y.className]);}
      const rgb=s=>{const n=s.match(/[\d.]+/g)?.map(Number);return n&&n.length>=3?(s.startsWith('color(srgb')?[...n.slice(0,3).map(v=>v*255),n[3]??1]:n):null;};
      const blend=(c,b)=>c.slice(0,3).map((v,i)=>v*(c[3]??1)+b[i]*(1-(c[3]??1)));
      const background=e=>{const chain=[];for(let p=e;p;p=p.parentElement)chain.unshift(p);let color=[255,255,255];for(const p of chain){const c=rgb(getComputedStyle(p).backgroundColor);if(c)color=blend(c,color);}return color;};
      const lum=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
      const lowContrast=[];const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;let checked=0;
      while(node=walker.nextNode()){if(node.textContent.trim().length<2)continue;const e=node.parentElement;if(!visible(e)||e.closest('svg,.appearance-miniature,button:disabled,.rt-sr-only'))continue;const s=getComputedStyle(e);if(Number(s.opacity)<.9)continue;const foreground=rgb(s.color);if(!foreground)continue;const bg=background(e);const a=lum(blend(foreground,bg)),b=lum(bg);const ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);const large=parseFloat(s.fontSize)>=24||parseFloat(s.fontSize)>=18.66&&parseInt(s.fontWeight)>=700;checked++;if(ratio<(large?3:4.5)-.1)lowContrast.push({tag:e.tagName,cls:e.className,ratio:+ratio.toFixed(2),color:s.color,background:bg.map(Math.round)});}
      return {page:root.dataset.page,title:root.querySelector('h1')?.textContent,icons:root.querySelectorAll('svg.ui-icon').length,missingIcons,overflow,collisions:collisions.slice(0,10),lowContrast:lowContrast.slice(0,20),textChecked:checked,cardCount:root.querySelectorAll('[class$="-card"],[class*="-card "],.card').length};
     };
const dir=process.env.NETMON_AUDIT_DIR||path.join(os.tmpdir(),'netmon-appearance-audit');
const base=process.env.NETMON_APP_URL||'http://localhost:3000';
process.env.AUDIT_ALL='1';fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await puppeteer.connect({browserWSEndpoint:process.env.NETMON_BROWSER_WS||'ws://127.0.0.1:9222/session',protocol:'webDriverBiDi'});
 const page=await browser.newPage(); const report=[];
 try{
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.app',{timeout:15000}).catch(()=>{throw new Error('Sign in using the isolated test browser before running this audit.');});
  const app=fs.readFileSync(path.join(__dirname,'../src/App.tsx'),'utf8');
  let routes=[...app.matchAll(/<Route path="([^"/:][^"]*)"/g)].map(m=>'/app/'+m[1]).filter(r=>!r.includes(':')&&!r.endsWith('*')&&!r.includes('dpi-tools'));
  routes=['/app/','/app/settings?tab=appearance',...routes];
  const targetId=await page.evaluate(async()=>{
   const response=await fetch('/api/v1/targets',{headers:{Accept:'application/json'}});
   if(!response.ok)return null;
   const targets=await response.json();
   return Array.isArray(targets)&&typeof targets[0]?.id==='string'?targets[0].id:null;
  });
  if(targetId&&/^[a-f0-9-]{36}$/i.test(targetId))routes.push('/app/targets/'+encodeURIComponent(targetId));
  if(process.env.AUDIT_FOCUS)routes=['/app/probes','/app/isp-comparison','/app/ipv4-monitoring','/app/ipv6-monitoring','/app/multi-location','/app/connectivity','/app/notifications','/app/alert-rules','/app/alerts','/app/vpn','/app/users','/app/audit-logs','/app/tool-management','/app/settings?tab=appearance'];
  if(process.env.AUDIT_ROUTES)routes=JSON.parse(process.env.AUDIT_ROUTES);
  if(process.env.AUDIT_QUICK)routes=['/app/latency','/app/monitors','/app/quality','/app/settings?tab=appearance','/app/devices','/app/tcp'];
  routes=routes.filter(route=>!route.includes('dpi-tools'));
  for(const mode of ['dark','light']){
   await page.evaluate(mode=>localStorage.setItem('netmon.appearance.v1',JSON.stringify({version:1,mode,depth:'balanced',accent:'classic'})),mode);
   for(const width of (process.env.AUDIT_TABS&&!process.env.AUDIT_ALL?[1440]:[1440,390])){
    await page.setViewport({width,height:1000});
    for(let i=0;i<routes.length;i++){
     const route=routes[i];
     await page.goto(base+route,{waitUntil:'domcontentloaded'});await page.waitForSelector('.page-surface');
     await page.addStyleTag({content:'*,*::before,*::after{animation-duration:.001ms!important;animation-delay:0ms!important;transition-duration:.001ms!important}'});await pause(180);
     await page.evaluate(()=>window.scrollTo(0,0));
     const result=await page.evaluate(inspect);
     const slug=(route.slice(5)||'overview').replace(/[^a-z0-9]+/gi,'-');const screenshot=`${mode}-${width}-${slug}.png`;
     if(width===1440||process.env.AUDIT_QUICK)await page.screenshot({path:dir+'/'+screenshot,fullPage:true});
     const tabStates=[];
     if(width===1440||width===390){
      const selector='.page-surface [class$="-tabs"] > button, .page-surface .tabs > button, .page-surface .settings-sidebar > .settings-tab, .page-surface .tools-sidebar > .tool-btn, .page-surface .tools-list > .tool-item, .page-surface .tabs-container > button';
      const count=(await page.$$(selector)).length;
      for(let tab=0;tab<count;tab++){
       const buttons=await page.$$(selector);if(!buttons[tab])continue;
       if(await buttons[tab].evaluate(e=>e.disabled))continue;
       const label=await buttons[tab].evaluate(e=>e.textContent.trim());
       await buttons[tab].evaluate(e=>e.scrollIntoView({block:'center',inline:'center'}));
       await buttons[tab].click();await pause(100);
       const state=await page.evaluate(inspect);tabStates.push({label,...state});
      }
     }
     report.push({mode,width,route,screenshot,tabStates,...result});
     if((i+1)%12===0)console.log(`${mode} ${width}px: ${i+1}/${routes.length} pages inspected`);
    }
   }
  }
  fs.writeFileSync(dir+(process.env.AUDIT_ROUTES?'/extra-report.json':process.env.AUDIT_ALL?'/all-report.json':process.env.AUDIT_TABS?'/tabs-report.json':'/report.json'),JSON.stringify(report,null,2));
  const states=report.flatMap(entry=>[entry,...entry.tabStates]);
  if(states.some(entry=>entry.missingIcons.length||entry.overflow.length||entry.collisions.length||entry.lowContrast.length))process.exitCode=1;
  console.log(JSON.stringify({pages:report.length,missingIconPages:report.filter(r=>r.missingIcons.length).length,layoutPages:report.filter(r=>r.overflow.length||r.collisions.length).length,contrastPages:report.filter(r=>r.lowContrast.length).length,report:dir+(process.env.AUDIT_ROUTES?'/extra-report.json':process.env.AUDIT_ALL?'/all-report.json':process.env.AUDIT_TABS?'/tabs-report.json':'/report.json')}));
 }finally{await page.close();await browser.disconnect();}
})().catch(e=>{console.error(e.message);process.exitCode=1});
