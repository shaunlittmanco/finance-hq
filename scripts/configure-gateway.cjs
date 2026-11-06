const fs=require('node:fs');
const endpoint=process.argv[2]||'';
if(!/^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/.test(endpoint))throw Error('Provide the verified HTTPS URL of the new Finance HQ Worker, without a trailing slash.');
const js=fs.readFileSync('gateway.js','utf8');
fs.writeFileSync('gateway.js',js.replace(/const ENDPOINT='[^']*';/,`const ENDPOINT='${endpoint}';`));
const html=fs.readFileSync('index.html','utf8').replace(/connect-src ([^;]+);/,(_,sources)=>'connect-src '+sources.split(' ').filter(s=>!s.endsWith('.workers.dev')).concat(endpoint).join(' ')+';');
fs.writeFileSync('index.html',html);
console.log('Pinned the verified Finance HQ server in the connector and CSP. Run checks before release.');
