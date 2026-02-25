'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Circle, Text } from 'react-konva';
import api from '@/lib/api';
import { useMatchStore } from '@/store/match-store';
import { useToast } from '@/hooks/use-toast';

const FIELD_WIDTH = 800;
const FIELD_HEIGHT = 600;

function playerLabel(name?: string | null) {
  if (!name) return '';
  const normalized = name.includes(',')
    ? name
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .reverse()
        .join(' ')
    : name;
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

interface FieldCanvasProps {
  matchId: string;
  readOnly?: boolean;
}

export function FieldCanvas({ matchId, readOnly = false }: FieldCanvasProps) {
  const { toast } = useToast();
  const { match, selectedPlayerId, setSelectedPlayer, updateRosterLayout } = useMatchStore();
  const stageRef = useRef<any>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [substitutionModal, setSubstitutionModal] = useState<{
    minute: number;
    second: number;
    outName: string;
    inName: string;
  } | null>(null);
  const [showPlayerInfo, setShowPlayerInfo] = useState(false);
  const [isPlayerInfoPinned, setIsPlayerInfoPinned] = useState(false);

  useEffect(() => {
    const measure = () => {
      if (!outerRef.current) return;
      const w = outerRef.current.offsetWidth;
      if (w > 0) setScale(w / FIELD_WIDTH);
    };

    const onResize = () => requestAnimationFrame(measure);
    requestAnimationFrame(measure);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handlePlayerDragEnd = async (rosterId: string, x: number, y: number) => {
    if (readOnly) return;
    const percentX = (x / FIELD_WIDTH) * 100;
    const percentY = (y / FIELD_HEIGHT) * 100;

    updateRosterLayout(rosterId, percentX, percentY);

    try {
      await api.patch(`/matches/${matchId}/roster/${rosterId}`, {
        layoutX: percentX,
        layoutY: percentY,
      });
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la posición del jugador',
        variant: 'destructive',
      });
    }
  };

  const handlePlayerClick = (rosterId: string) => {
    if (rosterId === selectedPlayerId) {
      setIsPlayerInfoPinned(false);
      setShowPlayerInfo(true);
      return;
    }
    setSelectedPlayer(rosterId);
    setIsPlayerInfoPinned(false);
    setShowPlayerInfo(true);
  };

  const homeAll = match?.roster.filter((r: any) => r.isHomeTeam) ?? [];
  const awayAll = match?.roster.filter((r: any) => !r.isHomeTeam) ?? [];
  const homeStarters = homeAll.filter((r: any) => r.isStarter);
  const awayStarters = awayAll.filter((r: any) => r.isStarter);
  const homeRoster = homeStarters.length > 0 ? homeStarters : homeAll;
  const awayRoster = awayStarters.length > 0 ? awayStarters : awayAll;

  function rosterDisplayName(rosterPlayer: any) {
    return (
      rosterPlayer?.customName ||
      (rosterPlayer?.player ? `${rosterPlayer.player.firstName} ${rosterPlayer.player.lastName}` : `#${rosterPlayer?.jerseyNumber ?? ''}`)
    );
  }

  function lastSubstitutionForIncoming(inRosterId: string) {
    if (!match?.events?.length) return null;
    for (let i = match.events.length - 1; i >= 0; i -= 1) {
      const e: any = match.events[i];
      if (e?.eventType !== 'SUBSTITUTION' || !e?.payload) continue;
      const inId = e.payload?.inRosterPlayerId;
      if (inId === inRosterId) {
        const outId = e.payload?.outRosterPlayerId;
        const outRoster = match.roster.find((r: any) => r.id === outId);
        const inRoster = match.roster.find((r: any) => r.id === inId);
        return {
          minute: e.minute,
          second: e.second ?? 0,
          outName: outRoster ? rosterDisplayName(outRoster) : 'Jugador',
          inName: inRoster ? rosterDisplayName(inRoster) : 'Jugador',
        };
      }
    }
    return null;
  }

  function playerCardStats(rosterId: string) {
    const events = (match?.events ?? []).filter((e: any) => e?.rosterPlayer?.id === rosterId);
    const yellow = events.filter((e: any) => e?.eventType === 'YELLOW_CARD').length;
    const red = events.filter((e: any) => e?.eventType === 'RED_CARD').length;
    return { yellow, red };
  }

  const selectedRoster = match?.roster?.find((r: any) => r.id === selectedPlayerId);
  const selectedPlayerEvents = selectedPlayerId
    ? (match?.events ?? []).filter((e: any) => {
        if (e?.rosterPlayer?.id === selectedPlayerId) return true;
        if (e?.payload?.outRosterPlayerId === selectedPlayerId) return true;
        if (e?.payload?.inRosterPlayerId === selectedPlayerId) return true;
        return false;
      })
    : [];
  const selectedPlayerEventsCountRef = useRef(0);

  const eventLabel: Record<string, string> = {
    GOAL: 'Gol',
    FOUL: 'Falta',
    SAVE: 'Atajada',
    OFFSIDE: 'Offside',
    PASS: 'Pase',
    SUBSTITUTION: 'Cambio',
    YELLOW_CARD: 'Amarilla',
    RED_CARD: 'Roja',
    CORNER: 'Corner',
    FREEKICK: 'Tiro libre',
    PENALTY: 'Penal',
    SHOT: 'Disparo',
    OTHER: 'Otro',
  };

  useEffect(() => {
    if (!showPlayerInfo || isPlayerInfoPinned) {
      selectedPlayerEventsCountRef.current = selectedPlayerEvents.length;
      return;
    }

    const timeout = window.setTimeout(() => {
      setShowPlayerInfo(false);
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [showPlayerInfo, isPlayerInfoPinned, selectedPlayerId, selectedPlayerEvents.length]);

  useEffect(() => {
    const prevCount = selectedPlayerEventsCountRef.current;
    const currentCount = selectedPlayerEvents.length;
    selectedPlayerEventsCountRef.current = currentCount;

    if (!showPlayerInfo || isPlayerInfoPinned) return;
    if (currentCount <= prevCount) return;

    const timeout = window.setTimeout(() => {
      setShowPlayerInfo(false);
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [showPlayerInfo, isPlayerInfoPinned, selectedPlayerEvents.length]);

  // Outer div measures available width; inner div is always 800×600 and scaled via CSS.
  // This avoids Konva scaleX/scaleY layout loops.
  return (
    <>
      <div
        ref={outerRef}
        className="w-full rounded-lg overflow-hidden border border-gray-300"
        style={{ height: FIELD_HEIGHT * scale }}
      >
        <div
          style={{
            width: FIELD_WIDTH,
            height: FIELD_HEIGHT,
            transformOrigin: 'top left',
            transform: `scale(${scale})`,
          }}
        >
          <Stage width={FIELD_WIDTH} height={FIELD_HEIGHT} ref={stageRef}>
            <Layer>
            {/* Background */}
            <Rect x={0} y={0} width={FIELD_WIDTH} height={FIELD_HEIGHT} fill="#1e7d3e" />

            {/* Border */}
            <Rect x={10} y={10} width={FIELD_WIDTH - 20} height={FIELD_HEIGHT - 20} stroke="white" strokeWidth={2} />

            {/* Midfield line */}
            <Rect x={FIELD_WIDTH / 2} y={10} width={1} height={FIELD_HEIGHT - 20} fill="white" />

            {/* Center circle */}
            <Circle x={FIELD_WIDTH / 2} y={FIELD_HEIGHT / 2} radius={60} stroke="white" strokeWidth={2} />

            {/* Penalty boxes */}
            <Rect x={10} y={FIELD_HEIGHT / 2 - 100} width={100} height={200} stroke="white" strokeWidth={2} />
            <Rect x={FIELD_WIDTH - 110} y={FIELD_HEIGHT / 2 - 100} width={100} height={200} stroke="white" strokeWidth={2} />

            {/* Home players (blue) */}
            {homeRoster.map((player: any) => {
              const x = player.layoutX ? (player.layoutX / 100) * FIELD_WIDTH : 100;
              const y = player.layoutY ? (player.layoutY / 100) * FIELD_HEIGHT : FIELD_HEIGHT / 2;
              const isSelected = player.id === selectedPlayerId;
              const name = playerLabel(player.customName || (player.player ? `${player.player.firstName} ${player.player.lastName}` : ''));
              const subInfo = lastSubstitutionForIncoming(player.id);
              const cards = playerCardStats(player.id);
              return (
                <React.Fragment key={player.id}>
                  <Circle
                    x={x} y={y}
                    radius={isSelected ? 22 : 20}
                    fill="#3b82f6"
                    stroke={isSelected ? '#fbbf24' : '#1e40af'}
                    strokeWidth={isSelected ? 3 : 2}
                    draggable={!readOnly}
                    onDragEnd={(e) => handlePlayerDragEnd(player.id, e.target.x(), e.target.y())}
                    onClick={() => handlePlayerClick(player.id)}
                    shadowBlur={5} shadowColor="black" shadowOpacity={0.3}
                  />
                  <Text
                    x={x} y={y} offsetX={6} offsetY={8}
                    text={player.jerseyNumber.toString()}
                    fontSize={16} fill="white" fontStyle="bold" listening={false}
                  />
                  <Text
                    x={x - 45}
                    y={y + 22}
                    width={90}
                    align="center"
                    text={name}
                    fontSize={10}
                    fill="#ffffff"
                    shadowBlur={2}
                    shadowColor="#000000"
                    listening={false}
                  />
                  {subInfo && (
                    <>
                      <Circle
                        x={x + 20}
                        y={y - 20}
                        radius={11}
                        fill="#fef08a"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        shadowBlur={6}
                        shadowColor="#000000"
                        shadowOpacity={0.25}
                        onClick={() => setSubstitutionModal(subInfo)}
                      />
                      <Text
                        x={x + 14.5}
                        y={y - 27}
                        text="⇄"
                        fontSize={13}
                        fontStyle="bold"
                        fill="#111827"
                        listening={false}
                      />
                    </>
                  )}
                  {cards.yellow > 0 && (
                    <>
                      <Rect
                        x={x - 28}
                        y={y - 26}
                        width={12}
                        height={16}
                        cornerRadius={2}
                        fill="#facc15"
                        stroke="#a16207"
                        strokeWidth={1}
                        shadowBlur={3}
                        shadowOpacity={0.2}
                      />
                      {cards.yellow > 1 && (
                        <Text
                          x={x - 27}
                          y={y - 25}
                          width={10}
                          align="center"
                          text={String(cards.yellow)}
                          fontSize={9}
                          fontStyle="bold"
                          fill="#111827"
                          listening={false}
                        />
                      )}
                    </>
                  )}
                  {cards.red > 0 && (
                    <>
                      <Rect
                        x={x - 14}
                        y={y - 26}
                        width={12}
                        height={16}
                        cornerRadius={2}
                        fill="#ef4444"
                        stroke="#991b1b"
                        strokeWidth={1}
                        shadowBlur={3}
                        shadowOpacity={0.2}
                      />
                      {cards.red > 1 && (
                        <Text
                          x={x - 13}
                          y={y - 25}
                          width={10}
                          align="center"
                          text={String(cards.red)}
                          fontSize={9}
                          fontStyle="bold"
                          fill="#ffffff"
                          listening={false}
                        />
                      )}
                    </>
                  )}
                </React.Fragment>
              );
            })}

            {/* Away players (red) */}
            {awayRoster.map((player: any) => {
              const x = player.layoutX ? (player.layoutX / 100) * FIELD_WIDTH : FIELD_WIDTH - 100;
              const y = player.layoutY ? (player.layoutY / 100) * FIELD_HEIGHT : FIELD_HEIGHT / 2;
              const isSelected = player.id === selectedPlayerId;
              const name = playerLabel(player.customName || (player.player ? `${player.player.firstName} ${player.player.lastName}` : ''));
              const subInfo = lastSubstitutionForIncoming(player.id);
              const cards = playerCardStats(player.id);
              return (
                <React.Fragment key={player.id}>
                  <Circle
                    x={x} y={y}
                    radius={isSelected ? 22 : 20}
                    fill="#ef4444"
                    stroke={isSelected ? '#fbbf24' : '#991b1b'}
                    strokeWidth={isSelected ? 3 : 2}
                    draggable={!readOnly}
                    onDragEnd={(e) => handlePlayerDragEnd(player.id, e.target.x(), e.target.y())}
                    onClick={() => handlePlayerClick(player.id)}
                    shadowBlur={5} shadowColor="black" shadowOpacity={0.3}
                  />
                  <Text
                    x={x} y={y} offsetX={6} offsetY={8}
                    text={player.jerseyNumber.toString()}
                    fontSize={16} fill="white" fontStyle="bold" listening={false}
                  />
                  <Text
                    x={x - 45}
                    y={y + 22}
                    width={90}
                    align="center"
                    text={name}
                    fontSize={10}
                    fill="#ffffff"
                    shadowBlur={2}
                    shadowColor="#000000"
                    listening={false}
                  />
                  {subInfo && (
                    <>
                      <Circle
                        x={x + 20}
                        y={y - 20}
                        radius={11}
                        fill="#fef08a"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        shadowBlur={6}
                        shadowColor="#000000"
                        shadowOpacity={0.25}
                        onClick={() => setSubstitutionModal(subInfo)}
                      />
                      <Text
                        x={x + 14.5}
                        y={y - 27}
                        text="⇄"
                        fontSize={13}
                        fontStyle="bold"
                        fill="#111827"
                        listening={false}
                      />
                    </>
                  )}
                  {cards.yellow > 0 && (
                    <>
                      <Rect
                        x={x - 28}
                        y={y - 26}
                        width={12}
                        height={16}
                        cornerRadius={2}
                        fill="#facc15"
                        stroke="#a16207"
                        strokeWidth={1}
                        shadowBlur={3}
                        shadowOpacity={0.2}
                      />
                      {cards.yellow > 1 && (
                        <Text
                          x={x - 27}
                          y={y - 25}
                          width={10}
                          align="center"
                          text={String(cards.yellow)}
                          fontSize={9}
                          fontStyle="bold"
                          fill="#111827"
                          listening={false}
                        />
                      )}
                    </>
                  )}
                  {cards.red > 0 && (
                    <>
                      <Rect
                        x={x - 14}
                        y={y - 26}
                        width={12}
                        height={16}
                        cornerRadius={2}
                        fill="#ef4444"
                        stroke="#991b1b"
                        strokeWidth={1}
                        shadowBlur={3}
                        shadowOpacity={0.2}
                      />
                      {cards.red > 1 && (
                        <Text
                          x={x - 13}
                          y={y - 25}
                          width={10}
                          align="center"
                          text={String(cards.red)}
                          fontSize={9}
                          fontStyle="bold"
                          fill="#ffffff"
                          listening={false}
                        />
                      )}
                    </>
                  )}
                </React.Fragment>
              );
            })}
            </Layer>
          </Stage>
        </div>
      </div>

      {substitutionModal && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-40 w-[min(92vw,420px)] rounded-xl border bg-white shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold text-sm">Detalle de Cambio</h3>
            <button
              type="button"
              onClick={() => setSubstitutionModal(null)}
              className="text-gray-400 hover:text-gray-700 text-lg leading-none"
            >
              ×
            </button>
          </div>
          <div className="p-4 space-y-2 text-sm">
            <p>
              Minuto: <strong>{substitutionModal.minute}&apos;{String(substitutionModal.second).padStart(2, '0')}"</strong>
            </p>
            <p>
              Sale: <strong>{substitutionModal.outName}</strong>
            </p>
            <p>
              Entra: <strong>{substitutionModal.inName}</strong>
            </p>
          </div>
        </div>
      )}

      {showPlayerInfo && selectedRoster && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-40 w-[min(92vw,520px)] rounded-xl border bg-white shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold text-sm">
              #{selectedRoster.jerseyNumber} {rosterDisplayName(selectedRoster)}
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPlayerInfoPinned((prev) => !prev)}
                className={`text-xs px-2 py-1 rounded border ${
                  isPlayerInfoPinned
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {isPlayerInfoPinned ? 'Fijado' : 'Fijar'}
              </button>
              <button
                type="button"
                onClick={() => setShowPlayerInfo(false)}
                className="text-gray-400 hover:text-gray-700 text-lg leading-none"
              >
                ×
              </button>
            </div>
          </div>
          <div className="p-4">
            {selectedPlayerEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin eventos registrados para este jugador.</p>
            ) : (
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {selectedPlayerEvents
                  .slice()
                  .sort((a: any, b: any) => (a.minute - b.minute) || (a.second - b.second))
                  .map((e: any) => {
                    const isSub = e.eventType === 'SUBSTITUTION';
                    const subSuffix = isSub
                      ? e.payload?.outRosterPlayerId === selectedPlayerId
                        ? ' (Sale)'
                        : e.payload?.inRosterPlayerId === selectedPlayerId
                          ? ' (Entra)'
                          : ''
                      : '';
                    return (
                      <div key={e.id} className="text-sm rounded-md border px-3 py-2">
                        <span className="font-semibold">{e.minute}&apos;{String(e.second ?? 0).padStart(2, '0')}"</span>
                        {' · '}
                        {eventLabel[e.eventType] ?? e.eventType}
                        {subSuffix}
                      </div>
                    );
                  })}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-3">
              Se cierra automaticamente tras registrar accion o en 3s. Usa Fijar para mantenerlo abierto.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
