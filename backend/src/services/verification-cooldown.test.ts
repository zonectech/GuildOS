import { describe, expect, it } from 'vitest';
import { schoolCodeCooldownMs, schoolCodeSecondsLeft } from '../../../frontend/components/guildos/verification-cooldown';
describe('school email countdown under clock skew',()=>{
 it('uses the server remaining duration instead of an absolute wall-clock timestamp',()=>{
  const monotonicStart=12000;
  const deadline=monotonicStart+schoolCodeCooldownMs(30);
  expect(schoolCodeSecondsLeft(deadline,monotonicStart)).toBe(30);
  expect(schoolCodeSecondsLeft(deadline,monotonicStart+29000)).toBe(1);
  expect(schoolCodeSecondsLeft(deadline,monotonicStart+31000)).toBe(0);
 });
 it('cannot turn a normal resend into the reported 5472-second countdown',()=>{
  expect(schoolCodeCooldownMs(5472)).toBe(60000);
  expect(schoolCodeCooldownMs(-10)).toBe(0);
  expect(schoolCodeCooldownMs(NaN)).toBe(60000);
 });
 it('is independent of device wall-clock changes and catches up after backgrounding',()=>{
  const deadline=5000+schoolCodeCooldownMs(60);
  expect(schoolCodeSecondsLeft(deadline,20000)).toBe(45);
  expect(schoolCodeSecondsLeft(deadline,100000)).toBe(0);
 });
});
