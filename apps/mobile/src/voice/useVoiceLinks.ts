/**
 * Subscribes the app to voice deep links, for both delivery paths:
 *
 *   cold start  the OS hands over the launch URL — `getInitialURL()`
 *   warm        the app is already running — the `url` event
 *
 * Warm delivery is the one that matters while driving: the assistant reaches
 * an app that is already open, so the command runs in milliseconds with no
 * bundle load. Cold start still works, it is just the slow path.
 *
 * React Navigation's linking config reads the same URLs; the two do not
 * conflict, because `voice/…` paths match no route (see ../navigation/linking).
 */
import { useEffect } from 'react';
import * as Linking from 'expo-linking';

import { handleVoiceUrl } from './handlers';

export function useVoiceLinks(): void {
  useEffect(() => {
    let active = true;

    void Linking.getInitialURL().then((url) => {
      if (active && url) handleVoiceUrl(url);
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleVoiceUrl(url);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
}
