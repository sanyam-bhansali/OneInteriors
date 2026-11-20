import type { Metadata } from 'next';
import { Container } from '@/components/ui';
import { OpsHeader } from '../ui';
import { requireRole } from '@/modules/auth/session';
import { opsWithoutAuth } from '@/lib/env';
import { defaultCoverageRules } from '@/modules/aftercare/coverage-ops';
import { RuleForm } from './RuleForm';

export const metadata: Metadata = { title: 'Warranty rules · Ops' };
export const dynamic = 'force-dynamic';

/**
 * What the warranty covers (owner, 20 Nov 2026; docs/studio-os/AFTERCARE.md).
 * A client's warranty claim is checked against these areas: the photo reader
 * names the area, and "Covered" decides. A covered claim becomes a warranty
 * snag; any other gets the automatic "not covered" reply and is sent to the
 * service visit named here. Seeded from Hauspire's agreement, clause 5.
 */
export default async function WarrantyRulesPage() {
  if (!opsWithoutAuth()) await requireRole('OPS');
  const rules = await defaultCoverageRules();
  return (
    <>
      <OpsHeader />
      <main className="py-10">
        <Container size="wide">
          <h1 className="m-0 text-[28px]">Warranty rules</h1>
          <p className="m-0 mt-2 max-w-3xl text-[14px] leading-relaxed text-[var(--color-ink-2)]">
            Every warranty claim is checked against these areas, straight away and with no one reviewing it: the photo reader picks
            the area from the client&apos;s photos, and <strong>Covered</strong> decides whether a snag is raised. A change applies to
            new claims only. Switch a rule off rather than rewriting it into something else, so past claims keep their meaning.
          </p>
          <div className="mt-6 flex max-w-4xl flex-col gap-3">
            {rules.map((r) => (
              <RuleForm
                key={r.id}
                id={r.id}
                claims={r.claims}
                initial={{
                  key: r.key,
                  label: r.label,
                  examples: r.examples,
                  covered: r.covered,
                  serviceCategory: r.serviceCategory ?? 'CARPENTRY',
                  sortOrder: String(r.sortOrder),
                  clientNote: r.clientNote ?? '',
                  active: r.active,
                }}
              />
            ))}
            <h2 className="m-0 mt-4 text-[18px]">Add a rule</h2>
            <RuleForm id={null} />
          </div>
        </Container>
      </main>
    </>
  );
}
