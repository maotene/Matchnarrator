'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Info, Trash2, Undo2 } from 'lucide-react';
import { useMatchStore } from '@/store/match-store';
import { useToast } from '@/hooks/use-toast';
import { Modal } from '@/components/ui/modal';
import api from '@/lib/api';

interface EventTimelineProps {
  matchId: string;
  readOnly?: boolean;
}

export function EventTimeline({ matchId, readOnly = false }: EventTimelineProps) {
  const { toast } = useToast();
  const { match, removeEvent, setMatch } = useMatchStore();
  const [filter, setFilter] = useState<string>('ALL');
  const [smartMode, setSmartMode] = useState(false);
  const [detailEvent, setDetailEvent] = useState<any | null>(null);
  const [detailText, setDetailText] = useState('');
  const [detailMode, setDetailMode] = useState<'view' | 'edit'>('view');
  const [isSavingDetail, setIsSavingDetail] = useState(false);

  const handleDeleteEvent = async (eventId: string) => {
    if (readOnly) return;
    try {
      await api.delete(`/matches/${matchId}/events/${eventId}`);
      removeEvent(eventId);
      toast({ title: 'Evento eliminado' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el evento',
        variant: 'destructive',
      });
    }
  };

  const handleUndo = async () => {
    if (readOnly) return;
    try {
      const response = await api.get(`/matches/${matchId}/events/last-deleted`);
      if (response.data) {
        await api.post(`/matches/${matchId}/events/${response.data.id}/restore`);
        toast({ title: 'Evento restaurado' });
        window.location.reload();
      } else {
        toast({
          title: 'Sin eventos',
          description: 'No hay eventos eliminados para restaurar',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'No se pudo restaurar el evento',
        variant: 'destructive',
      });
    }
  };

  if (!match) return null;

  const openDetail = (event: any) => {
    setDetailEvent(event);
    const currentDetail = event?.payload?.detail ?? '';
    setDetailText(currentDetail);
    setDetailMode(readOnly ? 'view' : currentDetail.trim().length > 0 ? 'view' : 'edit');
  };

  const saveDetail = async () => {
    if (readOnly) return;
    if (!detailEvent) return;
    setIsSavingDetail(true);
    try {
      const updated = await api.patch(`/matches/${matchId}/events/${detailEvent.id}`, {
        payload: {
          ...(detailEvent.payload ?? {}),
          detail: detailText.trim() || undefined,
        },
      });

      const nextEvents = match.events.map((e: any) => (e.id === detailEvent.id ? updated.data : e));
      setMatch({
        ...match,
        events: nextEvents,
      });
      setDetailEvent(updated.data);
      setDetailMode('view');
      toast({ title: 'Detalle guardado' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.response?.data?.message || 'No se pudo guardar el detalle',
        variant: 'destructive',
      });
    } finally {
      setIsSavingDetail(false);
    }
  };

  const filteredEvents = match.events.filter((event: any) => {
    if (filter === 'ALL') return true;
    if (filter === 'HOME') return event.teamSide === 'HOME';
    if (filter === 'AWAY') return event.teamSide === 'AWAY';
    return event.eventType === filter;
  });

  const sortedEvents = filteredEvents
    .slice()
    .sort((a: any, b: any) => {
      if (a.minute !== b.minute) return a.minute - b.minute;
      const as = a.second ?? 0;
      const bs = b.second ?? 0;
      return as - bs;
    });

  const allSortedEvents = (match.events ?? [])
    .slice()
    .sort((a: any, b: any) => {
      if (a.minute !== b.minute) return a.minute - b.minute;
      return (a.second ?? 0) - (b.second ?? 0);
    });

  const eventSecond = (event: any) => event.minute * 60 + (event.second ?? 0);

  const offensiveTypes = new Set(['GOAL', 'SHOT', 'CORNER', 'FREEKICK', 'PENALTY']);
  const disruptiveTypes = new Set(['FOUL', 'YELLOW_CARD', 'RED_CARD']);
  const keyMomentTypes = new Set(['GOAL', 'RED_CARD', 'PENALTY']);

  const smartBlocks: Array<{
    kind: 'MOMENTUM_HOME' | 'MOMENTUM_AWAY' | 'INTENSE';
    teamSide?: 'HOME' | 'AWAY';
    startSecond: number;
    endSecond: number;
    label: string;
  }> = [];

  const pushBlock = (block: (typeof smartBlocks)[number]) => {
    const duplicate = smartBlocks.some(
      (b) =>
        b.kind === block.kind &&
        b.teamSide === block.teamSide &&
        Math.abs(b.startSecond - block.startSecond) < 35,
    );
    if (!duplicate) smartBlocks.push(block);
  };

  (['HOME', 'AWAY'] as const).forEach((side) => {
    const sideEvents = allSortedEvents.filter(
      (e: any) => e.teamSide === side && offensiveTypes.has(e.eventType),
    );
    for (let i = 0; i < sideEvents.length; i += 1) {
      const start = eventSecond(sideEvents[i]);
      const end = start + 180;
      const count = sideEvents.filter((e: any) => {
        const sec = eventSecond(e);
        return sec >= start && sec <= end;
      }).length;
      if (count >= 3) {
        pushBlock({
          kind: side === 'HOME' ? 'MOMENTUM_HOME' : 'MOMENTUM_AWAY',
          teamSide: side,
          startSecond: start,
          endSecond: end,
          label: `Racha ${side === 'HOME' ? 'Local' : 'Visitante'} (${count} ataques)`,
        });
      }
    }
  });

  for (let i = 0; i < allSortedEvents.length; i += 1) {
    const start = eventSecond(allSortedEvents[i]);
    const end = start + 300;
    const count = allSortedEvents.filter((e: any) => {
      const sec = eventSecond(e);
      return sec >= start && sec <= end && disruptiveTypes.has(e.eventType);
    }).length;
    if (count >= 5) {
      pushBlock({
        kind: 'INTENSE',
        startSecond: start,
        endSecond: end,
        label: `Partido cortado (${count} faltas/tarjetas)`,
      });
    }
  }

  const isEventInSmartBlock = (event: any) => {
    const sec = eventSecond(event);
    return smartBlocks.some((b) => sec >= b.startSecond && sec <= b.endSecond);
  };

  const smartEvents = sortedEvents.filter((event: any) => {
    if (keyMomentTypes.has(event.eventType)) return true;
    return isEventInSmartBlock(event);
  });

  const displayEvents = smartMode ? smartEvents : sortedEvents;

  const eventWeights: Record<string, number> = {
    GOAL: 5,
    SHOT: 3,
    CORNER: 2,
    FREEKICK: 2,
    PENALTY: 3,
    PASS: 1,
    OFFSIDE: 1,
  };
  const homeMomentum = allSortedEvents
    .filter((e: any) => e.teamSide === 'HOME')
    .reduce((acc: number, e: any) => acc + (eventWeights[e.eventType] ?? 0), 0);
  const awayMomentum = allSortedEvents
    .filter((e: any) => e.teamSide === 'AWAY')
    .reduce((acc: number, e: any) => acc + (eventWeights[e.eventType] ?? 0), 0);
  const momentumTotal = Math.max(homeMomentum + awayMomentum, 1);
  const homeMomentumPct = Math.round((homeMomentum * 100) / momentumTotal);
  const awayMomentumPct = 100 - homeMomentumPct;

  const getEventIcon = (type: string) => {
    const icons: Record<string, string> = {
      GOAL: '⚽',
      FOUL: '🚫',
      SAVE: '🧤',
      YELLOW_CARD: '🟨',
      RED_CARD: '🟥',
      CORNER: '🚩',
      SHOT: '🎯',
      PASS: '⚽',
      OFFSIDE: '🏴',
      SUBSTITUTION: '🔄',
    };
    return icons[type] || '📝';
  };

  const getEventLabel = (type: string) => {
    const labels: Record<string, string> = {
      GOAL: 'Gol',
      FOUL: 'Falta',
      SAVE: 'Atajada',
      YELLOW_CARD: 'Tarjeta Amarilla',
      RED_CARD: 'Tarjeta Roja',
      CORNER: 'Corner',
      SHOT: 'Disparo',
      PASS: 'Pase',
      OFFSIDE: 'Offside',
      SUBSTITUTION: 'Cambio',
      OTHER: 'Otro',
    };
    return labels[type] || type;
  };

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-3xl md:text-4xl leading-tight">Timeline de Eventos</CardTitle>
          <Button size="lg" variant="outline" onClick={handleUndo} className="rounded-2xl" disabled={readOnly}>
            <Undo2 className="mr-2 h-4 w-4" />
            Deshacer
          </Button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="lg"
            className="rounded-2xl"
            variant={filter === 'ALL' ? 'default' : 'outline'}
            onClick={() => setFilter('ALL')}
          >
            Todos
          </Button>
          <Button
            size="lg"
            className="rounded-2xl"
            variant={filter === 'HOME' ? 'default' : 'outline'}
            onClick={() => setFilter('HOME')}
          >
            Local
          </Button>
          <Button
            size="lg"
            className="rounded-2xl"
            variant={filter === 'AWAY' ? 'default' : 'outline'}
            onClick={() => setFilter('AWAY')}
          >
            Visitante
          </Button>
          <Button
            size="lg"
            className="rounded-2xl"
            variant={filter === 'GOAL' ? 'default' : 'outline'}
            onClick={() => setFilter('GOAL')}
          >
            ⚽ Goles
          </Button>
          <Button
            size="lg"
            className="rounded-2xl"
            variant={filter === 'YELLOW_CARD' ? 'default' : 'outline'}
            onClick={() => setFilter('YELLOW_CARD')}
          >
            🟨 Amarillas
          </Button>
          <Button
            size="lg"
            className="rounded-2xl"
            variant={smartMode ? 'default' : 'outline'}
            onClick={() => setSmartMode((prev) => !prev)}
          >
            🧠 Solo inteligente
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3 rounded-xl border p-2.5 bg-white">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium text-blue-700">{match.homeTeam.shortName || match.homeTeam.name} {homeMomentumPct}%</span>
            <span className="font-medium text-red-700">{match.awayTeam.shortName || match.awayTeam.name} {awayMomentumPct}%</span>
          </div>
          <div className="h-2 w-full rounded-full overflow-hidden bg-slate-100">
            <div className="h-full bg-blue-500" style={{ width: `${homeMomentumPct}%` }} />
          </div>
        </div>

        {smartBlocks.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {smartBlocks.slice(0, 8).map((block, idx) => {
              const minStart = Math.floor(block.startSecond / 60);
              const minEnd = Math.floor(block.endSecond / 60);
              const tone =
                block.kind === 'MOMENTUM_HOME'
                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                  : block.kind === 'MOMENTUM_AWAY'
                    ? 'bg-red-50 text-red-800 border-red-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200';
              return (
                <span
                  key={`${block.kind}-${block.startSecond}-${idx}`}
                  className={`text-[11px] px-2 py-1 rounded-full border ${tone}`}
                >
                  {minStart}&apos;-{minEnd}&apos; {block.label}
                </span>
              );
            })}
          </div>
        )}

        <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
          {displayEvents.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No hay eventos registrados</p>
          ) : (
            displayEvents.map((event: any, index: number) => {
              const isHome = event.teamSide === 'HOME';
              const hasDetail = Boolean(event?.payload?.detail && String(event.payload.detail).trim().length > 0);
              const minuteLabel = `${event.minute}'${event.second !== undefined ? String(event.second).padStart(2, '0') + '"' : ''}`;
              const playerName = event.rosterPlayer?.customName
                ? event.rosterPlayer.customName
                : event.rosterPlayer?.player
                  ? `${event.rosterPlayer.jerseyNumber} ${event.rosterPlayer.player.lastName}`
                  : 'Sin jugador';
              const teamName = isHome
                ? (match.homeTeam.shortName || match.homeTeam.name)
                : (match.awayTeam.shortName || match.awayTeam.name);

              return (
                <div key={event.id} className="grid grid-cols-[106px_1fr] gap-2 items-stretch">
                  <div className="relative">
                    {index < displayEvents.length - 1 && (
                      <div className="absolute left-4 top-9 bottom-[-10px] border-l-2 border-dashed border-gray-300" />
                    )}
                    <div className="rounded-full border bg-white px-2 py-1.5 h-8 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0" />
                      <span className="text-[11px] font-semibold text-gray-800">{minuteLabel}</span>
                    
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => handleDeleteEvent(event.id)}
                          className="text-red-500 hover:text-red-700"
                          title="Eliminar evento"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => openDetail(event)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openDetail(event);
                      }
                    }}
                    className={`rounded-lg border px-2.5 py-1.5 flex items-center justify-between gap-2 ${
                      isHome
                        ? 'border-blue-200 bg-gradient-to-r from-blue-50 to-slate-50'
                        : 'border-red-200 bg-gradient-to-r from-red-50 to-rose-50'
                    } cursor-pointer hover:shadow-sm transition-shadow`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-2xl leading-none">{getEventIcon(event.eventType)}</span>
                      <div className="min-w-0">
                        <div className="text-sm md:text-base font-semibold tracking-tight leading-tight">
                          {getEventLabel(event.eventType).toUpperCase()}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">{playerName}</div>
                        <div className="mt-0.5">
                          <span
                            className={`inline-flex text-[10px] px-1.5 py-0.5 rounded-full border ${
                              hasDetail
                                ? 'text-emerald-700 border-emerald-300 bg-emerald-50'
                                : 'text-gray-500 border-gray-200 bg-gray-50'
                            }`}
                          >
                            {hasDetail ? 'Con detalle' : 'Sin detalle'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetail(event);
                        }}
                        className={`rounded p-1 ${
                          hasDetail
                            ? 'text-emerald-700 hover:bg-emerald-100'
                            : isHome
                              ? 'text-blue-700 hover:bg-blue-100'
                              : 'text-red-700 hover:bg-red-100'
                        }`}
                        title="Ver detalle"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                      <div className={`text-sm font-semibold ${isHome ? 'text-blue-700' : 'text-red-700'}`}>
                        {teamName}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>

      {detailEvent && (
        <Modal title="Detalle del Evento" onClose={() => setDetailEvent(null)} maxWidth="md">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {detailEvent.minute}&apos;{String(detailEvent.second ?? 0).padStart(2, '0')}" ·{' '}
              <strong>{getEventLabel(detailEvent.eventType)}</strong>
            </p>

            {detailMode === 'view' || readOnly ? (
              <div className="rounded-lg border p-3 bg-gray-50">
                {detailText?.trim() ? (
                  <p className="text-sm whitespace-pre-wrap">{detailText}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin detalle registrado.</p>
                )}
              </div>
            ) : (
              <textarea
                value={detailText}
                onChange={(e) => setDetailText(e.target.value)}
                placeholder="Ej: gol esquinado, golazo, remate cruzado, mano a mano..."
                className="w-full min-h-[110px] rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
              />
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDetailEvent(null)}>
                Cerrar
              </Button>
              {readOnly ? null : detailMode === 'view' ? (
                <Button onClick={() => setDetailMode('edit')}>
                  {detailText?.trim() ? 'Editar' : 'Agregar detalle'}
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setDetailMode('view')}>
                    Cancelar edición
                  </Button>
                  <Button onClick={saveDetail} disabled={isSavingDetail}>
                    {isSavingDetail ? 'Guardando...' : 'Guardar cambios'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
}
