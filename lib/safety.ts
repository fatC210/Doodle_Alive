import { childSafetyPrompt } from './data';

const BLOCKED_PATTERNS = [
  /weapon|gun|knife|bomb|violence|kill|death|blood|gore|horror/i,
  /adult|sex|nude|dating|romance/i,
  /drug|alcohol|gambling|casino/i,
  /address|phone number|password|secret|school name/i,
  /self[-\s]?harm|suicide/i,
  /hate|racist|bully/i,
];

export function isUnsafeForChild(value: string) {
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(value));
}

export function safeChildRedirect() {
  return "That's not something I can help with, but we can imagine a bright, safe adventure instead.";
}

export function sanitizeForChild(value: string) {
  if (isUnsafeForChild(value)) return safeChildRedirect();
  return value.trim();
}

export function childSafeSystemPrompt(personaPrompt?: string) {
  return [personaPrompt, childSafetyPrompt].filter(Boolean).join('\n');
}
