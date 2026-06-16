import {
  getHealthKitActivityIcon,
  getKnownHealthKitActivityTypes,
} from '@/constants/healthkit-activity-icons';
import { getCatalogEntryForHealthKitActivity } from '@/config/workout-catalog';

describe('healthkit activity icons', () => {
  it('returns a dedicated icon for every known HK activity type', () => {
    for (const activityType of getKnownHealthKitActivityTypes()) {
      const icon = getHealthKitActivityIcon(activityType);
      expect(icon.icon).toBeTruthy();
      expect(icon.sfSymbol).toBeTruthy();
    }
  });

  it('maps pickleball and tennis to distinct icons', () => {
    const pickleball = getHealthKitActivityIcon(79);
    const tennis = getHealthKitActivityIcon(48);
    expect(pickleball.sfSymbol).toBe('figure.pickleball');
    expect(tennis.sfSymbol).toBe('figure.tennis');
    expect(pickleball.sfSymbol).not.toBe(tennis.sfSymbol);
  });

  it('merges HK icons into catalog entries with Apple Fitness labels', () => {
    const entry = getCatalogEntryForHealthKitActivity(79);
    expect(entry.label).toBe('Pickleball');
    expect(entry.sfSymbol).toBe('figure.pickleball');
    expect(entry.icon).toBeTruthy();
  });

  it('keeps jump rope icon consistent across catalog resolution', () => {
    const entry = getCatalogEntryForHealthKitActivity(64);
    expect(entry.label).toBe('Jump Rope');
    expect(entry.sfSymbol).toBe('figure.jumprope');
    expect(entry.id).toBe('jump-rope');
  });
});
