'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { Search, Check, ChevronRight, Download, RefreshCw, ExternalLink } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ApiLeague {
  externalId: number;
  name: string;
  type: string;
  logo: string | null;
  country: string;
  countryFlag: string | null;
  seasons: { year: number; current: boolean }[];
}

interface ApiTeam {
  externalId: number;
  name: string;
  shortName: string | null;
  logo: string | null;
  city: string | null;
}

interface ApiPlayer {
  externalId: number;
  name: string;
  firstName: string;
  lastName: string;
  number: number | null;
  position: string | null;
  photo: string | null;
  age: number | null;
}

interface ImportedSeason {
  id: string;
  name: string;
  competition?: { id: string; name: string } | null;
}
interface ImportedTeam {
  teamSeasonId: string;
  team: { id: string; name: string; logo: string | null };
  isNew: boolean;
  externalId?: number | null;
}

type ManualStatus = 'FT' | 'NS' | 'PST';

interface ManualFixture {
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  venue?: string;
  round?: number;
  roundLabel?: string;
  statusShort?: string;
  statusLong?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  isFinished?: boolean;
}

interface ManualTeam {
  name: string;
}

interface ManualStanding {
  team: string;
  groupName?: string;
  rank: number;
  points: number;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalsDiff: number;
  form?: string | null;
  status?: string | null;
  description?: string | null;
}

