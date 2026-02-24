# NarratorMatchCenter

Sistema web fullstack para que narradores de fútbol registren eventos en tiempo real durante partidos.

## Características

- 🔐 Autenticación JWT con roles (SUPERADMIN, NARRADOR)
- 📊 Gestión de catálogos (competiciones, temporadas, equipos, jugadores)
- ⚽ Sesiones de partido con alineaciones interactivas
- 🎯 Posicionamiento visual de jugadores en cancha
- ⏱️ Timer en tiempo real con períodos
- ⌨️ Hotkeys para registro rápido de eventos
- 📈 Timeline de eventos con filtros
- 💾 Exportación de datos en JSON

## Tech Stack

### Backend
- NestJS 10+
- Prisma 5+ (ORM)
- PostgreSQL 15+
- JWT + Passport
- TypeScript

### Frontend
- Next.js 14+ (App Router)
- React 18+
- Tailwind CSS
- react-konva (Canvas interactivo)
- Zustand (State management)
- TypeScript

### Monorepo
- pnpm workspaces

## Estructura del Proyecto

```
matchnarrator/
├── apps/
│   ├── api/           # Backend NestJS
│   └── web/           # Frontend Next.js
├── packages/
│   └── shared/        # Tipos compartidos
├── docker-compose.yml
└── pnpm-workspace.yaml
```

## Setup Local

### Requisitos Previos

- Node.js 18+
- pnpm 8+
- Docker & Docker Compose

### Instalación

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd matchnarrator
```

2. **Instalar dependencias**
```bash
pnpm install
```

3. **Configurar variables de entorno**

Backend (`apps/api/.env`):
```bash
cp apps/api/.env.example apps/api/.env
# Editar apps/api/.env con tus valores
```

Frontend (`apps/web/.env.local`):
```bash
cp apps/web/.env.example apps/web/.env.local
# Editar apps/web/.env.local con tus valores
```

4. **Levantar PostgreSQL**
```bash
pnpm docker:up
```

5. **Migrar base de datos y seed**
```bash
pnpm prisma:migrate
pnpm prisma:seed
```

6. **Correr en desarrollo**
```bash
# Correr ambos (backend + frontend)
pnpm dev

# O correr individualmente
pnpm dev:api    # Backend en http://localhost:3001
pnpm dev:web    # Frontend en http://localhost:3000
```

## Usuarios de Prueba

Después de ejecutar el seed, puedes usar:

- **SUPERADMIN**
  - Email: `admin@example.com`
  - Password: `Admin123!`

- **NARRADOR**
  - Email: `narrador@example.com`
  - Password: `Narrador123!`

## Scripts Disponibles

```bash
# Desarrollo
pnpm dev              # Correr todo
pnpm dev:api          # Solo backend
pnpm dev:web          # Solo frontend

# Build
pnpm build            # Build todo
pnpm build:api        # Solo backend
pnpm build:web        # Solo frontend

# Testing
pnpm test             # Tests de todo
pnpm test:api         # Tests backend
pnpm test:web         # Tests frontend

# Database
pnpm prisma:migrate   # Ejecutar migraciones
pnpm prisma:studio    # Abrir Prisma Studio
pnpm prisma:seed      # Seed de datos

# Docker
pnpm docker:up        # Levantar PostgreSQL
pnpm docker:down      # Bajar PostgreSQL
```

## Uso

1. **Login**: Accede con tus credenciales en `http://localhost:3000/login`

2. **Dashboard**:
   - SUPERADMIN: Gestiona catálogos (competiciones, equipos, jugadores)
   - NARRADOR: Ve y crea partidos

3. **Match Center** (`/match/[id]`):
   - Posiciona jugadores en la cancha con drag & drop
   - Inicia el timer
   - Selecciona un jugador y usa hotkeys para registrar eventos:
     - `G` - Goal
     - `F` - Foul
     - `A` - Save (Atajada)
     - `O` - Offside
     - `P` - Pass
     - `C` - Substitution
     - `Y` - Yellow Card
     - `R` - Red Card
     - `S` - Shot
     - `K` - Corner
   - Ve la timeline de eventos en tiempo real
   - Exporta el partido completo en JSON

## Arquitectura

### Backend (NestJS)

Módulos principales:
- **auth**: Autenticación JWT
- **users**: Gestión de usuarios
- **competitions**: Catálogo de competiciones
- **seasons**: Catálogo de temporadas
- **teams**: Catálogo de equipos
- **players**: Catálogo de jugadores
- **matches**: Sesiones de partido
- **roster**: Alineaciones de partido
- **events**: Eventos de partido
- **export**: Exportación de datos

### Frontend (Next.js)

Páginas principales:
- `/login`: Autenticación
- `/dashboard`: Dashboard principal
- `/competitions`, `/teams`, `/players`: Gestión de catálogos (SUPERADMIN)
- `/match/[id]`: Match Center (NARRADOR)

## Testing

### Backend
```bash
cd apps/api
pnpm test           # Unit tests
pnpm test:e2e       # E2E tests
pnpm test:cov       # Coverage
```

### Frontend
```bash
cd apps/web
pnpm test           # Component tests
```

## License

MIT
