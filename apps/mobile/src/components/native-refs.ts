/**
 * Instance types of the host components a ref points at.
 *
 * Since React Native 0.88 `View` / `ScrollView` are typed as function
 * components, so the component name is no longer the instance type
 * (`useRef<View>` stopped compiling). `ComponentRef` reads the instance type
 * from each component's `ref` prop instead — the form React's types expect.
 */
import type { ComponentRef } from 'react';
import type { ScrollView, View } from 'react-native';

export type ViewInstance = ComponentRef<typeof View>;
export type ScrollViewInstance = ComponentRef<typeof ScrollView>;
