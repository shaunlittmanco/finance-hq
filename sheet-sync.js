/* Finance HQ v0.2: read-only, user-authorized Sheets adapter. No credentials embedded. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.FinanceHQSheets=api;})(typeof globalThis!=='undefined'?globalThis:this,(root)=>{
'use strict';
const SCOPE='https://www.googleapis.com/auth/spreadsheets.readonly';
const SESSION_KEY='finance-hq-google-tab-session-v1',IDLE_MS=300000,MAX_TOKEN_MS=3600000;
// Tab-scoped, short-lived authorization only. Never store financial values here.
const sessionBinding=config=>JSON.stringify([validateClientId(config?.clientId),validateId(config?.[2026]),validateId(config?.[2027])]);
const clean=v=>String(v??'').trim();
const money=v=>{let s=clean(v).replace(/[₱,$\s]/g,'');if(!s||s==='—'||s==='–')return null;let neg=false;if(/^\(.*\)$/.test(s)){neg=true;s=s.slice(1,-1);}const n=Number(s);return Number.isFinite(n)?(neg?-n:n):null;};
const n=v=>money(v)??0;
const isoDate=v=>{const s=clean(v);if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;let m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(m)return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;m=s.match(/^(\w+)\s+(\d{1,2}),?\s+(\d{4})/);if(!m)return '';const month=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[1].toLowerCase().slice(0,3));return month<0?'':`${m[3]}-${String(month+1).padStart(2,'0')}-${m[2].padStart(2,'0')}`;};
const cycleName=key=>{if(!/^202[67]-(0[1-9]|1[0-2])-16$/.test(key))throw Error('Invalid cutoff period.');const a=key.split('-').map(Number);const d=new Date(Date.UTC(a[0],a[1]-1,16)),end=new Date(Date.UTC(a[0],a[1],15));const opt={month:'short',day:'numeric',timeZone:'UTC'};return `${d.toLocaleDateString('en-US',opt)} - ${end.toLocaleDateString('en-US',opt)}`;};
const sourceName=key=>key==='2026-07-16'?'Jul 15 - Aug 15':cycleName(key);
const yearForCycle=key=>Number(key.slice(0,4));
const sheetUrl=(id,gid,row)=>`https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/edit#gid=${Number(gid)||0}${row?`&range=A${Number(row)}`:''}`;
function findRow(rows,first){return rows.findIndex(r=>clean(r?.[0]).toLowerCase()===first.toLowerCase());}
function summaryByLabels(rows,columns){const out={};for(const [key,cols,labels] of columns){let value=null;outer:for(const label of (Array.isArray(labels)?labels:[labels]))for(const row of rows.slice(0,14))for(const col of (Array.isArray(cols)?cols:[cols]))if(clean(row?.[col]).toLowerCase()===label.toLowerCase()){value=money(row[col+1]);break outer;}out[key]=value;}return out;}
function parseBook({id,title,gids,tabs,cycle,now=new Date().toISOString(),receiptLinks={}}){
 for(const rows of Object.values(tabs))for(const row of rows)for(const value of row)if(/^#(?:REF!|DIV\/0!|VALUE!|N\/A|NAME\?|NUM!|ERROR!)$/.test(clean(value)))throw Error('Source Sheet contains a formula error. Nothing imported.');
 if(!/^Expense Tracker [—-] 20\d\d$/.test(title))throw Error('Unexpected spreadsheet title. Nothing imported.');
 if(title!==`Expense Tracker — ${yearForCycle(cycle)}`)throw Error('Workbook year does not match cutoff.');
 const tab=sourceName(cycle),monthly=tabs[tab];if(!monthly||clean(monthly[13]?.[1])!=='Description'||clean(monthly[13]?.[4])!=='Actual / Amount Swiped')throw Error('Transaction headers changed. Your previous view was not replaced.');
 const weekly=tabs['Weekly Budget']||[],budgetHeadIndex=weekly.findIndex(r=>r.some(x=>clean(x)==='Cutoff Remaining'));
 if(budgetHeadIndex<0)throw Error('Weekly Budget header changed. No figures imported.');
 const budgetHead=weekly[budgetHeadIndex].map(clean),i=name=>budgetHead.indexOf(name);
 if(['Strict Cap','Reserved Obligations','Monthly Savings Target','Monthly Spending Left (After Savings)'].some(name=>i(name)<0))throw Error('Weekly Budget header changed. No figures imported.');
 const b=weekly.slice(budgetHeadIndex+1).find(r=>clean(r[1])===tab)||[];
 const get=name=>i(name)>=0?money(b[i(name)]):null;
 const wh=weekly.findIndex(r=>clean(r[1])==='Week');const weeks=wh<0?[]:weekly.slice(wh+1).map((r,ix)=>{const h=weekly[wh].map(clean),v=name=>money(r[h.indexOf(name)]);return {row:wh+ix+2,month:clean(r[0]),period:clean(r[1]),fixed:v('Fixed Weekly Spend Limit'),safe:v('Safe Spending Left'),paid:v('Actual Paid by Shaun'),credits:v('Actual Credits'),savings:v('Savings Target')};}).filter(r=>r.month===clean(b[0])&&r.period);
 const basics=summaryByLabels(monthly,[['actualPersonal',[0,2],'Actual Personal Spending'],['grossPaid',[0,2],'Gross Paid by Shaun'],['budgetImpact',[0,2],'Net Budget Impact'],['receivable',[0,4],['Projected collectible','Total Collectible','Total Receivables']],['rebatesReceived',[0,2],'Rebates Received'],['remainingActual',[0,2],'Remaining Actual Budget']]);
 const transactions=monthly.slice(14).map((r,index)=>({row:index+15,date:isoDate(r[0]),name:clean(r[1]),category:clean(r[2]),estimated:money(r[3]),amount:money(r[4]),method:clean(r[5]),myShare:money(r[6]),others:money(r[7]),repaid:money(r[8]),party:clean(r[9]),balance:money(r[10]),receipt:clean(r[12]),receiptUrls:(receiptLinks[index+15]||[]).map(safeReceiptUrl).filter(Boolean),notes:clean(r[11]).slice(0,600)})).filter(t=>t.name&&(t.date||t.estimated!==null||t.amount!==null));
 const dues=tabs['Due Dates']||[];
 if(clean(dues[7]?.[0])!=='Due Date'||clean(dues[7]?.[6])!=='Remaining')throw Error('Due Dates headers changed. Nothing imported.');
 const obligations=dues.slice(8).map((r,i)=>({row:i+9,date:clean(r[0]),type:clean(r[1]),name:clean(r[2]),statement:clean(r[3]),amount:money(r[4]),paidIssuer:money(r[5]),remaining:money(r[6]),status:clean(r[7]),posting:clean(r[9]),proof:clean(r[10])})).filter(o=>o.name&&o.date&&o.remaining!==null);
 const shared=tabs['Shared Expenses - Ako Muna']||[];const people=[];
 for(let j=2;j<Math.min(shared.length,45);j++){const r=shared[j]||[];if(clean(r[0]).toUpperCase()==='TOTAL')break;if(!clean(r[0])||money(r[5])===null)continue;people.push({name:clean(r[0]),gross:money(r[1]),paid:money(r[2]),balance:money(r[3]),offsets:money(r[4]),net:money(r[5])});}
 const rebates=tabs['Credit Card Rebates']||[];const promos=clean(rebates[6]?.[2])==='Promo / Merchant'?rebates.slice(7).map((r,i)=>({row:i+8,period:clean(r[0]),card:clean(r[1]),name:clean(r[2]),spendRequired:money(r[3]),eligible:money(r[4]),possible:money(r[5]),expected:money(r[6]),expectedDate:clean(r[7]),received:money(r[8]),receivedDate:clean(r[9]),status:clean(r[10])})).filter(p=>p.name):[];
 const installments=tabs.Installments||[];const plans=clean(installments[4]?.[2])==='Installment'?installments.slice(5).map((r,i)=>({row:i+6,cutoff:clean(r[0]),date:clean(r[1]),name:clean(r[2]),card:clean(r[3]),planned:money(r[4]),actual:money(r[5]),mine:money(r[6]),others:money(r[7]),balance:money(r[10]),status:clean(r[12])})).filter(p=>p.name):[];
 const recon=tabs['CC Billing Reconciliation']||[];if(recon.length&& !['Visa Statement Item','Statement Merchant'].includes(clean(recon[6]?.[2])))throw Error('Reconciliation headers changed. Nothing imported.');const findings=['Visa Statement Item','Statement Merchant'].includes(clean(recon[6]?.[2]))?recon.slice(7).map((r,i)=>({row:i+8,date:clean(r[0]),posted:clean(r[1]),merchant:clean(r[2]),amount:money(r[3]),tracker:clean(r[4]),matched:money(r[5]),status:clean(r[6]),difference:money(r[7])})).filter(f=>f.merchant):[];
 const saving=tabs.Savings||[];
 const dueSummary={open:money(dues[2]?.[1]),nextSeven:money(dues[2]?.[3]),overdue:money(dues[2]?.[5]),nextDate:clean(dues[2]?.[7])};
 const rebateSummary={expected:money(rebates[3]?.[1]),pending:money(rebates[4]?.[1]),received:money(rebates[5]?.[1]),egcPending:money(rebates[4]?.[4])};
 return {origin:'live-readonly',id,title,cycle,tab,year:yearForCycle(cycle),syncedAt:now,gids,weeks,warnings:b.length?[]:['This historical cutoff has no Weekly Budget summary. Budget figures are unavailable.'],weekly:{cap:get('Strict Cap'),reserved:get('Reserved Obligations'),savings:get('Monthly Savings Target'),spendableBeforeSavings:get('Spendable Before Savings'),actualDiscretionary:get('Actual Discretionary'),actualRemaining:get('Actual Remaining Before Savings'),cutoffRemaining:get('Cutoff Remaining'),safe:get('Monthly Spending Left (After Savings)'),billsReserve:get('Bills Reserve'),installmentReserve:get('Installment Reserve')},summary:basics,dueSummary,rebateSummary,savings:{total:money(saving[3]?.[1]),negative:summaryByLabels(saving,[['negative',[6,7],'CURRENT NEGATIVE']]).negative},transactions,obligations,people,promos,plans,findings,links:{month:sheetUrl(id,gids[tab]),weekly:sheetUrl(id,gids['Weekly Budget']),due:sheetUrl(id,gids['Due Dates']),shared:sheetUrl(id,gids['Shared Expenses - Ako Muna']),rebates:sheetUrl(id,gids['Credit Card Rebates']),installments:sheetUrl(id,gids.Installments),recon:sheetUrl(id,gids['CC Billing Reconciliation'])}};
}
function safeReceiptUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&['drive.google.com','docs.google.com'].includes(u.hostname)&&!u.username&&!u.password?u.href:'';}catch{return '';}}
function validateId(v){const str=clean(v);const m=str.match(/\/spreadsheets\/d\/([\w-]+)/);const id=m?m[1]:str;return /^[a-zA-Z0-9_-]{20,}$/.test(id)?id:'';}
function validateClientId(v){const str=clean(v);return /^[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(str)?str:'';}
class SyncClient{
 constructor(){this.token='';this.expires=0;this.issuedAt=0;this.lastActive=0;this.binding='';this.sessionSaved=false;this.active=null;this.generation=0;}
 restoreSession(config){
  try{
   const raw=root.sessionStorage?.getItem(SESSION_KEY);if(!raw)return false;
   const record=JSON.parse(raw),now=Date.now();
   if(record.version!==1||record.scope!==SCOPE||record.binding!==sessionBinding(config)||!validateClientId(config?.clientId)||
      typeof record.token!=='string'||!record.token||record.token.length>8192||/\s/.test(record.token)||
      ![record.issuedAt,record.expires,record.lastActive].every(Number.isFinite)||
      record.issuedAt>now||record.issuedAt<=0||record.expires-record.issuedAt>MAX_TOKEN_MS||
      record.expires<=now+30000||record.lastActive<record.issuedAt||record.lastActive>now||now-record.lastActive>=IDLE_MS)throw Error('Invalid or ended tab session.');
   this.token=record.token;this.expires=record.expires;this.issuedAt=record.issuedAt;this.lastActive=record.lastActive;this.binding=record.binding;this.sessionSaved=true;return true;
  }catch{this.lock();return false;}
 }
 saveSession(){
  try{if(!root.sessionStorage)throw Error('Tab storage unavailable.');root.sessionStorage.setItem(SESSION_KEY,JSON.stringify({version:1,scope:SCOPE,binding:this.binding,token:this.token,issuedAt:this.issuedAt,expires:this.expires,lastActive:this.lastActive}));this.sessionSaved=true;}catch{this.sessionSaved=false;}
 }
 touchSession(now=Date.now()){
  if(!this.token)return;
  if(now>=this.expires-30000||now-this.lastActive>=IDLE_MS){this.lock();return;}
  this.lastActive=now;this.saveSession();
 }
 authorize(clientId,config={clientId}){const generation=++this.generation;return new Promise((resolve,reject)=>{if(!root.google?.accounts?.oauth2)return reject(Error('Google sign-in library unavailable. Check internet or browser settings.'));try{const client=root.google.accounts.oauth2.initTokenClient({client_id:clientId,scope:SCOPE,include_granted_scopes:false,callback:r=>{if(generation!==this.generation)return reject(Error('Connection cancelled.'));if(r.error)return reject(Error('Google authorization was denied or cancelled.'));if(!root.google.accounts.oauth2.hasGrantedAllScopes(r,SCOPE))return reject(Error('Read-only Sheets permission was not granted.'));if(!r.access_token)return reject(Error('No Google access token returned.'));const lifetime=Math.min(Number(r.expires_in)||3300,MAX_TOKEN_MS/1000);if(lifetime<=30)return reject(Error('Google authorization has already expired. Connect again.'));this.token=r.access_token;this.issuedAt=Date.now();this.expires=this.issuedAt+lifetime*1000;this.lastActive=this.issuedAt;this.binding=sessionBinding({...config,clientId});this.saveSession();resolve();},error_callback:()=>reject(Error('Google popup was closed or blocked.'))});client.requestAccessToken({prompt:''});}catch(err){reject(err);}});}
 lock(){this.generation++;this.token='';this.expires=0;this.issuedAt=0;this.lastActive=0;this.binding='';this.sessionSaved=false;try{root.sessionStorage?.removeItem(SESSION_KEY);}catch{}}
 disconnect(){const token=this.token;this.lock();if(token&&root.google?.accounts?.oauth2?.revoke)root.google.accounts.oauth2.revoke(token,()=>{});}
 async get(url){if(!/^https:\/\/sheets\.googleapis\.com\/v4\/spreadsheets\//.test(url))throw Error('Blocked unexpected API endpoint.');if(!this.token||Date.now()>=this.expires-30000){this.lock();throw Error('Google authorization expired. Connect Google again.');}const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),20000);try{const r=await fetch(url,{headers:{Authorization:'Bearer '+this.token},cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:abort.signal});if(r.status===401){this.lock();throw Error('Authorization expired. Connect again.');}if(r.status===403)throw Error('Access denied. Check Sheets API, Google account and spreadsheet sharing permissions.');if(r.status===404)throw Error('Spreadsheet not found or inaccessible to this Google account.');if(!r.ok)throw Error(`Google Sheets returned HTTP ${r.status}.`);return await r.json();}finally{clearTimeout(timer);}}
 async read(config,cycle){const generation=this.generation;const y=yearForCycle(cycle),id=validateId(config[y]);if(!id)throw Error(`Set the ${y} spreadsheet link in Settings.`);const enc=encodeURIComponent;const base='https://sheets.googleapis.com/v4/spreadsheets/'+enc(id);const meta=await this.get(base+'?fields=spreadsheetId,properties(title),sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))');const title=meta.properties?.title;if(title!==`Expense Tracker — ${y}`)throw Error(`Expected Expense Tracker — ${y}, but Google returned ${title||'an unnamed workbook'}.`);const props=Object.fromEntries((meta.sheets||[]).map(x=>[x.properties?.title,x.properties]));const month=sourceName(cycle);
 const bounds={
  [month]:[13,10000],
  'Weekly Budget':[18,1000],'Due Dates':[12,1000],'Savings':[12,1000],
  'Shared Expenses - Ako Muna':[6,50],'Credit Card Rebates':[12,2000],
  'Installments':[16,2000],'CC Billing Reconciliation':[13,2000]
 };
 const columnLetter=x=>{let result='';while(x){result=String.fromCharCode(65+(x-1)%26)+result;x=Math.floor((x-1)/26);}return result;};
 const ranges=Object.fromEntries(Object.entries(bounds).filter(([name])=>props[name]).map(([name,[cols,rows]])=>{
  const grid=props[name].gridProperties||{};
  if(grid.rowCount>rows && !['Shared Expenses - Ako Muna'].includes(name))throw Error('Source exceeds supported bounds; no partial totals imported.');
  const c=Math.max(1,Math.min(cols,grid.columnCount||cols)),r=Math.max(1,Math.min(rows,grid.rowCount||rows));
  return [name,`A1:${columnLetter(c)}${r}`];
 }));
 for(const key of [month,'Weekly Budget','Due Dates'])if(!props[key])throw Error(`Required tab missing: ${key}.`);
 const found=Object.entries(ranges).filter(([k])=>props[k]);const params=new URLSearchParams({valueRenderOption:'FORMATTED_VALUE',fields:'spreadsheetId,valueRanges(range,values)'});for(const [k,r] of found)params.append('ranges',`'${k.replace(/'/g,"''")}'!${r}`);const json=await this.get(base+'/values:batchGet?'+params);if(json.valueRanges?.length!==found.length)throw Error('Incomplete Google Sheets response. Nothing imported.');const tabs=Object.fromEntries(found.map(([k],i)=>[k,json.valueRanges[i]?.values||[]]));const cells=await this.get(base+'?'+new URLSearchParams({ranges:`'${month}'!M15:M${props[month].gridProperties.rowCount}`,fields:'sheets(data(startRow,rowData(values(hyperlink,textFormatRuns(format(link)),userEnteredValue))))'}));const receiptLinks={};for(const sh of cells.sheets||[])for(const grid of sh.data||[])for(const [ix,row] of (grid.rowData||[]).entries()){const c=row.values?.[0]||{};const links=[c.hyperlink,...(c.textFormatRuns||[]).map(r=>r.format?.link?.uri)];const formula=c.userEnteredValue?.formulaValue||'';const fm=formula.match(/^=HYPERLINK\("([^"]+)"/i);if(fm)links.push(fm[1]);receiptLinks[(grid.startRow??14)+ix+1]=[...new Set(links.filter(Boolean))];}if(generation!==this.generation)throw Error('Connection changed. Result discarded.');return parseBook({receiptLinks,id,title,cycle,tabs,gids:Object.fromEntries(Object.entries(props).map(([k,v])=>[k,v.sheetId])),now:new Date().toISOString()});}
}
return {SCOPE,parseBook,validateId,validateClientId,isoDate,cycleName,sourceName,yearForCycle,SyncClient,money,sheetUrl,safeReceiptUrl};
});
