import {beforeEach,describe,it,expect,vi} from 'vitest';
const exists=vi.hoisted(()=>vi.fn());vi.mock('../../models/event-registration.model',()=>({EventRegistrationModel:{exists}}));
import {assertAttendancePolicyEditable} from './event-attendance-policy-lock';
const event={_id:'event',minimumAttendanceDuration:30,minimumAttendanceDays:1,checkOutRequired:true,timezone:'UTC',startDate:new Date('2026-10-27T09:00:00Z'),days:[{date:new Date('2026-10-27'),startTime:'09:00',endTime:'10:00',facilitators:[]}]};
beforeEach(()=>{exists.mockReset();exists.mockResolvedValue(true);});
describe('recorded attendance policy lock',()=>{
 it('blocks changing eligibility or schedule after evidence exists',async()=>{await expect(assertAttendancePolicyEditable(event,{minimumAttendanceDuration:10})).rejects.toThrow(/locked/);await expect(assertAttendancePolicyEditable(event,{startDate:'2026-10-28T09:00:00Z'})).rejects.toThrow(/locked/);});
 it('allows changes before attendance begins',async()=>{exists.mockResolvedValue(false);await expect(assertAttendancePolicyEditable(event,{minimumAttendanceDuration:10})).resolves.toBeUndefined();});
 it('allows facilitator or descriptive edits without silently changing attendance rules',async()=>{await expect(assertAttendancePolicyEditable(event,{days:[{...event.days[0],facilitators:[{name:'Trainer'}]}]})).resolves.toBeUndefined();expect(exists).not.toHaveBeenCalled();});
});
