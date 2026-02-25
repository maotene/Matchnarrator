'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Square } from 'lucide-react';
import { formatTime } from '@/lib/utils';
import { useMatchStore } from '@/store/match-store';
import { useToast } from '@/hooks/use-toast';
import { Modal } from '@/components/ui/modal';
import api from '@/lib/api';

interface TimerComponentProps {
  matchId: string;
  readOnly?: boolean;
}

export function TimerComponent({ matchId, readOnly = false }: TimerComponentProps) {
  const { toast } = useToast();
  const { match, updateTimer } = useMatchStore();
  const [localSeconds, setLocalSeconds] = useState(0);
  const [addedTime, setAddedTime] = useState({ first: 0, second: 0 });
  const [showEndPeriodModal, setShowEndPeriodModal] = useState(false);
  const [endPeriodContext, setEndPeriodContext] = useState<{
    currentPeriodLabel: string;
    nextPeriodLabel: string;
    addedMinutes: number;
    missingMinutes: number;
    isEarly: boolean;
  } | null>(null);

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
        return newValue;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [match?.isTimerRunning, matchId, updateTimer]);

  const handleStart = async () => {
    if (readOnly) return;
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
    if (readOnly) return;
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
    if (readOnly) return;
    if (!match) return;

    const currentPeriodLabel = getPeriodLabel(match.currentPeriod);
    const nextPeriodLabel =
      match.currentPeriod === 'FIRST_HALF'
        ? '2do Tiempo'
        : match.currentPeriod === 'SECOND_HALF'
          ? 'Final del Partido'
          : 'Siguiente período';

    const addedMinutes =
      match.currentPeriod === 'FIRST_HALF'
        ? addedTime.first
        : match.currentPeriod === 'SECOND_HALF'
          ? addedTime.second
          : 0;
    const requiredSeconds = 45 * 60 + addedMinutes * 60;
    const missingSeconds = Math.max(0, requiredSeconds - localSeconds);
    const missingMinutes = Math.ceil(missingSeconds / 60);
    const isEarly = missingSeconds > 0;

    setEndPeriodContext({
      currentPeriodLabel,
      nextPeriodLabel,
      addedMinutes,
      missingMinutes,
      isEarly,
    });
    setShowEndPeriodModal(true);
  };

  const confirmEndPeriod = async () => {
    if (readOnly) return;
    if (!endPeriodContext) return;
    try {
      await api.post(`/matches/${matchId}/timer/end-period`, { force: endPeriodContext.isEarly });
      toast({
        title: 'Período finalizado',
        description: `Siguiente estado: ${endPeriodContext.nextPeriodLabel}`,
      });
      setShowEndPeriodModal(false);
      window.location.reload();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo finalizar el período',
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
          <Button onClick={handleStart} className="flex-1" disabled={readOnly}>
            <Play className="mr-2 h-4 w-4" />
            Iniciar
          </Button>
        ) : (
          <Button onClick={handlePause} variant="outline" className="flex-1" disabled={readOnly}>
            <Pause className="mr-2 h-4 w-4" />
            Pausar
          </Button>
        )}
        <Button onClick={handleEndPeriod} variant="destructive" className="flex-1" disabled={readOnly}>
          <Square className="mr-2 h-4 w-4" />
          Fin Período
        </Button>
      </div>

      {readOnly && (
        <p className="text-xs text-center text-muted-foreground">
          Partido finalizado: cronómetro en modo solo lectura.
        </p>
      )}

      {showEndPeriodModal && endPeriodContext && (
        <Modal title="Confirmar Fin de Período" onClose={() => setShowEndPeriodModal(false)} maxWidth="md">
          <div className="space-y-4">
            {endPeriodContext.isEarly ? (
              <div className="space-y-2 text-sm">
                <p>
                  Aún no se completan <strong>45&apos;</strong>
                  {endPeriodContext.addedMinutes > 0 ? (
                    <>
                      {' '}+ <strong>{endPeriodContext.addedMinutes}&apos;</strong>
                    </>
                  ) : null}{' '}
                  de <strong>{endPeriodContext.currentPeriodLabel}</strong>.
                </p>
                <p>
                  Faltan aprox. <strong>{endPeriodContext.missingMinutes} min</strong>.
                </p>
                <p>
                  Si continúas, se forzará el cierre y el siguiente estado será{' '}
                  <strong>{endPeriodContext.nextPeriodLabel}</strong>.
                </p>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <p>
                  Vas a finalizar <strong>{endPeriodContext.currentPeriodLabel}</strong>.
                </p>
                <p>
                  Siguiente estado: <strong>{endPeriodContext.nextPeriodLabel}</strong>.
                </p>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowEndPeriodModal(false)}>
                Cancelar
              </Button>
              <Button
                variant={endPeriodContext.isEarly ? 'destructive' : 'default'}
                onClick={confirmEndPeriod}
              >
                {endPeriodContext.isEarly ? 'Forzar Cierre' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
