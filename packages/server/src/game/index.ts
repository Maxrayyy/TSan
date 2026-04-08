// packages/server/src/game/index.ts
export { createDeck, shuffle, deal } from './deck.js';
export { detectHandType } from './hand-detector.js';
export { compareHands, canBeat } from './hand-comparator.js';
export { validatePlay, playerHasCards, containsThree } from './play-validator.js';
export type { ValidationResult } from './play-validator.js';
export { checkTuoSan, checkBieSan } from './tuo-san-rule.js';
export type { TuoSanResult, BieSanResult } from './tuo-san-rule.js';
export { calculateRoundScore, settleGame } from './scorer.js';
export { GameEngine } from './game-engine.js';
export type { PlayerInfo } from './game-engine.js';