interface ManualPayload {
  teams?: ManualTeam[];
  fixtures?: ManualFixture[];
  standings?: ManualStanding[];
  metadata?: Record<string, any>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function apiHeaders(key: string) {
  return { 'x-football-api-key': key };
}

function normalizeImportedSeason(data: any): ImportedSeason | null {
  const season = data?.season;
  if (!season) return null;
  const competition = season?.competition ?? data?.competition ?? null;
  return {
    id: season.id,
    name: season.name,
    competition: competition
      ? { id: competition.id, name: competition.name }
      : null,
  };
}

const MANUAL_IMPORT_TEMPLATE = {
  competition: { name: 'LigaPro Serie A', country: 'Ecuador' },
  season: { name: '2025', startDate: '2025-01-01', endDate: '2025-12-31' },
  teams: [
    {
      name: 'Barcelona SC',
      shortName: 'BSC',
      players: [
        { firstName: 'Jugador', lastName: 'Ejemplo', number: 10, position: 'Attacker' },
      ],
    },
    { name: 'LDU Quito', shortName: 'LDU' },
  ],
  fixtures: [
    {
      homeTeam: 'Barcelona SC',
      awayTeam: 'LDU Quito',
      matchDate: '2025-03-01T20:00:00Z',
      round: 1,
      roundLabel: 'Regular Season - 1',
      statusShort: 'FT',
      homeScore: 2,
      awayScore: 1,
      isFinished: true,
    },
  ],
  standings: [
    {
      team: 'Barcelona SC',
      rank: 1,
      points: 3,
      played: 1,
      won: 1,
      draw: 0,
      lost: 0,
      goalsFor: 2,
      goalsAgainst: 1,
      goalsDiff: 1,
    },
  ],
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function ImportPage() {
  const { toast } = useToast();

  // API key
  const [apiKey, setApiKey] = useState('');
  const [keyValid, setKeyValid] = useState<boolean | null>(null);
  const [validating, setValidating] = useState(false);
  const [manualJson, setManualJson] = useState('');
  const [importingManual, setImportingManual] = useState(false);
  const [savingManualAsCurrent, setSavingManualAsCurrent] = useState(false);
  const [selectedManualRound, setSelectedManualRound] = useState<number>(1);

  // Step 1 – League search
  const [leagueQuery, setLeagueQuery] = useState('');
  const [leagueCountry, setLeagueCountry] = useState('');
  const [leagues, setLeagues] = useState<ApiLeague[]>([]);
  const [searchingLeagues, setSearchingLeagues] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState<ApiLeague | null>(null);
  const [selectedSeasonYear, setSelectedSeasonYear] = useState<number | null>(null);
  const [importingLeague, setImportingLeague] = useState(false);
  const [importingFullSeason, setImportingFullSeason] = useState(false);
  const [importedSeason, setImportedSeason] = useState<ImportedSeason | null>(null);

  // Step 2 – Teams
  const [apiTeams, setApiTeams] = useState<ApiTeam[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<number>>(new Set());
  const [importingTeams, setImportingTeams] = useState(false);
  const [importedTeams, setImportedTeams] = useState<ImportedTeam[]>([]);

  // Step 3 – Squad
  const [squadTeam, setSquadTeam] = useState<ImportedTeam | null>(null);
  const [apiSquad, setApiSquad] = useState<ApiPlayer[]>([]);
  const [loadingSquad, setLoadingSquad] = useState(false);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(new Set());
  const [importingSquad, setImportingSquad] = useState(false);

  // ── Validate key ────────────────────────────────────────────────────────────

  const parsedManualPayload = useMemo<ManualPayload | null>(() => {
    if (!manualJson.trim()) return null;
    try {
      return JSON.parse(manualJson) as ManualPayload;
    } catch {
      return null;
    }
  }, [manualJson]);

  const availableManualRounds = useMemo<number[]>(() => {
    const fixtures = parsedManualPayload?.fixtures;
    if (!Array.isArray(fixtures)) return [];
    return Array.from(
      new Set(fixtures.map((f) => f.round).filter((round): round is number => typeof round === 'number')),
    ).sort((a, b) => a - b);
  }, [parsedManualPayload]);

  const selectedRoundFixtures = useMemo<Array<{ fixture: ManualFixture; index: number }>>(() => {
    const fixtures = parsedManualPayload?.fixtures;
    if (!Array.isArray(fixtures)) return [];
    return fixtures
      .map((fixture, index) => ({ fixture, index }))
      .filter((item) => item.fixture.round === selectedManualRound);
  }, [parsedManualPayload, selectedManualRound]);

  useEffect(() => {
    if (availableManualRounds.length === 0) return;
    if (!availableManualRounds.includes(selectedManualRound)) {
      setSelectedManualRound(availableManualRounds[0]);
    }
  }, [availableManualRounds, selectedManualRound]);

  function statusLongFromShort(status: ManualStatus): string {
    if (status === 'FT') return 'Match Finished';
    if (status === 'PST') return 'Match Postponed';
    return 'Not Started';
  }

  function updateManualFixture(index: number, patch: Partial<ManualFixture>) {
    if (!parsedManualPayload?.fixtures) return;
    const nextPayload: ManualPayload = {
      ...parsedManualPayload,
      fixtures: parsedManualPayload.fixtures.map((fixture, currentIndex) =>
        currentIndex === index ? { ...fixture, ...patch } : fixture,
      ),
    };
    setManualJson(JSON.stringify(nextPayload, null, 2));
  }

  function updateFixtureStatus(index: number, status: ManualStatus) {
    const basePatch: Partial<ManualFixture> = {
      statusShort: status,
      statusLong: statusLongFromShort(status),
      isFinished: status === 'FT',
    };
    if (status !== 'FT') {
      basePatch.homeScore = null;
      basePatch.awayScore = null;
    }
    updateManualFixture(index, basePatch);
  }

  function updateFixtureScore(index: number, side: 'home' | 'away', value: string) {
    if (!parsedManualPayload?.fixtures) return;
    const current = parsedManualPayload.fixtures[index];
    if (!current) return;

    const parsed = value === '' ? null : Number.parseInt(value, 10);
    const normalized = Number.isNaN(parsed) ? null : parsed;
    const nextHomeScore = side === 'home' ? normalized : (current.homeScore ?? null);
    const nextAwayScore = side === 'away' ? normalized : (current.awayScore ?? null);

    const patch: Partial<ManualFixture> = {
      homeScore: nextHomeScore,
      awayScore: nextAwayScore,
    };

    if (nextHomeScore !== null && nextAwayScore !== null) {
      patch.statusShort = 'FT';
      patch.statusLong = statusLongFromShort('FT');
      patch.isFinished = true;
    }

    updateManualFixture(index, patch);
  }

  function recalculateManualStandings() {
    const payload = parsedManualPayload;
    if (!payload?.teams || !payload.fixtures) {
      toast({
        title: 'Faltan datos',
        description: 'El JSON necesita teams y fixtures para recalcular la tabla',
        variant: 'destructive',
      });
      return;
    }

    const table = new Map<string, ManualStanding>();
    for (const team of payload.teams) {
      table.set(team.name, {
        team: team.name,
        groupName: 'General',
        rank: 0,
        points: 0,
        played: 0,
        won: 0,
        draw: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalsDiff: 0,
        form: null,
        status: null,
        description: null,
      });
    }

    let finishedMatches = 0;
    for (const fixture of payload.fixtures) {
      const home = table.get(fixture.homeTeam);
      const away = table.get(fixture.awayTeam);
      const hasScore = fixture.homeScore !== null && fixture.homeScore !== undefined
        && fixture.awayScore !== null && fixture.awayScore !== undefined;
      const isFinished = fixture.isFinished || fixture.statusShort === 'FT';
      if (!home || !away || !hasScore || !isFinished) continue;

      finishedMatches += 1;
      const homeScore = Number(fixture.homeScore);
      const awayScore = Number(fixture.awayScore);

      home.played += 1;
      away.played += 1;
      home.goalsFor += homeScore;
      home.goalsAgainst += awayScore;
      away.goalsFor += awayScore;
      away.goalsAgainst += homeScore;

      if (homeScore > awayScore) {
        home.won += 1;
        away.lost += 1;
        home.points += 3;
      } else if (awayScore > homeScore) {
        away.won += 1;
        home.lost += 1;
        away.points += 3;
      } else {
        home.draw += 1;
        away.draw += 1;
        home.points += 1;
        away.points += 1;
      }
    }

    const standings = Array.from(table.values())
      .map((row) => ({ ...row, goalsDiff: row.goalsFor - row.goalsAgainst }))
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalsDiff !== a.goalsDiff) return b.goalsDiff - a.goalsDiff;
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
        return a.team.localeCompare(b.team, 'es');
      })
      .map((row, index) => ({ ...row, rank: index + 1 }));

    const playedRounds = new Set(
      payload.fixtures
        .filter((f) => f.statusShort === 'FT' || f.isFinished)
        .map((f) => f.round)
        .filter((round): round is number => typeof round === 'number'),
    );

    const nextPayload: ManualPayload = {
      ...payload,
      standings,
      metadata: {
        ...(payload.metadata ?? {}),
        updatedFromAdminAt: new Date().toISOString(),
        playedRounds: Array.from(playedRounds).sort((a, b) => a - b),
      },
    };
    setManualJson(JSON.stringify(nextPayload, null, 2));
    toast({
      title: 'Tabla recalculada',
      description: `${finishedMatches} partidos finalizados considerados en la clasificación`,
    });
  }

