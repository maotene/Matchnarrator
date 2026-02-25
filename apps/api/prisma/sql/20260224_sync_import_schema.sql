-- Sync mínimo para soporte de importación manual/full-season
-- Seguro para ejecutar múltiples veces (idempotente).
-- PostgreSQL

BEGIN;

-- =========================================================
-- FixtureMatch: columnas esperadas por el servicio
-- =========================================================

ALTER TABLE "FixtureMatch"
  ADD COLUMN IF NOT EXISTS "externalId" INTEGER,
  ADD COLUMN IF NOT EXISTS "roundLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "statusShort" TEXT,
  ADD COLUMN IF NOT EXISTS "statusLong" TEXT,
  ADD COLUMN IF NOT EXISTS "homeScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "awayScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "isFinished" BOOLEAN NOT NULL DEFAULT false;

-- Unique parcial para externalId (permite NULL)
CREATE UNIQUE INDEX IF NOT EXISTS "FixtureMatch_externalId_key"
  ON "FixtureMatch" ("externalId")
  WHERE "externalId" IS NOT NULL;

-- =========================================================
-- SeasonStanding: tabla usada por standings de temporada
-- =========================================================

CREATE TABLE IF NOT EXISTS "SeasonStanding" (
  "id" TEXT PRIMARY KEY,
  "seasonId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "groupName" TEXT NOT NULL DEFAULT '',
  "rank" INTEGER NOT NULL,
  "points" INTEGER NOT NULL,
  "played" INTEGER NOT NULL,
  "won" INTEGER NOT NULL,
  "draw" INTEGER NOT NULL,
  "lost" INTEGER NOT NULL,
  "goalsFor" INTEGER NOT NULL,
  "goalsAgainst" INTEGER NOT NULL,
  "goalsDiff" INTEGER NOT NULL,
  "form" TEXT,
  "status" TEXT,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SeasonStanding_seasonId_fkey'
  ) THEN
    ALTER TABLE "SeasonStanding"
      ADD CONSTRAINT "SeasonStanding_seasonId_fkey"
      FOREIGN KEY ("seasonId") REFERENCES "Season"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SeasonStanding_teamId_fkey'
  ) THEN
    ALTER TABLE "SeasonStanding"
      ADD CONSTRAINT "SeasonStanding_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "Team"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "SeasonStanding_seasonId_teamId_groupName_key"
  ON "SeasonStanding" ("seasonId", "teamId", "groupName");

CREATE INDEX IF NOT EXISTS "SeasonStanding_seasonId_rank_idx"
  ON "SeasonStanding" ("seasonId", "rank");

COMMIT;
