import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  ImageSourcePropType,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import { useReduceMotion } from '@/hooks/use-reduce-motion';
import type { Directive } from '@/types/daily-coaching';

export type MascotAction =
  | 'idle'
  | 'wave'
  | 'celebrate'
  | 'recoveryNudge'
  | 'sleepy';

type SpriteActionConfig = {
  fps: number;
  loop: boolean;
  frames: ImageSourcePropType[];
};

const SPRITES: Record<MascotAction, SpriteActionConfig> = {
  idle: {
    fps: 5,
    loop: true,
    frames: [
      require('../../assets/mascot/sprites/idle/00.png'),
      require('../../assets/mascot/sprites/idle/01.png'),
      require('../../assets/mascot/sprites/idle/02.png'),
      require('../../assets/mascot/sprites/idle/03.png'),
      require('../../assets/mascot/sprites/idle/04.png'),
      require('../../assets/mascot/sprites/idle/05.png'),
      require('../../assets/mascot/sprites/idle/06.png'),
      require('../../assets/mascot/sprites/idle/07.png'),
    ],
  },
  wave: {
    fps: 8,
    loop: false,
    frames: [
      require('../../assets/mascot/sprites/wave/00.png'),
      require('../../assets/mascot/sprites/wave/01.png'),
      require('../../assets/mascot/sprites/wave/02.png'),
      require('../../assets/mascot/sprites/wave/03.png'),
      require('../../assets/mascot/sprites/wave/04.png'),
      require('../../assets/mascot/sprites/wave/05.png'),
      require('../../assets/mascot/sprites/wave/06.png'),
      require('../../assets/mascot/sprites/wave/07.png'),
    ],
  },
  celebrate: {
    fps: 10,
    loop: false,
    frames: [
      require('../../assets/mascot/sprites/celebrate/00.png'),
      require('../../assets/mascot/sprites/celebrate/01.png'),
      require('../../assets/mascot/sprites/celebrate/02.png'),
      require('../../assets/mascot/sprites/celebrate/03.png'),
      require('../../assets/mascot/sprites/celebrate/04.png'),
      require('../../assets/mascot/sprites/celebrate/05.png'),
      require('../../assets/mascot/sprites/celebrate/06.png'),
      require('../../assets/mascot/sprites/celebrate/07.png'),
    ],
  },
  recoveryNudge: {
    fps: 6,
    loop: false,
    frames: [
      require('../../assets/mascot/sprites/recovery-nudge/00.png'),
      require('../../assets/mascot/sprites/recovery-nudge/01.png'),
      require('../../assets/mascot/sprites/recovery-nudge/02.png'),
      require('../../assets/mascot/sprites/recovery-nudge/03.png'),
      require('../../assets/mascot/sprites/recovery-nudge/04.png'),
      require('../../assets/mascot/sprites/recovery-nudge/05.png'),
      require('../../assets/mascot/sprites/recovery-nudge/06.png'),
      require('../../assets/mascot/sprites/recovery-nudge/07.png'),
    ],
  },
  sleepy: {
    fps: 5,
    loop: true,
    frames: [
      require('../../assets/mascot/sprites/sleepy/00.png'),
      require('../../assets/mascot/sprites/sleepy/01.png'),
      require('../../assets/mascot/sprites/sleepy/02.png'),
      require('../../assets/mascot/sprites/sleepy/03.png'),
      require('../../assets/mascot/sprites/sleepy/04.png'),
      require('../../assets/mascot/sprites/sleepy/05.png'),
      require('../../assets/mascot/sprites/sleepy/06.png'),
      require('../../assets/mascot/sprites/sleepy/07.png'),
    ],
  },
};

export function actionFromDirective(directive: Directive): MascotAction {
  switch (directive) {
    case 'rest':
      return 'sleepy';
    case 'light':
      return 'recoveryNudge';
    case 'moderate':
      return 'idle';
    case 'train_hard':
      return 'celebrate';
  }
}

export function actionFromReadinessRecommendation(
  recommendation: string | null | undefined,
): MascotAction {
  switch (recommendation) {
    case 'Train hard':
      return 'celebrate';
    case 'Moderate':
      return 'idle';
    case 'Light workout':
      return 'recoveryNudge';
    case 'Rest':
      return 'sleepy';
    default:
      return 'idle';
  }
}

export interface LivingMascotProps {
  action?: MascotAction;
  fallbackAction?: MascotAction;
  size?: number;
  style?: StyleProp<ViewStyle>;
  onActionEnd?: () => void;
}

export function LivingMascot({
  action = 'idle',
  fallbackAction = 'idle',
  size = 72,
  style,
  onActionEnd,
}: LivingMascotProps) {
  const reduceMotion = useReduceMotion();
  const [activeAction, setActiveAction] = useState(action);
  const [frame, setFrame] = useState(0);
  const onActionEndRef = useRef(onActionEnd);
  const endedRef = useRef(false);
  onActionEndRef.current = onActionEnd;

  const config = SPRITES[activeAction];
  const fallbackConfig = SPRITES[fallbackAction];

  useEffect(() => {
    setActiveAction(action);
  }, [action]);

  useEffect(() => {
    setFrame(0);
    endedRef.current = false;
    if (reduceMotion || config.frames.length <= 1) return;

    const intervalMs = 1000 / config.fps;
    const timer = setInterval(() => {
      setFrame((prev) => {
        const next = prev + 1;
        if (next < config.frames.length) return next;
        if (config.loop) return 0;

        if (!endedRef.current) {
          endedRef.current = true;
          onActionEndRef.current?.();
          setActiveAction(fallbackAction);
        }
        return config.frames.length - 1;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [
    activeAction,
    config.fps,
    config.frames.length,
    config.loop,
    fallbackAction,
    reduceMotion,
  ]);

  const source = useMemo(() => {
    if (reduceMotion) return fallbackConfig.frames[0];
    return config.frames[frame] ?? config.frames[0];
  }, [config.frames, fallbackConfig.frames, frame, reduceMotion]);

  return (
    <View
      pointerEvents="none"
      style={[s.wrap, { width: size, height: size }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Image source={source} resizeMode="contain" style={s.image} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
