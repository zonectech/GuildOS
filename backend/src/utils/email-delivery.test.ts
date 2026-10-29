import {describe,it,expect,vi} from 'vitest';
vi.mock('../config',()=>({config:{smtpHost:'',frontendUrl:'https://guildos.example'}}));
import {sendEmail} from './email';
describe('durable email cannot silently succeed when disabled',()=>{
 it('fails required delivery so it remains pending for retry',async()=>{await expect(sendEmail('nobody@example.com',{subject:'test',text:'test',html:'test'},undefined,{requireConfigured:true,messageId:'<test@example.com>'})).rejects.toThrow(/not configured/);});
});
