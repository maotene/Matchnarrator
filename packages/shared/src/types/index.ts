// User & Auth
export enum UserRole {
  SUPERADMIN = 'SUPERADMIN',
  NARRADOR = 'NARRADOR',
}

// Player Position
export enum PlayerPosition {
  GK = 'GK', // Goalkeeper
  DF = 'DF', // Defender
  MF = 'MF', // Midfielder
  FW = 'FW', // Forward
}

// Match
export enum MatchStatus {
  SETUP = 'SETUP',
  LIVE = 'LIVE',
  HALFTIME = 'HALFTIME',
  FINISHED = 'FINISHED',
}

export enum MatchPeriod {
  FIRST_HALF = 'FIRST_HALF',
  SECOND_HALF = 'SECOND_HALF',
  EXTRA_TIME_FIRST = 'EXTRA_TIME_FIRST',
  EXTRA_TIME_SECOND = 'EXTRA_TIME_SECOND',
  PENALTIES = 'PENALTIES',
}

export enum TeamSide {
  HOME = 'HOME',
  AWAY = 'AWAY',
}

export enum EventType {
  GOAL = 'GOAL',
  FOUL = 'FOUL',
  SAVE = 'SAVE',
  OFFSIDE = 'OFFSIDE',
  PASS = 'PASS',
  SUBSTITUTION = 'SUBSTITUTION',
  YELLOW_CARD = 'YELLOW_CARD',
  RED_CARD = 'RED_CARD',
  CORNER = 'CORNER',
  FREEKICK = 'FREEKICK',
  PENALTY = 'PENALTY',
  SHOT = 'SHOT',
  OTHER = 'OTHER',
}

// DTOs
export interface CreateUserDto {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  };
}

export interface CreateCompetitionDto {
  name: string;
  country?: string;
  logo?: string;
}

export interface CreateSeasonDto {
  name: string;
  competitionId: string;
  startDate?: Date;
  endDate?: Date;
}

export interface CreateTeamDto {
  name: string;
  shortName?: string;
  logo?: string;
  city?: string;
}

export interface CreatePlayerDto {
  firstName: string;
  lastName: string;
  photo?: string;
  birthDate?: Date;
  nationality?: string;
  position?: PlayerPosition;
}

export interface CreateMatchSessionDto {
  homeTeamId: string;
  awayTeamId: string;
  matchDate: Date;
  venue?: string;
  fixtureMatchId?: string;
}

export interface CreateRosterPlayerDto {
  playerId: string;
  teamId: string;
  jerseyNumber: number;
  isHomeTeam: boolean;
  isStarter?: boolean;
  position?: PlayerPosition;
}

export interface UpdateRosterLayoutDto {
  layoutX?: number;
  layoutY?: number;
}

export interface CreateMatchEventDto {
  rosterPlayerId?: string;
  teamSide: TeamSide;
  eventType: EventType;
  period: MatchPeriod;
  minute: number;
  second: number;
  payload?: any;
}

export interface TimerState {
  currentPeriod: MatchPeriod;
  elapsedSeconds: number;
  isTimerRunning: boolean;
  firstHalfAddedTime?: number;
  secondHalfAddedTime?: number;
}
