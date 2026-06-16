import {
  getHealthKitActivityDisplayLabel,
  resolveHealthKitActivityTypeNumber,
} from '@/constants/healthkit-activity-types';

describe('healthkit activity types', () => {
  it('resolves HK enum string identifiers to raw values', () => {
    expect(resolveHealthKitActivityTypeNumber('HKWorkoutActivityTypePickleball')).toBe(79);
    expect(resolveHealthKitActivityTypeNumber('HKWorkoutActivityTypeRunning')).toBe(37);
  });

  it('returns Apple Fitness display labels for known types', () => {
    expect(getHealthKitActivityDisplayLabel(79)).toBe('Pickleball');
    expect(getHealthKitActivityDisplayLabel(37)).toBe('Running');
    expect(getHealthKitActivityDisplayLabel(63)).toBe('HIIT');
  });

  it('uses enum identifier when numeric type was not mapped', () => {
    expect(
      getHealthKitActivityDisplayLabel(3000, 'HKWorkoutActivityTypePickleball'),
    ).toBe('Pickleball');
  });

  it('does not fall back to RoundFit catalog Other for unmapped HK types', () => {
    expect(getHealthKitActivityDisplayLabel(79)).not.toBe('Other');
    expect(getHealthKitActivityDisplayLabel(48)).toBe('Tennis');
  });
});
