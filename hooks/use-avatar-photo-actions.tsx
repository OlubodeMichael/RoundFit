import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState, type ReactNode } from 'react';
import {
  Alert,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppModal } from '@/components/ui/AppModal';
import { useTheme } from '@/hooks/use-theme';
import {
  deleteAvatar,
  pickAndUploadAvatar,
  takeAndUploadAvatar,
} from '@/utils/avatar';

// ── Palette ──────────────────────────────────────────────────────────────────

function usePalette() {
  const { isDark } = useTheme();
  return isDark
    ? {
        card:   '#1C1D23',
        sunken: '#0E0F13',
        edge:   'rgba(255,255,255,0.08)',
        hair:   'rgba(255,255,255,0.06)',
        text:   '#F4F4F5',
        dim:    '#909096',
        faint:  '#505058',
        accent: '#F97316',
      }
    : {
        card:   '#FFFFFF',
        sunken: '#F7F7F9',
        edge:   'rgba(0,0,0,0.06)',
        hair:   'rgba(0,0,0,0.05)',
        text:   '#09090B',
        dim:    '#6B7280',
        faint:  '#C0C0C8',
        accent: '#F97316',
      };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface UseAvatarPhotoActionsOptions {
  avatarUrl:    string | null;
  avatarLetter: string;
  name?:        string;
  /** Called with the new URL after an upload, or null after a remove. */
  onUpdated:    (url: string | null) => void;
}

export interface UseAvatarPhotoActions {
  /** Opens the avatar options sheet (AppModal, opens to the middle). */
  present:   () => void;
  /** True while an upload/remove is in flight (drive the avatar spinner). */
  uploading: boolean;
  /** Render once in the tree: the options modal + full-screen viewer. */
  overlay:   ReactNode;
}

/**
 * Avatar photo actions — Choose from Library / Take Photo / View / Remove.
 *
 * Presented in the `AppModal` bottom sheet (opens to the middle) with a grouped
 * list of options. Shared by the home header avatar and the profile screen so
 * both behave identically.
 */
export function useAvatarPhotoActions({
  avatarUrl,
  avatarLetter,
  name,
  onUpdated,
}: UseAvatarPhotoActionsOptions): UseAvatarPhotoActions {
  const P = usePalette();
  const insets = useSafeAreaInsets();
  const [uploading, setUploading] = useState(false);
  const [viewing,   setViewing]   = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const close = useCallback(() => setSheetOpen(false), []);

  const runUpload = useCallback(async (upload: () => Promise<string | null>) => {
    try {
      setUploading(true);
      const url = await upload();
      if (!url) return; // user cancelled
      onUpdated(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Could not upload photo', msg || 'Please try again.');
    } finally {
      setUploading(false);
    }
  }, [onUpdated]);

  const removePhoto = useCallback(async () => {
    try {
      setUploading(true);
      await deleteAvatar();
      onUpdated(null); // optimistic — clears UI immediately
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Could not remove photo', msg || 'Please try again.');
    } finally {
      setUploading(false);
    }
  }, [onUpdated]);

  // Close the sheet first, then run (so the picker / viewer isn't covered).
  const closeThen = useCallback((fn: () => void) => {
    setSheetOpen(false);
    setTimeout(fn, 280);
  }, []);

  const present = useCallback(() => {
    if (uploading) return;
    setSheetOpen(true);
  }, [uploading]);

  // Shared body — avatar preview + grouped action rows.
  const body = (
    <>
      <View style={{ alignItems: 'center', paddingTop: 2, paddingBottom: 22 }}>
        <View style={[s.sheetAvatar, { borderColor: P.hair }]}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={s.sheetAvatarImg} resizeMode="cover" />
          ) : (
            <LinearGradient
              colors={['#FB923C', '#F97316', '#EA580C']}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={s.sheetAvatarGradient}
            >
              <Text style={s.sheetAvatarLetter}>{avatarLetter}</Text>
            </LinearGradient>
          )}
        </View>
        {!!name && <Text style={[s.sheetName, { color: P.text }]}>{name}</Text>}
        <Text style={[s.sheetSub, { color: P.dim }]}>Profile photo</Text>
      </View>

      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        <View style={[s.sheetGroup, { backgroundColor: P.card, borderColor: P.edge }]}>
          <TouchableOpacity
            style={s.sheetGroupRow}
            onPress={() => closeThen(() => runUpload(pickAndUploadAvatar))}
            activeOpacity={0.6}
          >
            <View style={[s.sheetGroupIcon, { backgroundColor: P.sunken }]}>
              <Ionicons name="image-outline" size={18} color={P.accent} />
            </View>
            <Text style={[s.sheetGroupLabel, { color: P.text }]}>Choose from Library</Text>
            <Ionicons name="chevron-forward" size={14} color={P.faint} />
          </TouchableOpacity>

          <View style={[s.sheetGroupDivider, { backgroundColor: P.hair }]} />

          <TouchableOpacity
            style={s.sheetGroupRow}
            onPress={() => closeThen(() => runUpload(takeAndUploadAvatar))}
            activeOpacity={0.6}
          >
            <View style={[s.sheetGroupIcon, { backgroundColor: P.sunken }]}>
              <Ionicons name="camera-outline" size={18} color={P.accent} />
            </View>
            <Text style={[s.sheetGroupLabel, { color: P.text }]}>Take Photo</Text>
            <Ionicons name="chevron-forward" size={14} color={P.faint} />
          </TouchableOpacity>

          {avatarUrl && (
            <>
              <View style={[s.sheetGroupDivider, { backgroundColor: P.hair }]} />
              <TouchableOpacity
                style={s.sheetGroupRow}
                onPress={() => closeThen(() => setViewing(true))}
                activeOpacity={0.6}
              >
                <View style={[s.sheetGroupIcon, { backgroundColor: P.sunken }]}>
                  <Ionicons name="eye-outline" size={18} color={P.dim} />
                </View>
                <Text style={[s.sheetGroupLabel, { color: P.text }]}>View Photo</Text>
                <Ionicons name="chevron-forward" size={14} color={P.faint} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {avatarUrl && (
          <View style={[s.sheetGroup, { backgroundColor: P.card, borderColor: P.edge }]}>
            <TouchableOpacity
              style={s.sheetGroupRow}
              onPress={() => closeThen(removePhoto)}
              activeOpacity={0.6}
            >
              <View style={[s.sheetGroupIcon, { backgroundColor: 'rgba(239,68,68,0.08)' }]}>
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </View>
              <Text style={[s.sheetGroupLabel, { color: '#EF4444' }]}>Remove Photo</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </>
  );

  const overlay = (
    <>
      <AppModal visible={sheetOpen} onClose={close} sheetHeight={avatarUrl ? 0.54 : 0.42}>
        {body}
      </AppModal>

      {/* Full-screen viewer (both platforms) */}
      <Modal
        visible={viewing}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setViewing(false)}
      >
        <StatusBar hidden />
        <View style={s.viewerBg}>
          <TouchableOpacity style={[s.viewerClose, { top: insets.top + 12 }]} onPress={() => setViewing(false)} hitSlop={12}>
            <View style={s.viewerCloseCircle}>
              <Ionicons name="close" size={20} color="#FFF" />
            </View>
          </TouchableOpacity>
          {avatarUrl && (
            <Image source={{ uri: avatarUrl }} style={s.viewerImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </>
  );

  return { present, uploading, overlay };
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  sheetAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 12,
  },
  sheetAvatarImg:      { width: 76, height: 76, borderRadius: 38 },
  sheetAvatarGradient: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  sheetAvatarLetter:   { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, color: '#FFF' },
  sheetName: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  sheetSub:  { fontSize: 13, marginTop: 3 },

  sheetGroup: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sheetGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  sheetGroupIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetGroupLabel:   { flex: 1, fontSize: 15, fontWeight: '500' },
  sheetGroupDivider: { height: StyleSheet.hairlineWidth, marginLeft: 60 },

  viewerBg: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerClose: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
  },
  viewerCloseCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: {
    width: '100%',
    height: '80%',
  },
});