  async function validateKey() {
    if (!apiKey.trim()) return;
    setValidating(true);
    try {
      const res = await api.get('/import/leagues?q=Premier', {
        headers: apiHeaders(apiKey),
      });
      setKeyValid(res.data.length >= 0);
      toast({ title: 'API Key válida ✓' });
    } catch {
      setKeyValid(false);
      toast({ title: 'API Key inválida', description: 'Verificá tu clave de API-Football', variant: 'destructive' });
    } finally {
      setValidating(false);
    }
  }

  // ── Step 1: Search leagues ──────────────────────────────────────────────────

  async function searchLeagues() {
    if (!apiKey) return;
    setSearchingLeagues(true);
    try {
      const params = new URLSearchParams();
      if (leagueQuery) params.set('q', leagueQuery);
      if (leagueCountry) params.set('country', leagueCountry);
      const res = await api.get(`/import/leagues?${params}`, { headers: apiHeaders(apiKey) });
      setLeagues(res.data);
      if (res.data.length === 0) toast({ title: 'Sin resultados', description: 'Probá con otro término' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Error al buscar', variant: 'destructive' });
    } finally {
      setSearchingLeagues(false);
    }
  }

  async function importLeague() {
    if (!selectedLeague || !selectedSeasonYear) return;
    setImportingLeague(true);
    try {
      const res = await api.post('/import/leagues', {
        name: selectedLeague.name,
        country: selectedLeague.country,
        logo: selectedLeague.logo,
        seasonYear: selectedSeasonYear,
        seasonName: String(selectedSeasonYear),
      });
      setImportedSeason(normalizeImportedSeason(res.data));
      toast({ title: `Liga "${selectedLeague.name}" importada` });
      // Auto-load teams
      await loadApiTeams(res.data.season);
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Error al importar', variant: 'destructive' });
    } finally {
      setImportingLeague(false);
    }
  }

  async function importFullSeason() {
    if (!selectedLeague || !selectedSeasonYear || !apiKey) return;
    setImportingFullSeason(true);
    try {
      const res = await api.post(
        '/import/full-season',
        {
          leagueId: selectedLeague.externalId,
          name: selectedLeague.name,
          country: selectedLeague.country,
          logo: selectedLeague.logo,
          seasonYear: selectedSeasonYear,
          seasonName: String(selectedSeasonYear),
          includeSquads: true,
          includeFixtures: true,
          includeStandings: true,
        },
        { headers: apiHeaders(apiKey) },
      );

      setImportedSeason(normalizeImportedSeason(res.data));
      setImportedTeams(res.data?.teams ?? []);

      const summary = res.data?.summary;
      const teams = summary?.teams ?? 0;
      const players = summary?.playersAssigned ?? 0;
      const fixtures = (summary?.fixturesCreated ?? 0) + (summary?.fixturesUpdated ?? 0);
      const standings = summary?.standingsUpserted ?? 0;
      toast({
        title: 'Temporada importada',
        description: `${teams} equipos, ${players} jugadores asignados, ${fixtures} partidos y ${standings} filas de tabla.`,
      });

      await loadApiTeams(res.data?.season);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Error al importar temporada completa',
        variant: 'destructive',
      });
    } finally {
      setImportingFullSeason(false);
    }
  }

