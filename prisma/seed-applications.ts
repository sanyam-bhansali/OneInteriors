/**
 * Seed the two studios we invited directly.
 *
 * These are real Pune businesses, and they did **not** fill in the form — we
 * put them in the queue ourselves after being asked to onboard them. So
 * `howHeard` says exactly that, and the contact details are the ones published
 * on their own websites rather than anything we were given privately. Ops still
 * has to approve them like anyone else, and nothing here grants a tier.
 *
 *   npx tsx prisma/seed-applications.ts
 *
 * Idempotent: re-running updates the existing row rather than making a second.
 */

import { PrismaClient } from '@prisma/client';
import { lakhsToPaise } from '../src/lib/money';

const prisma = new PrismaClient();

const INVITED = [
  {
    tradeName: 'Hauspire',
    legalName: 'Hauspire Pvt Ltd',
    // Published on hauspire.com — we have not confirmed who the right person is.
    contactName: 'Hauspire studio (contact to confirm)',
    email: 'info@hauspire.com',
    phone: '+917666645800',
    website: 'https://hauspire.com',
    instagram: '@hauspiredesignstudio',
    localities: ['baner', 'wakad', 'hinjewadi', 'kharadi', 'kothrud', 'viman-nagar'],
    minLakhs: 3.5,
    maxLakhs: 25,
    about:
      'Designs in its own studio and manufactures in its own modular factory in Balewadi rather than sub-contracting the build. Publishes a fixed itemised price, a 45-day handover counted from design sign-off, and a ten-year written warranty.',
  },
  {
    tradeName: 'Urbanline Interiors',
    legalName: null,
    contactName: 'Urbanline studio (contact to confirm)',
    email: 'connect@urbanlineinteriors.com',
    phone: '+917558351003',
    // Note: urbanlineinterior.com (singular) does not resolve — the live site
    // is the plural domain.
    website: 'https://urbanlineinteriors.com',
    instagram: '@urbanlineinteriors',
    localities: ['baner', 'wakad', 'hinjewadi', 'kharadi', 'kothrud', 'viman-nagar'],
    minLakhs: 6,
    maxLakhs: 20,
    about:
      'Full home interiors, modular kitchens and renovation across Pune and Pimpri-Chinchwad, run out of Punawale since 2016. Advertises a ten-year warranty, on-time delivery and Vastu-compliant layouts, with packages from ₹6 lakh.',
  },
] as const;

async function main() {
  for (const studio of INVITED) {
    const existing = await prisma.studioApplication.findFirst({
      where: { email: studio.email },
      orderBy: { createdAt: 'desc' },
    });

    const data = {
      tradeName: studio.tradeName,
      legalName: studio.legalName,
      contactName: studio.contactName,
      email: studio.email,
      phone: studio.phone,
      website: studio.website,
      instagram: studio.instagram,
      localities: [...studio.localities],
      minProjectPaise: BigInt(lakhsToPaise(studio.minLakhs)),
      maxProjectPaise: BigInt(lakhsToPaise(studio.maxLakhs)),
      about: studio.about,
      // The honest provenance. Never let a seeded row look self-submitted.
      howHeard: 'Invited directly by One Interiors — seeded by ops, not self-applied',
    };

    if (existing) {
      await prisma.studioApplication.update({ where: { id: existing.id }, data });
      console.log(`updated  ${studio.tradeName}`);
    } else {
      await prisma.studioApplication.create({ data });
      console.log(`created  ${studio.tradeName}`);
    }
  }

  const waiting = await prisma.studioApplication.count({
    where: { status: { in: ['SUBMITTED', 'REVIEWING'] } },
  });
  console.log(`\n${waiting} application(s) waiting in /ops/applications`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
