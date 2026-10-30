import { writeFile } from 'node:fs/promises';
import { importEventLink } from '../backend/src/services/event/external-event-link';
async function main() {
 const url='https://cerebralvalley.ai/e/meta-ai-developer-hackathon?utm_source=meta&utm_medium=paid_social&utm_campaign=MAPI_2026_Q3_FBIG_AllProducts_Tiers0-2Sales_CNV_092326&utm_term=MAPI_FBIG_PRO_MetaHackathon_MaxConv_CompleteRegistration_Broad_ROWTier3_AllPlace_102126&utm_content=MAPI600vA_FBIG_Hackathon_DM_Competition_IMG_1x1_CerebralValley_TenDaysToBuild_BuildTheFuture_enUS_XX_101526+-+Copy';
 const result=await importEventLink(url);
 await writeFile('D:/Users/Administrator/Desktop/Guild0S/tmp/meta-import-result.json',JSON.stringify(result,null,2));
 const {description,shortDescription,...fields}=result.draft;
 console.log(JSON.stringify({...fields,descriptionCharacters:description.length,warnings:result.warnings},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
