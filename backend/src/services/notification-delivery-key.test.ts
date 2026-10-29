import {beforeEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({write:vi.fn(),emit:vi.fn(),push:vi.fn()}));
vi.mock('../models/notification.model',()=>({NotificationModel:{init:vi.fn(async()=>{}),updateOne:mocks.write,create:vi.fn()}}));
vi.mock('../realtime',()=>({emitToUser:mocks.emit}));
vi.mock('./push.service',()=>({sendPushToUser:mocks.push.mockResolvedValue(undefined),sendPushToUsers:vi.fn()}));
import {createNotification} from './notification.service';
const input={userId:'507f1f77bcf86cd799439011',type:'SYSTEM' as const,title:'New event',deliveryKey:'event:recipient'};
beforeEach(()=>{vi.clearAllMocks();});
describe('idempotent durable notifications',()=>{
 it('upserts once and does not resurface an existing notification on retry',async()=>{mocks.write.mockResolvedValueOnce({upsertedCount:1}).mockResolvedValueOnce({upsertedCount:0});await createNotification(input);await createNotification(input);expect(mocks.emit).toHaveBeenCalledOnce();expect(mocks.push).toHaveBeenCalledOnce();expect(mocks.write.mock.calls[0][0]).toEqual({deliveryKey:'event:recipient'});});
 it('propagates database failure so the delivery worker can retry',async()=>{mocks.write.mockRejectedValueOnce(Error('database down'));await expect(createNotification(input)).rejects.toThrow(/database/);expect(mocks.push).not.toHaveBeenCalled();});
 it('treats a racing unique-key insertion as already delivered',async()=>{mocks.write.mockRejectedValueOnce({code:11000});await expect(createNotification(input)).resolves.toBeUndefined();expect(mocks.push).not.toHaveBeenCalled();});
});
