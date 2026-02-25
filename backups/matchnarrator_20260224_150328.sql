--
-- PostgreSQL database dump
--

\restrict Vue0MJ4VHh9c1tWr0LpjouPWUVheJoc6fU1RV2CCnSbsIcdX0ZVcYpFdLC2tltK

-- Dumped from database version 15.16
-- Dumped by pg_dump version 15.16

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: EventType; Type: TYPE; Schema: public; Owner: matchnarrator
--

CREATE TYPE public."EventType" AS ENUM (
    'GOAL',
    'FOUL',
    'SAVE',
    'OFFSIDE',
    'PASS',
    'SUBSTITUTION',
    'YELLOW_CARD',
    'RED_CARD',
    'CORNER',
    'FREEKICK',
    'PENALTY',
    'SHOT',
    'OTHER'
);


ALTER TYPE public."EventType" OWNER TO matchnarrator;

--
-- Name: MatchPeriod; Type: TYPE; Schema: public; Owner: matchnarrator
--

CREATE TYPE public."MatchPeriod" AS ENUM (
    'FIRST_HALF',
    'SECOND_HALF',
    'EXTRA_TIME_FIRST',
    'EXTRA_TIME_SECOND',
    'PENALTIES'
);


ALTER TYPE public."MatchPeriod" OWNER TO matchnarrator;

--
-- Name: MatchStatus; Type: TYPE; Schema: public; Owner: matchnarrator
--

CREATE TYPE public."MatchStatus" AS ENUM (
    'SETUP',
    'LIVE',
    'HALFTIME',
    'FINISHED'
);


ALTER TYPE public."MatchStatus" OWNER TO matchnarrator;

--
-- Name: PlayerPosition; Type: TYPE; Schema: public; Owner: matchnarrator
--

CREATE TYPE public."PlayerPosition" AS ENUM (
    'GK',
    'DF',
    'MF',
    'FW'
);


ALTER TYPE public."PlayerPosition" OWNER TO matchnarrator;

--
-- Name: TeamSide; Type: TYPE; Schema: public; Owner: matchnarrator
--

CREATE TYPE public."TeamSide" AS ENUM (
    'HOME',
    'AWAY'
);


ALTER TYPE public."TeamSide" OWNER TO matchnarrator;

--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: matchnarrator
--

CREATE TYPE public."UserRole" AS ENUM (
    'SUPERADMIN',
    'NARRADOR'
);


ALTER TYPE public."UserRole" OWNER TO matchnarrator;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Competition; Type: TABLE; Schema: public; Owner: matchnarrator
--

