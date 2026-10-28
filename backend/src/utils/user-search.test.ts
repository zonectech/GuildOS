import {describe,it,expect} from 'vitest';import {userSearchTerms} from './user-search';
describe('account tagging search',()=>{
 it('accepts @usernames',()=>{expect(userSearchTerms('@ether_neel')[0].test('ether_neel')).toBe(true);});
 it('accepts copied profile links',()=>{expect(userSearchTerms('https://guildos-three.vercel.app/u/ether_neel')[0].test('ether_neel')).toBe(true);});
 it('splits names into independent literal terms',()=>{const terms=userSearchTerms('Neel Ether');expect(terms.every(term=>term.test('Ether Neel'))).toBe(true);});
 it('does not interpret regex operators as wildcard search',()=>{expect(userSearchTerms('a.*')[0].test('abc')).toBe(false);expect(userSearchTerms('a.*')[0].test('a.*')).toBe(true);});
 it('ignores empty queries',()=>{expect(userSearchTerms('  ')).toEqual([]);});
});