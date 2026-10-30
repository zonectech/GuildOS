import { writeFile } from 'node:fs/promises';
async function main(){
 const response=await fetch('https://cerebralvalley.ai/events/~/e/built-with-claude-japan2026?utm_source=cerebralvalley&utm_medium=referral&utm_campaign=featured&modalCloseUrl=%2Fevents',{signal:AbortSignal.timeout(15000)});
 const html=await response.text();await writeFile('D:/Users/Administrator/Desktop/Guild0S/tmp/claude-source.html',html);
 console.log(JSON.stringify({status:response.status,canonical:html.match(/<link[^>]*rel="canonical"[^>]*>/i)?.[0],structuredEvents:[...html.matchAll(/application\/ld\+json/g)].length,times:[...html.matchAll(/<time[^>]*>[\s\S]*?<\/time>/gi)].map(x=>x[0]).slice(0,12)},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});