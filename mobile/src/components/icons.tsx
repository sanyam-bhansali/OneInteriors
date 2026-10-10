import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** The web app's icons (src/components/app/ui.tsx), drawn the same way. */

type P = { color: ColorValue; size?: number };
const s = (color: ColorValue) => ({ fill: 'none', stroke: color, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

export const HomeIcon = ({ color, size = 22 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M4 11 12 4l8 7v8.5a.5.5 0 0 1-.5.5H15v-6H9v6H4.5a.5.5 0 0 1-.5-.5Z" {...s(color)} />
  </Svg>
);
export const ListIcon = ({ color, size = 22 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M5 7h14M5 12h10M5 17h7" {...s(color)} />
  </Svg>
);
export const CameraIcon = ({ color, size = 22 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.5-2h5L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z" {...s(color)} />
    <Circle cx="12" cy="13" r="3.5" {...s(color)} />
  </Svg>
);
export const CheckIcon = ({ color, size = 22 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Rect x="4.5" y="4.5" width="15" height="15" rx="2" {...s(color)} />
    <Path d="m8.5 12 2.5 2.5 4.5-5" {...s(color)} />
  </Svg>
);
export const FolderIcon = ({ color, size = 22 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M4 7.5A1.5 1.5 0 0 1 5.5 6H10l2 2h6.5A1.5 1.5 0 0 1 20 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z" {...s(color)} />
  </Svg>
);
export const BellIcon = ({ color, size = 20 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15Z" {...s(color)} />
    <Path d="M10 20a2 2 0 0 0 4 0" {...s(color)} />
  </Svg>
);
export const ArrowIcon = ({ color, size = 18 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 18 18">
    <Path d="M3.5 9h11M10 4.5 14.5 9 10 13.5" {...s(color)} />
  </Svg>
);
export const BackIcon = ({ color, size = 22 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 20 20">
    <Path d="M12.5 4.5 7 10l5.5 5.5" {...s(color)} />
  </Svg>
);
export const PersonIcon = ({ color, size = 22 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx="12" cy="8.5" r="3.5" {...s(color)} />
    <Path d="M5 19.5c1.2-3.2 3.8-5 7-5s5.8 1.8 7 5" {...s(color)} />
  </Svg>
);
