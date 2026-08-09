import { ExternalCredentialModel, type ExternalCredentialHydratedDocument } from '../models/external-credential.model';

export const MAX_EXTERNAL_CREDENTIALS = 10;

export type ExternalCredentialInput = {
  title: string;
  issuer?: string;
  issueDate?: string | null;
  fileUrl?: string;
  fileName?: string;
  description?: string;
};

function serialize(doc: ExternalCredentialHydratedDocument) {
  return {
    id: doc._id.toString(),
    title: doc.title,
    issuer: doc.issuer,
    issueDate: doc.issueDate ? doc.issueDate.toISOString() : null,
    fileUrl: doc.fileUrl,
    fileName: doc.fileName,
    description: doc.description,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function sanitizeInput(input: ExternalCredentialInput) {
  const title = (input.title ?? '').trim().slice(0, 140);
  if (!title) {
    throw new Error('A title is required');
  }
  const issueDate = input.issueDate ? new Date(input.issueDate) : null;
  return {
    title,
    issuer: (input.issuer ?? '').trim().slice(0, 140),
    issueDate: issueDate && !Number.isNaN(issueDate.getTime()) ? issueDate : null,
    fileUrl: (input.fileUrl ?? '').trim().slice(0, 300),
    fileName: (input.fileName ?? '').trim().slice(0, 160),
    description: (input.description ?? '').trim().slice(0, 500),
  };
}

export async function listMyCredentials(userId: string) {
  const docs = await ExternalCredentialModel.find({ userId }).sort({ createdAt: -1 });
  return docs.map(serialize);
}

export async function listCredentialsForUser(userId: string) {
  const docs = await ExternalCredentialModel.find({ userId }).sort({ createdAt: -1 });
  return docs.map(serialize);
}

export async function createCredential(userId: string, input: ExternalCredentialInput) {
  const count = await ExternalCredentialModel.countDocuments({ userId });
  if (count >= MAX_EXTERNAL_CREDENTIALS) {
    throw new Error(`You can add up to ${MAX_EXTERNAL_CREDENTIALS} credentials`);
  }
  const clean = sanitizeInput(input);
  const doc = await ExternalCredentialModel.create({ userId, ...clean });
  return serialize(doc);
}

export async function updateCredential(userId: string, credentialId: string, input: ExternalCredentialInput) {
  const doc = await ExternalCredentialModel.findOne({ _id: credentialId, userId });
  if (!doc) {
    throw new Error('Credential not found');
  }
  const clean = sanitizeInput(input);
  doc.title = clean.title;
  doc.issuer = clean.issuer;
  doc.issueDate = clean.issueDate;
  if (clean.fileUrl) doc.fileUrl = clean.fileUrl;
  if (clean.fileName) doc.fileName = clean.fileName;
  doc.description = clean.description;
  await doc.save();
  return serialize(doc);
}

export async function deleteCredential(userId: string, credentialId: string) {
  const result = await ExternalCredentialModel.deleteOne({ _id: credentialId, userId });
  if (result.deletedCount === 0) {
    throw new Error('Credential not found');
  }
}
