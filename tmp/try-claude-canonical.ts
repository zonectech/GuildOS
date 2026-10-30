import { writeFile } from 'node:fs/promises';
import { importEventLink } from '../backend/src/services/event/external-event-link';
async function main() {
 const url='https://cerebralvalley.ai/e/built-with-claude-japan2026';
 const result=await importEventLink(url);
 await writeFile('D:/Users/Administrator/Desktop/Guild0S/tmp/claude-canonical-result.json',JSON.stringify(result,null,2));
 const {description,shortDescription,...fields}=result.draft;
 console.log(JSON.stringify({...fields,descriptionCharacters:description.length,warnings:result.warnings},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
