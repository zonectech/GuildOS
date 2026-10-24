/**
 * wa.me deep link for sharing a certificate with a leader who may have no GuildOS account.
 * Local Nigerian numbers (leading 0) are converted to international format; anything already
 * international keeps its digits.
 */
export function waCertificateLink(phone: string, name: string, communityName: string, url: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '234' + digits.slice(1);
  const text = `Congratulations ${name}! \u{1F393} Your leadership certificate from ${communityName} is ready. View and download it here: ${url}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
