'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw } from 'lucide-react';

interface Competition {
  id: string;
  name: string;
}

interface Season {
  id: string;
  name: string;
  status: 'CURRENT' | 'HISTORICAL' | 'UPCOMING';
  competition: { id: string; name: string };
}

interface TeamSeason {
  id: string;
  team: { id: string; name: string; shortName: string | null; logo: string | null };
  _count: { players: number };
}

interface StandingRow {
  id: string;
  groupName: string;
  rank: number;
  points: number;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalsDiff: number;
  team: { id: string; name: string; shortName: string | null; logo: string | null };
}

interface MatchSessionSummary {
  id: string;
  status: string;
  narrator: { id: string; name: string; email: string };
}

interface Fixture {
  id: string;
  matchDate: string;
  round: number | null;
  roundLabel: string | null;
  statusShort: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: { id: string; name: string; logo: string | null } | null;
  awayTeam: { id: string; name: string; logo: string | null } | null;
  matchSessions: MatchSessionSummary[];
}

interface FullSeasonResponse {
  season: Season;
  teams: TeamSeason[];
  fixtures: Fixture[];
  standings: StandingRow[];
  summary: {
    teams: number;
    fixtures: number;
    standings: number;
    matchSessions: number;
  };
}

export default function CurrentSeasonPage() {
  const { toast } = useToast();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [competitionId, setCompetitionId] = useState('');
  const [data, setData] = useState<FullSeasonResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [roundUpdating, setRoundUpdating] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'teams' | 'standings' | 'fixtures'>('fixtures');

  const standingsByGroup = useMemo(() => {
    const groups = new Map<string, StandingRow[]>();
    for (const row of data?.standings ?? []) {
      const key = row.groupName || 'General';
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
    }
    return [...groups.entries()];
  }, [data]);

  const fixturesByRound = useMemo(() => {
    const groups = new Map<string, Fixture[]>();
    for (const fixture of data?.fixtures ?? []) {
      const key = String(fixture.round ?? 0);
      const list = groups.get(key) ?? [];
      list.push(fixture);
      groups.set(key, list);
    }

    return [...groups.entries()]
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([round, fixtures]) => ({
        round: Number(round),
        fixtures,
        isDisabled: fixtures.every((f) => f.statusShort === 'DIS'),
      }));
  }, [data]);

  const selectedRoundGroup = useMemo(() => {
    if (fixturesByRound.length === 0) return null;
    if (selectedRound === null) return fixturesByRound[0];
    return fixturesByRound.find((g) => g.round === selectedRound) ?? fixturesByRound[0];
  }, [fixturesByRound, selectedRound]);

  async function loadCompetitions() {
    const res = await api.get('/competitions');
    setCompetitions(res.data);
  }

  async function loadCurrentSeason(selectedCompetitionId?: string) {
    const query = selectedCompetitionId ? `?competitionId=${selectedCompetitionId}` : '';
    const res = await api.get(`/seasons/current/full${query}`);
    setData(res.data);
    setErrorMessage('');
  }

  async function initialLoad() {
    setLoading(true);
    try {
      await loadCompetitions();
      await loadCurrentSeason(competitionId || undefined);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'No se pudo cargar la temporada actual';
      setErrorMessage(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    try {
      await loadCurrentSeason(competitionId || undefined);
      toast({ title: 'Datos actualizados' });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'No se pudo refrescar';
      setErrorMessage(msg);
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setRefreshing(false);
    }
  }

  async function setRoundAvailability(round: number, enabled: boolean) {
    if (!data) return;
    const key = `${data.season.id}:${round}:${enabled ? 'on' : 'off'}`;
    setRoundUpdating(key);
    try {
      await api.patch(`/seasons/${data.season.id}/fixtures/round/${round}/availability`, { enabled });
      await loadCurrentSeason(competitionId || undefined);
      toast({
        title: enabled ? `Fecha ${round} habilitada` : `Fecha ${round} deshabilitada`,
      });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'No se pudo actualizar la fecha';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setRoundUpdating(null);
    }
  }

  useEffect(() => {
    initialLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId]);

  useEffect(() => {
    if (fixturesByRound.length === 0) {
      setSelectedRound(null);
      return;
    }
    if (selectedRound === null || !fixturesByRound.some((g) => g.round === selectedRound)) {
      setSelectedRound(fixturesByRound[0].round);
    }
  }, [fixturesByRound, selectedRound]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Temporada actual</h2>
          <p className="text-sm text-gray-500">
            Vista operativa para alimentar fixtures, plantillas y partidos vigentes.
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={refreshing || loading}>
          {refreshing ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Actualizar
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Liga:</span>
        <select
          value={competitionId}
          onChange={(e) => setCompetitionId(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">Todas (elige temporada vigente global)</option>
          {competitions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-gray-400 py-12 text-center">Cargando temporada actual...</p>
      ) : !data ? (
        <div className="border rounded-xl p-6 bg-white">
          <p className="text-sm text-red-600">{errorMessage || 'No hay temporada actual disponible.'}</p>
          <p className="text-xs text-gray-500 mt-2">
            Sugerencia: importá una temporada desde Admin {'>'} Importar y asegurate que el nombre/fechas correspondan a la vigente.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-gray-500">Temporada</p>
                <p className="font-semibold">{data.season.name}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-gray-500">Equipos</p>
                <p className="font-semibold">{data.summary.teams}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-gray-500">Fixtures</p>
                <p className="font-semibold">{data.summary.fixtures}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-gray-500">Sesiones narradas</p>
                <p className="font-semibold">{data.summary.matchSessions}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="space-y-3">
              <CardTitle className="text-base">Temporada actual · datos</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={activeTab === 'teams' ? 'default' : 'outline'}
                  onClick={() => setActiveTab('teams')}
                >
                  Equipos y plantillas
                </Button>
                <Button
                  size="sm"
                  variant={activeTab === 'standings' ? 'default' : 'outline'}
                  onClick={() => setActiveTab('standings')}
                >
                  Tabla de posiciones
                </Button>
                <Button
                  size="sm"
                  variant={activeTab === 'fixtures' ? 'default' : 'outline'}
                  onClick={() => setActiveTab('fixtures')}
                >
                  Fixtures
                </Button>
              </div>
            </CardHeader>

            {activeTab === 'teams' && (
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {data.teams.map((teamSeason) => (
                    <div key={teamSeason.id} className="border rounded-lg p-3 bg-white flex items-center gap-2">
                      {teamSeason.team.logo && (
                        <img src={teamSeason.team.logo} alt="" className="h-7 w-7 object-contain shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{teamSeason.team.name}</p>
                        <p className="text-xs text-gray-500">{teamSeason._count.players} jugadores</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}

            {activeTab === 'standings' && (
              <CardContent className="space-y-4">
                {standingsByGroup.length === 0 ? (
                  <p className="text-sm text-gray-500">Sin tabla importada.</p>
                ) : (
                  standingsByGroup.map(([groupName, rows]) => (
                    <div key={groupName}>
                      <p className="text-sm font-medium mb-2">{groupName}</p>
                      <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full text-xs sm:text-sm">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="text-left px-2 py-2">#</th>
                              <th className="text-left px-2 py-2">Equipo</th>
                              <th className="text-center px-2 py-2">Pts</th>
                              <th className="text-center px-2 py-2">PJ</th>
                              <th className="text-center px-2 py-2">G</th>
                              <th className="text-center px-2 py-2">E</th>
                              <th className="text-center px-2 py-2">P</th>
                              <th className="text-center px-2 py-2">DG</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row) => (
                              <tr key={row.id} className="border-b last:border-0">
                                <td className="px-2 py-2">{row.rank}</td>
                                <td className="px-2 py-2">{row.team.name}</td>
                                <td className="px-2 py-2 text-center">{row.points}</td>
                                <td className="px-2 py-2 text-center">{row.played}</td>
                                <td className="px-2 py-2 text-center">{row.won}</td>
                                <td className="px-2 py-2 text-center">{row.draw}</td>
                                <td className="px-2 py-2 text-center">{row.lost}</td>
                                <td className="px-2 py-2 text-center">{row.goalsDiff}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            )}

            {activeTab === 'fixtures' && (
              <CardContent className="space-y-3">
              {data.fixtures.length === 0 ? (
                <p className="text-sm text-gray-500">No hay fixtures importados.</p>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-[290px_1fr] gap-3 items-start">
                  <div className="border rounded-xl p-2 bg-white space-y-1">
                    {fixturesByRound.map((group, idx) => {
                      const roundName = group.fixtures[0]?.roundLabel || `Fecha ${group.round}`;
                      const active = selectedRoundGroup?.round === group.round;
                      const withSession = group.fixtures.filter((f) => f.matchSessions.length > 0).length;
                      return (
                        <button
                          key={group.round}
                          type="button"
                          onClick={() => setSelectedRound(group.round)}
                          className={`w-full text-left border rounded-lg px-2.5 py-2 transition ${
                            active ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="grid grid-cols-[14px_1fr] gap-2 items-start">
                            <div className="flex flex-col items-center">
                              <span className={`h-2.5 w-2.5 rounded-full ${active ? 'bg-blue-600' : 'bg-gray-400'}`} />
                              {idx < fixturesByRound.length - 1 && <span className="w-px h-8 bg-gray-300 mt-1" />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate">{roundName}</p>
                              <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                                <span className="rounded-full bg-blue-100 text-blue-800 px-1.5 py-0.5">
                                  {group.fixtures.length} partidos
                                </span>
                                <span className="rounded-full bg-emerald-100 text-emerald-800 px-1.5 py-0.5">
                                  {withSession} con sesión
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedRoundGroup && (
                    <div className="space-y-2">
                      {(() => {
                        const roundName = selectedRoundGroup.fixtures[0]?.roundLabel || `Fecha ${selectedRoundGroup.round}`;
                        const disableKey = `${data.season.id}:${selectedRoundGroup.round}:off`;
                        const enableKey = `${data.season.id}:${selectedRoundGroup.round}:on`;
                        return (
                          <div className="border rounded-xl p-3 bg-white">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="font-semibold text-lg">{roundName}</p>
                                <p className="text-xs text-gray-500">{selectedRoundGroup.fixtures.length} partidos</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-xs px-2 py-1 rounded-full ${
                                    selectedRoundGroup.isDisabled ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                  }`}
                                >
                                  {selectedRoundGroup.isDisabled ? 'Deshabilitada' : 'Habilitada'}
                                </span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={roundUpdating === disableKey}
                                  onClick={() => setRoundAvailability(selectedRoundGroup.round, false)}
                                >
                                  {roundUpdating === disableKey ? 'Guardando...' : 'Deshabilitar'}
                                </Button>
                                <Button
                                  size="sm"
                                  disabled={roundUpdating === enableKey}
                                  onClick={() => setRoundAvailability(selectedRoundGroup.round, true)}
                                >
                                  {roundUpdating === enableKey ? 'Guardando...' : 'Habilitar'}
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="hidden md:grid md:grid-cols-[125px_1fr_120px] gap-2 px-2 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                        <div>Fecha / Hora</div>
                        <div className="border-l border-slate-200 pl-3">Partido</div>
                        <div className="border-l border-slate-200 pl-3">Estado</div>
                      </div>

                      <div className="space-y-1.5">
                        {selectedRoundGroup.fixtures.map((fixture) => {
                          const dt = new Date(fixture.matchDate);
                          const hour = dt.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: true });
                          const dateShort = dt.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' });
                          const hasResult = fixture.homeScore !== null || fixture.awayScore !== null || fixture.statusShort === 'FT';
                          const sessionCount = fixture.matchSessions.length;
                          return (
                            <div key={fixture.id} className="border rounded-xl p-2.5 bg-white">
                              <div className="grid grid-cols-1 md:grid-cols-[125px_1fr_120px] gap-2 items-center">
                                <div className="leading-tight">
                                  <div className="text-sm font-semibold">{hour}</div>
                                  <div className="text-[11px] text-gray-500">{dateShort}</div>
                                </div>
                                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 md:border-l md:border-slate-200 md:pl-3 min-w-0">
                                  <div className="min-w-0 flex items-center gap-2">
                                    {fixture.homeTeam?.logo && <img src={fixture.homeTeam.logo} alt="" className="h-6 w-6 object-contain shrink-0" />}
                                    <span className="font-medium truncate">{fixture.homeTeam?.name ?? 'Local'}</span>
                                  </div>
                                  <span className="font-semibold">
                                    {hasResult ? `${fixture.homeScore ?? 0} - ${fixture.awayScore ?? 0}` : 'vs'}
                                  </span>
                                  <div className="min-w-0 flex items-center justify-end gap-2">
                                    <span className="font-medium truncate text-right">{fixture.awayTeam?.name ?? 'Visitante'}</span>
                                    {fixture.awayTeam?.logo && <img src={fixture.awayTeam.logo} alt="" className="h-6 w-6 object-contain shrink-0" />}
                                  </div>
                                </div>
                                <div className="md:border-l md:border-slate-200 md:pl-3">
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                                    {fixture.statusShort ?? 'N/A'}
                                  </span>
                                  <p className="text-[11px] text-gray-500 mt-0.5">{sessionCount} sesiones</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
              </CardContent>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
