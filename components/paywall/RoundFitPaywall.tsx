import { LinearGradient } from 'expo-linear-gradient';
import { Activity, Check, CreditCard, Lightbulb, Target, TrendingUp, X, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConnectedHealthHero } from '@/components/paywall/ConnectedHealthHero';
import { OnboardingQuestion } from '@/components/onboarding/onboarding-question';

const BENEFITS = [
  {
    icon: Target,
    title: 'Know what to do today',
    description: 'Get clear daily targets built around your goals.',
    color: '#F97316',
    background: '#FFF0E6',
  },
  {
    icon: Lightbulb,
    title: 'Make progress without guessing',
    description: 'Turn your health data into useful next steps.',
    color: '#16A34A',
    background: '#EAF8EE',
  },
  {
    icon: Activity,
    title: 'See the whole picture',
    description: 'Connect nutrition, training, sleep, and recovery.',
    color: '#2563EB',
    background: '#EAF1FF',
  },
  {
    icon: CreditCard,
    title: 'One app replaces the stack',
    description: 'One membership for your complete health plan.',
    color: '#2D2926',
    background: '#ECE9E5',
  },
  {
    icon: TrendingUp,
    title: 'Build momentum that lasts',
    description: 'Track your progress and keep moving forward.',
    color: '#0891B2',
    background: '#E6F7FA',
  },
] satisfies {
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
  background: string;
}[];

export type PaywallPlan = 'annual' | 'monthly';

export interface RoundFitPaywallProps {
  annualPrice: string;
  annualMonthlyPrice?: string | null;
  monthlyPrice: string;
  annualBadge?: string;
  annualHasTrial?: boolean;
  preview?: boolean;
  purchasing?: boolean;
  purchaseDisabled?: boolean;
  message?: string | null;
  onClose: () => void;
  onContinue: (plan: PaywallPlan) => void;
  onRestore?: () => void;
}

