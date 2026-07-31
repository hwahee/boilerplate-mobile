/**
 * Navigation ref — the ONLY way to navigate from outside the React tree.
 *
 * Voice commands arrive on `Linking` events, not from a component, so
 * src/voice needs a handle on the navigator. Screens must keep using
 * `useNavigation()`/`route.params`; this ref exists for OS-originated events
 * (voice today, notification taps if they ever need more than the linking
 * config can express).
 */
import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();
