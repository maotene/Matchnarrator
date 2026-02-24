'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Undo2 } from 'lucide-react';
import { useMatchStore } from '@/store/match-store';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';

interface EventTimelineProps {
  matchId: string;
}

export function EventTimeline({ matchId }: EventTimelineProps) {
  const { toast } = useToast();
  const { match, removeEvent } = useMatchStore();
  const [filter, setFilter] = useState<string>('ALL');

  const handleDeleteEvent = async (eventId: string) => {
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

  const filteredEvents = match.events.filter((event: any) => {
    if (filter === 'ALL') return true;
    if (filter === 'HOME') return event.teamSide === 'HOME';
    if (filter === 'AWAY') return event.teamSide === 'AWAY';
    return event.eventType === filter;
  });

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
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Timeline de Eventos</CardTitle>
          <Button size="sm" variant="outline" onClick={handleUndo}>
            <Undo2 className="mr-2 h-4 w-4" />
            Deshacer
          </Button>
        </div>
        <div className="flex gap-2 mt-4 flex-wrap">
          <Button
            size="sm"
            variant={filter === 'ALL' ? 'default' : 'outline'}
            onClick={() => setFilter('ALL')}
          >
            Todos
          </Button>
          <Button
            size="sm"
            variant={filter === 'HOME' ? 'default' : 'outline'}
            onClick={() => setFilter('HOME')}
          >
            Local
          </Button>
          <Button
            size="sm"
            variant={filter === 'AWAY' ? 'default' : 'outline'}
            onClick={() => setFilter('AWAY')}
          >
            Visitante
          </Button>
          <Button
            size="sm"
            variant={filter === 'GOAL' ? 'default' : 'outline'}
            onClick={() => setFilter('GOAL')}
          >
            ⚽ Goles
          </Button>
          <Button
            size="sm"
            variant={filter === 'YELLOW_CARD' ? 'default' : 'outline'}
            onClick={() => setFilter('YELLOW_CARD')}
          >
            🟨 Amarillas
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {filteredEvents.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No hay eventos registrados</p>
          ) : (
            filteredEvents
              .slice()
              .reverse()
              .map((event: any) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getEventIcon(event.eventType)}</span>
                    <div>
                      <div className="font-medium">{getEventLabel(event.eventType)}</div>
                      <div className="text-sm text-muted-foreground">
                        {event.minute}'{event.second}" · {event.teamSide === 'HOME' ? 'Local' : 'Visitante'}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteEvent(event.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