  async function importManualSeason() {
    if (!manualJson.trim()) {
      toast({ title: 'Falta JSON', description: 'Pegá un JSON de temporada manual', variant: 'destructive' });
      return;
    }

    let payload: any;
    try {
      payload = JSON.parse(manualJson);
    } catch {
      toast({ title: 'JSON inválido', description: 'Revisá formato (comas, llaves, comillas)', variant: 'destructive' });
      return;
    }

    setImportingManual(true);
    try {
      const res = await api.post('/import/manual-season', payload);
      setImportedSeason(normalizeImportedSeason(res.data));
      setImportedTeams(res.data?.teams ?? []);

      const summary = res.data?.summary;
      const teams = summary?.teams ?? 0;
      const players = summary?.playersAssigned ?? 0;
      const fixtures = (summary?.fixturesCreated ?? 0) + (summary?.fixturesUpdated ?? 0);
      const standings = summary?.standingsUpserted ?? 0;
      toast({
        title: 'Temporada importada manualmente',
        description: `${teams} equipos, ${players} jugadores, ${fixtures} partidos, ${standings} filas de tabla.`,
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'No se pudo importar el JSON manual',
        variant: 'destructive',
      });
    } finally {
      setImportingManual(false);
    }
  }

  async function saveManualSeasonAsCurrent() {
    if (!manualJson.trim()) {
      toast({ title: 'Falta JSON', description: 'Pegá un JSON de temporada manual', variant: 'destructive' });
      return;
    }

    let payload: any;
    try {
      payload = JSON.parse(manualJson);
    } catch {
      toast({ title: 'JSON inválido', description: 'Revisá formato (comas, llaves, comillas)', variant: 'destructive' });
      return;
    }

    const now = new Date();
    const year = now.getUTCFullYear();
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    payload = {
      ...payload,
      season: {
        ...(payload?.season ?? {}),
        name: payload?.season?.name || String(year),
        startDate,
        endDate,
      },
    };

    setManualJson(JSON.stringify(payload, null, 2));
    setSavingManualAsCurrent(true);
    try {
      const res = await api.post('/import/manual-season', payload);
      setImportedSeason(normalizeImportedSeason(res.data));
      setImportedTeams(res.data?.teams ?? []);

      const summary = res.data?.summary;
      const teams = summary?.teams ?? 0;
      const players = summary?.playersAssigned ?? 0;
      const fixtures = (summary?.fixturesCreated ?? 0) + (summary?.fixturesUpdated ?? 0);
      const standings = summary?.standingsUpserted ?? 0;
      toast({
        title: 'Guardado y temporada actual aplicada',
        description: `${teams} equipos, ${players} jugadores, ${fixtures} partidos, ${standings} filas de tabla.`,
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'No se pudo guardar el JSON manual',
        variant: 'destructive',
      });
    } finally {
      setSavingManualAsCurrent(false);
    }
  }

