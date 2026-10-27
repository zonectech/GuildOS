import { describe,expect,it } from 'vitest';
import { categoryEmail } from './email';
describe('thank-you email images',()=>{
 it('renders public images with escaped attributes',()=>{const email=categoryEmail('INFO',{subject:'Thanks',message:'Hello',imageUrl:'https://images.example/image.png?alt="hello"'});expect(email.html).toContain('alt=&quot;hello&quot;');expect(email.html).toContain('alt="Event image"');});
 it.each(['javascript:alert(1)','data:text/html,test'])('rejects unsafe image URL %s',imageUrl=>{expect(categoryEmail('INFO',{subject:'Thanks',message:'Hello',imageUrl}).html).not.toContain('alt="Event image"');});
});
