import * as oauth from 'oauth4webapi';
import {random,digest,encrypt,decrypt,encoded,MINUTE,fail,HttpError} from './security.mjs';
export const SHEETS_SCOPE='https://www.googleapis.com/auth/spreadsheets.readonly';
const GOOGLE={issuer:'https://accounts.google.com',authorization_endpoint:'https://accounts.google.com/o/oauth2/v2/auth',token_endpoint:'https://oauth2.googleapis.com/token',jwks_uri:'https://www.googleapis.com/oauth2/v3/certs',revocation_endpoint:'https://oauth2.googleapis.com/revoke'};
const options=fetcher=>({[oauth.customFetch]:(url,init)=>fetcher(url,{...init,signal:AbortSignal.timeout(20000)})});
export class GoogleConnection{
 constructor(env,store,fetcher=fetch){this.env=env;this.store=store;this.fetcher=fetcher;this.client={client_id:env.GOOGLE_CLIENT_ID};this.auth=oauth.ClientSecretPost(env.GOOGLE_CLIENT_SECRET);}
 async start(challenge){encoded(challenge,43,43);const state=random(),nonce=random(),verifier=oauth.generateRandomCodeVerifier();const record={state,nonce,verifier,challenge};await this.store.put('oauth:'+await digest(state),await encrypt(this.env,record),Date.now()+10*MINUTE);const url=new URL(GOOGLE.authorization_endpoint);url.search=new URLSearchParams({client_id:this.env.GOOGLE_CLIENT_ID,redirect_uri:this.env.SERVER_ORIGIN+'/oauth/callback',response_type:'code',scope:'openid email '+SHEETS_SCOPE,access_type:'offline',prompt:'consent',include_granted_scopes:'false',state,nonce,code_challenge:await oauth.calculatePKCECodeChallenge(verifier),code_challenge_method:'S256',login_hint:this.env.OWNER_EMAIL}).toString();return {url:url.href};}
 async callback(url){
  const state=encoded(url.searchParams.get('state'),43,43),sealed=await this.store.take('oauth:'+await digest(state));if(!sealed)fail(400,'setup_expired','Google setup has expired. Start setup again.');
  const record=await decrypt(this.env,sealed),params=oauth.validateAuthResponse(GOOGLE,this.client,url,record.state);
  const response=await oauth.authorizationCodeGrantRequest(GOOGLE,this.client,this.auth,params,this.env.SERVER_ORIGIN+'/oauth/callback',record.verifier,options(this.fetcher));
  const token=await oauth.processAuthorizationCodeResponse(GOOGLE,this.client,response,{expectedNonce:record.nonce,requireIdToken:true});
  await oauth.validateApplicationLevelSignature(GOOGLE,response,options(this.fetcher));
  const claims=oauth.getValidatedIdTokenClaims(token);
  if(!claims?.sub||claims.email_verified!==true||String(claims.email).toLowerCase()!==this.env.OWNER_EMAIL.toLowerCase())fail(403,'wrong_google_account','Use the Finance HQ owner’s Google account.');
  if(!token.scope?.split(' ').includes(SHEETS_SCOPE)||token.token_type!=='bearer')fail(403,'permission_required','Read-only Sheets access was not granted.');
  const owner=await this.store.get('owner');if(owner&&owner.sub!==claims.sub)fail(403,'wrong_google_account','Google account identity does not match this Finance HQ.');
  const existing=await this.load(),refresh=token.refresh_token||(existing?.sub===claims.sub?existing.refresh:'');if(!refresh)fail(409,'offline_access_required','Google did not return renewable access. Repeat Google setup once.');
  // Check both fixed source books before retaining renewable access.
  for(const year of ['2026','2027']){
   const result=await this.fetcher('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(this.env['SHEET_'+year])+'?fields=properties(title)',{headers:{Authorization:'Bearer '+token.access_token},cache:'no-store',signal:AbortSignal.timeout(20000)});
   if(!result.ok||(await result.json()).properties?.title!==`Expense Tracker — ${year}`)fail(403,'tracker_access_denied','The Google account cannot read both configured trackers.');
  }
  await this.store.put('owner',{sub:claims.sub,userID:owner?.userID||random()});
  await this.save({sub:claims.sub,refresh,access:token.access_token,expires:Date.now()+Math.min(Number(token.expires_in)||3300,3600)*1000});
  const ticket=random();await this.store.put('exchange:'+await digest(ticket),{challenge:record.challenge},Date.now()+MINUTE);return ticket;
 }
 async load(){const value=await this.store.get('google');return value?decrypt(this.env,value):null;}
 async save(record){await this.store.put('google',await encrypt(this.env,record));}
 async access(force=false){
  const sealed=await this.store.get('google'),record=sealed?await decrypt(this.env,sealed):null;if(!record)fail(409,'google_reauthorization_required','Restore Google access in connection settings.');
  if(!force&&record.expires>Date.now()+MINUTE)return record.access;
  try{
   const response=await oauth.refreshTokenGrantRequest(GOOGLE,this.client,this.auth,record.refresh,options(this.fetcher));
   const token=await oauth.processRefreshTokenResponse(GOOGLE,this.client,response);
   if(token.scope&&!token.scope.split(' ').includes(SHEETS_SCOPE))fail(409,'google_reauthorization_required','Google read-only permission has changed.');
   const next={...record,access:token.access_token,refresh:token.refresh_token||record.refresh,expires:Date.now()+Math.min(Number(token.expires_in)||3300,3600)*1000};const value=await encrypt(this.env,next),updated=await this.store.db.prepare("UPDATE records SET value=? WHERE key='google' AND value=?").bind(JSON.stringify(value),JSON.stringify(sealed)).run();if(updated.meta.changes!==1){const latest=await this.load();if(latest?.expires>Date.now()+MINUTE)return latest.access;fail(503,'google_temporarily_unavailable','Connection changed while renewing. Try Refresh again.');}return next.access;
  }catch(error){if(error?.error==='invalid_grant'){const removed=await this.store.db.prepare("DELETE FROM records WHERE key='google' AND value=?").bind(JSON.stringify(sealed)).run();if(removed.meta.changes!==1)fail(503,'google_temporarily_unavailable','Connection changed. Try Refresh again.');fail(409,'google_reauthorization_required','Google access was revoked or expired. Restore it once in settings.');}if(error instanceof HttpError)throw error;fail(503,'google_temporarily_unavailable','Google is temporarily unavailable. Your connection has been retained; try Refresh again.');}
 }
 async get(url){
  if(!url.startsWith('https://sheets.googleapis.com/v4/spreadsheets/'))fail(403,'endpoint_denied','Unexpected source endpoint.');
  let response;for(let attempt=0;attempt<2;attempt++){
   const token=await this.access(attempt>0);response=await this.fetcher(url,{method:'GET',headers:{Authorization:'Bearer '+token},cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(20000)});
   if(response.status!==401)break;
  }
  if(response.status===401)fail(409,'google_reauthorization_required','Google no longer accepts this connection. Restore Google access in settings.');
  if(response.status===403||response.status===404)fail(403,'tracker_access_denied','Google cannot read a configured tracker. Check its existing sharing permissions.');
  if(!response.ok)fail(503,'google_temporarily_unavailable','Google Sheets is temporarily unavailable. Try Refresh again.');return response.json();
 }
 async disconnect(){const record=await this.load();if(record){const response=await oauth.revocationRequest(GOOGLE,this.client,this.auth,record.refresh,options(this.fetcher));await oauth.processRevocationResponse(response);}await this.store.remove('google');await this.store.db.prepare("DELETE FROM records WHERE key LIKE 'session:%'").run();}
}
