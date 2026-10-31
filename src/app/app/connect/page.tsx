import type { Metadata } from 'next';
import { ConnectForm } from './ConnectForm';

export const metadata: Metadata = { title: 'Connect your project', robots: { index: false, follow: false } };

export default function AppConnect() {
  return (
    <div className="oa-frame">
      <ConnectForm />
    </div>
  );
}
