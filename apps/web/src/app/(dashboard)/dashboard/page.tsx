'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { Plus, Calendar, MapPin, Clock, Eye } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { Modal } from '@/components/ui/modal';
import { useAuthStore } from '@/store/auth-store';

interface MatchSummary {
  id: string;
  fixtureMatchId: string | null;
  status: string;
  matchDate: string;
  homeTeam?: { name?: string; shortName?: string | null; logo?: string | null };
  awayTeam?: { name?: string; shortName?: string | null; logo?: string | null };
  _count: { events: number };
}

interface FixtureItem {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  matchDate: string;
  venue?: string | null;
  round: number | null;
  roundLabel: string | null;
  statusShort: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam?: { name?: string; shortName?: string | null; logo?: string | null } | null;
  awayTeam?: { name?: string; shortName?: string | null; logo?: string | null } | null;
}

interface MatchDetailEvent {
  id: string;
  eventType: string;
  teamSide: 'HOME' | 'AWAY';
  minute: number;
  second: number;
}

interface MatchDetail {
  id: string;
  roster: Array<{ id: string }>;
  events: MatchDetailEvent[];
}

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [fixtures, setFixtures] = useState<FixtureItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [creatingFixtureId, setCreatingFixtureId] = useState<string | null>(null);
  const [detailsBySessionId, setDetailsBySessionId] = useState<Record<string, MatchDetail>>({});
  const [loadingDetailsSessionId, setLoadingDetailsSessionId] = useState<string | null>(null);
  const [selectedFechaKey, setSelectedFechaKey] = useState<string>('');
  const [detailModalSessionId, setDetailModalSessionId] = useState<string | null>(null);

  const matchesByFixtureId = useMemo(() => {
    const map = new Map<string, MatchSummary>();
    for (const match of matches) {
      if (match.fixtureMatchId) map.set(match.fixtureMatchId, match);
    }
    return map;
  }, [matches]);

  const fixturesByFecha = useMemo(() => {
    const groups = new Map<string, FixtureItem[]>();
    for (const fixture of fixtures) {
      const key = fixture.roundLabel || `Fecha ${fixture.round ?? '-'}`;
      const list = groups.get(key) ?? [];
      list.push(fixture);
      groups.set(key, list);
    }

    const ordered = [...groups.entries()].map(([key, value]) => ({
      key,
      fixtures: value.sort(
        (a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime(),
      ),
      order: value[0]?.round ?? Number.MAX_SAFE_INTEGER,
    }));

    return ordered.sort((a, b) => a.order - b.order);
  }, [fixtures]);

  const selectedFechaGroup = useMemo(
    () => fixturesByFecha.find((group) => group.key === selectedFechaKey) ?? fixturesByFecha[0] ?? null,
    [fixturesByFecha, selectedFechaKey],
  );

  useEffect(() => {
    fetchMatches();
  }, [user?.role]);

  useEffect(() => {
    if (fixturesByFecha.length === 0) {
      setSelectedFechaKey('');
      return;
    }
    setSelectedFechaKey((prev) =>
      prev && fixturesByFecha.some((group) => group.key === prev) ? prev : fixturesByFecha[0].key,
    );
  }, [fixturesByFecha]);

  const fetchMatches = async () => {
    try {
      const matchesUrl =
        user?.role === 'SUPERADMIN' ? '/matches?all=1' : '/matches';
      const [matchesRes, fixturesRes] = await Promise.all([
        api.get(matchesUrl),
        api.get('/seasons/current/fixtures'),
      ]);
      setMatches(matchesRes.data ?? []);
      setFixtures(fixturesRes.data?.fixtures ?? []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudieron cargar los partidos',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createFromFixture = async (fixture: FixtureItem) => {
    setCreatingFixtureId(fixture.id);
    try {
      const response = await api.post('/matches', {
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
        matchDate: new Date(fixture.matchDate).toISOString(),
        fixtureMatchId: fixture.id,
        venue: fixture.venue ?? undefined,
      });
      toast({ title: 'Sesión creada', description: 'Partido creado desde fixture importado' });
      router.push(`/match/${response.data.id}`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo crear la sesión',
        variant: 'destructive',
      });
    } finally {
      setCreatingFixtureId(null);
    }
  };

  const openSessionDetail = async (sessionId?: string) => {
    if (!sessionId) return;
    setDetailModalSessionId(sessionId);
    if (detailsBySessionId[sessionId]) return;

    setLoadingDetailsSessionId(sessionId);
    try {
      const response = await api.get(`/matches/${sessionId}`);
      setDetailsBySessionId((prev) => ({ ...prev, [sessionId]: response.data }));
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo cargar el detalle del partido',
        variant: 'destructive',
      });
    } finally {
      setLoadingDetailsSessionId(null);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'SETUP':
        return 'bg-gray-100 text-gray-800';
      case 'LIVE':
        return 'bg-green-100 text-green-800';
      case 'HALFTIME':
        return 'bg-yellow-100 text-yellow-800';
      case 'FINISHED':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      SETUP: 'Configuración',
      LIVE: 'En Vivo',
      HALFTIME: 'Medio Tiempo',
      FINISHED: 'Finalizado',
    };
    return labels[status] || status;
  };

  const getEventLabel = (eventType: string) => {
    const labels: Record<string, string> = {
      GOAL: 'Gol',
      YELLOW_CARD: 'Amarilla',
      RED_CARD: 'Roja',
      FOUL: 'Falta',
      SAVE: 'Atajada',
      OFFSIDE: 'Offside',
      PASS: 'Pase',
      SUBSTITUTION: 'Cambio',
      CORNER: 'Corner',
      FREEKICK: 'Tiro libre',
      PENALTY: 'Penal',
      SHOT: 'Disparo',
      OTHER: 'Otro',
    };
    return labels[eventType] || eventType;
  };

  const parseFechaNumber = (label: string) => {
    const match = label.match(/fecha\s*(\d+)/i);
    return match ? Number(match[1]) : null;
  };

  const formatHeaderDate = (date: string) =>
    new Date(date).toLocaleDateString('es-EC', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const formatHour = (date: string) =>
    new Date(date).toLocaleTimeString('es-EC', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

  const formatShortDate = (date: string) =>
    new Date(date).toLocaleDateString('es-EC', {
      day: '2-digit',
      month: 'short',
    });

  const teamFallback = (name?: string | null) => {
    if (!name) return '?';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  };

  const selectedFixtures = selectedFechaGroup?.fixtures ?? [];
  const stats = selectedFixtures.reduce(
    (acc, fixture) => {
      const session = matchesByFixtureId.get(fixture.id);
      if (!session) {
        acc.withoutSession += 1;
      } else {
        acc.withSession += 1;
        if (session.status === 'LIVE' || session.status === 'HALFTIME') acc.live += 1;
      }
      return acc;
    },
    { total: selectedFixtures.length, withSession: 0, withoutSession: 0, live: 0 },
  );

  const detailModalData = detailModalSessionId ? detailsBySessionId[detailModalSessionId] : null;
  const detailEvents = detailModalData?.events ?? [];
  const detailGoals = detailEvents.filter((e) => e.eventType === 'GOAL').length;
  const detailYellowCards = detailEvents.filter((e) => e.eventType === 'YELLOW_CARD').length;
  const detailRedCards = detailEvents.filter((e) => e.eventType === 'RED_CARD').length;
  const detailLatestEvents = [...detailEvents]
    .sort((a, b) => b.minute * 60 + b.second - (a.minute * 60 + a.second))
    .slice(0, 10);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight">Mis Partidos</h1>
          <p className="text-sm md:text-lg text-muted-foreground">Temporada 2026 - LigaPro Serie A</p>
        </div>
        <Button onClick={() => router.push('/matches/create')}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Partido
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Cargando partidos...</p>
        </div>
      ) : fixtures.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              No hay fixtures importados para la temporada actual.
            </p>
            <Button onClick={() => router.push('/matches/create')}>
              <Plus className="mr-2 h-4 w-4" />
              Crear Partido Manual
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-4 items-start">
            <Card className="h-fit xl:sticky xl:top-4">
              <CardHeader className="pb-1">
                <CardTitle className="text-2xl">Calendario</CardTitle>
                <CardDescription className="text-xs">Selecciona una fecha</CardDescription>
              </CardHeader>
              <CardContent className="space-y-0.5">
                {fixturesByFecha.map((group, idx) => {
                  const withSession = group.fixtures.filter((f) => matchesByFixtureId.has(f.id)).length;
                  const withoutSession = group.fixtures.length - withSession;
                  const isActive = selectedFechaGroup?.key === group.key;
                  const fechaNum = parseFechaNumber(group.key);
                  const firstDate = group.fixtures[0]?.matchDate;
                  return (
                    <button
                      key={group.key}
                      type="button"
                      onClick={() => setSelectedFechaKey(group.key)}
                      className={`w-full text-left border rounded-lg px-2.5 py-2 transition ${
                        isActive ? 'bg-blue-50 border-blue-300 shadow-sm' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="grid grid-cols-[14px_1fr] gap-2 items-start">
                        <div className="flex flex-col items-center">
                          <span className={`h-2.5 w-2.5 rounded-full ${isActive ? 'bg-blue-600' : 'bg-gray-400'}`} />
                          {idx < fixturesByFecha.length - 1 && <span className="w-px h-9 bg-gray-300 mt-1" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-base leading-none">
                              {fechaNum ? `Fecha ${fechaNum}` : group.key}
                            </p>
                            <p className="text-xs text-muted-foreground whitespace-nowrap">
                              {firstDate ? formatHeaderDate(firstDate) : ''}
                            </p>
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                            <span className="rounded-full bg-blue-100 text-blue-800 px-1.5 py-0.5">
                              {group.fixtures.length} partidos
                            </span>
                            {withSession > 0 && (
                              <span className="rounded-full bg-emerald-100 text-emerald-800 px-1.5 py-0.5">
                                {withSession} con sesión
                              </span>
                            )}
                            {withoutSession > 0 && (
                              <span className="rounded-full bg-gray-100 text-gray-700 px-1.5 py-0.5">
                                {withoutSession} sin sesión
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <div className="space-y-3">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-3xl leading-none">{selectedFechaGroup?.key || 'Partidos'}</CardTitle>
                      <CardDescription className="text-base mt-2">
                        {selectedFechaGroup?.fixtures[0]?.matchDate
                          ? formatHeaderDate(selectedFechaGroup.fixtures[0].matchDate)
                          : 'Sin partidos'}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="rounded-xl border bg-white px-4 py-2.5 flex flex-wrap items-center gap-3 text-sm md:text-base font-medium">
                    <span>{stats.total} Partidos</span>
                    <span className="text-gray-300">|</span>
                    <span className="text-emerald-700">● {stats.live} En sesión</span>
                    <span className="text-blue-700">● {stats.withSession} Con sesión</span>
                    <span className="text-gray-500">● {stats.withoutSession} Sin sesión</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-2 md:p-3">
                {!selectedFechaGroup ? (
                  <p className="text-sm text-muted-foreground">No hay partidos para mostrar.</p>
                ) : (
                  <div className="max-w-[1080px] space-y-1.5">
                    <div className="hidden md:grid md:grid-cols-[130px_1fr_132px_170px] gap-2 px-2 pb-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                      <div>Fecha / Hora</div>
                      <div className="border-l border-slate-200 pl-3">Partido</div>
                      <div className="border-l border-slate-200 pl-3">Estado</div>
                      <div className="border-l border-slate-200 pl-3">Acción</div>
                    </div>
                    {selectedFechaGroup.fixtures.map((fixture) => {
                    const session = matchesByFixtureId.get(fixture.id);
                    const isDisabled = fixture.statusShort === 'DIS';
                    const hasResult =
                      fixture.homeScore !== null || fixture.awayScore !== null || fixture.statusShort === 'FT';
                    const sessionStatus = session ? getStatusLabel(session.status) : isDisabled ? 'Deshabilitado' : 'Sin sesión';
                    const sessionStatusClass = session
                      ? getStatusBadgeColor(session.status)
                      : isDisabled
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-700';
                    const timeLabel = formatHour(fixture.matchDate);

                    return (
                      <div key={fixture.id} className="rounded-xl border bg-white px-3 py-2">
                        
                        <div className="grid grid-cols-1 md:grid-cols-[130px_1fr_132px_170px] gap-2 items-center">
                          <div className="leading-tight">
                            <div className="text-base font-semibold tracking-tight">{timeLabel}</div>
                            <div className="text-[11px] text-muted-foreground">{formatShortDate(fixture.matchDate)}</div>
                          </div>

                          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 min-w-0 md:border-l md:border-slate-200 md:pl-3">
                            <div className="min-w-0 flex items-center gap-2">
                              {fixture.homeTeam?.logo ? (
                                <img src={fixture.homeTeam.logo} alt="" className="h-7 w-7 object-contain shrink-0" />
                              ) : (
                                <span className="h-7 w-7 rounded-full bg-gray-100 text-[10px] text-gray-700 flex items-center justify-center border shrink-0">
                                  {teamFallback(fixture.homeTeam?.shortName || fixture.homeTeam?.name)}
                                </span>
                              )}
                              <p className="font-semibold text-lg truncate">{fixture.homeTeam?.name || 'Local'}</p>
                            </div>
                            {hasResult ? (
                              <p className="text-2xl font-bold leading-none">
                                {fixture.homeScore ?? 0} - {fixture.awayScore ?? 0}
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground font-medium">vs</p>
                            )}
                            <div className="min-w-0 flex items-center justify-end gap-2">
                              <p className="font-semibold text-lg truncate text-right">{fixture.awayTeam?.name || 'Visitante'}</p>
                              {fixture.awayTeam?.logo ? (
                                <img src={fixture.awayTeam.logo} alt="" className="h-7 w-7 object-contain shrink-0" />
                              ) : (
                                <span className="h-7 w-7 rounded-full bg-gray-100 text-[10px] text-gray-700 flex items-center justify-center border shrink-0">
                                  {teamFallback(fixture.awayTeam?.shortName || fixture.awayTeam?.name)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="space-y-0.5 md:border-l md:border-slate-200 md:pl-3">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${sessionStatusClass}`}>
                              {sessionStatus}
                            </span>
                            <p className="text-[11px] text-muted-foreground">
                              {session ? `${session._count.events} eventos` : 'Sin sesión creada'}
                            </p>
                          </div>

                          <div className="flex flex-wrap justify-end gap-2 md:border-l md:border-slate-200 md:pl-3">
                            {session ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openSessionDetail(session.id)}
                                >
                                  <Eye className="mr-1 h-4 w-4" />
                                  Detalle
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    router.push(
                                      session.status === 'FINISHED'
                                        ? `/match/${session.id}?readonly=1`
                                        : `/match/${session.id}`,
                                    )
                                  }
                                >
                                  {session.status === 'FINISHED' ? 'Ver resumen' : 'Abrir sesión'}
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                disabled={isDisabled || creatingFixtureId === fixture.id}
                                onClick={() => createFromFixture(fixture)}
                              >
                                {creatingFixtureId === fixture.id ? 'Creando...' : 'Crear sesión'}
                              </Button>
                            )}
                          </div>
                        </div>

                       
                      </div>
                    );
                  })}
                  </div>
                )}
                </CardContent>
              </Card>
            </div>
          </div>

          {detailModalSessionId && (
            <Modal title="Detalle del Partido" onClose={() => setDetailModalSessionId(null)} maxWidth="lg">
              <div className="space-y-3">
                {loadingDetailsSessionId === detailModalSessionId && !detailModalData ? (
                  <p className="text-sm text-muted-foreground">Cargando estadísticas...</p>
                ) : !detailModalData ? (
                  <p className="text-sm text-muted-foreground">No se pudo cargar el detalle.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="rounded-md border p-2">
                        <p className="text-xs text-muted-foreground">Eventos</p>
                        <p className="font-semibold">{detailEvents.length}</p>
                      </div>
                      <div className="rounded-md border p-2">
                        <p className="text-xs text-muted-foreground">Goles</p>
                        <p className="font-semibold">{detailGoals}</p>
                      </div>
                      <div className="rounded-md border p-2">
                        <p className="text-xs text-muted-foreground">Amarillas</p>
                        <p className="font-semibold">{detailYellowCards}</p>
                      </div>
                      <div className="rounded-md border p-2">
                        <p className="text-xs text-muted-foreground">Rojas</p>
                        <p className="font-semibold">{detailRedCards}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">Eventos</p>
                      {detailLatestEvents.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Sin eventos registrados.</p>
                      ) : (
                        <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                          {detailLatestEvents.map((event) => (
                            <div key={event.id} className="text-xs text-muted-foreground rounded border px-2 py-1">
                              {event.minute}'{String(event.second ?? 0).padStart(2, '0')} -{' '}
                              {getEventLabel(event.eventType)} ({event.teamSide === 'HOME' ? 'Local' : 'Visitante'})
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </Modal>
          )}

          {matches.filter((m) => !m.fixtureMatchId).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Partidos manuales sin fixture</CardTitle>
                <CardDescription>Sesiones creadas fuera del calendario importado</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {matches.filter((m) => !m.fixtureMatchId).map((match) => (
                  <div
                    key={match.id}
                    className="border rounded-lg p-3 flex items-center justify-between gap-2"
                  >
                    <div>
                      <p className="font-medium">
                        {match.homeTeam?.name} vs {match.awayTeam?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(match.matchDate)}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        router.push(
                          match.status === 'FINISHED'
                            ? `/match/${match.id}?readonly=1`
                            : `/match/${match.id}`,
                        )
                      }
                    >
                      {match.status === 'FINISHED' ? 'Ver resumen' : 'Abrir'}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