function PlanOption({
  label,
  price,
  period,
  detail,
  badge,
  selected,
  tight,
  onPress,
}: {
  label: string;
  price: string;
  period: string;
  detail: string;
  badge?: string;
  selected: boolean;
  tight: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.plan, tight && s.planTight, selected && s.planSelected]}
      activeOpacity={0.82}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}, ${price} ${period}. ${detail}`}
    >
      {badge ? (
        <View style={s.planBadge}>
          <Text style={[s.planBadgeText, tight && s.planBadgeTextTight]}>{badge}</Text>
        </View>
      ) : null}
      <View style={s.planTop}>
        <Text style={[s.planLabel, tight && s.planLabelTight, selected && s.planTextSelected]}>{label}</Text>
        <View style={[s.radio, tight && s.radioTight, selected && s.radioSelected]}>
          {selected ? <Check size={tight ? 10 : 14} color="#FFFFFF" strokeWidth={3.2} /> : null}
        </View>
      </View>
      <View style={s.planPriceRow}>
        <Text style={[s.planPrice, tight && s.planPriceTight, selected && s.planTextSelected]}>{price}</Text>
        <Text style={[s.planPeriod, tight && s.planPeriodTight, selected && s.planSubSelected]}>{period}</Text>
      </View>
      <Text style={[s.planDetail, tight && s.planDetailTight, selected && s.planSubSelected]}>{detail}</Text>
    </TouchableOpacity>
  );
}

export function RoundFitPaywall({
  annualPrice,
  annualMonthlyPrice,
  monthlyPrice,
  annualBadge,
  annualHasTrial = true,
  preview = false,
  purchasing = false,
  purchaseDisabled = false,
  message,
  onClose,
  onContinue,
  onRestore,
}: RoundFitPaywallProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const compact = height < 900;
  const tight = height < 720;
  const heroHeight = tight ? 76 : compact ? 142 : 210;
  const [selectedPlan, setSelectedPlan] = useState<PaywallPlan>('annual');
  const annualSelected = selectedPlan === 'annual';
  const annualDetail = annualHasTrial
    ? `7 days free${annualMonthlyPrice ? ` · ${annualMonthlyPrice}/mo` : ''}`
    : annualMonthlyPrice
      ? `${annualMonthlyPrice}/mo`
      : 'Billed yearly';

  return (
    <View
      style={[
        s.root,
        s.content,
        { paddingTop: insets.top + (tight ? 2 : 8), paddingBottom: insets.bottom + 12 },
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(249,115,22,0.38)',
          'rgba(255,174,112,0.24)',
          'rgba(250,247,242,0.04)',
          'rgba(250,247,242,0)',
        ]}
        locations={[0, 0.28, 0.76, 1]}
        style={[s.topGradient, { height: insets.top + heroHeight + 48 }]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(249,115,22,0)', 'rgba(249,115,22,0.13)', 'rgba(249,115,22,0)']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[s.topGradient, { height: insets.top + heroHeight + 24 }]}
      />

      <TouchableOpacity
        style={[s.close, { top: insets.top + (tight ? 2 : 8) }]}
        onPress={onClose}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={preview ? 'Close paywall preview' : 'Close paywall'}
      >
        <X size={22} color="#111111" strokeWidth={2.2} />
      </TouchableOpacity>

      <ConnectedHealthHero height={heroHeight} />

      <View style={[s.hero, compact && s.heroCompact]}>
        <OnboardingQuestion
          before="Your health. "
          emphasis="Finally connected."
          style={[s.title, compact && s.titleCompact, tight && s.titleTight]}
        />
      </View>

      <View style={[s.benefits, compact && s.benefitsCompact, tight && s.benefitsTight]}>
        {BENEFITS.map((benefit) => {
          const Icon = benefit.icon;
          return (
            <View key={benefit.title} style={[s.benefitRow, tight && s.benefitRowTight]}>
              <View
                style={[
                  s.benefitIcon,
                  { backgroundColor: benefit.background },
                  tight && s.benefitIconTight,
                ]}
              >
                <Icon size={tight ? 14 : 20} color={benefit.color} strokeWidth={2.4} />
              </View>
              <View style={s.benefitCopy}>
                <Text style={[s.benefitTitle, tight && s.benefitTitleTight]}>
                  {benefit.title}
                </Text>
                <Text style={[s.benefitDescription, tight && s.benefitDescriptionTight]}>
                  {benefit.description}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={[s.bottom, compact && s.bottomCompact, tight && s.bottomTight]}>
        <View style={s.plans} accessibilityRole="radiogroup">
          <PlanOption
            label="Annual"
            price={annualPrice}
            period="/ year"
            detail={annualDetail}
            badge={annualBadge}
            selected={annualSelected}
            tight={tight}
            onPress={() => setSelectedPlan('annual')}
          />
          <PlanOption
            label="Monthly"
            price={monthlyPrice}
            period="/ month"
            detail="No free trial"
            selected={!annualSelected}
            tight={tight}
            onPress={() => setSelectedPlan('monthly')}
          />
        </View>

        <TouchableOpacity
          style={[s.cta, compact && s.ctaCompact, (purchasing || purchaseDisabled) && s.ctaDisabled]}
          activeOpacity={0.85}
          disabled={purchasing || purchaseDisabled}
          onPress={() => onContinue(selectedPlan)}
          accessibilityRole="button"
          accessibilityState={{ disabled: purchasing || purchaseDisabled, busy: purchasing }}
          accessibilityLabel={
            annualSelected
              ? 'Start 7-day free trial'
              : 'Continue with selected plan'
          }
        >
          {purchasing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={s.ctaText}>
              {annualSelected ? 'Start 7-day free trial' : 'Continue'}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={[s.disclosure, tight && s.disclosureTight]}>
          Auto-renews. Cancel anytime.
        </Text>
        {message ? <Text style={s.message}>{message}</Text> : null}
        {preview ? (
          <Text style={s.previewNote}>Developer preview · No purchase will be made</Text>
        ) : (
          <View style={s.legalLinks}>
            <TouchableOpacity onPress={onRestore} disabled={!onRestore || purchasing}>
              <Text style={s.legalLink}>Restore</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL('https://roundfit.co/terms')}>
              <Text style={s.legalLink}>Terms</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL('https://roundfit.co/privacy')}>
              <Text style={s.legalLink}>Privacy</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAF7F2' },
  content: { paddingHorizontal: 24 },
  topGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 1,
  },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 18,
    top: 0,
    zIndex: 2,
    backgroundColor: 'rgba(255,255,255,0.72)',
    shadowColor: '#7C2D12',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  hero: { alignItems: 'center', marginTop: -10 },
  heroCompact: { marginTop: -6 },
  title: {
    color: '#111111',
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 40,
    lineHeight: 43,
    letterSpacing: -1.5,
    textAlign: 'center',
  },
  titleCompact: { fontSize: 32, lineHeight: 35 },
  titleTight: { fontSize: 26, lineHeight: 29 },
  benefits: { gap: 14, marginTop: 26, paddingHorizontal: 8 },
  benefitsCompact: { gap: 11, marginTop: 18 },
  benefitsTight: { gap: 5, marginTop: 9 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitRowTight: { gap: 8 },
  benefitIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitIconTight: { width: 25, height: 25, borderRadius: 8 },
  benefitCopy: { flex: 1 },
  benefitTitle: {
    color: '#22201E',
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 17,
    lineHeight: 21,
    letterSpacing: -0.25,
  },
  benefitTitleTight: { fontSize: 13, lineHeight: 15 },
  benefitDescription: {
    color: '#746E68',
    fontFamily: 'Archivo_500Medium',
    fontSize: 13,
    lineHeight: 17,
    marginTop: 2,
  },
  benefitDescriptionTight: { fontSize: 10, lineHeight: 12, marginTop: 0 },
  bottom: { marginTop: 'auto', paddingTop: 22 },
  bottomCompact: { paddingTop: 10 },
  bottomTight: { paddingTop: 7 },
  plans: { flexDirection: 'row', gap: 12 },
  plan: {
    flex: 1,
    minWidth: 0,
    minHeight: 106,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#DED8D1',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 17,
  },
  planTight: { minHeight: 76, borderRadius: 15, paddingHorizontal: 11, paddingVertical: 9 },
  planSelected: { backgroundColor: '#111111', borderColor: '#111111' },
  planBadge: {
    position: 'absolute',
    right: 10,
    top: -9,
    backgroundColor: '#F97316',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  planBadgeText: {
    color: '#FFFFFF',
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  planBadgeTextTight: { fontSize: 8 },
  planTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planLabel: { color: '#3E3935', fontFamily: 'Archivo_600SemiBold', fontSize: 15 },
  planLabelTight: { fontSize: 12 },
  planTextSelected: { color: '#FFFFFF' },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#B5AFA9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioTight: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5 },
  radioSelected: { backgroundColor: '#F97316', borderColor: '#F97316' },
  planPriceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 9 },
  planPrice: {
    color: '#111111',
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 27,
    letterSpacing: -0.8,
  },
  planPriceTight: { fontSize: 20 },
  planPeriod: { color: '#746E68', fontFamily: 'Archivo_500Medium', fontSize: 12, marginLeft: 4 },
  planPeriodTight: { fontSize: 10, marginLeft: 3 },
  planDetail: { color: '#746E68', fontFamily: 'Archivo_500Medium', fontSize: 11, marginTop: 6 },
  planDetailTight: { fontSize: 9, marginTop: 3 },
  planSubSelected: { color: '#C8C2BC' },
  cta: {
    backgroundColor: '#111111',
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 17,
    marginTop: 14,
  },
  ctaCompact: { paddingVertical: 14, marginTop: 9 },
  ctaDisabled: { opacity: 0.55 },
  ctaText: { color: '#FFFFFF', fontFamily: 'Archivo_600SemiBold', fontSize: 16 },
  disclosure: {
    color: '#4D4945',
    fontFamily: 'Archivo_500Medium',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 13,
  },
  disclosureTight: { fontSize: 10, lineHeight: 13, marginTop: 7 },
  previewNote: {
    color: '#A09A94',
    fontFamily: 'Archivo_500Medium',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 6,
  },
  message: {
    color: '#B91C1C',
    fontFamily: 'Archivo_500Medium',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 5,
  },
  legalLink: {
    color: '#8B847E',
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 10,
  },
});
