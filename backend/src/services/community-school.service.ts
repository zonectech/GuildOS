import { UserModel } from '../models/user.model';
import { InstitutionModel } from '../models/institution.model';
import { schoolEmailVerification } from './community-access.service';
import { findInstitutionByName, institutionAcceptsEmail } from './institution.service';
import { normalizeIdentity } from '../utils/community-identity';

export async function resolveCommunitySchool(userId: string, school = '') {
 const user = await UserModel.findById(userId).select('email emailVerified communityAccessEmail communityAccessEmailVerified profile.university profile.faculty profile.department').lean();
 if(!user) throw new Error('User not found');
 const proof=schoolEmailVerification(user);
 const institutions=await InstitutionModel.find({active:true}).select('name aliases emailDomains').lean();
 const matched=proof.verified?institutions.find(i=>institutionAcceptsEmail(i,proof.email)):null;
 const selected=school.trim()?await findInstitutionByName(school):matched;
 return { email:proof.email, verified:proof.verified, matchedSchool:matched?.name || '', selectedSchool:selected?.name || school.trim(), selectedMatches:Boolean(selected && proof.verified && institutionAcceptsEmail(selected,proof.email)), profileSchool:user.profile?.university || '', faculty:user.profile?.faculty || '', department:user.profile?.department || '' };
}

/** Unknown schools are proposals, never active registry institutions or trusted domains. */
export async function resolveOrProposeInstitution(name: string) {
 const known=await findInstitutionByName(name); if(known)return known;
 const clean=String(name||'').trim(); const normalizedName=normalizeIdentity(clean);
 if(clean.length<3 || clean.length>180 || !normalizedName)throw new Error('Enter your school’s full name');
 try { return await InstitutionModel.findOneAndUpdate({normalizedName},{$setOnInsert:{name:clean,normalizedName,aliases:[],normalizedAliases:[],emailDomains:[],country:'',active:false,verifiedBy:null}},{upsert:true,new:true}).lean(); }
 catch(error:any){if(error?.code===11000)return InstitutionModel.findOne({normalizedName}).lean();throw error;}
}
