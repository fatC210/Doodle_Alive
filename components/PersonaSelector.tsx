'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Compass, Dice5, Drama, FlaskConical, Glasses, HeartHandshake, LockKeyhole, Mic2, Palette, Sparkles, type LucideIcon } from 'lucide-react';
import { generateRandomCharacterName } from '@/lib/character-name';
import { DEFAULT_STYLE_ID, personas, pickRandomPersona, styles } from '@/lib/data';
import { provisionDidAgent } from '@/lib/did-agent-client';
import { useLanguage } from '@/lib/i18n';
import { loadDidApiKey } from '@/lib/secrets';
import type { LanguageCode, PersonaPreset } from '@/lib/types';
import { clearDraft, dataUrlToBlob, loadDraft, saveCharacter, saveDraft } from '@/lib/storage';

const personaIcons: Record<string, LucideIcon> = {
  'brave-explorer': Compass,
  'mischievous-prankster': Drama,
  'gentle-guardian': HeartHandshake,
  'wacky-inventor': FlaskConical,
  'cool-rebel': Glasses,
  random: Dice5,
};

function getPersonaVoice(persona: PersonaPreset, language: LanguageCode) {
  return language === 'zh' ? persona.voiceZh : persona.voice;
}

function buildPersonaPrompt(persona: PersonaPreset, character: { name: string; styleName: string; prompt: string }) {
  return `${persona.systemPrompt}
Character name: ${character.name}
Visual style: ${character.styleName}
Drawing prompt: ${character.prompt}`;
}

