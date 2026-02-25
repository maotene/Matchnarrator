import { PrismaClient, UserRole, PlayerPosition } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Clean up existing data (optional - comment out if you don't want to reset)
  await prisma.matchEvent.deleteMany();
  await prisma.matchRosterPlayer.deleteMany();
  await prisma.matchSession.deleteMany();
  await prisma.playerSeason.deleteMany();
  await prisma.teamSeason.deleteMany();
  await prisma.player.deleteMany();
  await prisma.team.deleteMany();
  await prisma.season.deleteMany();
  await prisma.competition.deleteMany();
  await prisma.user.deleteMany();

  console.log('🗑️  Cleaned up existing data');

  // Create users
  const adminPassword = await bcrypt.hash('Admin123!', 10);
  const narratorPassword = await bcrypt.hash('Narrador123!', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      password: adminPassword,
      name: 'Super Admin',
      role: UserRole.SUPERADMIN,
    },
  });

  const narrator = await prisma.user.create({
    data: {
      email: 'narrador@example.com',
      password: narratorPassword,
      name: 'Juan Narrador',
      role: UserRole.NARRADOR,
    },
  });

  console.log('✅ Created users');

  // Create competition
  const competition = await prisma.competition.create({
    data: {
      name: 'Liga Profesional Argentina',
      country: 'Argentina',
      logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Liga_Profesional_de_F%C3%BAtbol_2022.svg/1200px-Liga_Profesional_de_F%C3%BAtbol_2022.svg.png',
    },
  });

  console.log('✅ Created competition');

  // Create season
  const currentYear = new Date().getFullYear();
  const season = await prisma.season.create({
    data: {
      name: String(currentYear),
      competitionId: competition.id,
      startDate: new Date(`${currentYear}-01-15`),
      endDate: new Date(`${currentYear}-12-15`),
    },
  });

  console.log('✅ Created season');

  // Create teams
  const bocaJuniors = await prisma.team.create({
    data: {
      name: 'Boca Juniors',
      shortName: 'BOCA',
      logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/CABJ_Logo.svg/1200px-CABJ_Logo.svg.png',
      city: 'Buenos Aires',
    },
  });

  const riverPlate = await prisma.team.create({
    data: {
      name: 'River Plate',
      shortName: 'RIVER',
      logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Escudo_del_C_A_River_Plate.svg/1200px-Escudo_del_C_A_River_Plate.svg.png',
      city: 'Buenos Aires',
    },
  });

  console.log('✅ Created teams');

  // Create TeamSeasons
  const bocaSeason = await prisma.teamSeason.create({
    data: {
      teamId: bocaJuniors.id,
      seasonId: season.id,
    },
  });

  const riverSeason = await prisma.teamSeason.create({
    data: {
      teamId: riverPlate.id,
      seasonId: season.id,
    },
  });

  console.log('✅ Created team seasons');

  // Create Boca Juniors players
  const bocaPlayers = [
    { firstName: 'Sergio', lastName: 'Romero', position: PlayerPosition.GK, number: 1 },
    { firstName: 'Luis', lastName: 'Advíncula', position: PlayerPosition.DF, number: 17 },
    { firstName: 'Marcos', lastName: 'Rojo', position: PlayerPosition.DF, number: 6 },
    { firstName: 'Nicolás', lastName: 'Figal', position: PlayerPosition.DF, number: 4 },
    { firstName: 'Frank', lastName: 'Fabra', position: PlayerPosition.DF, number: 18 },
    { firstName: 'Cristian', lastName: 'Medina', position: PlayerPosition.MF, number: 36 },
    { firstName: 'Pol', lastName: 'Fernández', position: PlayerPosition.MF, number: 8 },
    { firstName: 'Ezequiel', lastName: 'Fernández', position: PlayerPosition.MF, number: 21 },
    { firstName: 'Exequiel', lastName: 'Zeballos', position: PlayerPosition.FW, number: 20 },
    { firstName: 'Miguel', lastName: 'Merentiel', position: PlayerPosition.FW, number: 16 },
    { firstName: 'Edinson', lastName: 'Cavani', position: PlayerPosition.FW, number: 10 },
  ];

  for (const playerData of bocaPlayers) {
    const player = await prisma.player.create({
      data: {
        firstName: playerData.firstName,
        lastName: playerData.lastName,
        position: playerData.position,
        nationality: 'Argentina',
      },
    });

    await prisma.playerSeason.create({
      data: {
        playerId: player.id,
        teamSeasonId: bocaSeason.id,
        jerseyNumber: playerData.number,
      },
    });
  }

  console.log('✅ Created Boca Juniors players');

  // Create River Plate players
  const riverPlayers = [
    { firstName: 'Franco', lastName: 'Armani', position: PlayerPosition.GK, number: 1 },
    { firstName: 'Milton', lastName: 'Casco', position: PlayerPosition.DF, number: 20 },
    { firstName: 'Paulo', lastName: 'Díaz', position: PlayerPosition.DF, number: 17 },
    { firstName: 'Leandro', lastName: 'González Pirez', position: PlayerPosition.DF, number: 14 },
    { firstName: 'Enzo', lastName: 'Díaz', position: PlayerPosition.DF, number: 13 },
    { firstName: 'Enzo', lastName: 'Pérez', position: PlayerPosition.MF, number: 24 },
    { firstName: 'Nicolás', lastName: 'De la Cruz', position: PlayerPosition.MF, number: 11 },
    { firstName: 'Rodrigo', lastName: 'Aliendro', position: PlayerPosition.MF, number: 29 },
    { firstName: 'Esequiel', lastName: 'Barco', position: PlayerPosition.FW, number: 21 },
    { firstName: 'Lucas', lastName: 'Beltrán', position: PlayerPosition.FW, number: 19 },
    { firstName: 'Miguel', lastName: 'Borja', position: PlayerPosition.FW, number: 9 },
  ];

  for (const playerData of riverPlayers) {
    const player = await prisma.player.create({
      data: {
        firstName: playerData.firstName,
        lastName: playerData.lastName,
        position: playerData.position,
        nationality: 'Argentina',
      },
    });

    await prisma.playerSeason.create({
      data: {
        playerId: player.id,
        teamSeasonId: riverSeason.id,
        jerseyNumber: playerData.number,
      },
    });
  }

  console.log('✅ Created River Plate players');

  console.log('🎉 Seed completed successfully!');
  console.log('\n📝 Test credentials:');
  console.log('   SUPERADMIN: admin@example.com / Admin123!');
  console.log('   NARRADOR: narrador@example.com / Narrador123!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
