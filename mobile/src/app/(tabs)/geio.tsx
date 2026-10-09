import { AppWebView } from '../web';

/** GEIO, the orb in the middle of the tab bar (v79). The conversation lives on the website's /app/geio. */
export default function GeioTab() {
  return <AppWebView path="/app/geio" title="GEIO" />;
}
