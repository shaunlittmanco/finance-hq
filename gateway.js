/* Renewable Google connection. The browser receives only a short-lived Finance HQ session. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.FinanceHQGateway=api;})(typeof globalThis!=='undefined'?globalThis:this,root=>{
'use strict';
// Filled only after the separate free server is deployed and verified. Empty keeps the existing connector active.
const ENDPOINT='';
const KEY='finance-hq-passkey-tab-v1',SETUP_KEY='finance-hq-google-setup-v1',IDLE=300000;
const enc=new TextEncoder();
const b64=bytes=>{let s='';for(const b of new Uint8Array(bytes))s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');};
const bytes=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4)),c=>c.charCodeAt(0));
const random=()=>b64(root.crypto.getRandomValues(new Uint8Array(32)));
const digest=async value=>b64(await root.crypto.subtle.digest('SHA-256',enc.encode(value)));
const validEndpoint=value=>/^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/.test(value);
const error=(message,code)=>Object.assign(new Error(message),{code});
const publicKeyOptions=options=>({...options,challenge:bytes(options.challenge),...(options.user?{user:{...options.user,id:bytes(options.user.id)}}:{}),...(options.excludeCredentials?{excludeCredentials:options.excludeCredentials.map(c=>({...c,id:bytes(c.id)}))}:{}),...(options.allowCredentials?{allowCredentials:options.allowCredentials.map(c=>({...c,id:bytes(c.id)}))}:{})});
function serialize(credential){
 if(!credential)throw error('Passkey request cancelled. Try Unlock again.','passkey_cancelled');
 if(credential.toJSON)return credential.toJSON();
 const r=credential.response,response={clientDataJSON:b64(r.clientDataJSON)};
 if(r.attestationObject){response.attestationObject=b64(r.attestationObject);response.transports=r.getTransports?.()||[];}
 else{response.authenticatorData=b64(r.authenticatorData);response.signature=b64(r.signature);if(r.userHandle)response.userHandle=b64(r.userHandle);}
 return {id:credential.id,rawId:b64(credential.rawId),type:credential.type,authenticatorAttachment:credential.authenticatorAttachment,clientExtensionResults:credential.getClientExtensionResults(),response};
}
class Client{
 constructor(endpoint=ENDPOINT){if(!validEndpoint(endpoint))throw error('Secure server is not configured.','not_configured');this.endpoint=endpoint;this.token='';this.expires=0;this.lastActive=0;this.sessionSaved=false;this.generation=0;this.needsGoogle=false;}
 clear(){this.generation++;this.token='';this.expires=0;this.lastActive=0;this.sessionSaved=false;try{root.sessionStorage?.removeItem(KEY);}catch{}}
 save(){try{root.sessionStorage.setItem(KEY,JSON.stringify({endpoint:this.endpoint,token:this.token,expires:this.expires,lastActive:this.lastActive}));this.sessionSaved=true;}catch{this.sessionSaved=false;}}
 setSession(value){const now=Date.now();if(!/^[\w-]{43}$/.test(value.token)||!Number.isFinite(value.expires)||value.expires<=now+30000||value.expires>now+16*60000)throw error('Invalid secure session response.','invalid_session');this.token=value.token;this.expires=value.expires;this.lastActive=now;this.save();}
 restoreSession(){try{const record=JSON.parse(root.sessionStorage?.getItem(KEY)||'null'),now=Date.now();if(!record||record.endpoint!==this.endpoint||!/^[\w-]{43}$/.test(record.token)||!Number.isFinite(record.expires)||record.expires<=now+30000||record.expires>now+16*60000||!Number.isFinite(record.lastActive)||record.lastActive>now||now-record.lastActive>=IDLE){this.clear();return false;}this.token=record.token;this.expires=record.expires;this.lastActive=record.lastActive;this.sessionSaved=true;return true;}catch{this.clear();return false;}}
 touchSession(now=Date.now()){if(!this.token)return;if(now-this.lastActive>=IDLE||now>=this.expires-30000){this.lock();return;}this.lastActive=now;this.save();}
 async api(path,input={},authenticated=true,token=this.token){
  const paths=['/auth/start','/auth/exchange','/passkey/options','/passkey/verify','/register/options','/register/verify','/api/status','/api/sync','/api/logout','/api/disconnect','/api/session/refresh'];if(!paths.includes(path))throw error('Unexpected secure server operation.','endpoint_denied');
  const response=await root.fetch(this.endpoint+path,{method:'POST',headers:{'Content-Type':'application/json',...(authenticated?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(input),credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(30000)});
  let value;try{value=await response.json();}catch{throw error('Secure server returned an invalid response.','invalid_response');}
  if(!response.ok){if(response.status===401&&value.error?.code==='unlock_required'&&this.token===token)this.clear();if(value.error?.code==='google_reauthorization_required'&&this.token===token)this.needsGoogle=true;throw error(value.error?.message||'Secure connection failed. Try again.',value.error?.code||'server_error');}return value;
 }
 async authorize(){
  if(!root.PublicKeyCredential||!root.navigator?.credentials)throw error('Passkeys require a supported browser. On iPhone, open Finance HQ in Safari.','passkey_unavailable');
  const version=this.generation,{options,challengeID}=await this.api('/passkey/options',{},false);
  let credential;try{credential=await root.navigator.credentials.get({publicKey:publicKeyOptions(options)});}catch{throw error('Passkey unlock was cancelled or unavailable. Try Unlock with passkey again.','passkey_cancelled');}
  if(version!==this.generation)throw error('Unlock cancelled.','cancelled');
  const session=await this.api('/passkey/verify',{challengeID,response:serialize(credential)},false);if(version!==this.generation)throw error('Unlock cancelled.','cancelled');this.setSession(session);
 }
 async register(){const {options,challengeID}=await this.api('/register/options');let credential;try{credential=await root.navigator.credentials.create({publicKey:publicKeyOptions(options)});}catch{throw error('Passkey setup was cancelled or unavailable. Use Safari on a supported iPhone.','passkey_cancelled');}return this.api('/register/verify',{challengeID,response:serialize(credential)});}
 async googleSetup(){const verifier=random();try{root.sessionStorage.setItem(SETUP_KEY,JSON.stringify({verifier,endpoint:this.endpoint,created:Date.now()}));}catch{throw error('Allow session storage before starting secure Google setup.','storage_blocked');}const result=await this.api('/auth/start',{challenge:await digest(verifier)},false),url=new URL(result.url);if(url.origin!=='https://accounts.google.com'||url.pathname!=='/o/oauth2/v2/auth')throw error('Unexpected Google authorization destination.','endpoint_denied');root.location.assign(url.href);}
 async completeSetup(){const match=root.location?.hash?.match(/^#finance-auth=([\w-]{43})$/);if(!match)return false;root.history.replaceState(null,'','#settings');let record;try{record=JSON.parse(root.sessionStorage.getItem(SETUP_KEY)||'null');root.sessionStorage.removeItem(SETUP_KEY);}catch{}if(!record||record.endpoint!==this.endpoint||Date.now()-record.created>20*60000||record.created>Date.now())throw error('Google setup expired. Start setup again on this device.','setup_expired');const session=await this.api('/auth/exchange',{ticket:match[1],verifier:record.verifier},false);this.setSession(session);this.needsGoogle=false;return true;}
 async read(_config,cycle){const version=this.generation;if(this.expires<Date.now()+6*60000){const renewed=await this.api('/api/session/refresh');if(version!==this.generation)throw error('Connection changed.','cancelled');if(!Number.isFinite(renewed.expires)||renewed.expires<=Date.now()+30000||renewed.expires>Date.now()+16*60000){this.clear();throw error('Unlock with your passkey to continue.','unlock_required');}this.expires=renewed.expires;this.save();}const data=await this.api('/api/sync',{cycle});if(version!==this.generation)throw error('Connection changed. Result discarded.','cancelled');if(data.origin!=='live-readonly'||data.cycle!==cycle||data.title!==`Expense Tracker — ${cycle.slice(0,4)}`||!Array.isArray(data.transactions)||!Array.isArray(data.weeks))throw error('Secure source response did not match the selected tracker.','invalid_response');this.needsGoogle=false;return data;}
 lock(){const token=this.token;this.clear();if(token)this.api('/api/logout',{},true,token).catch(()=>{});}
 async disconnect(){const token=this.token;this.clear();if(token)await this.api('/api/disconnect',{},true,token);}
}
return {ENDPOINT,available:()=>validEndpoint(ENDPOINT),Client,publicKeyOptions,serialize};
});
