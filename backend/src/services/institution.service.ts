import { InstitutionModel } from '../models/institution.model';
import { normalizeIdentity } from '../utils/community-identity';

function normalizeDomain(value: string) {
  return value.trim().toLowerCase().replace(/^@/, '');
}

export async function seedCoreInstitutions() {
  await InstitutionModel.updateOne(
    { normalizedName: normalizeIdentity('Federal University of Technology Minna') },
    {
      $setOnInsert: {
        name: 'Federal University of Technology Minna',
        normalizedName: normalizeIdentity('Federal University of Technology Minna'),
        aliases: ['FUTMINNA', 'FUT Minna'],
        normalizedAliases: ['FUTMINNA', 'FUT Minna'].map(normalizeIdentity),
        emailDomains: ['futminna.edu.ng'],
        country: 'NG',
        active: true,
      },
    },
    { upsert: true },
  );
}

export async function listInstitutions() {
  return InstitutionModel.find({ active: true }).select('name aliases country').sort({ name: 1 }).lean();
}

export async function findInstitutionByName(value: string) {
  const normalized = normalizeIdentity(value);
  if (!normalized) return null;
  return InstitutionModel.findOne({
    active: true,
    $or: [{ normalizedName: normalized }, { normalizedAliases: normalized }],
  }).lean();
}

export function emailDomain(email: string) {
  return normalizeDomain(email.split('@')[1] ?? '');
}

export function institutionAcceptsEmail(institution: { emailDomains: string[] }, email: string) {
  const domain = emailDomain(email);
  return Boolean(domain) && institution.emailDomains.some((allowed) => {
    const normalized = normalizeDomain(allowed);
    return domain === normalized || domain.endsWith(`.${normalized}`);
  });
}

export async function createInstitution(input: {
  name: string;
  aliases?: string[];
  emailDomains: string[];
  country?: string;
  adminId: string;
}) {
  const name = input.name?.trim();
  const domains = [...new Set((input.emailDomains ?? []).map(normalizeDomain).filter(Boolean))];
  if (!name) throw new Error('Institution name is required');
  if (!domains.length || domains.some((domain) => !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain))) {
    throw new Error('At least one valid institution email domain is required');
  }
  const aliases = [...new Set((input.aliases ?? []).map((alias) => alias.trim()).filter(Boolean))];
  return InstitutionModel.create({
    name,
    normalizedName: normalizeIdentity(name),
    aliases,
    normalizedAliases: aliases.map(normalizeIdentity),
    emailDomains: domains,
    country: input.country?.trim().toUpperCase() ?? '',
    active: true,
    verifiedBy: input.adminId,
  });
}

export async function updateInstitution(id: string, input: Partial<{ name: string; aliases: string[]; emailDomains: string[]; country: string; active: boolean }>) {
  const institution = await InstitutionModel.findById(id);
  if (!institution) throw new Error('Institution not found');
  if (input.name !== undefined) {
    if (!input.name.trim()) throw new Error('Institution name is required');
    institution.name = input.name.trim();
    institution.normalizedName = normalizeIdentity(input.name);
  }
  if (input.aliases !== undefined) {
    institution.aliases = [...new Set(input.aliases.map((alias) => alias.trim()).filter(Boolean))];
    institution.normalizedAliases = institution.aliases.map(normalizeIdentity);
  }
  if (input.emailDomains !== undefined) {
    const domains = [...new Set(input.emailDomains.map(normalizeDomain).filter(Boolean))];
    if (!domains.length || domains.some((domain) => !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain))) throw new Error('At least one valid institution email domain is required');
    institution.emailDomains = domains;
  }
  if (input.country !== undefined) institution.country = input.country.trim().toUpperCase();
  if (input.active !== undefined) institution.active = input.active;
  await institution.save();
  return institution;
}