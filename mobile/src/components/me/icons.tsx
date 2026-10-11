import type { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * The line icons Me, the Locker and account deletion use (Me.dc.html,
 * Locker.dc.html): 24-unit boxes, a 1.8 stroke, round caps and joins.
 */

type P = { color: ColorValue; size?: number };
const s = (color: ColorValue) => ({ fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

export const ChevronIcon = ({ color, size = 18 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="m9 6 6 6-6 6" {...s(color)} />
  </Svg>
);
export const LockerIcon = ({ color, size = 18 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M4 20h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-8l-2-3H4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1z" {...s(color)} />
  </Svg>
);
export const BellLineIcon = ({ color, size = 18 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" {...s(color)} />
    <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" {...s(color)} />
  </Svg>
);
export const MailIcon = ({ color, size = 18 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" {...s(color)} />
    <Path d="m3.5 6.5 8.5 6.5 8.5-6.5" {...s(color)} />
  </Svg>
);
export const QuestionIcon = ({ color, size = 18 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx="12" cy="12" r="9" {...s(color)} />
    <Path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5V14M12 17.5v.01" {...s(color)} />
  </Svg>
);
export const ShieldIcon = ({ color, size = 18 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" {...s(color)} />
    <Path d="m9 12 2 2 4-4" {...s(color)} />
  </Svg>
);
export const TrashIcon = ({ color, size = 18 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 12a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1l1-12M9 7V4h6v3" {...s(color)} />
  </Svg>
);
export const LogoutIcon = ({ color, size = 18 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11" {...s(color)} />
  </Svg>
);
export const SearchIcon = ({ color, size = 18 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx="11" cy="11" r="7" {...s(color)} />
    <Path d="m20 20-3.5-3.5" {...s(color)} />
  </Svg>
);
export const DocArrowIcon = ({ color, size = 16 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 18 18">
    <Path d="M3.5 9h11M10 4.5 14.5 9 10 13.5" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
export const TickIcon = ({ color, size = 16 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="m5 12.5 4.5 4.5L19 7.5" {...s(color)} strokeWidth={2.4} />
  </Svg>
);
