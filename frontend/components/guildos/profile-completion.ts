export type ProfileCompletionInput = {
  fullName?: string;
  username?: string;
  bio?: string;
  location?: string;
  socialLinks?: string[];
  university?: string;
  faculty?: string;
  department?: string;
  level?: string;
  interests?: string[];
  graduationYear?: number | null;
  avatar?: string;
};

export type ProfileCompletionField = {
  key: string;
  label: string;
  value: unknown;
};

export type ProfileCompletionResult = {
  completion: number;
  missingFields: string[];
  fields: ProfileCompletionField[];
};

function isFilled(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  return Boolean(value && String(value).trim());
}

export function getProfileCompletion(input: ProfileCompletionInput): ProfileCompletionResult {
  const fields: ProfileCompletionField[] = [
    { key: 'fullName', label: 'Add full name', value: input.fullName },
    { key: 'username', label: 'Add username', value: input.username },
    { key: 'avatar', label: 'Add profile photo', value: input.avatar },
    { key: 'bio', label: 'Add bio', value: input.bio },
    { key: 'location', label: 'Add location', value: input.location },
    { key: 'socialLinks', label: 'Add social links', value: input.socialLinks },
    { key: 'university', label: 'Add university', value: input.university },
    { key: 'faculty', label: 'Add faculty', value: input.faculty },
    { key: 'department', label: 'Add department', value: input.department },
    { key: 'level', label: 'Add level', value: input.level },
    { key: 'interests', label: 'Add skills', value: input.interests },
    { key: 'graduationYear', label: 'Add graduation year', value: input.graduationYear },
  ];

  const filledCount = fields.filter((field) => isFilled(field.value)).length;
  const completion = fields.length ? Math.round((filledCount / fields.length) * 100) : 0;
  const missingFields = fields.filter((field) => !isFilled(field.value)).map((field) => field.label);

  return {
    completion,
    missingFields,
    fields,
  };
}
