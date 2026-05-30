'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Sparkles } from 'lucide-react';
import { personas, pickRandomPersona, styles } from '@/lib/data';
import { createElevenAgent, buildAgentPrompt } from '@/lib/elevenlabs';
import { useLanguage } from '@/lib/i18n';
import { loadSecretKeys } from '@/lib/secrets';
import { clearDraft, dataUrlToBlob, loadDraft, loadSettings, saveCharacter, saveDraft } from '@/lib/storage';
import { DoodleDrawing, MagicPortal } from './Illustrations';

export function PersonaSelector() {
  const router = useRouter();
  const { language, t } = useLanguage();
  const [selectedId, setSelectedId] = useState('random');
  const [saving, setSaving] = useState(false);
  const [agentMessage, setAgentMessage] = useState('');
  const [generatedDataUrl, setGeneratedDataUrl] = useState('');
  const [styleId, setStyleId] = useState('watercolor');
  const selected = useMemo(() => personas.find((persona) => persona.id === selectedId) ?? personas.find((persona) => persona.id === 'random') ?? pickRandomPersona(), [selectedId]);
  const selectedStyle = useMemo(() => styles.find((style) => style.id === styleId) ?? styles[0], [styleId]);

  useEffect(() => {
    queueMicrotask(() => {
      const draft = loadDraft();
      setSelectedId(draft.personaId ?? 'random');
      setGeneratedDataUrl(draft.generatedDataUrl ?? draft.originalDataUrl ?? '');
      setStyleId(draft.styleId ?? 'watercolor');
    });
  }, []);

  function choose(personaId: string) {
    setSelectedId(personaId);
    saveDraft({ step: 'PERSONA', personaId });
  }

  function skipRandom() {
    const picked = pickRandomPersona();
    setSelectedId('random');
    saveDraft({ step: 'PERSONA', personaId: picked.id });
    setAgentMessage(`${t('randomPicked')}: ${language === 'zh' ? picked.nameZh : picked.name}`);
  }

  async function startChat() {
    if (saving) return;
    setSaving(true);
    try {
      const draft = loadDraft();
      const savedRandomPersona = draft.personaId && draft.personaId !== 'random'
        ? personas.find((item) => item.id === draft.personaId)
        : undefined;
      const randomPersona = savedRandomPersona ?? pickRandomPersona();
      const persona = selected.id === 'random' ? randomPersona : selected;
      const id = `character-${Date.now()}`;
      const originalImage = draft.originalDataUrl ? await dataUrlToBlob(draft.originalDataUrl) : undefined;
      const generatedImage = draft.generatedDataUrl ? await dataUrlToBlob(draft.generatedDataUrl) : undefined;
      const keys = await loadSecretKeys();
      const settings = loadSettings();
      const agent = await createElevenAgent({
        apiKey: keys.elevenLabs,
        persona,
        character: { name: 'Lumi', styleName: selectedStyle.name, prompt: draft.prompt ?? '' },
        llmSource: settings.llmSource,
        model: settings.builtInModel,
        customLlmEndpoint: settings.customLlmEndpoint,
      });
      const personaPrompt = buildAgentPrompt(persona, { name: 'Lumi', styleName: selectedStyle.name, prompt: draft.prompt ?? '' });
      await saveCharacter({
        id,
        name: 'Lumi',
        styleId: selectedStyle.id,
        styleName: selectedStyle.name,
        personaId: persona.id,
        personaName: persona.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        originalImage,
        originalDataUrl: draft.originalDataUrl,
        generatedImage,
        generatedDataUrl: draft.generatedDataUrl,
        accentColors: draft.accentColors,
        prompt: draft.prompt ?? '',
        avatarId: draft.avatarId,
        avatarSourceUrl: draft.avatarSourceUrl,
        didStreamId: draft.didStreamId,
        agentId: agent.agentId,
        voiceId: persona.voiceId,
        personaPrompt,
        randomPersonaId: selected.id === 'random' ? persona.id : undefined,
        tone: selectedStyle.tone,
      });
      clearDraft();
      router.push(`/chat/${id}`);
    } catch (error) {
      setAgentMessage(error instanceof Error ? error.message : t('saveCharacterFailed'));
      setSaving(false);
    }
  }

  return (
    <>
      <section className="persona-layout">
        <div>
          <h1 className="create-title">{t('choosePersonality')} ✨</h1>
          <p className="subtitle">{t('choosePersonalityCopy')}</p>
          <div className="persona-grid">
            {personas.map((persona) => (
              <button key={persona.id} className={`persona-card ${persona.id === selected.id ? 'selected' : ''}`} type="button" onClick={() => choose(persona.id)}>
                {persona.id === selected.id ? <span className="selected-check">✓</span> : null}
                <div className="persona-emoji">{persona.icon}</div>
                <h3>{language === 'zh' ? persona.nameZh : persona.name}</h3>
                <p>{persona.desc}</p>
                <span className="voice-chip">🎙 {persona.voice}</span>
              </button>
            ))}
          </div>
        </div>
        <aside className="preview-panel card">
          <h3>✨ {t('characterPreview')}</h3>
          <div className="preview-frame persona-preview" style={{ position: 'relative' }}>{generatedDataUrl ? <img className="preview-image" src={generatedDataUrl} alt={t('characterPreview')} /> : <DoodleDrawing />}<MagicPortal /></div>
          <div className="settings-card" style={{ padding: 18, marginTop: 20 }}><b>{t('selectedStyle')}</b><div className="voice-chip" style={{ marginTop: 12 }}>✨ {language === 'zh' ? selectedStyle.nameZh : selectedStyle.name}</div></div>
          <div className="settings-card" style={{ padding: 18, marginTop: 20 }}><b>{t('selectedPersona')}</b><div className="choice-row"><span className="persona-emoji" style={{ width: 58, height: 58, fontSize: 34 }}>{selected.icon}</span><span><b>{language === 'zh' ? selected.nameZh : selected.name}</b><br /><span className="voice-chip">{selected.voice}</span></span></div>{agentMessage ? <p className="subtitle">{agentMessage}</p> : null}</div>
        </aside>
      </section>

      <div className="bottom-nav">
        <Link className="outline-button" href="/create/morph">← {t('back')}</Link>
        <button className="ghost-button" type="button" onClick={skipRandom}><Box size={18} /> {t('skipRandom')}</button>
        <button className={`primary-button ${saving ? 'disabled' : ''}`} type="button" onClick={startChat}><Sparkles size={18} /> {saving ? t('saving') : `${t('startChatting')} →`}</button>
      </div>
      <div className="info-bar">🔒 {t('changeLater')}</div>
    </>
  );
}
