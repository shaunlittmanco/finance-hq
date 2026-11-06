import {generateRegistrationOptions,verifyRegistrationResponse,generateAuthenticationOptions,verifyAuthenticationResponse} from '@simplewebauthn/server';
import Sheets from '../../sheet-sync.js';
import {Store,HttpError,fail,checkConfig,requireOrigin,corsHeaders,json,body,encoded,random,digest,b64,unb64,MINUTE} from './security.mjs';
import {GoogleConnection} from './google.mjs';
const CHECK_MS=2*MINUTE;
export function createHandler({webauthn={generateRegistrationOptions,verifyRegistrationResponse,generateAuthenticationOptions,verifyAuthenticationResponse},makeStore=env=>new Store(env.DB),makeGoogle=(env,store)=>new GoogleConnection(env,store)}={}){
 return async function handle(request,env,ctx={waitUntil(){}}){
  const url=new URL(request.url);
  try{
   checkConfig(env,request);
   const store=makeStore(env),google=makeGoogle(env,store);
   // OAuth callback is Google's top-level redirect. It is protected by one-use state + nonce + PKCE.
   if(request.method==='GET'&&url.pathname==='/oauth/callback'){
    const ticket=await google.callback(url);return new Response(null,{status:303,headers:{Location:env.FRONTEND_URL+'#finance-auth='+ticket,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"}});
   }
   requireOrigin(request,env);
   if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders(env)});
   if(request.method!=='POST')fail(405,'method_denied','Use the Finance HQ application.');
   const input=await body(request);
   if(['/auth/start','/auth/exchange','/passkey/options','/passkey/verify'].includes(url.pathname)){await store.rate(request,env);ctx.waitUntil(store.cleanup());}
   if(url.pathname==='/auth/start')return json(env,await google.start(input.challenge));
   if(url.pathname==='/auth/exchange'){
    const key='exchange:'+await digest(encoded(input.ticket,43,43));
    const exchange=await store.get(key);if(!exchange||exchange.challenge!==await digest(encoded(input.verifier,43,128)))fail(400,'setup_expired','Google setup is invalid or expired. Start setup again.');
    if(!await store.take(key))fail(400,'setup_expired','Google setup has already been used.');
    return json(env,await store.issueSession('google'));
   }
   if(url.pathname==='/passkey/options'){
    if(!await store.get('owner'))fail(409,'setup_required','Complete Google setup once before enabling your passkey.');
    const options=await webauthn.generateAuthenticationOptions({rpID:env.RP_ID,userVerification:'required'}),challengeID=random();
    await store.put('challenge:'+challengeID,{challenge:options.challenge,kind:'login'},Date.now()+CHECK_MS);return json(env,{options,challengeID});
   }
   if(url.pathname==='/passkey/verify'){
    const record=await store.take('challenge:'+encoded(input.challengeID,43,43));if(!record||record.kind!=='login')fail(400,'challenge_expired','Unlock request expired. Try again.');
    const id=encoded(input.response?.id,1,2048),credential=await store.get('credential:'+id);if(!credential)fail(401,'passkey_not_recognized','This passkey is not registered with Finance HQ.');
    let result;try{result=await webauthn.verifyAuthenticationResponse({response:input.response,expectedChallenge:record.challenge,expectedOrigin:env.ALLOWED_ORIGIN,expectedRPID:env.RP_ID,requireUserVerification:true,credential:{...credential,publicKey:unb64(credential.publicKey)}});}catch{fail(401,'passkey_invalid','Passkey verification failed. Try unlocking again.');}
    if(!result.verified||!result.authenticationInfo.userVerified)fail(401,'passkey_invalid','User verification is required.');
    const updated={...credential,counter:result.authenticationInfo.newCounter};
    const change=await store.db.prepare('UPDATE records SET value=? WHERE key=? AND value=?').bind(JSON.stringify(updated),'credential:'+id,JSON.stringify(credential)).run();if(change.meta.changes!==1)fail(409,'unlock_retry','Another unlock completed first. Try again.');
    return json(env,await store.issueSession('passkey'));
   }
   const auth=await store.session(request);
   if(url.pathname==='/api/status'){
    const credentials=await store.db.prepare("SELECT COUNT(*) AS count FROM records WHERE key LIKE 'credential:%'").first();return json(env,{connected:!!await store.get('google'),passkeys:credentials.count,sessionMaximum:auth.maximum});
   }
   if(url.pathname==='/api/session/refresh')return json(env,await store.renewSession(auth));
   if(url.pathname==='/register/options'){
    if(auth.kind!=='google'||Date.now()-auth.issued>5*MINUTE)fail(401,'google_setup_required','Authorize Google once to add a new passkey.');
    const owner=await store.get('owner');if(!owner)fail(409,'setup_required','Complete Google setup first.');
    const existing=await store.db.prepare("SELECT value FROM records WHERE key LIKE 'credential:%'").all();
    const options=await webauthn.generateRegistrationOptions({rpName:'Finance HQ',rpID:env.RP_ID,userID:unb64(owner.userID),userName:env.OWNER_EMAIL,userDisplayName:'Finance HQ owner',attestationType:'none',supportedAlgorithmIDs:[-7,-257],excludeCredentials:existing.results.map(row=>{const item=JSON.parse(row.value);return {id:item.id,transports:item.transports};}),authenticatorSelection:{residentKey:'required',userVerification:'required',authenticatorAttachment:'platform'}});
    const challengeID=random();await store.put('challenge:'+challengeID,{challenge:options.challenge,kind:'register',session:auth.key},Date.now()+CHECK_MS);return json(env,{options,challengeID});
   }
   if(url.pathname==='/register/verify'){
    if(auth.kind!=='google'||Date.now()-auth.issued>5*MINUTE)fail(401,'google_setup_required','Authorize Google once to add a new passkey.');
    const record=await store.take('challenge:'+encoded(input.challengeID,43,43));if(!record||record.kind!=='register'||record.session!==auth.key)fail(400,'challenge_expired','Passkey setup expired. Try again.');
    let result;try{result=await webauthn.verifyRegistrationResponse({response:input.response,expectedChallenge:record.challenge,expectedOrigin:env.ALLOWED_ORIGIN,expectedRPID:env.RP_ID,requireUserVerification:true});}catch{fail(400,'passkey_invalid','Passkey setup could not be verified. Try again.');}
    if(!result.verified||!result.registrationInfo?.userVerified)fail(400,'passkey_invalid','Passkey user verification is required.');
    const credential=result.registrationInfo.credential;await store.db.prepare('INSERT INTO records(key,value,expires) VALUES(?,?,0)').bind('credential:'+credential.id,JSON.stringify({...credential,publicKey:b64(credential.publicKey)})).run();
    return json(env,{registered:true});
   }
   if(url.pathname==='/api/sync'){
    if(!/^202[67]-(0[1-9]|1[0-2])-16$/.test(input.cycle||'')||input.cycle<'2026-07-16')fail(400,'invalid_cutoff','Choose a supported 16th–15th cutoff.');
    const reader=new Sheets.SyncClient();reader.get=endpoint=>google.get(endpoint);
    try{return json(env,await reader.read({2026:env.SHEET_2026,2027:env.SHEET_2027},input.cycle));}catch(error){if(error instanceof HttpError)throw error;fail(422,'source_validation_failed',/header|formula|Workbook|Expected|Required|bounds|Incomplete|Unexpected spreadsheet/i.test(error.message)?error.message:'Source validation failed. Your last verified figures were not replaced.');}
   }
   if(url.pathname==='/api/logout'){await store.remove(auth.key);return json(env,{locked:true});}
   if(url.pathname==='/api/disconnect'){await google.disconnect();return json(env,{disconnected:true});}
   fail(404,'not_found','Unknown Finance HQ operation.');
  }catch(error){
   // Never log OAuth codes, refresh/access tokens, request bodies, or source data.
   const known=error instanceof HttpError;
   return json(env,{error:{code:known?error.code:'temporarily_unavailable',message:known?error.message:'Secure connection is temporarily unavailable. Try again.'}},known?error.status:503);
  }
 };
}
export default {fetch:createHandler()};
