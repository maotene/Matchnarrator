'use client';

import { useEffect, useState } from 'react';
import { useMatchStore } from '@/store/match-store';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { X } from 'lucide-react';

export const EVENT_META: Record<string, { label: string; icon: string }> = {
  GOAL:         { label: 'Gol',             icon: '⚽' },
  FOUL:         { label: 'Falta',           icon: '🚫' },
  SAVE:         { label: 'Atajada',         icon: '🧤' },
  YELLOW_CARD:  { label: 'T. Amarilla',     icon: '🟨' },
  RED_CARD:     { label: 'T. Roja',         icon: '🟥' },
  CORNER:       { label: 'Corner',          icon: '🚩' },
  SHOT:         { label: 'Disparo',         icon: '🎯' },
  PASS:         { label: 'Pase',            icon: '🔵' },
  OFFSIDE:      { label: 'Offside',         icon: '🏴' },
  SUBSTITUTION: { label: 'Cambio',          icon: '🔄' },
  FREEKICK:     { label: 'Tiro Libre',      icon: '🎯' },
  PENALTY:      { label: 'Penal',           icon: '🥅' },
  OTHER:        { label: 'Otro',            icon: '📝' },
};

interface EventDialogProps {
  matchId: string;
  eventType: string;
  onClose: () => void;
}

