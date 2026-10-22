import {
  firstNameFromFullName,
  firstNameFromUserMetadata,
} from '@/utils/social-first-name';

describe('firstNameFromFullName', () => {
  it('returns the first word', () => {
    expect(firstNameFromFullName('  Ana Maria Lopez ')).toBe('Ana');
  });

  it('returns null for blank input', () => {
    expect(firstNameFromFullName('   ')).toBeNull();
    expect(firstNameFromFullName(null)).toBeNull();
  });
});

describe('firstNameFromUserMetadata', () => {
  it('prefers given_name', () => {
    expect(firstNameFromUserMetadata({ given_name: 'José', full_name: 'Joe Smith' })).toBe('José');
  });

  it('falls back to the first word of full_name, then name', () => {
    expect(firstNameFromUserMetadata({ full_name: 'Sam Lee' })).toBe('Sam');
    expect(firstNameFromUserMetadata({ name: 'Kim Park' })).toBe('Kim');
  });

  it('returns null when no name is present', () => {
    expect(firstNameFromUserMetadata({ email: 'a@b.co' })).toBeNull();
    expect(firstNameFromUserMetadata(null)).toBeNull();
  });
});
