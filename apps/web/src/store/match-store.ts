import { create } from 'zustand';

interface MatchSession {
  id: string;
  homeTeam: any;
  awayTeam: any;
  status: string;
  currentPeriod: string;
  elapsedSeconds: number;
  isTimerRunning: boolean;
  firstHalfAddedTime?: number;
  secondHalfAddedTime?: number;
  roster: any[];
  events: any[];
}

interface MatchState {
  match: MatchSession | null;
  selectedPlayerId: string | null;
  setMatch: (match: MatchSession) => void;
  setSelectedPlayer: (playerId: string | null) => void;
  updateTimer: (elapsedSeconds: number) => void;
  addEvent: (event: any) => void;
  removeEvent: (eventId: string) => void;
  updateRosterLayout: (rosterId: string, x: number, y: number) => void;
  applySubstitution: (outRosterId: string, inRosterId: string) => void;
}

export const useMatchStore = create<MatchState>((set) => ({
  match: null,
  selectedPlayerId: null,

  setMatch: (match) => set({ match }),

  setSelectedPlayer: (playerId) => set({ selectedPlayerId: playerId }),

  updateTimer: (elapsedSeconds) =>
    set((state) => ({
      match: state.match
        ? {
            ...state.match,
            elapsedSeconds,
          }
        : null,
    })),

  addEvent: (event) =>
    set((state) => ({
      match: state.match
        ? {
            ...state.match,
            events: [...state.match.events, event],
          }
        : null,
    })),

  removeEvent: (eventId) =>
    set((state) => ({
      match: state.match
        ? {
            ...state.match,
            events: state.match.events.filter((e: any) => e.id !== eventId),
          }
        : null,
    })),

  updateRosterLayout: (rosterId, x, y) =>
    set((state) => ({
      match: state.match
        ? {
            ...state.match,
            roster: state.match.roster.map((r: any) =>
              r.id === rosterId ? { ...r, layoutX: x, layoutY: y } : r
            ),
          }
        : null,
    })),

  applySubstitution: (outRosterId, inRosterId) =>
    set((state) => {
      if (!state.match) return { match: null };
      const outPlayer = state.match.roster.find((r: any) => r.id === outRosterId);
      const nextRoster = state.match.roster.map((r: any) => {
        if (r.id === outRosterId) {
          return { ...r, isStarter: false };
        }
        if (r.id === inRosterId) {
          return {
            ...r,
            isStarter: true,
            layoutX: outPlayer?.layoutX ?? r.layoutX,
            layoutY: outPlayer?.layoutY ?? r.layoutY,
          };
        }
        return r;
      });
      return {
        match: {
          ...state.match,
          roster: nextRoster,
        },
        selectedPlayerId: inRosterId,
      };
    }),
}));
