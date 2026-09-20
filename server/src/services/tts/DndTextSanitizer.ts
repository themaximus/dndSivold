export interface ITextSanitizer {
  sanitize(text: string): string;
}

export class DndTextSanitizer implements ITextSanitizer {
  public sanitize(rawText: string): string {
    let cleaned = rawText;

    // 1. Remove parenthetical game mechanic annotations: "(итоговый результат проверки 5)", "(СЛ 14)", etc.
    cleaned = cleaned.replace(/\([^)]*(?:проверк|бросок|результат|итогов|кубик|d20|к20|сложност|сл\s*\d|hp|хп|урон|модификатор|спасбросок|кб)[^)]*\)/giu, '');

    // 2. Remove square brackets with rolls e.g. [Кость: d20...], [Цель: ...]
    cleaned = cleaned.replace(/\[[^\]]*\]/gu, '');

    // 3. Remove standalone dice mechanic codes: "d20", "2d6+3", "1к20", "2к6"
    cleaned = cleaned.replace(/(?<!\p{L})\d*[dkдк]\d+(\s*[\+\-]\s*\d+)?(?!\p{L})/giu, '');

    // 4. Remove standalone HP / AC / Damage notifications like "-4 HP", "HP -4", "КБ 16"
    cleaned = cleaned.replace(/[-+]\s*\d+\s*(HP|ХП|хп|hp)(?!\p{L})/giu, '');
    cleaned = cleaned.replace(/(?<!\p{L})(HP|ХП|хп|hp)\s*[-+:]\s*\d+(?!\p{L})/giu, '');
    cleaned = cleaned.replace(/(?<!\p{L})(КБ|AC)\s*[:=\-]?\s*\d+(?!\p{L})/giu, '');

    // 5. Remove question to players at end like "Что делает Кирильчик?", "Что вы делаете?"
    cleaned = cleaned.replace(/Что\s+(?:вы\s+делаете|делает\s+[\p{L}]+)\??/giu, '');

    // 6. Remove DM/Round prefixes like "Мастер:", "Раунд 8:"
    cleaned = cleaned.replace(/^(?:Мастер|DM|Хроника(?:\s+раунда\s+\d+)?|Раунд\s+\d+)\s*[:\-]\s*/giu, '');

    // 7. Remove HTML tags and markdown symbols
    cleaned = cleaned.replace(/<[^>]*>?/gm, '');
    cleaned = cleaned.replace(/[*_~`#\[\]]/gu, '');

    // 8. Remove dangling empty parentheses
    cleaned = cleaned.replace(/\(\s*\)/gu, '');

    // 9. Normalize whitespace and punctuation spacing
    cleaned = cleaned.replace(/\s+/gu, ' ');
    cleaned = cleaned.replace(/\s+([,\.!\?:;])/gu, '$1');

    return cleaned.trim();
  }
}

export const dndTextSanitizer = new DndTextSanitizer();
