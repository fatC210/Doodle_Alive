import type { LanguageCode } from './types';

const englishNames = ['Milo', 'Luna', 'Poppy', 'Theo', 'Nora', 'Finn', 'Ivy', 'Leo', 'Mia', 'Oliver', 'Ruby', 'Max', 'Sophie', 'Jasper', 'Ellie', 'Arlo'];
const chineseNames = ['安安', '乐乐', '可可', '米米', '朵朵', '悠悠', '小满', '小鹿', '星野', '云舒', '念念', '桃桃', '阿布', '圆圆', '豆豆', '晴晴'];

function pickRandom(items: string[], random: () => number) {
  return items[Math.floor(random() * items.length)] ?? items[0];
}

export function generateRandomCharacterName(language: LanguageCode = 'en', random: () => number = Math.random) {
  return language === 'zh' ? pickRandom(chineseNames, random) : pickRandom(englishNames, random);
}
