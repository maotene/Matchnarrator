'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, DragEvent, SetStateAction } from 'react';
import { Stage, Layer, Rect, Circle, Text } from 'react-konva';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMatchStore } from '@/store/match-store';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { Save, Trash2, Plus, Search } from 'lucide-react';

interface RosterEntry {
  key: string;
  rosterId?: string;
  playerId: string;
  displayName: string;
  jerseyNumber: number;
  position: string | null;
  isStarter: boolean;
  isNew: boolean;
  markedForDelete: boolean;
  layoutX?: number;
  layoutY?: number;
}

interface CatalogPlayer {
  playerId: string;
  firstName: string;
  lastName: string;
  position: string | null;
  defaultJersey: number;
}

interface SquadOptionsResponse {
  season: {
    id: string;
    name: string;
    competition?: { id: string; name: string } | null;
  };
  homeTeam: {
    id: string;
    name: string;
    squad: CatalogPlayer[];
  };
  awayTeam: {
    id: string;
    name: string;
    squad: CatalogPlayer[];
  };
}

interface RosterSetupProps {
  matchId: string;
  onConfirmed: () => void;
}

const FIELD_WIDTH = 560;
const FIELD_HEIGHT = 340;
const STARTER_SLOTS: Array<{ x: number; y: number }> = [
  { x: 8, y: 50 },
  { x: 22, y: 20 },
  { x: 22, y: 38 },
  { x: 22, y: 62 },
  { x: 22, y: 80 },
  { x: 42, y: 28 },
  { x: 42, y: 50 },
  { x: 42, y: 72 },
  { x: 64, y: 24 },
  { x: 64, y: 50 },
  { x: 64, y: 76 },
];

function defaultName(p: { firstName: string; lastName: string }) {
  return `${p.lastName}, ${p.firstName}`;
}

