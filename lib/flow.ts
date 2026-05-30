import type { CreationStep } from './types';

export const creationFlow: CreationStep[] = ['DRAW', 'STYLE', 'MORPHING', 'PERSONA', 'TALKING'];

export function canMove(from: CreationStep, to: CreationStep) {
  const fromIndex = creationFlow.indexOf(from);
  const toIndex = creationFlow.indexOf(to);
  if (fromIndex < 0 || toIndex < 0) return false;
  if (to === 'DRAW') return true;
  return Math.abs(toIndex - fromIndex) <= 1 || toIndex < fromIndex;
}

export function nextStep(step: CreationStep): CreationStep {
  return creationFlow[Math.min(creationFlow.indexOf(step) + 1, creationFlow.length - 1)];
}

export function previousStep(step: CreationStep): CreationStep {
  return creationFlow[Math.max(creationFlow.indexOf(step) - 1, 0)];
}
