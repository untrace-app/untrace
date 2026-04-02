// Temporary test harness — run with: npm run test-solver

import { solve } from './solver.ts';
import { TEST_LEVELS } from '../levels/test-levels.ts';

for (const level of TEST_LEVELS) {
  const result = solve(level);
  console.log(
    `[${level.id}] ${level.name}\n` +
    `  solvable:            ${result.solvable}\n` +
    `  minMoves:            ${result.minMoves ?? 'n/a'}\n` +
    `  solutionCount:       ${result.solutionCount ?? 'n/a'}\n` +
    `  requiresDraw:        ${result.requiresDraw}\n` +
    `  eulerSolvable:       ${result.eulerSolvable}\n` +
    `  minRemainingLayers:  ${result.minRemainingLayers}\n` +
    `  difficulty:          ${result.difficulty ?? 'n/a'}\n`,
  );
}
