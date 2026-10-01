import { formatWorkoutSetWeight } from '@/utils/body-units';

describe('formatWorkoutSetWeight', () => {
  it('converts stored kilograms to the profile imperial unit', () => {
    expect(formatWorkoutSetWeight(83.9146882455934, 'kg', 'imperial')).toBe('185 lb');
  });

  it('rounds metric display values to one decimal place', () => {
    expect(formatWorkoutSetWeight(83.9146882455934, 'kg', 'metric')).toBe('83.9 kg');
  });

  it('normalizes stored pounds before metric display', () => {
    expect(formatWorkoutSetWeight(185, 'lbs', 'metric')).toBe('83.9 kg');
  });

  it('labels zero load as bodyweight', () => {
    expect(formatWorkoutSetWeight(0, 'kg', 'metric')).toBe('Bodyweight');
  });
});