  // ── Step 2: Teams ───────────────────────────────────────────────────────────

  async function loadApiTeams(season?: ImportedSeason) {
    const s = season ?? importedSeason;
    if (!selectedLeague || !selectedSeasonYear || !s) return;
    setLoadingTeams(true);
    setApiTeams([]);
    try {
      const res = await api.get(
        `/import/teams?leagueId=${selectedLeague.externalId}&season=${selectedSeasonYear}`,
        { headers: apiHeaders(apiKey) },
      );
      setApiTeams(res.data);
      setSelectedTeamIds(new Set(res.data.map((t: ApiTeam) => t.externalId)));
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Error al cargar equipos', variant: 'destructive' });
    } finally {
      setLoadingTeams(false);
    }
  }

  async function importTeams() {
    if (!importedSeason) return;
    const toImport = apiTeams.filter((t) => selectedTeamIds.has(t.externalId));
    setImportingTeams(true);
    try {
      const res = await api.post('/import/teams', {
        seasonId: importedSeason.id,
        teams: toImport.map((t) => ({
          name: t.name,
          shortName: t.shortName,
          logo: t.logo,
          city: t.city,
        })),
      });
      setImportedTeams(res.data);
      toast({ title: `${res.data.length} equipos importados` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Error al importar equipos', variant: 'destructive' });
    } finally {
      setImportingTeams(false);
    }
  }

  // ── Step 3: Squad ───────────────────────────────────────────────────────────

  async function loadSquad(importedTeam: ImportedTeam) {
    setSquadTeam(importedTeam);
    setApiSquad([]);
    setSelectedPlayerIds(new Set());
    setLoadingSquad(true);
    try {
      // We need the external team ID — fetch from API by team name is hard;
      // Use season-based endpoint: /teams?league=X&season=Y gives externalIds
      // We'll use the externalId stored in apiTeams
      const apiTeam = apiTeams.find((t) => t.name === importedTeam.team.name);
      if (!apiTeam) {
        toast({ title: 'No se pudo encontrar el ID externo del equipo', variant: 'destructive' });
        return;
      }
      const res = await api.get(
        `/import/squad?teamId=${apiTeam.externalId}&season=${selectedSeasonYear}`,
        { headers: apiHeaders(apiKey) },
      );
      setApiSquad(res.data);
      setSelectedPlayerIds(new Set(res.data.map((p: ApiPlayer) => p.externalId)));
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Error al cargar plantel', variant: 'destructive' });
    } finally {
      setLoadingSquad(false);
    }
  }

  async function importSquad() {
    if (!squadTeam) return;
    const toImport = apiSquad.filter((p) => selectedPlayerIds.has(p.externalId));
    setImportingSquad(true);
    try {
      const res = await api.post('/import/squad', {
        teamSeasonId: squadTeam.teamSeasonId,
        players: toImport.map((p) => ({
          firstName: p.firstName,
          lastName: p.lastName,
          number: p.number,
          position: p.position,
          photo: p.photo,
        })),
      });
      toast({ title: `${res.data.length} jugadores importados en ${squadTeam.team.name}` });
      setSquadTeam(null);
      setApiSquad([]);
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Error al importar plantel', variant: 'destructive' });
    } finally {
      setImportingSquad(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Importar desde API-Football</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Importá ligas, equipos y plantillas automáticamente.{' '}
          <a
            href="https://dashboard.api-football.com/register"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
          >
            Obtener API Key gratis <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      </div>

      {/* ── API Key ── */}
      <Card>
        <CardHeader><CardTitle className="text-base">1. Configurar API Key</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2 max-w-md">
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setKeyValid(null); }}
              placeholder="Pegá tu API Key de api-football.com"
              className={keyValid === false ? 'border-red-400' : keyValid ? 'border-green-400' : ''}
            />
            <Button onClick={validateKey} disabled={validating || !apiKey} variant="outline">
              {validating ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Validar'}
            </Button>
          </div>
          {keyValid === true && <p className="text-sm text-green-600 mt-2">✓ Clave válida. Podés continuar.</p>}
          {keyValid === false && <p className="text-sm text-red-500 mt-2">✗ Clave inválida o límite de requests alcanzado.</p>}
          <p className="text-xs text-gray-400 mt-2">
            La clave se usa solo en esta sesión (no se guarda en el servidor).
            Para guardarla permanentemente, añadí FOOTBALL_API_KEY al .env del servidor.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">1.5 Importación manual (sin API de pago)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            Pegá un JSON (desde dataset abierto de internet) para cargar competencia, temporada, equipos, planteles, fixtures y tabla.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setManualJson(JSON.stringify(MANUAL_IMPORT_TEMPLATE, null, 2))}
            >
              Cargar plantilla JSON
            </Button>
            <Button
              size="sm"
              onClick={importManualSeason}
              disabled={importingManual || savingManualAsCurrent || !manualJson.trim()}
            >
              {importingManual ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Guardar en BD
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={saveManualSeasonAsCurrent}
              disabled={savingManualAsCurrent || importingManual || !manualJson.trim()}
            >
              {savingManualAsCurrent ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar + temporada actual
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Persistencia: los cambios se guardan en base de datos solo al usar los botones de guardar.
          </p>
          <textarea
            value={manualJson}
            onChange={(e) => setManualJson(e.target.value)}
            placeholder='Pega aquí el JSON. Ejemplo: {"competition":{"name":"LigaPro Serie A"},"season":{"name":"2025"},"teams":[...]}'
            className="w-full min-h-[260px] border rounded-lg p-3 text-xs font-mono"
          />
          {parsedManualPayload && availableManualRounds.length > 0 && (
            <div className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Editar fecha:</span>
                  <select
                    value={selectedManualRound}
                    onChange={(e) => setSelectedManualRound(Number(e.target.value))}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    {availableManualRounds.map((round) => (
                      <option key={round} value={round}>Fecha {round}</option>
                    ))}
                  </select>
                </div>
                <Button size="sm" variant="outline" onClick={recalculateManualStandings}>
                  Recalcular tabla automáticamente
                </Button>
              </div>

              <div className="space-y-2">
                {selectedRoundFixtures.map(({ fixture, index }) => (
                  <div key={`${fixture.homeTeam}-${fixture.awayTeam}-${index}`} className="border rounded p-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="text-sm font-medium">
                        {fixture.homeTeam} vs {fixture.awayTeam}
                      </div>
                      <select
                        value={(fixture.statusShort as ManualStatus) || 'NS'}
                        onChange={(e) => updateFixtureStatus(index, e.target.value as ManualStatus)}
                        className="border rounded px-2 py-1 text-xs"
                      >
                        <option value="NS">NS</option>
                        <option value="FT">FT</option>
                        <option value="PST">PST</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <Input
                        type="number"
                        min={0}
                        value={fixture.homeScore ?? ''}
                        onChange={(e) => updateFixtureScore(index, 'home', e.target.value)}
                        className="w-20"
                        placeholder="Home"
                      />
                      <span className="text-gray-400">-</span>
                      <Input
                        type="number"
                        min={0}
                        value={fixture.awayScore ?? ''}
                        onChange={(e) => updateFixtureScore(index, 'away', e.target.value)}
                        className="w-20"
                        placeholder="Away"
                      />
                      <span className="text-xs text-gray-500 ml-2">{fixture.matchDate?.slice(0, 10) ?? ''}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={importManualSeason}
                  disabled={importingManual || savingManualAsCurrent || !manualJson.trim()}
                >
                  {importingManual ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                  Guardar cambios en BD
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={saveManualSeasonAsCurrent}
                  disabled={savingManualAsCurrent || importingManual || !manualJson.trim()}
                >
                  {savingManualAsCurrent ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                  Guardar y marcar actual
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Step 1: League ── */}
      <Card className={!apiKey ? 'opacity-50 pointer-events-none' : ''}>
        <CardHeader><CardTitle className="text-base">2. Buscar y seleccionar liga</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Input value={leagueQuery} onChange={(e) => setLeagueQuery(e.target.value)} placeholder="Nombre de la liga..." className="flex-1 min-w-[200px]" onKeyDown={(e) => e.key === 'Enter' && searchLeagues()} />
            <Input value={leagueCountry} onChange={(e) => setLeagueCountry(e.target.value)} placeholder="País (ej: Argentina)" className="w-48" onKeyDown={(e) => e.key === 'Enter' && searchLeagues()} />
            <Button onClick={searchLeagues} disabled={searchingLeagues}>
              {searchingLeagues ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
              Buscar
            </Button>
          </div>

          {leagues.length > 0 && (
            <div className="border rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              {leagues.map((l) => (
                <button
                  key={l.externalId}
                  onClick={() => { setSelectedLeague(l); setSelectedSeasonYear(l.seasons.find((s) => s.current)?.year ?? l.seasons[0]?.year ?? null); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left border-b last:border-0 transition-colors ${
                    selectedLeague?.externalId === l.externalId ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  {l.logo && <img src={l.logo} alt="" className="h-7 w-7 object-contain shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{l.name}</div>
                    <div className="text-xs text-gray-400">{l.country} · {l.type}</div>
                  </div>
                  {selectedLeague?.externalId === l.externalId && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
                </button>
              ))}
            </div>
          )}

          {selectedLeague && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
              {selectedLeague.logo && <img src={selectedLeague.logo} alt="" className="h-9 w-9 object-contain" />}
              <div className="flex-1">
                <div className="font-semibold">{selectedLeague.name}</div>
                <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                  <span>Temporada:</span>
                  <select
                    value={selectedSeasonYear ?? ''}
                    onChange={(e) => setSelectedSeasonYear(Number(e.target.value))}
                    className="border rounded px-1.5 py-0.5 text-xs"
                  >
                    {selectedLeague.seasons.map((s) => (
                      <option key={s.year} value={s.year}>{s.year}{s.current ? ' (actual)' : ''}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={importLeague} disabled={importingLeague || importingFullSeason || !selectedSeasonYear} size="sm" variant="outline">
                  {importingLeague ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                  Solo liga
                </Button>
                <Button onClick={importFullSeason} disabled={importingFullSeason || importingLeague || !selectedSeasonYear} size="sm">
                  {importingFullSeason ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                  Temporada completa
                </Button>
              </div>
            </div>
          )}

          {importedSeason && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
              <Check className="h-4 w-4" />
              <span>
                Liga importada: <strong>{importedSeason.competition?.name ?? selectedLeague?.name ?? 'Liga'}</strong> — Temporada{' '}
                <strong>{importedSeason.name}</strong>
              </span>
              <ChevronRight className="h-4 w-4 ml-auto" />
              <span className="text-xs text-gray-400">Ver equipos abajo</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Step 2: Teams ── */}
      {importedSeason && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                3. Equipos — {importedSeason.competition?.name ?? selectedLeague?.name ?? 'Liga'} {importedSeason.name}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => loadApiTeams()} disabled={loadingTeams}>
                {loadingTeams ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingTeams ? (
              <p className="text-center py-8 text-gray-400">Cargando equipos...</p>
            ) : apiTeams.length === 0 ? (
              <p className="text-sm text-gray-500">No hay equipos. ¿Ya importaste la liga?</p>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{selectedTeamIds.size} / {apiTeams.length} seleccionados</span>
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedTeamIds(new Set(apiTeams.map((t) => t.externalId)))} className="text-blue-600 hover:underline text-xs">Todos</button>
                    <button onClick={() => setSelectedTeamIds(new Set())} className="text-gray-400 hover:underline text-xs">Ninguno</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                  {apiTeams.map((t) => {
                    const selected = selectedTeamIds.has(t.externalId);
                    return (
                      <button
                        key={t.externalId}
                        onClick={() => {
                          const next = new Set(selectedTeamIds);
                          selected ? next.delete(t.externalId) : next.add(t.externalId);
                          setSelectedTeamIds(next);
                        }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
                          selected ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {t.logo && <img src={t.logo} alt="" className="h-6 w-6 object-contain shrink-0" />}
                        <span className="flex-1 truncate">{t.name}</span>
                        {selected && <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-end pt-1">
                  <Button onClick={importTeams} disabled={importingTeams || selectedTeamIds.size === 0}>
                    {importingTeams ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                    Importar {selectedTeamIds.size} equipos
                  </Button>
                </div>
              </>
            )}

            {importedTeams.length > 0 && (
              <div className="border-t pt-3 mt-3">
                <p className="text-sm font-medium mb-2">{importedTeams.length} equipos en la temporada — elegí uno para importar su plantel:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {importedTeams.map((it) => (
                    <button
                      key={it.teamSeasonId}
                      onClick={() => loadSquad(it)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
                        squadTeam?.teamSeasonId === it.teamSeasonId ? 'border-purple-400 bg-purple-50' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {it.team.logo && <img src={it.team.logo} alt="" className="h-6 w-6 object-contain shrink-0" />}
                      <span className="flex-1 truncate">{it.team.name}</span>
                      {it.isNew && <span className="text-xs text-green-600 bg-green-50 px-1.5 rounded">nuevo</span>}
                      <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Squad ── */}
      {squadTeam && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              4. Plantel — {squadTeam.team.logo && <img src={squadTeam.team.logo} alt="" className="inline h-5 w-5 object-contain mr-1" />}
              {squadTeam.team.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingSquad ? (
              <p className="text-center py-8 text-gray-400">Cargando plantel...</p>
            ) : apiSquad.length === 0 ? (
              <p className="text-sm text-gray-500">Sin jugadores disponibles.</p>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{selectedPlayerIds.size} / {apiSquad.length} seleccionados</span>
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedPlayerIds(new Set(apiSquad.map((p) => p.externalId)))} className="text-blue-600 hover:underline text-xs">Todos</button>
                    <button onClick={() => setSelectedPlayerIds(new Set())} className="text-gray-400 hover:underline text-xs">Ninguno</button>
                  </div>
                </div>
                <div className="border rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                  {apiSquad.map((p) => {
                    const selected = selectedPlayerIds.has(p.externalId);
                    return (
                      <button
                        key={p.externalId}
                        onClick={() => {
                          const next = new Set(selectedPlayerIds);
                          selected ? next.delete(p.externalId) : next.add(p.externalId);
                          setSelectedPlayerIds(next);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left border-b last:border-0 transition-colors ${
                          selected ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        {p.photo && <img src={p.photo} alt="" className="h-7 w-7 rounded-full object-cover shrink-0" />}
                        <span className="font-mono text-xs text-gray-400 w-5 shrink-0">{p.number ?? '—'}</span>
                        <span className="flex-1 font-medium truncate">{p.name}</span>
                        <span className="text-xs text-gray-400 shrink-0">{p.position ?? ''}</span>
                        {selected && <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-end pt-1">
                  <Button onClick={importSquad} disabled={importingSquad || selectedPlayerIds.size === 0}>
                    {importingSquad ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                    Importar {selectedPlayerIds.size} jugadores
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
