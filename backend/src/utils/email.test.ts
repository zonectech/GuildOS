import { describe, expect, it } from 'vitest';
import { categoryEmail, recommendationEmail, verificationEmailTemplate } from './email';
import { recommendationToken, validRecommendationToken } from './recommendation-token';

describe('email content and unsubscribe security',()=>{
 it('escapes card content and includes plain text and unsubscribe links',()=>{
  const mail=recommendationEmail({name:'Ada <Student>',unsubscribeUrl:'https://api.example.org/unsubscribe?id=1&token=abc',events:[{title:'<script>alert(1)</script>',detail:'Friday & Saturday',reason:'AI & design',url:'https://example.org/events/ai'}],communities:[]});
  expect(mail.html).not.toContain('<script>');expect(mail.html).toContain('&lt;script&gt;');expect(mail.html).toContain('Unsubscribe from recommendations');expect(mail.text).toContain('https://example.org/events/ai');expect(mail.unsubscribeUrl).toBeTruthy();
 });
 it('does not attach marketing unsubscribe controls to account emails',()=>{
  const mail=verificationEmailTemplate('Ada','https://example.org/verify');expect(mail.unsubscribeUrl).toBeUndefined();expect(mail.html).not.toContain('Unsubscribe from recommendations');
  expect(mail.html).toContain('When an organizer offers a certificate');
 });
 it('escapes transactional messages too',()=>{expect(categoryEmail('INFO',{subject:'Hello',message:'<img src=x onerror=alert(1)>'}).html).not.toContain('<img src=x');});
 it('rejects forged, malformed and cross-user unsubscribe tokens',()=>{
  const id='a'.repeat(24),token=recommendationToken(id);expect(validRecommendationToken(id,token)).toBe(true);expect(validRecommendationToken('b'.repeat(24),token)).toBe(false);expect(validRecommendationToken(id,token.slice(1))).toBe(false);expect(validRecommendationToken('not-an-id',token)).toBe(false);
 });
});
