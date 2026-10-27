/** Literal public-profile search; never interpret user text as a regular expression. */
export function peopleSearchFilter(value = '') {
 const query = value.trim().slice(0, 80);
 if (!query) return {};
 const literal = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
 return { $or: ['fullName', 'profile.username', 'profile.university', 'profile.department', 'profile.interests', 'profile.skills'].map(field => ({ [field]: { $regex: literal, $options: 'i' } })) };
}
