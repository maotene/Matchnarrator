import { useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useMatchStore } from '@/store/match-store';
import { useToast } from './use-toast';
import api from '@/lib/api';

interface UseHotkeysOptions {
  matchId: string;
  isEnabled: boolean;
}

const HOTKEY_MAPPINGS: Record<string, string> = {
  g: 'GOAL',
  f: 'FOUL',
  a: 'SAVE',
  o: 'OFFSIDE',
  p: 'PASS',
  c: 'SUBSTITUTION',
  y: 'YELLOW_CARD',
  r: 'RED_CARD',
  s: 'SHOT',
  k: 'CORNER',
};

export function useMatchHotkeys({ matchId, isEnabled }: UseHotkeysOptions) {
  const { toast } = useToast();
  const { match, selectedPlayerId, addEvent, setSelectedPlayer } = useMatchStore();

  useHotkeys(
    'g',
    () => handleEventHotkey('GOAL'),
    { enabled: isEnabled, enableOnFormTags: false },
    [isEnabled, match, selectedPlayerId]
  );

  useHotkeys(
    'f',
    () => handleEventHotkey('FOUL'),
    { enabled: isEnabled, enableOnFormTags: false },
    [isEnabled, match, selectedPlayerId]
  );

  useHotkeys(
    'a',
    () => handleEventHotkey('SAVE'),
    { enabled: isEnabled, enableOnFormTags: false },
    [isEnabled, match, selectedPlayerId]
  );

  useHotkeys(
    'o',
    () => handleEventHotkey('OFFSIDE'),
    { enabled: isEnabled, enableOnFormTags: false },
    [isEnabled, match, selectedPlayerId]
  );

  useHotkeys(
    'p',
    () => handleEventHotkey('PASS'),
    { enabled: isEnabled, enableOnFormTags: false },
    [isEnabled, match, selectedPlayerId]
  );

  useHotkeys(
    'c',
    () => handleEventHotkey('SUBSTITUTION'),
    { enabled: isEnabled, enableOnFormTags: false },
    [isEnabled, match, selectedPlayerId]
  );

  useHotkeys(
    'y',
    () => handleEventHotkey('YELLOW_CARD'),
    { enabled: isEnabled, enableOnFormTags: false },
    [isEnabled, match, selectedPlayerId]
  );

  useHotkeys(
    'r',
    () => handleEventHotkey('RED_CARD'),
    { enabled: isEnabled, enableOnFormTags: false },
    [isEnabled, match, selectedPlayerId]
  );

  useHotkeys(
    's',
    () => handleEventHotkey('SHOT'),
    { enabled: isEnabled, enableOnFormTags: false },
    [isEnabled, match, selectedPlayerId]
  );

  useHotkeys(
    'k',
    () => handleEventHotkey('CORNER'),
    { enabled: isEnabled, enableOnFormTags: false },
    [isEnabled, match, selectedPlayerId]
  );

  useHotkeys(
    'esc',
    () => setSelectedPlayer(null),
    { enabled: isEnabled },
    [isEnabled]
  );

  const handleEventHotkey = async (eventType: string) => {
    if (!match) return;

    // Find selected player
    const selectedRosterPlayer = match.roster.find((r: any) => r.id === selectedPlayerId);

    const currentMinute = Math.floor(match.elapsedSeconds / 60);
    const currentSecond = match.elapsedSeconds % 60;

    const teamSide = selectedRosterPlayer ? (selectedRosterPlayer.isHomeTeam ? 'HOME' : 'AWAY') : 'HOME';

    try {
      const response = await api.post(`/matches/${matchId}/events`, {
        rosterPlayerId: selectedPlayerId || undefined,
        teamSide,
        eventType,
        period: match.currentPeriod,
        minute: currentMinute,
        second: currentSecond,
      });

      addEvent(response.data);

      toast({
        title: `${getEventLabel(eventType)} registrado`,
        description: `${currentMinute}'${currentSecond}"`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'No se pudo registrar el evento',
        variant: 'destructive',
      });
    }
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
    };
    return labels[type] || type;
  };

  return { HOTKEY_MAPPINGS };
}
