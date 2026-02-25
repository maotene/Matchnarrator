import { useHotkeys } from 'react-hotkeys-hook';
import { useMatchStore } from '@/store/match-store';

interface UseHotkeysOptions {
  matchId: string;
  isEnabled: boolean;
  onEventTriggered: (eventType: string) => void;
}

export const HOTKEY_MAPPINGS: Record<string, string> = {
  G: 'Gol',
  F: 'Falta',
  A: 'Atajada',
  O: 'Offside',
  P: 'Pase',
  C: 'Cambio',
  Y: 'T. Amarilla',
  R: 'T. Roja',
  S: 'Disparo',
  K: 'Corner',
};

const KEY_TO_EVENT: Record<string, string> = {
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

export function useMatchHotkeys({ isEnabled, onEventTriggered }: UseHotkeysOptions) {
  const { setSelectedPlayer } = useMatchStore();
  const opts = { enabled: isEnabled, enableOnFormTags: false } as const;

  useHotkeys('g', () => onEventTriggered('GOAL'),        opts, [isEnabled, onEventTriggered]);
  useHotkeys('f', () => onEventTriggered('FOUL'),        opts, [isEnabled, onEventTriggered]);
  useHotkeys('a', () => onEventTriggered('SAVE'),        opts, [isEnabled, onEventTriggered]);
  useHotkeys('o', () => onEventTriggered('OFFSIDE'),     opts, [isEnabled, onEventTriggered]);
  useHotkeys('p', () => onEventTriggered('PASS'),        opts, [isEnabled, onEventTriggered]);
  useHotkeys('c', () => onEventTriggered('SUBSTITUTION'),opts, [isEnabled, onEventTriggered]);
  useHotkeys('y', () => onEventTriggered('YELLOW_CARD'), opts, [isEnabled, onEventTriggered]);
  useHotkeys('r', () => onEventTriggered('RED_CARD'),    opts, [isEnabled, onEventTriggered]);
  useHotkeys('s', () => onEventTriggered('SHOT'),        opts, [isEnabled, onEventTriggered]);
  useHotkeys('k', () => onEventTriggered('CORNER'),      opts, [isEnabled, onEventTriggered]);
  useHotkeys('esc', () => setSelectedPlayer(null), { enabled: isEnabled }, [isEnabled]);

  return { HOTKEY_MAPPINGS, KEY_TO_EVENT };
}
