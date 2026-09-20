import { describe, expect, it } from 'vitest';
import { biologicalSexFromProgramTrack } from './program-track';

describe('biologicalSexFromProgramTrack', () => {
  it('maps female track to FEMALE and male track to MALE', () => {
    expect(biologicalSexFromProgramTrack('female')).toBe('FEMALE');
    expect(biologicalSexFromProgramTrack('male')).toBe('MALE');
  });
});
