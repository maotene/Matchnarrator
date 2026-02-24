'use client';

import React, { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMatchStore } from '@/store/match-store';
import { useToast } from '@/hooks/use-toast';
import { FieldCanvas } from '@/components/field/field-canvas';
import { TimerComponent } from '@/components/timer/timer-component';
import { EventTimeline } from '@/components/timeline/event-timeline';
import { useMatchHotkeys } from '@/hooks/use-hotkeys';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Keyboard } from 'lucide-react';
import api from '@/lib/api';

export default function MatchCenterPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const matchId = params.id as string;
  const { match, setMatch, selectedPlayerId } = useMatchStore();
  const [showHotkeys, setShowHotkeys] = React.useState(false);

  // Enable hotkeys
  const { HOTKEY_MAPPINGS } = useMatchHotkeys({
    matchId,
    isEnabled: match?.status === 'LIVE' || match?.status === 'HALFTIME',
  });

  useEffect(() => {
    fetchMatch();
  }, [matchId]);

  const fetchMatch = async () => {
    try {
      const response = await api.get(`/matches/${matchId}`);
      setMatch(response.data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'No se pudo cargar el partido',
        variant: 'destructive',
      });
      router.push('/dashboard');
    }
  };

  const handleExport = async () => {
    try {
      const response = await api.get(`/matches/${matchId}/export`);
      const dataStr = JSON.stringify(response.data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `match-${matchId}-${new Date().toISOString()}.json`;
      link.click();
      toast({ title: 'Partido exportado exitosamente' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'No se pudo exportar el partido',
        variant: 'destructive',
      });
    }
  };

  if (!match) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Cargando partido...</p>
      </div>
    );
  }

  const homeGoals = match.events.filter(
    (e: any) => e.teamSide === 'HOME' && e.eventType === 'GOAL'
  ).length;
  const awayGoals = match.events.filter(
    (e: any) => e.teamSide === 'AWAY' && e.eventType === 'GOAL'
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-sm text-muted-foreground">
                  {match.homeTeam.shortName || match.homeTeam.name}
                </div>
                <div className="text-4xl font-bold">{homeGoals}</div>
              </div>
              <div className="text-2xl text-muted-foreground">-</div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">
                  {match.awayTeam.shortName || match.awayTeam.name}
                </div>
                <div className="text-4xl font-bold">{awayGoals}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowHotkeys(!showHotkeys)}>
                <Keyboard className="mr-2 h-4 w-4" />
                Atajos
              </Button>
              <Button variant="outline" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Hotkeys Card */}
      {showHotkeys && (
        <Card>
          <CardHeader>
            <CardTitle>Atajos de Teclado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <kbd className="px-2 py-1 text-xs font-semibold bg-gray-100 border rounded">
                  G
                </kbd>
                <p className="text-xs mt-1">Gol</p>
              </div>
              <div className="text-center">
                <kbd className="px-2 py-1 text-xs font-semibold bg-gray-100 border rounded">
                  F
                </kbd>
                <p className="text-xs mt-1">Falta</p>
              </div>
              <div className="text-center">
                <kbd className="px-2 py-1 text-xs font-semibold bg-gray-100 border rounded">
                  A
                </kbd>
                <p className="text-xs mt-1">Atajada</p>
              </div>
              <div className="text-center">
                <kbd className="px-2 py-1 text-xs font-semibold bg-gray-100 border rounded">
                  Y
                </kbd>
                <p className="text-xs mt-1">T. Amarilla</p>
              </div>
              <div className="text-center">
                <kbd className="px-2 py-1 text-xs font-semibold bg-gray-100 border rounded">
                  R
                </kbd>
                <p className="text-xs mt-1">T. Roja</p>
              </div>
              <div className="text-center">
                <kbd className="px-2 py-1 text-xs font-semibold bg-gray-100 border rounded">
                  S
                </kbd>
                <p className="text-xs mt-1">Disparo</p>
              </div>
              <div className="text-center">
                <kbd className="px-2 py-1 text-xs font-semibold bg-gray-100 border rounded">
                  K
                </kbd>
                <p className="text-xs mt-1">Corner</p>
              </div>
              <div className="text-center">
                <kbd className="px-2 py-1 text-xs font-semibold bg-gray-100 border rounded">
                  O
                </kbd>
                <p className="text-xs mt-1">Offside</p>
              </div>
              <div className="text-center">
                <kbd className="px-2 py-1 text-xs font-semibold bg-gray-100 border rounded">
                  C
                </kbd>
                <p className="text-xs mt-1">Cambio</p>
              </div>
              <div className="text-center">
                <kbd className="px-2 py-1 text-xs font-semibold bg-gray-100 border rounded">
                  ESC
                </kbd>
                <p className="text-xs mt-1">Deseleccionar</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Selecciona un jugador en la cancha y presiona una tecla para registrar un evento.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Field + Timer */}
        <div className="lg:col-span-2 space-y-6">
          <FieldCanvas matchId={matchId} />
          {selectedPlayerId && (
            <Card className="bg-yellow-50 border-yellow-200">
              <CardContent className="py-3">
                <p className="text-sm text-center">
                  ⚽ Jugador seleccionado - Presiona una tecla para registrar evento
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Timer + Timeline */}
        <div className="space-y-6">
          <TimerComponent matchId={matchId} />
          <EventTimeline matchId={matchId} />
        </div>
      </div>
    </div>
  );
}
