import { personas, styles } from './data';
import type { DoodleCharacter, LanguageCode } from './types';

export function getLocalizedStyleName(character: DoodleCharacter, language: LanguageCode) {
  const style = styles.find((item) => item.id === character.styleId);
  if (!style) return character.styleName;
  return language === 'zh' ? style.nameZh : style.name;
}

export function getLocalizedPersonaName(character: DoodleCharacter, language: LanguageCode) {
  const persona = personas.find((item) => item.id === character.personaId);
  if (!persona) return character.personaName;
  return language === 'zh' ? persona.nameZh : persona.name;
}
