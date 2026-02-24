// Hotkey mappings
export const HOTKEY_MAPPINGS = {
  G: 'GOAL',
  F: 'FOUL',
  A: 'SAVE',
  O: 'OFFSIDE',
  P: 'PASS',
  C: 'SUBSTITUTION',
  Y: 'YELLOW_CARD',
  R: 'RED_CARD',
  S: 'SHOT',
  K: 'CORNER',
} as const;

// Timer constants
export const HALF_DURATION_MINUTES = 45;
export const EXTRA_TIME_DURATION_MINUTES = 15;

// Field dimensions (for canvas)
export const FIELD_WIDTH = 800;
export const FIELD_HEIGHT = 600;
