import { describe, expect, it } from 'vitest';
import { categoryEmail, recommendationEmail, verificationEmailTemplate } from './email';
import { recommendationToken, validRecommendationToken } from './recommendation-token';

describe('email content and unsubscribe security',()=>{
 it('renders website-style event and community cards with real metadata',()=>{
  const mail=recommendationEmail({name:'Ada',unsubscribeUrl:'https://example.org/unsubscribe',events:[{title:'AI Workshop',url:'https://example.org/events/ai',detail:'Saturday',reason:'Matches AI',imageUrl:'https://images.example.org/cover.jpg',logoUrl:'https://images.example.org/logo.png',communityName:'AI Builders',verified:true,dateDay:'21',dateMonth:'NOV',dateLabel:'Sat, 21 Nov · 10:00 WAT',location:'Online'}],communities:[{title:'Design Club',url:'https://example.org/communities/design',detail:'Design',reason:'From your school',school:'University of Lagos',category:'Design',description:'Create and learn together.',memberCount:125,verified:true}]});
  expect(mail.html).toContain('https://images.example.org/cover.jpg');expect(mail.html).toContain('https://images.example.org/logo.png');expect(mail.html).toContain('NOV');expect(mail.html).toContain('125 members');expect(mail.html).toContain('University of Lagos');expect(mail.html).toContain('Verified');expect(mail.text).toContain('Create and learn together.');
 });
 it('keeps missing-image cards useful and rejects unsafe image URLs',()=>{
  const mail=recommendationEmail({name:'Ada',unsubscribeUrl:'https://example.org/unsubscribe',events:[{title:'AI Workshop',url:'https://example.org/events/ai',detail:'Saturday',reason:'Matches AI',imageUrl:'javascript:alert(1)',logoUrl:'file:///private/logo.png',communityName:'AI Builders'}],communities:[]});
  expect(mail.html).not.toContain('javascript:');expect(mail.html).not.toContain('file:///');expect(mail.html).toContain('AI Builders');expect(mail.html).not.toContain('&#10003; Verified');expect(mail.html).toContain('View event');
 });
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
