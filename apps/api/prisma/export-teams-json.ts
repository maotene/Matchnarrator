import { PrismaClient } from '@prisma/client';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

type TeamRow = {
  name: string;
  shortName: string | null;
  logo: string | null;
  city: string | null;
};

function rootPath(...parts: string[]) {
  return join(__dirname, '..', '..', '..', ...parts);
}

function cleanTeam(team: TeamRow) {
  return {
    name: team.name,
    shortName: team.shortName ?? undefined,
    logo: team.logo ?? undefined,
    city: team.city ?? undefined,
  };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const teams = await prisma.team.findMany({
      select: {
        name: true,
        shortName: true,
        logo: true,
        city: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    const compactTeams = teams.map(cleanTeam);

    const teamsOnlyPath = rootPath('data', 'manual-import', 'teams-from-db.json');
    mkdirSync(dirname(teamsOnlyPath), { recursive: true });
    writeFileSync(
      teamsOnlyPath,
      `${JSON.stringify({ teams: compactTeams }, null, 2)}\n`,
      'utf-8',
    );

    const baseSeasonPath = rootPath(
      'data',
      'manual-import',
      'ecuador-serie-a-2026-ficticio-real.json',
    );
    const outputSeasonPath = rootPath(
      'data',
      'manual-import',
      'ecuador-serie-a-2026-ficticio-real.teams-updated.json',
    );

    const raw = readFileSync(baseSeasonPath, 'utf-8');
    const payload = JSON.parse(raw);
    payload.teams = compactTeams;
    writeFileSync(outputSeasonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');

    console.log(`Export OK: ${teams.length} teams`);
    console.log(`- ${teamsOnlyPath}`);
    console.log(`- ${outputSeasonPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Export failed:', error);
  process.exit(1);
});
