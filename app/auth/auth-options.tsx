/**
 * Log-in sheet — the "Have an account? Log in" path off the landing screen.
 *
 * Presented over the landing screen as a content-height bottom sheet. Owning the
 * sheet here avoids inconsistent native detent sizing across iOS versions.
 *
 * Signing up is deliberately not offered here — the landing screen owns "Get
 * started". Email is the one option that leaves the sheet: a full log-in form does
 * not fit a short detent, so it `replace`s the sheet with the full-screen form.
 */
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GoogleLogo } from '@/components/ui/GoogleLogo';
import { hasActiveUserSession } from '@/context/auth-context';
import { useAuth } from '@/hooks/use-auth';
import { PRIVACY_URL, TERMS_URL } from '@/constants/legal';
import { safeBack } from '@/utils/navigation';
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
    <View style={s.overlay}>
      <StatusBar style="light" />
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={() => safeBack(router, '/auth')}
        accessibilityRole="button"
        accessibilityLabel="Close login options"
      />

      <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 18) + 14 }]}>
      <View style={s.grabber} />
      <View style={s.eyebrow}>
        <View style={s.eyebrowDot} />
        <Text style={s.eyebrowText}>ROUND FIT ACCOUNT</Text>
      </View>
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
          style={[s.option, s.appleOption, { opacity: isLoading ? 0.55 : 1 }]}
          activeOpacity={0.85}
          disabled={isLoading}
          onPress={() => runOAuth('apple')}
          accessibilityRole="button"
          accessibilityLabel="Continue with Apple"
        >
          <View style={s.optionIcon}>
            <Ionicons name="logo-apple" size={25} color="#FFFFFF" />
          </View>
          <Text style={[s.optionText, s.appleOptionText]}>Continue with Apple</Text>
          <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.option, { opacity: isLoading ? 0.55 : 1 }]}
          activeOpacity={0.85}
          disabled={isLoading}
          onPress={() => runOAuth('google')}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
        >
          <View style={s.optionIcon}>
            <GoogleLogo size={24} />
          </View>
          <Text style={s.optionText}>Continue with Google</Text>
          <Ionicons name="arrow-forward" size={19} color={C.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={s.option}
          activeOpacity={0.85}
          // Replace, not push: the form is presented as a modal (see the auth
          // stack layout), and pushing it would stack that card on top of this
          // sheet. Replacing hands the slot over, so the modal comes up against
          // the landing screen instead.
          onPress={() => router.replace('/auth/email-login')}
          accessibilityRole="button"
          accessibilityLabel="Continue with email"
        >
          <View style={s.optionIcon}>
            <Ionicons name="mail-outline" size={25} color={C.text} />
          </View>
          <Text style={s.optionText}>Continue with email</Text>
          <Ionicons name="arrow-forward" size={19} color={C.text} />
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
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(5,5,8,0.38)',
  },
  sheet: {
    backgroundColor: C.bg,
    paddingHorizontal: 22,
    paddingTop: 12,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 24,
  },
  grabber: {
    width: 42,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 19,
    backgroundColor: '#CEC9C2',
  },

  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  eyebrowDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.accent,
  },
  eyebrowText: {
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 10,
    letterSpacing: 1.5,
    color: '#77716A',
  },

  headline: {
    fontFamily:    'ArchivoBlack_400Regular',
    fontSize:      31,
    lineHeight:    36,
    letterSpacing: -1.1,
    color:         C.text,
  },
  sub: {
    fontFamily: 'Archivo_500Medium',
    fontSize:   14,
    lineHeight: 20,
    color:      C.mid,
    marginTop:  4,
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

  options:   { gap: 10, marginTop: 22 },
  option: {
    minHeight:         64,
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   '#F0ECE7',
    borderRadius:      17,
    paddingVertical:   16,
    paddingHorizontal: 18,
  },
  appleOption: { backgroundColor: C.text },
  optionIcon: {
    width:          28,
    alignItems:     'center',
    justifyContent: 'center',
    marginRight:    13,
  },
  optionText: {
    flex:       1,
    fontFamily: 'Archivo_600SemiBold',
    fontSize:   16,
    color:      C.text,
  },
  appleOptionText: { color: '#FFFFFF' },

  legal: {
    fontSize:   12,
    lineHeight: 17,
    color:      C.mid,
    textAlign:  'center',
    marginTop:  18,
  },
  legalLink: {
    color:      C.text,
    fontWeight: '600',
  },
});
