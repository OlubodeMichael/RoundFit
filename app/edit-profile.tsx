import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { EditProfileModal } from '@/components/profile/EditProfileModal';

/** Legacy route — opens the same bottom sheet as the profile screen. */
export default function EditProfileScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!visible) router.back();
  }, [visible, router]);

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <EditProfileModal visible={visible} onClose={() => setVisible(false)} />
    </View>
  );
}