CREATE TABLE public."Competition" (
    id text NOT NULL,
    name text NOT NULL,
    country text,
    logo text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Competition" OWNER TO matchnarrator;

--
-- Name: FixtureMatch; Type: TABLE; Schema: public; Owner: matchnarrator
--

CREATE TABLE public."FixtureMatch" (
    id text NOT NULL,
    "seasonId" text NOT NULL,
    "homeTeamId" text NOT NULL,
    "awayTeamId" text NOT NULL,
    "matchDate" timestamp(3) without time zone NOT NULL,
    venue text,
    round integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."FixtureMatch" OWNER TO matchnarrator;

--
-- Name: MatchEvent; Type: TABLE; Schema: public; Owner: matchnarrator
--

CREATE TABLE public."MatchEvent" (
    id text NOT NULL,
    "matchId" text NOT NULL,
    "rosterPlayerId" text,
    "teamSide" public."TeamSide" NOT NULL,
    "eventType" public."EventType" NOT NULL,
    period public."MatchPeriod" NOT NULL,
    minute integer NOT NULL,
    second integer NOT NULL,
    payload jsonb,
    "isDeleted" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."MatchEvent" OWNER TO matchnarrator;

--
-- Name: MatchRosterPlayer; Type: TABLE; Schema: public; Owner: matchnarrator
--

CREATE TABLE public."MatchRosterPlayer" (
    id text NOT NULL,
    "matchId" text NOT NULL,
    "playerId" text NOT NULL,
    "teamId" text NOT NULL,
    "jerseyNumber" integer NOT NULL,
    "isHomeTeam" boolean NOT NULL,
    "isStarter" boolean DEFAULT true NOT NULL,
    "position" public."PlayerPosition",
    "layoutX" double precision,
    "layoutY" double precision,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "customName" text
);


ALTER TABLE public."MatchRosterPlayer" OWNER TO matchnarrator;

--
-- Name: MatchSession; Type: TABLE; Schema: public; Owner: matchnarrator
--

CREATE TABLE public."MatchSession" (
    id text NOT NULL,
    "narratorId" text NOT NULL,
    "homeTeamId" text NOT NULL,
    "awayTeamId" text NOT NULL,
    "fixtureMatchId" text,
    "matchDate" timestamp(3) without time zone NOT NULL,
    venue text,
    status public."MatchStatus" DEFAULT 'SETUP'::public."MatchStatus" NOT NULL,
    "currentPeriod" public."MatchPeriod" DEFAULT 'FIRST_HALF'::public."MatchPeriod" NOT NULL,
    "elapsedSeconds" integer DEFAULT 0 NOT NULL,
    "isTimerRunning" boolean DEFAULT false NOT NULL,
    "firstHalfAddedTime" integer,
    "secondHalfAddedTime" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."MatchSession" OWNER TO matchnarrator;

--
-- Name: Player; Type: TABLE; Schema: public; Owner: matchnarrator
--

CREATE TABLE public."Player" (
    id text NOT NULL,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    photo text,
    "birthDate" timestamp(3) without time zone,
    nationality text,
    "position" public."PlayerPosition",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Player" OWNER TO matchnarrator;

--
-- Name: PlayerSeason; Type: TABLE; Schema: public; Owner: matchnarrator
--

CREATE TABLE public."PlayerSeason" (
    id text NOT NULL,
    "playerId" text NOT NULL,
    "teamSeasonId" text NOT NULL,
    "jerseyNumber" integer
);


ALTER TABLE public."PlayerSeason" OWNER TO matchnarrator;

--
-- Name: Season; Type: TABLE; Schema: public; Owner: matchnarrator
--

CREATE TABLE public."Season" (
    id text NOT NULL,
    name text NOT NULL,
    "competitionId" text NOT NULL,
    "startDate" timestamp(3) without time zone,
    "endDate" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Season" OWNER TO matchnarrator;

--
-- Name: Team; Type: TABLE; Schema: public; Owner: matchnarrator
--

CREATE TABLE public."Team" (
    id text NOT NULL,
    name text NOT NULL,
    "shortName" text,
    logo text,
    city text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Team" OWNER TO matchnarrator;

--
-- Name: TeamSeason; Type: TABLE; Schema: public; Owner: matchnarrator
--

CREATE TABLE public."TeamSeason" (
    id text NOT NULL,
    "teamId" text NOT NULL,
    "seasonId" text NOT NULL
);


ALTER TABLE public."TeamSeason" OWNER TO matchnarrator;

--
-- Name: User; Type: TABLE; Schema: public; Owner: matchnarrator
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    name text NOT NULL,
    role public."UserRole" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."User" OWNER TO matchnarrator;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: matchnarrator
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO matchnarrator;

--
-- Data for Name: Competition; Type: TABLE DATA; Schema: public; Owner: matchnarrator
--

COPY public."Competition" (id, name, country, logo, "createdAt", "updatedAt") FROM stdin;
cmm0v0nq50000rtknihty5zni	LIGA PRO	ECUADOR	https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTuNmsWtBZ7VD5YZBJOsLW4qIWL-zOJHOJFctktDGTOVg&s	2026-02-24 17:08:40.349	2026-02-24 17:09:16.679
cmm0wub350003rtknmit1x199	Ligue 1	France	https://media.api-sports.io/football/leagues/61.png	2026-02-24 17:59:43.266	2026-02-24 17:59:43.266
cmm0wy7530000ukj5zshnx35k	Premier League	England	https://media.api-sports.io/football/leagues/39.png	2026-02-24 18:02:44.775	2026-02-24 18:02:44.775
cmm10sp9f00002fpvj58f58pk	LigaPro Serie A	Ecuador	\N	2026-02-24 19:50:26.787	2026-02-24 19:57:43.912
\.


--
-- Data for Name: FixtureMatch; Type: TABLE DATA; Schema: public; Owner: matchnarrator
--

COPY public."FixtureMatch" (id, "seasonId", "homeTeamId", "awayTeamId", "matchDate", venue, round, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: MatchEvent; Type: TABLE DATA; Schema: public; Owner: matchnarrator
--

COPY public."MatchEvent" (id, "matchId", "rosterPlayerId", "teamSide", "eventType", period, minute, second, payload, "isDeleted", "createdAt", "updatedAt") FROM stdin;
cmm0q164z0003xamjk86qozh3	cmm0pythx0001xamj97stjzew	\N	HOME	SHOT	FIRST_HALF	0	11	\N	f	2026-02-24 14:49:06.131	2026-02-24 14:49:06.131
cmm0q1ase0005xamj0y0xnw2z	cmm0pythx0001xamj97stjzew	\N	HOME	SHOT	FIRST_HALF	0	17	\N	f	2026-02-24 14:49:12.158	2026-02-24 14:49:12.158
cmm0qp5aw002l4lp244qy7sax	cmm0qmltd001b4lp2tvipgfq1	\N	HOME	SHOT	FIRST_HALF	0	2	\N	f	2026-02-24 15:07:44.791	2026-02-24 15:07:44.791
cmm0qp8ec002n4lp2sybesiap	cmm0qmltd001b4lp2tvipgfq1	\N	HOME	SHOT	FIRST_HALF	0	7	\N	f	2026-02-24 15:07:48.804	2026-02-24 15:07:48.804
cmm0qpa4a002p4lp2mnph1erj	cmm0qmltd001b4lp2tvipgfq1	\N	HOME	GOAL	FIRST_HALF	0	9	\N	f	2026-02-24 15:07:51.035	2026-02-24 15:07:51.035
cmm0qpsra002r4lp27bs2f1q1	cmm0qmltd001b4lp2tvipgfq1	\N	HOME	CORNER	FIRST_HALF	0	33	\N	f	2026-02-24 15:08:15.19	2026-02-24 15:10:30.262
cmm0qvukl002t4lp2d6r4j0or	cmm0qmltd001b4lp2tvipgfq1	\N	HOME	GOAL	FIRST_HALF	4	43	\N	f	2026-02-24 15:12:57.477	2026-02-24 15:12:57.477
\.


--
-- Data for Name: MatchRosterPlayer; Type: TABLE DATA; Schema: public; Owner: matchnarrator
--

COPY public."MatchRosterPlayer" (id, "matchId", "playerId", "teamId", "jerseyNumber", "isHomeTeam", "isStarter", "position", "layoutX", "layoutY", "createdAt", "updatedAt", "customName") FROM stdin;
\.


--
-- Data for Name: MatchSession; Type: TABLE DATA; Schema: public; Owner: matchnarrator
--

COPY public."MatchSession" (id, "narratorId", "homeTeamId", "awayTeamId", "fixtureMatchId", "matchDate", venue, status, "currentPeriod", "elapsedSeconds", "isTimerRunning", "firstHalfAddedTime", "secondHalfAddedTime", "createdAt", "updatedAt") FROM stdin;
cmm0pythx0001xamj97stjzew	cmm0pl2av0001kgeowwctdscg	cmm0pl2b20005kgeouwv1yrrf	cmm0pl2b40006kgeooo61p0x3	\N	2026-02-24 20:30:00	Monumental	HALFTIME	SECOND_HALF	30	f	\N	\N	2026-02-24 14:47:16.437	2026-02-24 14:49:29.451
cmm0qhtal00014lp2pfbyydwv	cmm0pl2av0001kgeowwctdscg	cmm0pl2b20005kgeouwv1yrrf	cmm0pl2b40006kgeooo61p0x3	\N	2026-02-24 20:06:00	Monumental	SETUP	FIRST_HALF	0	f	\N	\N	2026-02-24 15:02:02.637	2026-02-24 15:02:02.637
cmm0qmltd001b4lp2tvipgfq1	cmm0pl2av0001kgeowwctdscg	cmm0pl2b20005kgeouwv1yrrf	cmm0pl2b40006kgeooo61p0x3	\N	2026-02-24 15:05:00	Monumental	HALFTIME	SECOND_HALF	630	f	\N	\N	2026-02-24 15:05:46.225	2026-02-24 16:47:48.986
cmm0uagdi0001z6nsc08sizwf	cmm0pl2av0001kgeowwctdscg	cmm0pl2b20005kgeouwv1yrrf	cmm0pl2b40006kgeooo61p0x3	\N	2026-02-24 16:48:00	Monumental	SETUP	FIRST_HALF	0	f	\N	\N	2026-02-24 16:48:17.767	2026-02-24 16:48:17.767
\.


--
-- Data for Name: Player; Type: TABLE DATA; Schema: public; Owner: matchnarrator
--

COPY public."Player" (id, "firstName", "lastName", photo, "birthDate", nationality, "position", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: PlayerSeason; Type: TABLE DATA; Schema: public; Owner: matchnarrator
--

COPY public."PlayerSeason" (id, "playerId", "teamSeasonId", "jerseyNumber") FROM stdin;
\.


--
-- Data for Name: Season; Type: TABLE DATA; Schema: public; Owner: matchnarrator
--

COPY public."Season" (id, name, "competitionId", "startDate", "endDate", "createdAt", "updatedAt") FROM stdin;
cmm0xazym0001v64qz4xqi4ef	2023	cmm0wy7530000ukj5zshnx35k	2023-01-01 05:00:00	2023-12-31 05:00:00	2026-02-24 18:12:41.998	2026-02-24 18:12:41.998
cmm10sp9m00022fpvaxtq5onh	2026	cmm10sp9f00002fpvj58f58pk	2026-02-22 00:00:00	2026-12-20 00:00:00	2026-02-24 19:50:26.795	2026-02-24 19:57:43.918
\.


--
-- Data for Name: Team; Type: TABLE DATA; Schema: public; Owner: matchnarrator
--

COPY public."Team" (id, name, "shortName", logo, city, "createdAt", "updatedAt") FROM stdin;
cmm0pl2b20005kgeouwv1yrrf	Boca Juniors	BOCA	https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/CABJ_Logo.svg/1200px-CABJ_Logo.svg.png	Buenos Aires	2026-02-24 14:36:34.671	2026-02-24 14:36:34.671
cmm0pl2b40006kgeooo61p0x3	River Plate	RIVER	https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Escudo_del_C_A_River_Plate.svg/1200px-Escudo_del_C_A_River_Plate.svg.png	Buenos Aires	2026-02-24 14:36:34.673	2026-02-24 14:36:34.673
cmm0xb0cj0002v64qdvvycuzd	Manchester United	MUN	https://media.api-sports.io/football/teams/33.png	Manchester	2026-02-24 18:12:42.499	2026-02-24 18:12:42.499
cmm0xb0cs0005v64q2zk1mfor	Newcastle	NEW	https://media.api-sports.io/football/teams/34.png	Newcastle upon Tyne	2026-02-24 18:12:42.508	2026-02-24 18:12:42.508
cmm0xb0cv0008v64qef6gbq5v	Bournemouth	BOU	https://media.api-sports.io/football/teams/35.png	Bournemouth, Dorset	2026-02-24 18:12:42.511	2026-02-24 18:12:42.511
cmm0xb0cw000bv64q5nk3g1td	Fulham	FUL	https://media.api-sports.io/football/teams/36.png	London	2026-02-24 18:12:42.513	2026-02-24 18:12:42.513
cmm0xb0cy000ev64qhjq3hcfq	Wolves	WOL	https://media.api-sports.io/football/teams/39.png	Wolverhampton, West Midlands	2026-02-24 18:12:42.514	2026-02-24 18:12:42.514
cmm0xb0cz000hv64qyqdwhohh	Liverpool	LIV	https://media.api-sports.io/football/teams/40.png	Liverpool	2026-02-24 18:12:42.516	2026-02-24 18:12:42.516
cmm0xb0d1000kv64q38yop6v2	Arsenal	ARS	https://media.api-sports.io/football/teams/42.png	London	2026-02-24 18:12:42.517	2026-02-24 18:12:42.517
cmm0xb0d2000nv64qwq8fl9ul	Burnley	BUR	https://media.api-sports.io/football/teams/44.png	Burnley	2026-02-24 18:12:42.519	2026-02-24 18:12:42.519
cmm0xb0d4000qv64qtrjuwwcf	Everton	EVE	https://media.api-sports.io/football/teams/45.png	Liverpool, Merseyside	2026-02-24 18:12:42.52	2026-02-24 18:12:42.52
cmm0xb0d5000tv64quybgmbgw	Tottenham	TOT	https://media.api-sports.io/football/teams/47.png	London	2026-02-24 18:12:42.522	2026-02-24 18:12:42.522
cmm0xb0d7000wv64qmxvepory	West Ham	WES	https://media.api-sports.io/football/teams/48.png	London	2026-02-24 18:12:42.523	2026-02-24 18:12:42.523
cmm0xb0d8000zv64q1qgx1tgc	Chelsea	CHE	https://media.api-sports.io/football/teams/49.png	London	2026-02-24 18:12:42.525	2026-02-24 18:12:42.525
cmm0xb0da0012v64ql3ywbg1u	Manchester City	MCI	https://media.api-sports.io/football/teams/50.png	Manchester	2026-02-24 18:12:42.526	2026-02-24 18:12:42.526
cmm0xb0db0015v64qs4nyc4j4	Brighton	BRI	https://media.api-sports.io/football/teams/51.png	Falmer, East Sussex	2026-02-24 18:12:42.528	2026-02-24 18:12:42.528
cmm0xb0dd0018v64qlviq33ut	Crystal Palace	CRY	https://media.api-sports.io/football/teams/52.png	London	2026-02-24 18:12:42.529	2026-02-24 18:12:42.529
cmm0xb0de001bv64qaavniwrg	Brentford	BRE	https://media.api-sports.io/football/teams/55.png	Brentford, Middlesex	2026-02-24 18:12:42.531	2026-02-24 18:12:42.531
cmm0xb0df001ev64qcnvrth2n	Sheffield Utd	SHE	https://media.api-sports.io/football/teams/62.png	Sheffield	2026-02-24 18:12:42.532	2026-02-24 18:12:42.532
cmm0xb0dh001hv64qhxih6xr7	Nottingham Forest	NOT	https://media.api-sports.io/football/teams/65.png	Nottingham, Nottinghamshire	2026-02-24 18:12:42.533	2026-02-24 18:12:42.533
cmm0xb0di001kv64qjwidqtrm	Aston Villa	AST	https://media.api-sports.io/football/teams/66.png	Birmingham	2026-02-24 18:12:42.535	2026-02-24 18:12:42.535
cmm0xb0dj001nv64qju2pw65g	Luton	LUT	https://media.api-sports.io/football/teams/1359.png	Luton, Bedfordshire	2026-02-24 18:12:42.536	2026-02-24 18:12:42.536
cmm10sp9t00032fpvkc12ynvq	AUCAS	\N	\N	\N	2026-02-24 19:50:26.801	2026-02-24 19:50:26.801
cmm10spa200062fpvmr66zrxv	BARCELONA	\N	\N	\N	2026-02-24 19:50:26.81	2026-02-24 19:50:26.81
cmm10spad00092fpvmyklz688	D. CUENCA	\N	\N	\N	2026-02-24 19:50:26.822	2026-02-24 19:50:26.822
cmm10spao000c2fpvg3z8b7wi	DELFIN	\N	\N	\N	2026-02-24 19:50:26.833	2026-02-24 19:50:26.833
cmm10spaz000f2fpvcchh7gxk	EMELEC	\N	\N	\N	2026-02-24 19:50:26.844	2026-02-24 19:50:26.844
cmm10spb7000i2fpvltt708uq	GUAYAQUIL CITY	\N	\N	\N	2026-02-24 19:50:26.852	2026-02-24 19:50:26.852
cmm10spbf000l2fpv0rluh94t	INDEPENDIENTE	\N	\N	\N	2026-02-24 19:50:26.86	2026-02-24 19:50:26.86
cmm10spbm000o2fpv5r5ht4aa	LEONES	\N	\N	\N	2026-02-24 19:50:26.866	2026-02-24 19:50:26.866
cmm10spbu000r2fpv4z2s6w0m	LIBERTAD	\N	\N	\N	2026-02-24 19:50:26.874	2026-02-24 19:50:26.874
cmm10spc2000u2fpvbz5kjkwv	LIGA	\N	\N	\N	2026-02-24 19:50:26.883	2026-02-24 19:50:26.883
cmm10spc8000x2fpvv3aufxn7	MACARA	\N	\N	\N	2026-02-24 19:50:26.888	2026-02-24 19:50:26.888
cmm10spcd00102fpvd4cdic1z	MANTA	\N	\N	\N	2026-02-24 19:50:26.893	2026-02-24 19:50:26.893
cmm10spcl00132fpvjzmzli1x	MUSHUC RUNA	\N	\N	\N	2026-02-24 19:50:26.901	2026-02-24 19:50:26.901
cmm10spcs00162fpv5y4dfi5m	ORENSE	\N	\N	\N	2026-02-24 19:50:26.909	2026-02-24 19:50:26.909
cmm10spcx00192fpvdagv3qll	TECNICO U.	\N	\N	\N	2026-02-24 19:50:26.914	2026-02-24 19:50:26.914
cmm10spd5001c2fpvgu4jjkge	U. CATOLICA	\N	\N	\N	2026-02-24 19:50:26.922	2026-02-24 19:50:26.922
\.


--
-- Data for Name: TeamSeason; Type: TABLE DATA; Schema: public; Owner: matchnarrator
--

COPY public."TeamSeason" (id, "teamId", "seasonId") FROM stdin;
cmm0xb0cp0004v64qjhsh50n4	cmm0xb0cj0002v64qdvvycuzd	cmm0xazym0001v64qz4xqi4ef
cmm0xb0ct0007v64qez3a0qwf	cmm0xb0cs0005v64q2zk1mfor	cmm0xazym0001v64qz4xqi4ef
cmm0xb0cv000av64q942f4of9	cmm0xb0cv0008v64qef6gbq5v	cmm0xazym0001v64qz4xqi4ef
cmm0xb0cx000dv64q1bdijhqi	cmm0xb0cw000bv64q5nk3g1td	cmm0xazym0001v64qz4xqi4ef
cmm0xb0cz000gv64q1c0h0h6o	cmm0xb0cy000ev64qhjq3hcfq	cmm0xazym0001v64qz4xqi4ef
cmm0xb0d0000jv64q3tcvox8g	cmm0xb0cz000hv64qyqdwhohh	cmm0xazym0001v64qz4xqi4ef
cmm0xb0d2000mv64qkf3oijy5	cmm0xb0d1000kv64q38yop6v2	cmm0xazym0001v64qz4xqi4ef
cmm0xb0d3000pv64q08dvttsx	cmm0xb0d2000nv64qwq8fl9ul	cmm0xazym0001v64qz4xqi4ef
cmm0xb0d4000sv64qvmfgn4gl	cmm0xb0d4000qv64qtrjuwwcf	cmm0xazym0001v64qz4xqi4ef
cmm0xb0d6000vv64qt85w50xs	cmm0xb0d5000tv64quybgmbgw	cmm0xazym0001v64qz4xqi4ef
cmm0xb0d8000yv64qpz0brrkg	cmm0xb0d7000wv64qmxvepory	cmm0xazym0001v64qz4xqi4ef
cmm0xb0d90011v64qa1wdodwm	cmm0xb0d8000zv64q1qgx1tgc	cmm0xazym0001v64qz4xqi4ef
cmm0xb0db0014v64q0op17ery	cmm0xb0da0012v64ql3ywbg1u	cmm0xazym0001v64qz4xqi4ef
cmm0xb0dc0017v64qrahwr2i9	cmm0xb0db0015v64qs4nyc4j4	cmm0xazym0001v64qz4xqi4ef
cmm0xb0dd001av64qj0td0ibt	cmm0xb0dd0018v64qlviq33ut	cmm0xazym0001v64qz4xqi4ef
cmm0xb0df001dv64q1j0aht9q	cmm0xb0de001bv64qaavniwrg	cmm0xazym0001v64qz4xqi4ef
cmm0xb0dg001gv64qvv8f19z5	cmm0xb0df001ev64qcnvrth2n	cmm0xazym0001v64qz4xqi4ef
cmm0xb0dh001jv64qw6ktkz1i	cmm0xb0dh001hv64qhxih6xr7	cmm0xazym0001v64qz4xqi4ef
cmm0xb0dj001mv64qvo86jvct	cmm0xb0di001kv64qjwidqtrm	cmm0xazym0001v64qz4xqi4ef
cmm0xb0dk001pv64q0jgyk843	cmm0xb0dj001nv64qju2pw65g	cmm0xazym0001v64qz4xqi4ef
cmm10sp9y00052fpv5cxu69m6	cmm10sp9t00032fpvkc12ynvq	cmm10sp9m00022fpvaxtq5onh
cmm10spa800082fpv9cwt3fo0	cmm10spa200062fpvmr66zrxv	cmm10sp9m00022fpvaxtq5onh
cmm10spaj000b2fpvtctzxsey	cmm10spad00092fpvmyklz688	cmm10sp9m00022fpvaxtq5onh
cmm10spas000e2fpvlhc64ngt	cmm10spao000c2fpvg3z8b7wi	cmm10sp9m00022fpvaxtq5onh
cmm10spb3000h2fpv27jbvbcv	cmm10spaz000f2fpvcchh7gxk	cmm10sp9m00022fpvaxtq5onh
cmm10spbb000k2fpvd0zic4zk	cmm10spb7000i2fpvltt708uq	cmm10sp9m00022fpvaxtq5onh
cmm10spbj000n2fpvkkiaczw1	cmm10spbf000l2fpv0rluh94t	cmm10sp9m00022fpvaxtq5onh
cmm10spbp000q2fpv60gly41p	cmm10spbm000o2fpv5r5ht4aa	cmm10sp9m00022fpvaxtq5onh
cmm10spbz000t2fpvzaqg80b6	cmm10spbu000r2fpv4z2s6w0m	cmm10sp9m00022fpvaxtq5onh
cmm10spc5000w2fpvv3lm1rhz	cmm10spc2000u2fpvbz5kjkwv	cmm10sp9m00022fpvaxtq5onh
cmm10spca000z2fpvbmw9iz9r	cmm10spc8000x2fpvv3aufxn7	cmm10sp9m00022fpvaxtq5onh
cmm10spch00122fpvy5vkkmq1	cmm10spcd00102fpvd4cdic1z	cmm10sp9m00022fpvaxtq5onh
cmm10spcp00152fpv5qc4wgmf	cmm10spcl00132fpvjzmzli1x	cmm10sp9m00022fpvaxtq5onh
cmm10spcv00182fpvp713y7q6	cmm10spcs00162fpv5y4dfi5m	cmm10sp9m00022fpvaxtq5onh
cmm10spd1001b2fpv8s4xbjnx	cmm10spcx00192fpvdagv3qll	cmm10sp9m00022fpvaxtq5onh
cmm10spd9001e2fpvgrx3exhs	cmm10spd5001c2fpvgu4jjkge	cmm10sp9m00022fpvaxtq5onh
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: matchnarrator
--

COPY public."User" (id, email, password, name, role, "createdAt", "updatedAt") FROM stdin;
cmm0pl2ap0000kgeos50oalvz	admin@example.com	$2b$10$m0kWz/l2L9bXcBJQ.PkB6ewlFLQEoidLQcW6mQA.c/3EbVEQUJHz.	Super Admin	SUPERADMIN	2026-02-24 14:36:34.658	2026-02-24 14:36:34.658
cmm0pl2av0001kgeowwctdscg	narrador@example.com	$2b$10$YgyQwabJFUQpNJ5qNPxZduFYm5NlvAF/xDCY5jtyB77YTavGcJkd2	Juan Narrador	NARRADOR	2026-02-24 14:36:34.663	2026-02-24 14:36:34.663
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: matchnarrator
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
\.


--
-- Name: Competition Competition_pkey; Type: CONSTRAINT; Schema: public; Owner: matchnarrator
--

ALTER TABLE ONLY public."Competition"
    ADD CONSTRAINT "Competition_pkey" PRIMARY KEY (id);


--
-- Name: FixtureMatch FixtureMatch_pkey; Type: CONSTRAINT; Schema: public; Owner: matchnarrator
--

ALTER TABLE ONLY public."FixtureMatch"
    ADD CONSTRAINT "FixtureMatch_pkey" PRIMARY KEY (id);


--
-- Name: MatchEvent MatchEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: matchnarrator
--

ALTER TABLE ONLY public."MatchEvent"
    ADD CONSTRAINT "MatchEvent_pkey" PRIMARY KEY (id);


--
-- Name: MatchRosterPlayer MatchRosterPlayer_pkey; Type: CONSTRAINT; Schema: public; Owner: matchnarrator
--

ALTER TABLE ONLY public."MatchRosterPlayer"
    ADD CONSTRAINT "MatchRosterPlayer_pkey" PRIMARY KEY (id);


--
-- Name: MatchSession MatchSession_pkey; Type: CONSTRAINT; Schema: public; Owner: matchnarrator
--

ALTER TABLE ONLY public."MatchSession"
    ADD CONSTRAINT "MatchSession_pkey" PRIMARY KEY (id);


--
-- Name: PlayerSeason PlayerSeason_pkey; Type: CONSTRAINT; Schema: public; Owner: matchnarrator
--

ALTER TABLE ONLY public."PlayerSeason"
    ADD CONSTRAINT "PlayerSeason_pkey" PRIMARY KEY (id);


--
-- Name: Player Player_pkey; Type: CONSTRAINT; Schema: public; Owner: matchnarrator
--

ALTER TABLE ONLY public."Player"
    ADD CONSTRAINT "Player_pkey" PRIMARY KEY (id);


--
-- Name: Season Season_pkey; Type: CONSTRAINT; Schema: public; Owner: matchnarrator
--

ALTER TABLE ONLY public."Season"
    ADD CONSTRAINT "Season_pkey" PRIMARY KEY (id);


--
-- Name: TeamSeason TeamSeason_pkey; Type: CONSTRAINT; Schema: public; Owner: matchnarrator
--

ALTER TABLE ONLY public."TeamSeason"
    ADD CONSTRAINT "TeamSeason_pkey" PRIMARY KEY (id);


--
-- Name: Team Team_pkey; Type: CONSTRAINT; Schema: public; Owner: matchnarrator
--

ALTER TABLE ONLY public."Team"
    ADD CONSTRAINT "Team_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: matchnarrator
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: matchnarrator
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: MatchEvent_matchId_isDeleted_idx; Type: INDEX; Schema: public; Owner: matchnarrator
--

CREATE INDEX "MatchEvent_matchId_isDeleted_idx" ON public."MatchEvent" USING btree ("matchId", "isDeleted");


--
-- Name: MatchRosterPlayer_matchId_playerId_key; Type: INDEX; Schema: public; Owner: matchnarrator
--

CREATE UNIQUE INDEX "MatchRosterPlayer_matchId_playerId_key" ON public."MatchRosterPlayer" USING btree ("matchId", "playerId");


--
-- Name: PlayerSeason_playerId_teamSeasonId_key; Type: INDEX; Schema: public; Owner: matchnarrator
--

CREATE UNIQUE INDEX "PlayerSeason_playerId_teamSeasonId_key" ON public."PlayerSeason" USING btree ("playerId", "teamSeasonId");


--
-- Name: TeamSeason_teamId_seasonId_key; Type: INDEX; Schema: public; Owner: matchnarrator
--

CREATE UNIQUE INDEX "TeamSeason_teamId_seasonId_key" ON public."TeamSeason" USING btree ("teamId", "seasonId");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: matchnarrator
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: FixtureMatch FixtureMatch_seasonId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: matchnarrator
--

ALTER TABLE ONLY public."FixtureMatch"
    ADD CONSTRAINT "FixtureMatch_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES public."Season"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MatchEvent MatchEvent_matchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: matchnarrator
--

ALTER TABLE ONLY public."MatchEvent"
    ADD CONSTRAINT "MatchEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES public."MatchSession"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MatchEvent MatchEvent_rosterPlayerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: matchnarrator
--

ALTER TABLE ONLY public."MatchEvent"
    ADD CONSTRAINT "MatchEvent_rosterPlayerId_fkey" FOREIGN KEY ("rosterPlayerId") REFERENCES public."MatchRosterPlayer"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MatchRosterPlayer MatchRosterPlayer_matchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: matchnarrator
--

ALTER TABLE ONLY public."MatchRosterPlayer"
    ADD CONSTRAINT "MatchRosterPlayer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES public."MatchSession"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MatchRosterPlayer MatchRosterPlayer_playerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: matchnarrator
--

ALTER TABLE ONLY public."MatchRosterPlayer"
    ADD CONSTRAINT "MatchRosterPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES public."Player"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MatchSession MatchSession_awayTeamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: matchnarrator
--

ALTER TABLE ONLY public."MatchSession"
    ADD CONSTRAINT "MatchSession_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MatchSession MatchSession_fixtureMatchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: matchnarrator
--

ALTER TABLE ONLY public."MatchSession"
    ADD CONSTRAINT "MatchSession_fixtureMatchId_fkey" FOREIGN KEY ("fixtureMatchId") REFERENCES public."FixtureMatch"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MatchSession MatchSession_homeTeamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: matchnarrator
--

ALTER TABLE ONLY public."MatchSession"
    ADD CONSTRAINT "MatchSession_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MatchSession MatchSession_narratorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: matchnarrator
--

ALTER TABLE ONLY public."MatchSession"
    ADD CONSTRAINT "MatchSession_narratorId_fkey" FOREIGN KEY ("narratorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PlayerSeason PlayerSeason_playerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: matchnarrator
--

ALTER TABLE ONLY public."PlayerSeason"
    ADD CONSTRAINT "PlayerSeason_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES public."Player"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PlayerSeason PlayerSeason_teamSeasonId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: matchnarrator
--

ALTER TABLE ONLY public."PlayerSeason"
    ADD CONSTRAINT "PlayerSeason_teamSeasonId_fkey" FOREIGN KEY ("teamSeasonId") REFERENCES public."TeamSeason"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Season Season_competitionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: matchnarrator
--

ALTER TABLE ONLY public."Season"
    ADD CONSTRAINT "Season_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES public."Competition"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TeamSeason TeamSeason_seasonId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: matchnarrator
--

ALTER TABLE ONLY public."TeamSeason"
    ADD CONSTRAINT "TeamSeason_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES public."Season"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TeamSeason TeamSeason_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: matchnarrator
--

ALTER TABLE ONLY public."TeamSeason"
    ADD CONSTRAINT "TeamSeason_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict Vue0MJ4VHh9c1tWr0LpjouPWUVheJoc6fU1RV2CCnSbsIcdX0ZVcYpFdLC2tltK