export function EventDialog({ matchId, eventType, onClose }: EventDialogProps) {
  const { toast } = useToast();
  const { match, selectedPlayerId, addEvent, applySubstitution } = useMatchStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detail, setDetail] = useState('');

  // Pre-fill from currently selected player
  const preselected = match?.roster.find((r: any) => r.id === selectedPlayerId);
  const [teamSide, setTeamSide] = useState<'HOME' | 'AWAY' | null>(
    preselected ? (preselected.isHomeTeam ? 'HOME' : 'AWAY') : null
  );
  const [rosterPlayerId, setRosterPlayerId] = useState<string | null>(
    preselected ? selectedPlayerId : null
  );
  const [subOutRosterPlayerId, setSubOutRosterPlayerId] = useState<string | null>(
    eventType === 'SUBSTITUTION' && preselected?.isStarter ? preselected.id : null,
  );
  const [subInRosterPlayerId, setSubInRosterPlayerId] = useState<string | null>(null);

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!match) return null;

  const meta = EVENT_META[eventType] ?? { label: eventType, icon: '📝' };
  const minute = Math.floor(match.elapsedSeconds / 60);
  const second = match.elapsedSeconds % 60;

  const homeRoster = match.roster
    .filter((r: any) => r.isHomeTeam)
    .sort((a: any, b: any) => Number(b.isStarter) - Number(a.isStarter) || a.jerseyNumber - b.jerseyNumber);
  const awayRoster = match.roster
    .filter((r: any) => !r.isHomeTeam)
    .sort((a: any, b: any) => Number(b.isStarter) - Number(a.isStarter) || a.jerseyNumber - b.jerseyNumber);
  const teamRoster = teamSide === 'HOME' ? homeRoster : teamSide === 'AWAY' ? awayRoster : [];
  const startersRoster = teamRoster.filter((r: any) => r.isStarter);
  const subsRoster = teamRoster.filter((r: any) => !r.isStarter);

  const handleTeamSelect = (side: 'HOME' | 'AWAY') => {
    setTeamSide(side);
    // Reset player if they're not on this team
    const stillValid = match.roster.find(
      (r: any) => r.id === rosterPlayerId && (side === 'HOME' ? r.isHomeTeam : !r.isHomeTeam)
    );
    if (!stillValid) setRosterPlayerId(null);

    const outValid = match.roster.find(
      (r: any) =>
        r.id === subOutRosterPlayerId &&
        (side === 'HOME' ? r.isHomeTeam : !r.isHomeTeam) &&
        r.isStarter,
    );
    if (!outValid) setSubOutRosterPlayerId(null);

    const inValid = match.roster.find(
      (r: any) =>
        r.id === subInRosterPlayerId &&
        (side === 'HOME' ? r.isHomeTeam : !r.isHomeTeam) &&
        !r.isStarter,
    );
    if (!inValid) setSubInRosterPlayerId(null);
  };

  const handleConfirm = async () => {
    if (!teamSide) return;
    if (eventType === 'SUBSTITUTION') {
      if (!subOutRosterPlayerId || !subInRosterPlayerId) {
        toast({
          title: 'Cambio incompleto',
          description: 'Debes seleccionar quién sale y quién entra',
          variant: 'destructive',
        });
        return;
      }
      if (subOutRosterPlayerId === subInRosterPlayerId) {
        toast({
          title: 'Cambio inválido',
          description: 'El jugador que sale no puede ser el mismo que entra',
          variant: 'destructive',
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const outPlayer = match.roster.find((r: any) => r.id === subOutRosterPlayerId);
      const inPlayer = match.roster.find((r: any) => r.id === subInRosterPlayerId);

      const response = await api.post(`/matches/${matchId}/events`, {
        rosterPlayerId:
          eventType === 'SUBSTITUTION'
            ? subOutRosterPlayerId ?? undefined
            : rosterPlayerId ?? undefined,
        teamSide,
        eventType,
        period: match.currentPeriod,
        minute,
        second,
        payload:
          eventType === 'SUBSTITUTION'
            ? {
                outRosterPlayerId: subOutRosterPlayerId,
                inRosterPlayerId: subInRosterPlayerId,
                detail: detail.trim() || undefined,
              }
            : {
                detail: detail.trim() || undefined,
              },
      });
      addEvent(response.data);

      if (eventType === 'SUBSTITUTION' && outPlayer && inPlayer) {
        const patchInData: any = { isStarter: true };
        if (outPlayer.layoutX !== null && outPlayer.layoutX !== undefined) patchInData.layoutX = outPlayer.layoutX;
        if (outPlayer.layoutY !== null && outPlayer.layoutY !== undefined) patchInData.layoutY = outPlayer.layoutY;

        await Promise.all([
          api.patch(`/matches/${matchId}/roster/${outPlayer.id}`, {
            isStarter: false,
          }),
          api.patch(`/matches/${matchId}/roster/${inPlayer.id}`, patchInData),
        ]);

        applySubstitution(outPlayer.id, inPlayer.id);
      }

      const team = teamSide === 'HOME' ? match.homeTeam : match.awayTeam;
      const player = match.roster.find((r: any) =>
        r.id === (eventType === 'SUBSTITUTION' ? subOutRosterPlayerId : rosterPlayerId),
      );
      const playerDesc = player
        ? ` · ${player.jerseyNumber} ${player.customName || player.player?.lastName || ''}`
        : '';
      const substitutionDesc =
        eventType === 'SUBSTITUTION' && outPlayer && inPlayer
          ? ` · ${outPlayer.jerseyNumber} ${outPlayer.customName || outPlayer.player?.lastName || ''} → ${inPlayer.jerseyNumber} ${inPlayer.customName || inPlayer.player?.lastName || ''}`
          : playerDesc;
      toast({
        title: `${meta.icon} ${meta.label}`,
        description: `${team.shortName || team.name}${substitutionDesc} · ${minute}'`,
      });
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo registrar el evento',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{meta.icon}</span>
            <div>
              <h2 className="text-lg font-bold leading-tight">{meta.label}</h2>
              <p className="text-sm text-muted-foreground">{minute}'{String(second).padStart(2, '0')}"</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Team selector */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Equipo *</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleTeamSelect('HOME')}
                className={`py-3 px-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                  teamSide === 'HOME'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                    : 'border-gray-200 hover:border-blue-300 text-gray-700'
                }`}
              >
                <div>{match.homeTeam.shortName || match.homeTeam.name}</div>
                <div className="text-xs font-normal text-gray-400 mt-0.5">Local</div>
              </button>
              <button
                onClick={() => handleTeamSelect('AWAY')}
                className={`py-3 px-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                  teamSide === 'AWAY'
                    ? 'border-red-500 bg-red-50 text-red-700 shadow-sm'
                    : 'border-gray-200 hover:border-red-300 text-gray-700'
                }`}
              >
                <div>{match.awayTeam.shortName || match.awayTeam.name}</div>
                <div className="text-xs font-normal text-gray-400 mt-0.5">Visitante</div>
              </button>
            </div>
          </div>

          {/* Player selector */}
          {teamSide && eventType !== 'SUBSTITUTION' && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                Jugador <span className="font-normal normal-case text-gray-400">(opcional)</span>
              </p>
              <div className="border rounded-xl overflow-hidden divide-y max-h-52 overflow-y-auto">
                <button
                  onClick={() => setRosterPlayerId(null)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                    rosterPlayerId === null ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="text-gray-300 w-6 text-center font-mono">—</span>
                  <span className="text-gray-400">Sin jugador</span>
                </button>
                {teamRoster.map((r: any) => (
                  <button
                    key={r.id}
                    onClick={() => setRosterPlayerId(r.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                      rosterPlayerId === r.id
                        ? teamSide === 'HOME'
                          ? 'bg-blue-50 font-semibold text-blue-800'
                          : 'bg-red-50 font-semibold text-red-800'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className="font-mono text-xs text-gray-400 w-6 text-center shrink-0">
                      {r.jerseyNumber}
                    </span>
                    <span className="truncate">
                      {r.customName || (r.player
                        ? `${r.player.lastName}, ${r.player.firstName}`
                        : `#${r.jerseyNumber}`)}
                    </span>
                    {!r.isStarter && <span className="ml-auto text-[10px] text-gray-400">SUP</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {teamSide && eventType === 'SUBSTITUTION' && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  Sale (Titular) *
                </p>
                <div className="border rounded-xl overflow-hidden divide-y max-h-48 overflow-y-auto">
                  {startersRoster.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-muted-foreground">No hay titulares disponibles.</p>
                  ) : (
                    startersRoster.map((r: any) => (
                      <button
                        key={r.id}
                        onClick={() => setSubOutRosterPlayerId(r.id)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                          subOutRosterPlayerId === r.id
                            ? teamSide === 'HOME'
                              ? 'bg-blue-50 font-semibold text-blue-800'
                              : 'bg-red-50 font-semibold text-red-800'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <span className="font-mono text-xs text-gray-400 w-6 text-center shrink-0">{r.jerseyNumber}</span>
                        <span className="truncate">
                          {r.customName || (r.player ? `${r.player.lastName}, ${r.player.firstName}` : `#${r.jerseyNumber}`)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  Entra (Suplente) *
                </p>
                <div className="border rounded-xl overflow-hidden divide-y max-h-48 overflow-y-auto">
                  {subsRoster.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-muted-foreground">No hay suplentes disponibles.</p>
                  ) : (
                    subsRoster.map((r: any) => (
                      <button
                        key={r.id}
                        onClick={() => setSubInRosterPlayerId(r.id)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                          subInRosterPlayerId === r.id
                            ? teamSide === 'HOME'
                              ? 'bg-blue-50 font-semibold text-blue-800'
                              : 'bg-red-50 font-semibold text-red-800'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <span className="font-mono text-xs text-gray-400 w-6 text-center shrink-0">{r.jerseyNumber}</span>
                        <span className="truncate">
                          {r.customName || (r.player ? `${r.player.lastName}, ${r.player.firstName}` : `#${r.jerseyNumber}`)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Detalle <span className="font-normal normal-case text-gray-400">(opcional)</span>
            </p>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Ej: gol esquinado, golazo, remate cruzado, etc."
              className="w-full min-h-[80px] rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-5">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={handleConfirm}
            disabled={!teamSide || isSubmitting}
          >
            {isSubmitting ? 'Registrando...' : 'Confirmar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
