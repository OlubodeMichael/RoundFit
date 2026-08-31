/**
 * Log-in sheet — the "Have an account? Log in" path off the landing screen.
 *
 * Presented as a short `formSheet` sized with `fitToContents` (see `_layout.tsx`),
 * so this screen must render at its intrinsic height: no `flex: 1` spacers, and no
 * entrance animation that changes layout. It is dismissed by the native grabber or
 * a swipe down, so it carries no close button of its own.
 *
 * Signing up is deliberately not offered here — the landing screen owns "Get
 * started". Email is the one option that leaves the sheet: a full log-in form does
 * not fit a short detent, so it `replace`s the sheet with the full-screen form.
 */
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GoogleLogo } from '@/components/ui/GoogleLogo';
import { hasActiveUserSession } from '@/context/auth-context';
import { useAuth } from '@/hooks/use-auth';
import { useSheetPresentation } from '@/hooks/use-sheet-presentation';
import { PRIVACY_URL, TERMS_URL } from '@/constants/legal';
import * as WebBrowser from 'expo-web-browser';

const C = {
  bg:     '#FAFAF8',
  text:   '#111111',
  mid:    '#888888',
  line:   '#E6E2DA',
  accent: '#F97316',
};

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { presentedAsSheet, topInset } = useSheetPresentation();
  const {
    signInWithOAuth,
    isLoading,
    error,
    clearError,
    status,
    user,
    profileSetupPending,
  } = useAuth();

  const oauthAttemptRef = useRef(false);

  useEffect(() => {
    if (hasActiveUserSession(status, user)) {
      oauthAttemptRef.current = false;
      router.replace('/(tabs)');
      return;
    }
    if (!oauthAttemptRef.current) return;
    if (status === 'needs-profile' && profileSetupPending) {
      oauthAttemptRef.current = false;
      router.replace('/onboarding/complete-profile');
    }
  }, [status, user, profileSetupPending, router]);

  const runOAuth = (provider: 'apple' | 'google') => {
    oauthAttemptRef.current = true;
    void signInWithOAuth(provider);
  };

  return (
    <View
      style={[
        s.root,
        {
          // The grabber occupies the top of the sheet; only the full-screen
          // fallback needs to clear the status bar.
          paddingTop:    topInset + (presentedAsSheet ? 28 : 20),
          paddingBottom: insets.bottom + 20,
        },
      ]}
    >
      <Text style={s.headline}>Welcome back</Text>
      <Text style={s.sub}>Pick up where you left off.</Text>

      {error && (
        <TouchableOpacity style={s.errorBanner} onPress={clearError} activeOpacity={0.8}>
          <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
          <Text style={s.errorText}>
            {error === 'OAUTH_FAILED'
              ? 'Sign in with Google or Apple failed. Please try again.'
              : 'Something went wrong. Please try again.'}
          </Text>
        </TouchableOpacity>
      )}

      <View style={s.options}>
        <TouchableOpacity
          style={[s.option, { opacity: isLoading ? 0.55 : 1 }]}
          activeOpacity={0.85}
          disabled={isLoading}
          onPress={() => runOAuth('apple')}
        >
          <View style={s.optionIcon}>
            <Ionicons name="logo-apple" size={26} color={C.text} />
          </View>
          <Text style={s.optionText}>Continue with Apple</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.option, { opacity: isLoading ? 0.55 : 1 }]}
          activeOpacity={0.85}
          disabled={isLoading}
          onPress={() => runOAuth('google')}
        >
          <View style={s.optionIcon}>
            <GoogleLogo size={24} />
          </View>
          <Text style={s.optionText}>Continue with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.option}
          activeOpacity={0.85}
          // Replace, not push: a full log-in form does not fit the short detent,
          // and leaving the sheet mounted underneath would make the form animate
          // in over a screen that is still presenting a modal.
          onPress={() => router.replace('/auth/email-login')}
        >
          <View style={s.optionIcon}>
            <Ionicons name="mail-outline" size={25} color={C.text} />
          </View>
          <Text style={s.optionText}>Continue with email</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.legal}>
        By continuing you agree to our{' '}
        <Text
          style={s.legalLink}
          suppressHighlighting
          onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}
        >
          Terms
        </Text>{' '}
        and{' '}
        <Text
          style={s.legalLink}
          suppressHighlighting
          onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
        >
          Privacy Policy
        </Text>
        .
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    backgroundColor:   C.bg,
    paddingHorizontal: 24,
  },

  headline: {
    fontFamily:    'Syne_800ExtraBold',
    fontSize:      34,
    lineHeight:    40,
    letterSpacing: -1.2,
    color:         C.text,
  },
  sub: {
    fontSize:   15,
    lineHeight: 21,
    color:      C.mid,
    marginTop:  6,
  },

  errorBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    backgroundColor:   'rgba(239,68,68,0.08)',
    borderWidth:       1,
    borderColor:       'rgba(239,68,68,0.25)',
    borderRadius:      12,
    paddingVertical:   12,
    paddingHorizontal: 14,
    marginTop:         18,
  },
  errorText: {
    flex:       1,
    fontSize:   13,
    lineHeight: 18,
    color:      '#EF4444',
  },

  options:   { gap: 12, marginTop: 26 },
  option: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   '#FFFFFF',
    borderRadius:      18,
    borderWidth:       1,
    borderColor:       C.line,
    paddingVertical:   21,
    paddingHorizontal: 20,
  },
  optionIcon: {
    width:          30,
    alignItems:     'center',
    justifyContent: 'center',
    marginRight:    16,
  },
  optionText: {
    fontSize:   17,
    fontWeight: '600',
    color:      C.text,
  },

  legal: {
    fontSize:   12,
    lineHeight: 17,
    color:      C.mid,
    textAlign:  'center',
    marginTop:  22,
  },
  legalLink: {
    color:      C.text,
    fontWeight: '600',
  },
});
