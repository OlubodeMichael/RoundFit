import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';

import { usePalette } from '@/lib/log-theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface ProLockProps {
  /** What is behind the lock, in the user's words. "Weekly insights", not "weekly-ai". */
  title: string;
  /** One line on why it is worth having. Sell the outcome, not the technology. */
  description: string;
  icon?: IoniconName;
  /** Analytics source tag, forwarded to the paywall as `?source=`. */
  source?: string;
  /** `screen` fills the page; `card` sits inline among other content. */
  variant?: 'screen' | 'card';
  /**
   * Renders a back chevron. Required on a `screen` lock that replaces a pushed
   * route, which would otherwise have no affordance out except the system
   * swipe — and no affordance at all for anyone who does not know about it.
   */
  onBack?: () => void;
}

/**
 * The upgrade prompt shown in place of a Pro surface.
 *
 * Deliberately a *replacement* for the content rather than an overlay on top of
 * it. A blurred-but-visible chart invites pinch-to-read and screenshotting, and
 * it also means the screen still pays the cost of computing data nobody is
 * allowed to see.
 *
 * Never render this while `useProAccess().ready` is false — see the note there
 * about flashing a lock at paying subscribers mid-resolution.
 */
export function ProLock({
  title,
  description,
  icon = 'sparkles',
  source = 'feature_gate',
  variant = 'screen',
  onBack,
}: ProLockProps) {
  const P = usePalette();
  const router = useRouter();
  const isScreen = variant === 'screen';

  const body = (
    <View
      style={[
        isScreen ? styles.screen : styles.card,
        {
          backgroundColor: isScreen ? 'transparent' : P.card,
          borderColor: isScreen ? 'transparent' : P.cardEdge,
          borderWidth: isScreen ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={[styles.iconPill, { backgroundColor: P.caloriesSoft }]}>
        <Ionicons name={icon} size={isScreen ? 28 : 22} color={P.calories} />
      </View>

      <Text style={[styles.title, { color: P.text }, !isScreen && styles.titleCard]}>{title}</Text>
      <Text style={[styles.description, { color: P.textDim }]}>{description}</Text>

      <Pressable
        onPress={() => router.push({ pathname: '/paywall', params: { source } })}
        accessibilityRole="button"
        accessibilityLabel={`Unlock ${title} with RoundFit Pro`}
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: P.calories },
          pressed && styles.ctaPressed,
        ]}
      >
        <Text style={styles.ctaText}>Unlock with RoundFit Pro</Text>
      </Pressable>
    </View>
  );

  if (!onBack) return body;

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={[styles.backBtn, { backgroundColor: P.card, borderColor: P.cardEdge }]}
        >
          <Ionicons name="chevron-back" size={18} color={P.text} />
        </Pressable>
      </View>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  card: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderRadius: 20,
    gap: 10,
  },
  iconPill: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  titleCard: {
    fontSize: 17,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  cta: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 999,
    minHeight: 48,
    justifyContent: 'center',
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
