/**
 * Chrome helpers for a screen that may be presented as an iOS sheet.
 *
 * `useSafeAreaInsets()` reports the *window* insets even inside a native modal,
 * so a sheet would pick up ~59pt of phantom status-bar padding at the top. A
 * native stack also renders its first screen as a full-screen card regardless of
 * `presentation`, so "not the first route in the stack" is the reliable signal
 * that this screen is actually sitting in a sheet.
 */
import { useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface SheetPresentation {
  /** True when this screen is stacked above another one, i.e. shown as a sheet. */
  presentedAsSheet: boolean;
  /** Top safe-area inset to apply — always 0 inside a sheet. */
  topInset: number;
}

export function useSheetPresentation(): SheetPresentation {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const presentedAsSheet = (navigation.getState()?.index ?? 0) > 0;
  return { presentedAsSheet, topInset: presentedAsSheet ? 0 : insets.top };
}
