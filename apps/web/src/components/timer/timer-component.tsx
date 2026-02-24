'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Play, Pause, Square } from 'lucide-react';
import { formatTime } from '@/lib/utils';
import { useMatchStore } from '@/store/match-store';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';

interface TimerComponentProps {
  matchId: string;
}

export function TimerComponent({ matchId }: TimerComponentProps) {
  const { toast } = useToast();
  const { match, updateTimer } = useMatchStore();
  const [localSeconds, setLocalSeconds] = useState(0);
  const [addedTime, setAddedTime] = useState({ first: 0, second: 0 });

  useEffect(() => {
    if (match) {
      setLocalSeconds(match.elapsedSeconds);
      setAddedTime({
        first: match.firstHalfAddedTime || 0,
        second: match.secondHalfAddedTime || 0,
      });
    }
  }, [match]);

  useEffect(() => {
    if (!match?.isTimerRunning) return;

    const interval = setInterval(() => {
      setLocalSeconds((prev) => {
        const newValue = prev + 1;
        updateTimer(newValue);

        // Sync with backend every 10 seconds
        if (newValue % 10 === 0) {
          api.patch(`/matches/${matchId}/timer/elapsed`, { seconds: newValue }).catch(() => {});
        }

        return newValue;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [match?.isTimerRunning, matchId, updateTimer]);

  const handleStart = async () => {
    try {
      await api.post(`/matches/${matchId}/timer/start`);
      toast({ title: 'Timer iniciado' });
      window.location.reload();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo iniciar el timer',
        variant: 'destructive',
      });
    }
  };

  const handlePause = async () => {
    try {
      await api.post(`/matches/${matchId}/timer/pause`);
      toast({ title: 'Timer pausado' });
      window.location.reload();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo pausar el timer',
        variant: 'destructive',
      });
    }
  };

  const handleEndPeriod = async () => {
    if (!confirm('¿Estás seguro de finalizar este período?')) return;

    try {
      await api.post(`/matches/${matchId}/timer/end-period`);
      toast({ title: 'Período finalizado' });
      window.location.reload();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo finalizar el período',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateAddedTime = async () => {
    try {
      await api.patch(`/matches/${matchId}/timer/added-time`, {
        firstHalfAddedTime: addedTime.first,
        secondHalfAddedTime: addedTime.second,
      });
      toast({ title: 'Tiempo adicional actualizado' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el tiempo adicional',
        variant: 'destructive',
      });
    }
  };

  if (!match) return null;

  const getPeriodLabel = (period: string) => {
    const labels: Record<string, string> = {
      FIRST_HALF: '1er Tiempo',
      SECOND_HALF: '2do Tiempo',
      EXTRA_TIME_FIRST: 'Alargue 1',
      EXTRA_TIME_SECOND: 'Alargue 2',
      PENALTIES: 'Penales',
    };
    return labels[period] || period;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-4">
      <div className="text-center">
        <div className="text-5xl font-bold text-gray-900">{formatTime(localSeconds)}</div>
        <div className="text-sm text-muted-foreground mt-2">
          {getPeriodLabel(match.currentPeriod)}
        </div>
      </div>

      <div className="flex gap-2 justify-center">
        {!match.isTimerRunning ? (
          <Button onClick={handleStart} className="flex-1">
            <Play className="mr-2 h-4 w-4" />
            Iniciar
          </Button>
        ) : (
          <Button onClick={handlePause} variant="outline" className="flex-1">
            <Pause className="mr-2 h-4 w-4" />
            Pausar
          </Button>
        )}
        <Button onClick={handleEndPeriod} variant="destructive" className="flex-1">
          <Square className="mr-2 h-4 w-4" />
          Fin Período
        </Button>
      </div>

      <div className="pt-4 border-t space-y-3">
        <Label className="text-sm font-medium">Tiempo Adicional</Label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="first-half" className="text-xs">
              1er Tiempo
            </Label>
            <Input
              id="first-half"
              type="number"
              min={0}
              value={addedTime.first}
              onChange={(e) => setAddedTime({ ...addedTime, first: parseInt(e.target.value) || 0 })}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="second-half" className="text-xs">
              2do Tiempo
            </Label>
            <Input
              id="second-half"
              type="number"
              min={0}
              value={addedTime.second}
              onChange={(e) =>
                setAddedTime({ ...addedTime, second: parseInt(e.target.value) || 0 })
              }
              className="mt-1"
            />
          </div>
        </div>
        <Button onClick={handleUpdateAddedTime} size="sm" variant="outline" className="w-full">
          Actualizar
        </Button>
      </div>
    </div>
  );
}
