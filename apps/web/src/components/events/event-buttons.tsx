'use client';

import { EVENT_META } from './event-dialog';

const EVENTS = [
  'GOAL', 'SHOT', 'FOUL', 'SAVE',
  'YELLOW_CARD', 'RED_CARD', 'CORNER',
  'OFFSIDE', 'SUBSTITUTION', 'FREEKICK',
];

interface EventButtonsProps {
  onEvent: (eventType: string) => void;
  disabled?: boolean;
}

export function EventButtons({ onEvent, disabled }: EventButtonsProps) {
  return (
    <div className="flex flex-wrap gap-1.5 justify-center">
      {EVENTS.map((type) => {
        const { label, icon } = EVENT_META[type];
        return (
          <button
            key={type}
            onClick={() => onEvent(type)}
            disabled={disabled}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium transition-colors shadow-sm"
          >
            <span>{icon}</span>
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
