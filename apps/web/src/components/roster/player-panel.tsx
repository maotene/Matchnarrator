'use client';

import { useMatchStore } from '@/store/match-store';

interface PlayerPanelProps {
  side: 'home' | 'away';
}

export function PlayerPanel({ side }: PlayerPanelProps) {
  const { match, selectedPlayerId, setSelectedPlayer } = useMatchStore();
  if (!match) return null;

  const roster = match.roster
    .filter((r: any) => (side === 'home' ? r.isHomeTeam : !r.isHomeTeam))
    .sort((a: any, b: any) => a.jerseyNumber - b.jerseyNumber);
  const starters = roster.filter((r: any) => r.isStarter);
  const subs = roster.filter((r: any) => !r.isStarter);

  const team = side === 'home' ? match.homeTeam : match.awayTeam;

  const baseColor = side === 'home' ? 'text-blue-700' : 'text-red-700';
  const selectedClass =
    side === 'home'
      ? 'bg-blue-50 border-blue-300 font-semibold'
      : 'bg-red-50 border-red-300 font-semibold';

  return (
    <div className="space-y-1">
      <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 pb-1 border-b ${baseColor}`}>
        {team.shortName || team.name}
      </h3>
      {roster.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Sin jugadores</p>
      ) : (
        [...starters, ...subs].map((r: any, idx) => {
          const isSelected = r.id === selectedPlayerId;
          const playerName = r.customName || (r.player
            ? r.player.lastName
            : `#${r.jerseyNumber}`);
          const showSubsDivider = idx === starters.length && subs.length > 0;
          return (
            <div key={r.id}>
              {showSubsDivider && (
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-2 mb-1 border-t pt-1">
                  Suplentes
                </p>
              )}
              <button
                onClick={() => setSelectedPlayer(isSelected ? null : r.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm border transition-colors ${
                  isSelected
                    ? selectedClass + ' border'
                    : 'border-transparent hover:bg-gray-50 hover:border-gray-200'
                }`}
                title={r.player ? `${r.player.firstName} ${r.player.lastName}` : undefined}
              >
                <span
                  className={`font-mono font-bold w-6 text-center shrink-0 text-xs ${
                    isSelected ? '' : 'text-muted-foreground'
                  }`}
                >
                  {r.jerseyNumber}
                </span>
                <span className="truncate">{playerName}</span>
                {!r.isStarter && <span className="text-[10px] text-muted-foreground ml-auto">SUP</span>}
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
