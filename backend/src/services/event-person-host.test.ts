import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ manager: vi.fn(), inviteFind: vi.fn(), hostOne: vi.fn(), update: vi.fn(), userFind: vi.fn(), userOne: vi.fn(), event: vi.fn(), notify: vi.fn(), create: vi.fn(), count: vi.fn(), blocked: vi.fn() }));
vi.mock('./event/event-shared', () => ({ requireEventManager: m.manager }));
vi.mock('../models/event-person-host.model', () => ({ EventPersonHostModel: { find: m.inviteFind, findOne: m.hostOne, findOneAndUpdate: m.update, countDocuments: m.count, create: m.create } }));
vi.mock('../models/user.model', () => ({ UserModel: { find: m.userFind, findOne: m.userOne } }));
vi.mock('../models/event.model', () => ({ EventModel: { findOne: m.event } }));
vi.mock('./notification.service', () => ({ createNotification: m.notify }));
vi.mock('./user-safety.service', () => ({ isBlockedBetween: m.blocked }));
import { publicHostPerson, publicEventHosts, respondPersonHost, invitePersonHost, removePersonHost } from './event-person-host.service';
const person = { _id:'person', fullName:'Person', status:'ACTIVE', deletedAt:null, email:'private@example.test', profile:{ username:'person', avatar:'', profileVisibility:'PUBLIC' } };
describe('event organizer and personal co-host privacy', () => {
 beforeEach(() => { vi.clearAllMocks(); m.event.mockReturnValue({ select: () => ({ lean: async () => ({ status:'PUBLISHED', cancellationReason:'' }) }) }); m.blocked.mockResolvedValue(false); });
 it.each(['PRIVATE','UNLISTED'])('does not expose a %s profile', visibility => { expect(publicHostPerson({ ...person, profile:{...person.profile,profileVisibility:visibility} })).toBeNull(); });
 it('only exposes public identity fields', () => { expect(publicHostPerson(person)).toEqual({id:'person',name:'Person',username:'person',avatar:''}); expect(publicHostPerson({...person,status:'BLOCKED'})).toBeNull(); expect(publicHostPerson({...person,deletedAt:new Date()})).toBeNull(); });
 it('does not publish pending or declined people and only returns the viewers invite', async () => {
  m.inviteFind.mockReturnValue({ lean: async () => [{_id:'a',userId:'person',status:'PENDING'},{_id:'b',userId:'other',status:'ACCEPTED'}] });
  m.userFind.mockReturnValue({ select: () => ({ lean: async () => [person,{...person,_id:'other',profile:{...person.profile,username:'other'}}] }) });
  const result=await publicEventHosts({_id:'event',createdBy:'person'},'person');
  expect(result.personCoHosts.map(p=>p.id)).toEqual(['other']);
  expect(result.viewerPersonHostInvite).toEqual({id:'a'});
  expect((await publicEventHosts({_id:'event',createdBy:'person'},'stranger')).viewerPersonHostInvite).toBeNull();
 });
 it('requires the invited account and pending status in an atomic response', async () => {
  m.update.mockResolvedValue(null);
  await expect(respondPersonHost('event','invite','stranger',true)).rejects.toThrow('Pending invitation not found');
  expect(m.update).toHaveBeenCalledWith({ _id:'invite',eventId:'event',userId:'stranger',status:'PENDING' },expect.anything(),{new:true});
  expect(m.manager).not.toHaveBeenCalled();
 });
 it('accepting credit does not call a management-access grant', async () => {
  m.update.mockResolvedValue({_id:'invite',status:'ACCEPTED'});
  expect(await respondPersonHost('event','invite','person',true)).toEqual({id:'invite',status:'ACCEPTED'});
  expect(m.manager).not.toHaveBeenCalled();
 });
 it('requires approved event-manager access before inviting anyone', async () => {
  m.manager.mockRejectedValueOnce(new Error('Insufficient permissions'));
  await expect(invitePersonHost('event','stranger','person')).rejects.toThrow('Insufficient permissions');
  expect(m.userOne).not.toHaveBeenCalled(); expect(m.notify).not.toHaveBeenCalled();
 });
 it('allows a person to withdraw their credit without management access', async () => {
  const deleted=vi.fn(); m.hostOne.mockResolvedValue({userId:'person',deleteOne:deleted});
  expect(await removePersonHost('event','invite','person')).toEqual({removed:true});
  expect(deleted).toHaveBeenCalledOnce(); expect(m.manager).not.toHaveBeenCalled();
 });
 it('denies removing another persons credit without manager authorization', async () => {
  const deleted=vi.fn(); m.hostOne.mockResolvedValue({userId:'person',deleteOne:deleted});
  m.manager.mockRejectedValueOnce(new Error('Insufficient permissions'));
  await expect(removePersonHost('event','invite','stranger')).rejects.toThrow('Insufficient permissions');
  expect(deleted).not.toHaveBeenCalled();
 });
 it('will not send an invitation across a block', async () => {
  m.manager.mockResolvedValue({createdBy:'creator',slug:'event',status:'PUBLISHED'});
  m.userOne.mockReturnValue({select:()=>({lean:async()=>person})}); m.blocked.mockResolvedValue(true);
  await expect(invitePersonHost('event','manager','person')).rejects.toThrow('Public profile not found'); expect(m.notify).not.toHaveBeenCalled();
 });
});
