const enc=new TextEncoder(),dec=new TextDecoder();
export const MINUTE=60000,SESSION_MS=15*MINUTE,SESSION_MAX_MS=12*60*MINUTE;
export class HttpError extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code;}}
export const fail=(status,code,message)=>{throw new HttpError(status,code,message);};
export function b64(bytes){let s='';for(const byte of bytes)s+=String.fromCharCode(byte);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export function unb64(s){if(typeof s!=='string'||!/^[A-Za-z0-9_-]+$/.test(s)||s.length>32768)fail(400,'invalid_input','Invalid encoded value.');return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));}
export const random=()=>b64(crypto.getRandomValues(new Uint8Array(32)));
export const digest=async s=>b64(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s))));
export function checkConfig(env,request){
 const frontend=new URL(env.FRONTEND_URL),origin=new URL(request.url).origin;
 if(unb64(env.TOKEN_ENCRYPTION_KEY).length!==32)fail(503,'not_configured','Secure encryption setup is incomplete.');
 if(frontend.protocol!=='https:'||frontend.username||frontend.password||frontend.search||frontend.hash||frontend.origin!==env.ALLOWED_ORIGIN||frontend.hostname!==env.RP_ID||frontend.pathname!=='/finance-hq/'||!env.OWNER_EMAIL||!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!env.TOKEN_ENCRYPTION_KEY||!env.DB)fail(503,'not_configured','Secure connection setup is incomplete.');
 if(!/^https:\/\/[a-z0-9.-]+\.workers\.dev$/.test(origin)||env.SERVER_ORIGIN!==origin)fail(503,'not_configured','Secure server address is not configured.');
 for(const year of ['2026','2027'])if(!/^[\w-]{20,}$/.test(env['SHEET_'+year]))fail(503,'not_configured','Tracker setup is incomplete.');
 return {frontend,origin};
}
export function requireOrigin(request,env){if(request.headers.get('Origin')!==env.ALLOWED_ORIGIN)fail(403,'origin_denied','This request is not from Finance HQ.');}
export function corsHeaders(env){return {'Access-Control-Allow-Origin':env.ALLOWED_ORIGIN,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600','Cache-Control':'no-store, private','Vary':'Origin','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"};}
export function json(env,value,status=200){return new Response(JSON.stringify(value),{status,headers:{...corsHeaders(env),'Content-Type':'application/json; charset=utf-8'}});}
export async function body(request){if(request.headers.get('Content-Type')?.split(';')[0]!=='application/json')fail(415,'invalid_input','JSON requests are required.');const text=await request.text();if(text.length>24000)fail(413,'invalid_input','Request is too large.');try{const value=JSON.parse(text);if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value;}catch{fail(400,'invalid_input','Invalid request.');}}
export function encoded(value,min=32,max=1024){if(typeof value!=='string'||value.length<min||value.length>max||!/^[\w-]+$/.test(value))fail(400,'invalid_input','Invalid request identifier.');return value;}
export async function encrypt(env,value){const key=await crypto.subtle.importKey('raw',unb64(env.TOKEN_ENCRYPTION_KEY),'AES-GCM',false,['encrypt']);const iv=crypto.getRandomValues(new Uint8Array(12));const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode('finance-hq-server-v1')},key,enc.encode(JSON.stringify(value)));return {iv:b64(iv),cipher:b64(new Uint8Array(cipher))};}
export async function decrypt(env,value){const key=await crypto.subtle.importKey('raw',unb64(env.TOKEN_ENCRYPTION_KEY),'AES-GCM',false,['decrypt']);return JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(value.iv),additionalData:enc.encode('finance-hq-server-v1')},key,unb64(value.cipher))));}
export class Store{
 constructor(db){this.db=db;}
 async get(key){const row=await this.db.prepare('SELECT value FROM records WHERE key=? AND (expires=0 OR expires>?)').bind(key,Date.now()).first();return row?JSON.parse(row.value):null;}
 async put(key,value,expires=0){await this.db.prepare('INSERT INTO records(key,value,expires) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, expires=excluded.expires').bind(key,JSON.stringify(value),expires).run();}
 async take(key){const row=await this.db.prepare('DELETE FROM records WHERE key=? AND expires>? RETURNING value').bind(key,Date.now()).first();return row?JSON.parse(row.value):null;}
 async remove(key){await this.db.prepare('DELETE FROM records WHERE key=?').bind(key).run();}
 async session(request){const header=request.headers.get('Authorization')||'';if(!/^Bearer [\w-]{43}$/.test(header))fail(401,'unlock_required','Unlock Finance HQ with your passkey.');const key='session:'+await digest(header.slice(7)),record=await this.get(key);if(!record||record.maximum<=Date.now()||record.owner!=='owner')fail(401,'unlock_required','Unlock Finance HQ with your passkey.');return {...record,key};}
 async issueSession(kind){const token=random(),now=Date.now(),expires=now+SESSION_MS;await this.put('session:'+await digest(token),{owner:'owner',kind,issued:now,maximum:now+SESSION_MAX_MS},expires);return {token,expires};}
 async renewSession(auth){const expires=Math.min(Date.now()+SESSION_MS,auth.maximum);await this.put(auth.key,{owner:'owner',kind:auth.kind,issued:auth.issued,maximum:auth.maximum},expires);return {expires};}
 async rate(request,env){const ip=request.headers.get('CF-Connecting-IP');if(!ip)fail(403,'origin_denied','Request network identity unavailable.');const minute=Math.floor(Date.now()/MINUTE),key='rate:'+minute+':'+await digest(env.TOKEN_ENCRYPTION_KEY+ip);const row=await this.db.prepare('INSERT INTO rates(key,hits,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1 RETURNING hits').bind(key,Date.now()+2*MINUTE).first();if(!row||row.hits>12)fail(429,'rate_limited','Too many attempts. Please wait a minute.');}
 async cleanup(){await this.db.batch([this.db.prepare('DELETE FROM records WHERE expires>0 AND expires<=?').bind(Date.now()),this.db.prepare('DELETE FROM rates WHERE expires<=?').bind(Date.now())]);}
}