export function PersonaSelector() {
  const router = useRouter();
  const { language, t } = useLanguage();
  const [selectedId, setSelectedId] = useState('random');
  const [saving, setSaving] = useState(false);
  const [agentMessage, setAgentMessage] = useState('');
  const [generatedDataUrl, setGeneratedDataUrl] = useState('');
  const [styleId, setStyleId] = useState(DEFAULT_STYLE_ID);
  const [characterName, setCharacterName] = useState('');
  const selected = useMemo(() => personas.find((persona) => persona.id === selectedId) ?? personas.find((persona) => persona.id === 'random') ?? pickRandomPersona(), [selectedId]);
  const selectedStyle = useMemo(() => styles.find((style) => style.id === styleId) ?? styles.find((style) => style.id === DEFAULT_STYLE_ID) ?? styles[0], [styleId]);

  useEffect(() => {
    queueMicrotask(() => {
      const draft = loadDraft();
      setSelectedId(draft.personaId ?? 'random');
      setGeneratedDataUrl(draft.generatedDataUrl ?? draft.generatedImageUrl ?? draft.originalDataUrl ?? '');
      setStyleId(draft.styleId ?? DEFAULT_STYLE_ID);
      setCharacterName(draft.characterName ?? '');
    });
  }, []);

  function choose(personaId: string) {
    setSelectedId(personaId);
    saveDraft({ step: 'PERSONA', personaId });
  }

  function updateCharacterName(value: string) {
    setCharacterName(value);
    setAgentMessage('');
    saveDraft({ step: 'PERSONA', characterName: value });
  }

  async function startChat() {
    if (saving) return;
    const enteredCharacterName = characterName.trim();
    const finalCharacterName = enteredCharacterName || generateRandomCharacterName(language);
    if (!enteredCharacterName) {
      setCharacterName(finalCharacterName);
      saveDraft({ step: 'PERSONA', characterName: finalCharacterName });
    }
    setSaving(true);
    setAgentMessage('');
    try {
      const draft = loadDraft();
      const savedRandomPersona = draft.personaId && draft.personaId !== 'random'
        ? personas.find((item) => item.id === draft.personaId)
        : undefined;
      const randomPersona = savedRandomPersona ?? pickRandomPersona();
      const persona = selected.id === 'random' ? randomPersona : selected;
      const id = `character-${Date.now()}`;
      const originalImage = draft.originalDataUrl ? await dataUrlToBlob(draft.originalDataUrl) : undefined;
      const generatedImage = draft.generatedDataUrl?.startsWith('data:') ? await dataUrlToBlob(draft.generatedDataUrl) : undefined;
      const characterDetails = { name: finalCharacterName, styleName: selectedStyle.name, prompt: draft.prompt ?? '' };
      const personaPrompt = buildPersonaPrompt(persona, characterDetails);
      const didApiKey = await loadDidApiKey();
      const didAgent = await provisionDidAgent({
        characterId: id,
        characterName: finalCharacterName,
        personaPrompt,
        imageDataUrl: draft.generatedDataUrl?.startsWith('data:') ? draft.generatedDataUrl : undefined,
        imageUrl: draft.generatedImageUrl,
        apiKey: didApiKey,
        allowedDomains: window.location.origin,
      });
      await saveCharacter({
        id,
        name: finalCharacterName,
        styleId: selectedStyle.id,
        styleName: selectedStyle.name,
        personaId: persona.id,
        personaName: persona.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        originalImage,
        originalDataUrl: draft.originalDataUrl,
        generatedImage,
        generatedDataUrl: draft.generatedDataUrl || draft.generatedImageUrl,
        generatedImageUrl: draft.generatedImageUrl,
        accentColors: draft.accentColors,
        prompt: draft.prompt ?? '',
        personaPrompt,
        randomPersonaId: selected.id === 'random' ? persona.id : undefined,
        tone: selectedStyle.tone,
        didAgentId: didAgent.agentId,
        didClientKey: didAgent.clientKey,
        didSourceUrl: didAgent.sourceUrl,
        didStatus: didAgent.status,
      });
      clearDraft();
      router.push(`/chat/${id}`);
    } catch (error) {
      setAgentMessage(localizeDidAgentError(error, language, t));
      setSaving(false);
    }
  }

  const setupIssue = '';
  const SelectedIcon = personaIcons[selected.id] ?? Dice5;

  return (
    <>
      <section className="persona-layout">
        <div>
          <h1 className="create-title persona-title">{t('choosePersonality')}</h1>
          <p className="subtitle">{t('choosePersonalityCopy')}</p>
          <label className="character-name-field form-field">
            <span>{t('characterName')}</span>
            <input value={characterName} maxLength={32} onChange={(event) => updateCharacterName(event.target.value)} placeholder={t('characterNamePlaceholder')} aria-label={t('characterName')} />
          </label>
          <div className="persona-grid">
            {personas.map((persona) => {
              const PersonaIcon = personaIcons[persona.id] ?? Dice5;
              return (
                <button key={persona.id} className={`persona-card ${persona.id === selected.id ? 'selected' : ''}`} type="button" onClick={() => choose(persona.id)}>
                  {persona.id === selected.id ? <span className="selected-check"><Check size={18} aria-hidden="true" /></span> : null}
                  <div className="persona-icon"><PersonaIcon size={58} strokeWidth={1.8} aria-hidden="true" /></div>
                  <h3>{language === 'zh' ? persona.nameZh : persona.name}</h3>
                  <p>{language === 'zh' ? persona.descZh : persona.desc}</p>
                  <span className="voice-chip"><Mic2 size={14} aria-hidden="true" /> {getPersonaVoice(persona, language)}</span>
                </button>
              );
            })}
          </div>
        </div>
        <aside className="preview-panel card">
          <h3>{t('characterPreview')}</h3>
          <div className="preview-frame persona-preview">{generatedDataUrl ? <img className="preview-image" src={generatedDataUrl} alt={t('characterPreview')} /> : null}</div>
          <div className="settings-card" style={{ padding: 18, marginTop: 20 }}><b>{t('characterName')}</b><div className="character-preview-name">{characterName.trim() || t('characterNamePlaceholder')}</div></div>
          <div className="settings-card" style={{ padding: 18, marginTop: 20 }}><b>{t('selectedStyle')}</b><div className="voice-chip" style={{ marginTop: 12 }}><Palette size={14} aria-hidden="true" /> {language === 'zh' ? selectedStyle.nameZh : selectedStyle.name}</div></div>
          <div className="settings-card" style={{ padding: 18, marginTop: 20 }}><b>{t('selectedPersona')}</b><div className="choice-row"><span className="persona-icon persona-icon-small"><SelectedIcon size={30} strokeWidth={1.9} aria-hidden="true" /></span><span><b>{language === 'zh' ? selected.nameZh : selected.name}</b><br /><span className="voice-chip"><Mic2 size={14} aria-hidden="true" /> {getPersonaVoice(selected, language)}</span></span></div>{agentMessage ? <p className="subtitle">{agentMessage}</p> : null}</div>
        </aside>
      </section>

      <div className="bottom-nav">
        <Link className="outline-button" href="/create/morph">← {t('back')}</Link>
        {setupIssue ? <Link className="outline-button" href="/settings">{t('openSettings')}</Link> : null}
        <button className={`primary-button ${saving || setupIssue ? 'disabled' : ''}`} type="button" onClick={startChat}><Sparkles size={18} /> {saving ? t('creatingDidAvatar') : `${t('startChatting')} →`}</button>
      </div>
      <div className={setupIssue ? 'inline-warning' : 'info-bar'}>{setupIssue || <><LockKeyhole size={16} aria-hidden="true" /> {t('changeLater')}</>}</div>
    </>
  );
}

function localizeDidAgentError(error: unknown, language: LanguageCode, t: ReturnType<typeof useLanguage>['t']) {
  const message = error instanceof Error ? error.message : '';
  if (!message) return t('saveCharacterFailed');
  if (language !== 'zh') return message;
  if (/D-ID|DID_API_KEY|DID_ALLOWED_DOMAINS|server|agent|avatar|client key|source/i.test(message)) return t('didAgentCreationFailed');
  return message;
}
