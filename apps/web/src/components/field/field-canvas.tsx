'use client';

import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Circle, Text, Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import api from '@/lib/api';
import { useMatchStore } from '@/store/match-store';
import { useToast } from '@/hooks/use-toast';

const FIELD_WIDTH = 800;
const FIELD_HEIGHT = 600;

interface FieldCanvasProps {
  matchId: string;
}

export function FieldCanvas({ matchId }: FieldCanvasProps) {
  const { toast } = useToast();
  const { match, selectedPlayerId, setSelectedPlayer, updateRosterLayout } = useMatchStore();
  const stageRef = useRef<any>(null);
  const [draggingPlayer, setDraggingPlayer] = useState<string | null>(null);

  const handlePlayerDragEnd = async (rosterId: string, x: number, y: number) => {
    // Convert to percentage (0-100)
    const percentX = (x / FIELD_WIDTH) * 100;
    const percentY = (y / FIELD_HEIGHT) * 100;

    // Update local state immediately (optimistic update)
    updateRosterLayout(rosterId, percentX, percentY);

    // Update backend
    try {
      await api.patch(`/matches/${matchId}/roster/${rosterId}`, {
        layoutX: percentX,
        layoutY: percentY,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la posición del jugador',
        variant: 'destructive',
      });
    }
  };

  const handlePlayerClick = (rosterId: string) => {
    setSelectedPlayer(rosterId === selectedPlayerId ? null : rosterId);
  };

  if (!match) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-gray-100 rounded-lg">
        <p className="text-muted-foreground">Cargando cancha...</p>
      </div>
    );
  }

  const homeRoster = match.roster.filter((r: any) => r.isHomeTeam);
  const awayRoster = match.roster.filter((r: any) => !r.isHomeTeam);

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden bg-green-700">
      <Stage width={FIELD_WIDTH} height={FIELD_HEIGHT} ref={stageRef}>
        <Layer>
          {/* Field Background */}
          <Rect x={0} y={0} width={FIELD_WIDTH} height={FIELD_HEIGHT} fill="#1e7d3e" />

          {/* Field Lines */}
          <Rect
            x={10}
            y={10}
            width={FIELD_WIDTH - 20}
            height={FIELD_HEIGHT - 20}
            stroke="white"
            strokeWidth={2}
          />
          {/* Midfield line */}
          <Rect
            x={FIELD_WIDTH / 2}
            y={10}
            width={1}
            height={FIELD_HEIGHT - 20}
            fill="white"
          />
          {/* Center circle */}
          <Circle
            x={FIELD_WIDTH / 2}
            y={FIELD_HEIGHT / 2}
            radius={60}
            stroke="white"
            strokeWidth={2}
          />
          {/* Penalty boxes */}
          <Rect x={10} y={FIELD_HEIGHT / 2 - 100} width={100} height={200} stroke="white" strokeWidth={2} />
          <Rect
            x={FIELD_WIDTH - 110}
            y={FIELD_HEIGHT / 2 - 100}
            width={100}
            height={200}
            stroke="white"
            strokeWidth={2}
          />

          {/* Home Team Players (Blue) */}
          {homeRoster.map((player: any) => {
            const x = player.layoutX ? (player.layoutX / 100) * FIELD_WIDTH : 100;
            const y = player.layoutY ? (player.layoutY / 100) * FIELD_HEIGHT : FIELD_HEIGHT / 2;
            const isSelected = player.id === selectedPlayerId;

            return (
              <React.Fragment key={player.id}>
                <Circle
                  x={x}
                  y={y}
                  radius={isSelected ? 22 : 20}
                  fill="#3b82f6"
                  stroke={isSelected ? '#fbbf24' : '#1e40af'}
                  strokeWidth={isSelected ? 3 : 2}
                  draggable
                  onDragStart={() => setDraggingPlayer(player.id)}
                  onDragEnd={(e) => {
                    setDraggingPlayer(null);
                    handlePlayerDragEnd(player.id, e.target.x(), e.target.y());
                  }}
                  onClick={() => handlePlayerClick(player.id)}
                  shadowBlur={5}
                  shadowColor="black"
                  shadowOpacity={0.3}
                />
                <Text
                  x={x}
                  y={y}
                  offsetX={6}
                  offsetY={8}
                  text={player.jerseyNumber.toString()}
                  fontSize={16}
                  fill="white"
                  fontStyle="bold"
                  listening={false}
                />
              </React.Fragment>
            );
          })}

          {/* Away Team Players (Red) */}
          {awayRoster.map((player: any) => {
            const x = player.layoutX
              ? (player.layoutX / 100) * FIELD_WIDTH
              : FIELD_WIDTH - 100;
            const y = player.layoutY ? (player.layoutY / 100) * FIELD_HEIGHT : FIELD_HEIGHT / 2;
            const isSelected = player.id === selectedPlayerId;

            return (
              <React.Fragment key={player.id}>
                <Circle
                  x={x}
                  y={y}
                  radius={isSelected ? 22 : 20}
                  fill="#ef4444"
                  stroke={isSelected ? '#fbbf24' : '#991b1b'}
                  strokeWidth={isSelected ? 3 : 2}
                  draggable
                  onDragStart={() => setDraggingPlayer(player.id)}
                  onDragEnd={(e) => {
                    setDraggingPlayer(null);
                    handlePlayerDragEnd(player.id, e.target.x(), e.target.y());
                  }}
                  onClick={() => handlePlayerClick(player.id)}
                  shadowBlur={5}
                  shadowColor="black"
                  shadowOpacity={0.3}
                />
                <Text
                  x={x}
                  y={y}
                  offsetX={6}
                  offsetY={8}
                  text={player.jerseyNumber.toString()}
                  fontSize={16}
                  fill="white"
                  fontStyle="bold"
                  listening={false}
                />
              </React.Fragment>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}
