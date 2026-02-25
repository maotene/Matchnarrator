# DB Sync Guide (Import + Current Season)

Este proyecto tenía desalineación entre:
- `apps/api/prisma/schema.prisma`
- Prisma Client generado
- Estructura real de PostgreSQL

Síntomas típicos:
- `FixtureMatch.externalId does not exist`
- `Cannot read properties of undefined (reading 'findMany')` en `seasonStanding`
- Errores por `roundLabel` en `fixtureMatch`

## 1) Backup (obligatorio)

Desde la raíz del proyecto:

```bash
mkdir -p backups
pg_dump "$DATABASE_URL" > "backups/matchnarrator_$(date +%Y%m%d_%H%M%S).sql"
```

Si no tienes `DATABASE_URL` exportada:

```bash
set -a
source apps/api/.env
set +a
mkdir -p backups
pg_dump "$DATABASE_URL" > "backups/matchnarrator_$(date +%Y%m%d_%H%M%S).sql"
```

## 2) Aplicar patch SQL idempotente (sin perder data)

Este patch crea/ajusta lo mínimo para que el import funcione:
- columnas faltantes en `FixtureMatch`
- índice único parcial en `FixtureMatch.externalId`
- tabla `SeasonStanding` + constraints/índices

Comando:

```bash
set -a
source apps/api/.env
set +a
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/prisma/sql/20260224_sync_import_schema.sql
```

## 3) Regenerar Prisma Client y compilar API

```bash
pnpm --filter api prisma:generate
pnpm --filter api build
```

## 4) Reiniciar API

Dev:

```bash
pnpm --filter api dev
```

Prod:

```bash
pnpm --filter api start:prod
```

## 5) Verificación rápida

```bash
set -a
source apps/api/.env
set +a
psql "$DATABASE_URL" -c '\\d "FixtureMatch"'
psql "$DATABASE_URL" -c '\\d "SeasonStanding"'
```

Debes ver en `FixtureMatch`:
- `externalId`
- `roundLabel`
- `statusShort`, `statusLong`
- `homeScore`, `awayScore`
- `isFinished`

## 6) Camino recomendado a futuro (migraciones formales)

Ahora mismo el fix SQL te desbloquea sin resetear datos.  
Luego, conviene normalizar con migraciones Prisma versionadas.

Pasos recomendados para entorno dev limpio:

```bash
pnpm --filter api prisma:migrate --name baseline_schema
pnpm --filter api prisma:generate
```

Si Prisma detecta drift irreconciliable en local y te propone reset, hazlo solo en DB de desarrollo.

