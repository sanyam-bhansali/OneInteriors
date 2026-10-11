import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * Line icons only Home and Notifications use, drawn from the 10 Oct design
 * files (Main.dc.html, Notifications.dc.html): 24-unit boxes, round caps,
 * a 1.8 stroke.
 */

type P = { color: ColorValue; size?: number; fill?: ColorValue };
const s = (color: ColorValue, w = 1.8) => ({ fill: 'none', stroke: color, strokeWidth: w, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

export const HOUSE = 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z';

/** The house of the "Updated from site" chip; `fill` lights it up. */
export const HouseMark = ({ color, size = 16, fill = 'none' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d={HOUSE} {...s(color)} fill={fill} />
  </Svg>
);

export const BellMark = ({ color, size = 20 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" {...s(color, 1.75)} />
    <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" {...s(color, 1.75)} />
  </Svg>
);

export const ChevronBack = ({ color, size = 22 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="m15 18-6-6 6-6" {...s(color)} />
  </Svg>
);

export const ArrowMark = ({ color, size = 14 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 18 18">
    <Path d="M3.5 9h11M10 4.5 14.5 9 10 13.5" {...s(color, 1.7)} />
  </Svg>
);

export const CameraMark = ({ color, size = 19 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" {...s(color)} />
    <Circle cx="12" cy="13" r="3.5" {...s(color)} />
  </Svg>
);

export const CalendarMark = ({ color, size = 19 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Rect x="3" y="5" width="18" height="16" rx="2" {...s(color)} />
    <Path d="M3 10h18M8 3v4M16 3v4" {...s(color)} />
  </Svg>
);

export const ChatMark = ({ color, size = 19 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M21 12a8 8 0 0 1-11.8 7L4 20l1.1-4.6A8 8 0 1 1 21 12z" {...s(color)} />
  </Svg>
);

export const TickMark = ({ color, size = 19 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M9 11l3 3 8-8" {...s(color)} />
    <Path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" {...s(color)} />
  </Svg>
);

export const LinesMark = ({ color, size = 19 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M4 6h16M4 12h10M4 18h6" {...s(color)} />
  </Svg>
);

export const FolderMark = ({ color, size = 19 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" {...s(color)} />
  </Svg>
);