function getInitials(name: string) {
  const cleaned = name.replace(',', ' ').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '--';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function normalizeDisplayName(name: string) {
  if (!name.includes(',')) return name;
  const parts = name.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return name;
  return `${parts[1]} ${parts[0]}`.trim();
}

function starterSlot(index: number, side: 'home' | 'away') {
  const base = STARTER_SLOTS[index] ?? STARTER_SLOTS[STARTER_SLOTS.length - 1];
  if (side === 'home') return base;
  return { x: 100 - base.x, y: base.y };
}

function buildCatalogEntries(catalog: CatalogPlayer[]): RosterEntry[] {
  return catalog.map((p) => ({
    key: `new-${p.playerId}`,
    playerId: p.playerId,
    displayName: defaultName(p),
    jerseyNumber: p.defaultJersey,
    position: p.position,
    isStarter: false,
    isNew: true,
    markedForDelete: false,
  }));
}

function normalizeLegacyEntries(entries: RosterEntry[]) {
  const active = entries.filter((e) => !e.markedForDelete);
  const starters = active.filter((e) => e.isStarter);

  if (active.length > 0 && starters.length >= active.length) {
    return entries.map((e) => ({
      ...e,
      isStarter: false,
      layoutX: undefined,
      layoutY: undefined,
    }));
  }

  if (starters.length > 11) {
    return entries.map((e) => ({
      ...e,
      isStarter: false,
      layoutX: undefined,
      layoutY: undefined,
    }));
  }

  return entries;
}

export function RosterSetup({ matchId, onConfirmed }: RosterSetupProps) {
  const { toast } = useToast();
  const { match } = useMatchStore();

  const [homeEntries, setHomeEntries] = useState<RosterEntry[]>([]);
  const [awayEntries, setAwayEntries] = useState<RosterEntry[]>([]);
  const [homeCatalog, setHomeCatalog] = useState<CatalogPlayer[]>([]);
  const [awayCatalog, setAwayCatalog] = useState<CatalogPlayer[]>([]);
  const [seasonLabel, setSeasonLabel] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedSide, setSelectedSide] = useState<'home' | 'away'>('home');
  const [showAdd, setShowAdd] = useState(false);
  const [availableSearch, setAvailableSearch] = useState('');

  const homeActive = useMemo(() => homeEntries.filter((e) => !e.markedForDelete && e.jerseyNumber > 0), [homeEntries]);
  const awayActive = useMemo(() => awayEntries.filter((e) => !e.markedForDelete && e.jerseyNumber > 0), [awayEntries]);
  const homeStarters = useMemo(() => homeActive.filter((e) => e.isStarter), [homeActive]);
  const awayStarters = useMemo(() => awayActive.filter((e) => e.isStarter), [awayActive]);

  const canStart =
    homeActive.length >= 11 &&
    awayActive.length >= 11 &&
    homeStarters.length === 11 &&
    awayStarters.length === 11;

  useEffect(() => {
    if (match) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.id]);

  async function load() {
    setIsLoading(true);
    try {
      const squadRes = await api.get(`/matches/${matchId}/squad-options`);
      const squadData: SquadOptionsResponse = squadRes.data;

      const hCatalog = (squadData.homeTeam?.squad ?? []).slice().sort((a, b) => a.defaultJersey - b.defaultJersey);
      const aCatalog = (squadData.awayTeam?.squad ?? []).slice().sort((a, b) => a.defaultJersey - b.defaultJersey);
      setHomeCatalog(hCatalog);
      setAwayCatalog(aCatalog);
      setSeasonLabel(`${squadData.season.competition?.name ?? 'Liga'} — ${squadData.season.name}`);

      const existingRoster: any[] = match?.roster ?? [];

      if (existingRoster.length > 0) {
        const mapExisting = (isHome: boolean, side: 'home' | 'away'): RosterEntry[] =>
          existingRoster
            .filter((r) => r.isHomeTeam === isHome)
            .sort((a, b) => a.jerseyNumber - b.jerseyNumber)
            .map((r, idx) => {
              const fallback = starterSlot(idx, side);
              return {
                key: r.id,
                rosterId: r.id,
                playerId: r.playerId,
                displayName: r.customName ?? (r.player ? defaultName(r.player) : `#${r.jerseyNumber}`),
                jerseyNumber: r.jerseyNumber,
                position: r.player?.position ?? null,
                isStarter: Boolean(r.isStarter),
                isNew: false,
                markedForDelete: false,
                layoutX: r.layoutX ?? (r.isStarter ? fallback.x : undefined),
                layoutY: r.layoutY ?? (r.isStarter ? fallback.y : undefined),
              };
            });

        setHomeEntries(normalizeLegacyEntries(mapExisting(true, 'home')));
        setAwayEntries(normalizeLegacyEntries(mapExisting(false, 'away')));
      } else {
        setHomeEntries(buildCatalogEntries(hCatalog));
        setAwayEntries(buildCatalogEntries(aCatalog));
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'No se pudieron cargar los datos',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  function validateBeforeSave() {
    if (homeActive.length < 11 || awayActive.length < 11) {
      toast({
        title: 'Plantilla incompleta',
        description: 'Cada equipo debe tener al menos 11 jugadores cargados',
        variant: 'destructive',
      });
      return false;
    }

    if (homeStarters.length !== 11 || awayStarters.length !== 11) {
      toast({
        title: 'Titulares inválidos',
        description: 'Debes completar exactamente 11 titulares en cancha por equipo',
        variant: 'destructive',
      });
      return false;
    }

    return true;
  }

  async function saveRoster(showSuccessToast = true) {
    if (!match || !validateBeforeSave()) return false;

    setIsSaving(true);
    try {
      for (const e of [...homeEntries, ...awayEntries]) {
        if (e.markedForDelete && e.rosterId) {
          await api.delete(`/matches/${matchId}/roster/${e.rosterId}`);
        }
      }

      for (const e of homeActive.filter((x) => x.isNew)) {
        const res = await api.post(`/matches/${matchId}/roster`, {
          playerId: e.playerId,
          teamId: match.homeTeam.id,
          jerseyNumber: e.jerseyNumber,
          isHomeTeam: true,
          customName: e.displayName,
          isStarter: e.isStarter,
        });

        if (e.layoutX !== undefined || e.layoutY !== undefined) {
          await api.patch(`/matches/${matchId}/roster/${res.data.id}`, {
            layoutX: e.layoutX,
            layoutY: e.layoutY,
          });
        }
      }

      for (const e of awayActive.filter((x) => x.isNew)) {
        const res = await api.post(`/matches/${matchId}/roster`, {
          playerId: e.playerId,
          teamId: match.awayTeam.id,
          jerseyNumber: e.jerseyNumber,
          isHomeTeam: false,
          customName: e.displayName,
          isStarter: e.isStarter,
        });

        if (e.layoutX !== undefined || e.layoutY !== undefined) {
          await api.patch(`/matches/${matchId}/roster/${res.data.id}`, {
            layoutX: e.layoutX,
            layoutY: e.layoutY,
          });
        }
      }

      for (const e of [...homeActive, ...awayActive].filter((x) => !x.isNew && x.rosterId)) {
        await api.patch(`/matches/${matchId}/roster/${e.rosterId}`, {
          jerseyNumber: e.jerseyNumber,
          customName: e.displayName,
          isStarter: e.isStarter,
          layoutX: e.layoutX,
          layoutY: e.layoutY,
        });
      }

      if (showSuccessToast) toast({ title: 'Alineaciones guardadas' });
      onConfirmed();
      await load();
      return true;
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Error al guardar alineaciones',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleContinueToEvents() {
    const ok = await saveRoster(false);
    if (!ok) return;

    toast({
      title: 'Alineaciones listas',
      description: 'En la siguiente pantalla usa el botón Iniciar del cronómetro',
    });
    onConfirmed();
  }

  if (isLoading) {
    return <div className="text-center py-16 text-muted-foreground">Cargando pre-partido...</div>;
  }

  const currentEntries = selectedSide === 'home' ? homeEntries : awayEntries;
  const currentCatalog = selectedSide === 'home' ? homeCatalog : awayCatalog;
  const setCurrentEntries = selectedSide === 'home' ? setHomeEntries : setAwayEntries;
  const currentTeamName = selectedSide === 'home' ? match?.homeTeam.name ?? 'Local' : match?.awayTeam.name ?? 'Visitante';
  const currentColor = selectedSide === 'home' ? 'blue' : 'red';
  const currentActive = currentEntries.filter((e) => !e.markedForDelete);
  const currentStarters = currentActive.filter((e) => e.isStarter);
  const currentAvailable = currentActive.filter((e) => !e.isStarter);
  const addedPlayerIds = new Set(currentActive.map((e) => e.playerId));
  const addable = currentCatalog.filter((p) => !addedPlayerIds.has(p.playerId));
  const filteredAvailable = currentAvailable.filter((entry) => {
    const q = availableSearch.trim().toLowerCase();
    if (!q) return true;
    const byName = normalizeDisplayName(entry.displayName).toLowerCase().includes(q);
    const byNumber = String(entry.jerseyNumber).includes(q);
    return byName || byNumber;
  });

  function addFromCatalog(player: CatalogPlayer) {
    const nextEntry: RosterEntry = {
      key: `new-${player.playerId}-${Date.now()}`,
      playerId: player.playerId,
      displayName: defaultName(player),
      jerseyNumber: player.defaultJersey,
      position: player.position,
      isStarter: false,
      isNew: true,
      markedForDelete: false,
    };
    setCurrentEntries((prev) => [...prev, nextEntry]);
    setShowAdd(false);
  }

  function removeEntry(key: string) {
    setCurrentEntries((prev) => prev.map((e) => (e.key === key ? { ...e, markedForDelete: true } : e)));
  }

  function demoteStarter(key: string) {
    setCurrentEntries((prev) =>
      prev.map((e) => (e.key === key ? { ...e, isStarter: false, layoutX: undefined, layoutY: undefined } : e)),
    );
  }

  function promoteByButton(key: string) {
    if (currentStarters.length >= 11) return;
    setCurrentEntries((prev) =>
      prev.map((e) =>
        e.key === key
          ? {
              ...e,
              isStarter: true,
              // start at center so narrator can reposition
              layoutX: 50,
              layoutY: 50,
            }
          : e,
      ),
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Pre-partido</CardTitle>
          <p className="text-sm text-muted-foreground">
            Completa las alineaciones en cancha (11 titulares por equipo) y luego inicia el registro.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <Stat label="Temporada" value={seasonLabel || '—'} />
            <Stat label="Fecha / Hora" value={match?.matchDate ? new Date(match.matchDate).toLocaleString('es-EC') : '—'} />
            <Stat label="Estadio" value={match?.venue || 'Por definir'} />
            <Stat label="Eventos cargados" value={String(match?.events?.length ?? 0)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Alineaciones</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Arrastra jugadores disponibles a la cancha hasta completar 11 titulares por equipo.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => saveRoster(true)} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Guardando...' : 'Guardar'}
            </Button>
            <Button onClick={handleContinueToEvents} disabled={isSaving || !canStart}>
              Guardar y Continuar
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <TeamSelectorButton
                active={selectedSide === 'home'}
                onClick={() => setSelectedSide('home')}
                teamName={match?.homeTeam.name ?? 'Local'}
                subtitle={`${homeActive.length} jug · ${homeStarters.length}/11 TIT`}
                color="blue"
              />
              <TeamSelectorButton
                active={selectedSide === 'away'}
                onClick={() => setSelectedSide('away')}
                teamName={match?.awayTeam.name ?? 'Visitante'}
                subtitle={`${awayActive.length} jug · ${awayStarters.length}/11 TIT`}
                color="red"
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium">Plantilla disponible</p>
                  <p className="text-xs text-muted-foreground">{currentAvailable.length} por ubicar</p>
                </div>

                <div className="relative mb-2">
                  <Search className="h-4 w-4 text-gray-400 absolute left-2 top-2.5" />
                  <input
                    value={availableSearch}
                    onChange={(e) => setAvailableSearch(e.target.value)}
                    placeholder="Buscar por número o nombre"
                    className="w-full h-9 rounded-md border pl-8 pr-3 text-sm"
                  />
                </div>

                <div className="max-h-[460px] overflow-y-auto space-y-1">
                  {filteredAvailable.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Ya no hay jugadores pendientes de ubicar.</p>
                  ) : (
                    filteredAvailable.map((entry) => (
                      <div
                        key={entry.key}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/roster-key', entry.key);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        className="border rounded-md px-3 py-2 flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing hover:bg-gray-50"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {entry.jerseyNumber} · {normalizeDisplayName(entry.displayName)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {getInitials(entry.displayName)} · {entry.position ?? 'N/A'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => promoteByButton(entry.key)}
                            disabled={currentStarters.length >= 11}
                            className="text-xs border rounded px-2 py-1 hover:bg-green-50 disabled:opacity-40"
                            title="Agregar a la cancha"
                          >
                            + Agregar
                          </button>
                          <button
                            type="button"
                            onClick={() => removeEntry(entry.key)}
                            className="text-gray-300 hover:text-red-500"
                            title="Quitar de convocatoria"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-3 border-t pt-3">
                  {!showAdd ? (
                    <button
                      type="button"
                      onClick={() => setShowAdd(true)}
                      disabled={addable.length === 0}
                      className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus className="h-4 w-4" />
                      {addable.length > 0
                        ? `Agregar jugador del catálogo (${addable.length} disponibles)`
                        : 'Todos los jugadores del catálogo están convocados'}
                    </button>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-600">Seleccionar del catálogo</span>
                        <button
                          type="button"
                          onClick={() => setShowAdd(false)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Cerrar
                        </button>
                      </div>
                      <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                        {addable.map((p) => (
                          <button
                            type="button"
                            key={p.playerId}
                            onClick={() => addFromCatalog(p)}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
                          >
                            <span className="font-mono text-xs text-gray-400 w-6 text-center shrink-0">{p.defaultJersey || '?'}</span>
                            <span className="flex-1">{defaultName(p)}</span>
                            <span className="text-xs text-gray-400">{p.position ?? ''}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <MiniLineupBoard
                  side={selectedSide}
                  teamName={currentTeamName}
                  color={currentColor}
                  entries={currentEntries}
                  setEntries={setCurrentEntries}
                  starters={currentStarters}
                />

                <div className="border rounded-lg p-3">
                  <p className="font-medium mb-2">Titulares en cancha ({currentStarters.length}/11)</p>
                  <div className="space-y-1 text-sm">
                    {Array.from({ length: 11 }).map((_, idx) => {
                      const player = currentStarters[idx];
                      if (!player) {
                        return (
                          <div key={idx} className="text-muted-foreground">{idx + 1}: (vacío)</div>
                        );
                      }

                      const initials = getInitials(player.displayName);
                      return (
                        <div key={player.key} className="flex items-center justify-between gap-2">
                          <span className="truncate">
                            {idx + 1} {initials} {player.jerseyNumber}: {normalizeDisplayName(player.displayName)}
                          </span>
                          <button
                            type="button"
                            onClick={() => demoteStarter(player.key)}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Quitar
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3 bg-white">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium mt-1">{value}</p>
    </div>
  );
}

function TeamSelectorButton({
  active,
  onClick,
  teamName,
  subtitle,
  color,
}: {
  active: boolean;
  onClick: () => void;
  teamName: string;
  subtitle: string;
  color: 'blue' | 'red';
}) {
  const activeClass = color === 'blue' ? 'bg-blue-50 border-blue-300' : 'bg-red-50 border-red-300';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full border rounded-lg p-3 text-left transition ${active ? activeClass : 'hover:bg-gray-50'}`}
    >
      <p className="font-semibold text-sm">{teamName}</p>
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    </button>
  );
}

function MiniLineupBoard({
  side,
  teamName,
  color,
  entries,
  setEntries,
  starters,
}: {
  side: 'home' | 'away';
  teamName: string;
  color: 'blue' | 'red';
  entries: RosterEntry[];
  setEntries: Dispatch<SetStateAction<RosterEntry[]>>;
  starters: RosterEntry[];
}) {
  const dropRef = useRef<HTMLDivElement | null>(null);
  const [isOver, setIsOver] = useState(false);

  function updateLayout(key: string, x: number, y: number) {
    const clampedX = Math.max(4, Math.min(96, x));
    const clampedY = Math.max(5, Math.min(95, y));
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, layoutX: clampedX, layoutY: clampedY } : e)));
  }

  function promoteToStarter(key: string, x: number, y: number) {
    setEntries((prev) =>
      prev.map((e) =>
        e.key === key
          ? {
              ...e,
              isStarter: true,
              layoutX: x,
              layoutY: y,
            }
          : e,
      ),
    );
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsOver(false);

    const key = e.dataTransfer.getData('text/roster-key');
    if (!key) return;
    if (starters.length >= 11) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    promoteToStarter(key, x, y);
  }

  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="font-medium">{teamName} · Titulares en cancha</p>
        <p className="text-xs text-muted-foreground">Arrastra para ubicar ({starters.length}/11)</p>
      </div>

      <div
        ref={dropRef}
        onDragOver={(e) => {
          e.preventDefault();
          setIsOver(true);
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={handleDrop}
        className={`overflow-x-auto rounded-md ${isOver ? 'ring-2 ring-blue-300' : ''}`}
      >
        <div className="min-w-[560px]">
          <Stage width={FIELD_WIDTH} height={FIELD_HEIGHT}>
            <Layer>
              <Rect x={0} y={0} width={FIELD_WIDTH} height={FIELD_HEIGHT} fill="#1e7d3e" cornerRadius={8} />
              <Rect x={10} y={10} width={FIELD_WIDTH - 20} height={FIELD_HEIGHT - 20} stroke="white" strokeWidth={2} />
              <Rect x={FIELD_WIDTH / 2} y={10} width={1} height={FIELD_HEIGHT - 20} fill="white" />
              <Circle x={FIELD_WIDTH / 2} y={FIELD_HEIGHT / 2} radius={42} stroke="white" strokeWidth={2} />

              {starters.map((player, idx) => {
                const slot = starterSlot(idx, side);
                const x = ((player.layoutX ?? slot.x) / 100) * FIELD_WIDTH;
                const y = ((player.layoutY ?? slot.y) / 100) * FIELD_HEIGHT;
                const initials = getInitials(player.displayName);

                return [
                  <Circle
                    key={`c-${player.key}`}
                    x={x}
                    y={y}
                    radius={20}
                    fill={color === 'blue' ? '#2563eb' : '#dc2626'}
                    stroke="white"
                    strokeWidth={2}
                    draggable
                    onDragEnd={(evt) => {
                      const nx = (evt.target.x() / FIELD_WIDTH) * 100;
                      const ny = (evt.target.y() / FIELD_HEIGHT) * 100;
                      updateLayout(player.key, nx, ny);
                    }}
                  />,
                  <Text
                    key={`t-${player.key}`}
                    x={x - 18}
                    y={y - 7}
                    width={36}
                    align="center"
                    text={`${player.jerseyNumber} ${initials}`}
                    fontSize={10}
                    fill="white"
                    fontStyle="bold"
                    listening={false}
                  />,
                ];
              })}
            </Layer>
          </Stage>
        </div>
      </div>

      {starters.length === 0 && (
        <p className="text-xs text-muted-foreground mt-2">
          Cancha vacía. Arrastra jugadores desde la lista de disponibles.
        </p>
      )}
    </div>
  );
}
