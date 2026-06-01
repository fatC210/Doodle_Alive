'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Brush, Eraser, Eye, RotateCcw, Sparkles, Target, Trash2, Upload } from 'lucide-react';
import { DEFAULT_STYLE_ID } from '@/lib/data';
import { getCreationResumePath } from '@/lib/flow';
import { useLanguage } from '@/lib/i18n';
import { buildImagePrompt, extractAccentColors, hasVisibleCanvasContent } from '@/lib/prompt';
import { clearDraft, loadDraft, saveDraft } from '@/lib/storage';

const CANVAS_SIZE = 1024;
const colors = ['#ff4545', '#ff982d', '#ffe122', '#78d843', '#12b6a5', '#1376d8', '#ff5fae', '#7b482a', '#151515', '#f8fbff', '#8b5cf6'];
const DEFAULT_BRUSH_COLOR = '#151515';
const backgrounds = ['#ffffff', '#ffdce8', '#fff6bf', '#dff8e6', '#d9f3ff', '#eee5ff'];
const brushSizes = [8, 18, 34];

type DrawingCanvasProps = {
  freshStart?: boolean;
  forceDrawStep?: boolean;
  resumeDraft?: boolean;
};

export function DrawingCanvas({ freshStart = false, forceDrawStep = false, resumeDraft = false }: DrawingCanvasProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const undoStackRef = useRef<ImageData[]>([]);
  const uploadImageRef = useRef<HTMLImageElement | null>(null);
  const uploadPanRef = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState(DEFAULT_BRUSH_COLOR);
  const [customColor, setCustomColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(18);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [eraser, setEraser] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [adjustingUpload, setAdjustingUpload] = useState(false);
  const [uploadZoom, setUploadZoom] = useState(1);
  const [uploadOffset, setUploadOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !context) return;
    if (freshStart) {
      clearDraft();
      router.replace('/create', { scroll: false });
    }
    const draft = loadDraft();
    if (!freshStart && resumeDraft) {
      const resumePath = getCreationResumePath(draft);
      if (resumePath) {
        router.replace(resumePath, { scroll: false });
        return;
      }
    }
    if (!freshStart && forceDrawStep && draft.step !== 'DRAW') {
      saveDraft({ step: 'DRAW' });
    }
    setValidationMessage(draft.didValidationMessage ?? '');
    context.fillStyle = draft.backgroundColor || '#ffffff';
    context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    setBackgroundColor(draft.backgroundColor || '#ffffff');

    if (draft.originalDataUrl) {
      const image = new Image();
      image.onload = () => context.drawImage(image, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
      image.src = draft.originalDataUrl;
    }
  }, [forceDrawStep, freshStart, resumeDraft, router]);

  function getContext() {
    const context = canvasRef.current?.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas is unavailable.');
    return context;
  }

  function snapshot() {
    const context = getContext();
    undoStackRef.current = [...undoStackRef.current.slice(-19), context.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE)];
  }

  function pointFromEvent(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_SIZE,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_SIZE,
    };
  }

  function beginDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (adjustingUpload) {
      uploadPanRef.current = pointFromEvent(event);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    snapshot();
    drawingRef.current = true;
    lastPointRef.current = pointFromEvent(event);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (adjustingUpload && uploadPanRef.current) {
      const point = pointFromEvent(event);
      const dx = point.x - uploadPanRef.current.x;
      const dy = point.y - uploadPanRef.current.y;
      uploadPanRef.current = point;
      setUploadOffset((current) => {
        const next = { x: current.x + dx, y: current.y + dy };
        requestAnimationFrame(() => renderUploadedImage(uploadZoom, next));
        return next;
      });
      return;
    }
    if (!drawingRef.current || !lastPointRef.current) return;
    const context = getContext();
    const point = pointFromEvent(event);
    context.lineWidth = brushSize;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = eraser ? backgroundColor : color;
    context.beginPath();
    context.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    lastPointRef.current = point;
  }

  function endDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (adjustingUpload) {
      uploadPanRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    drawingRef.current = false;
    lastPointRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function setBackground(nextColor: string) {
    const canvas = canvasRef.current;
    const context = getContext();
    snapshot();
    const previous = context.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    replaceBackgroundPixels(previous, backgroundColor, nextColor);
    context.putImageData(previous, 0, 0);
    setBackgroundColor(nextColor);
    saveDraft({ backgroundColor: nextColor });
    canvas?.focus();
  }

  function undo() {
    const previous = undoStackRef.current.pop();
    if (!previous) return;
    getContext().putImageData(previous, 0, 0);
  }

  function clearCanvas() {
    snapshot();
    const context = getContext();
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    uploadImageRef.current = null;
    setAdjustingUpload(false);
    saveDraft({ originalDataUrl: undefined, accentColors: [], prompt: undefined, isBlankCanvas: undefined });
  }

  function exportDrawing() {
    const canvas = canvasRef.current;
    const context = getContext();
    if (!canvas) return;
    const imageData = context.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    const accentColors = extractAccentColors(imageData, backgroundColor, 3);
    const draft = loadDraft();
    const styleId = draft.styleId ?? DEFAULT_STYLE_ID;
    const isBlankCanvas = !hasVisibleCanvasContent(imageData, backgroundColor);
    const prompt = buildImagePrompt(styleId, accentColors, backgroundColor, { isBlankCanvas });
    const originalDataUrl = canvas.toDataURL('image/png');
    saveDraft({ step: 'STYLE', originalDataUrl, accentColors, prompt, backgroundColor, styleId, isBlankCanvas, didValidationMessage: undefined, didValidationStatus: undefined });
    router.push('/create/style');
  }

  function uploadImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const image = new Image();
    image.onload = () => {
      snapshot();
      uploadImageRef.current = image;
      setAdjustingUpload(true);
      setUploadZoom(1);
      setUploadOffset({ x: 0, y: 0 });
      renderUploadedImage(1, { x: 0, y: 0 }, image);
      URL.revokeObjectURL(image.src);
    };
    image.src = URL.createObjectURL(file);
    event.target.value = '';
  }

  function renderUploadedImage(zoom = uploadZoom, offset = uploadOffset, image = uploadImageRef.current) {
    if (!image) return;
    const context = getContext();
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    const baseScale = Math.max(CANVAS_SIZE / image.width, CANVAS_SIZE / image.height);
    const scale = baseScale * zoom;
    const width = image.width * scale;
    const height = image.height * scale;
    context.drawImage(image, (CANVAS_SIZE - width) / 2 + offset.x, (CANVAS_SIZE - height) / 2 + offset.y, width, height);
  }

  function updateUploadZoom(value: number) {
    setUploadZoom(value);
    renderUploadedImage(value, uploadOffset);
  }

  function centerUpload() {
    setUploadOffset({ x: 0, y: 0 });
    renderUploadedImage(uploadZoom, { x: 0, y: 0 });
  }

  function applyUpload() {
    uploadImageRef.current = null;
    setAdjustingUpload(false);
    saveDraft({ originalDataUrl: undefined, accentColors: [], prompt: undefined, isBlankCanvas: undefined });
  }

  function chooseColor(nextColor: string) {
    setColor(nextColor);
    setEraser(false);
  }

  function chooseCustomColor(event: { currentTarget: HTMLInputElement }) {
    chooseColor(event.currentTarget.value);
    setCustomColor(event.currentTarget.value);
  }

  return (
    <section className="wizard-card">
      <div className="draw-area">
        <div className="canvas-panel">
          <div className="canvas-width-frame">
            <div className="tab-row">
              <button className="tab-button active" type="button"><Brush size={18} /> {t('drawOnCanvas')}</button>
              <label className="tab-button upload-tab"><Upload size={18} /> {t('uploadPhoto')}<input type="file" accept="image/*" onChange={uploadImage} /></label>
            </div>
            {validationMessage ? <div className="inline-warning">{validationMessage}</div> : null}
          </div>
          <div className="canvas-box real-canvas-box canvas-width-frame">
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              onPointerDown={beginDraw}
              onPointerMove={draw}
              onPointerUp={endDraw}
              onPointerCancel={endDraw}
              aria-label={t('drawingCanvasAria')}
            />
            <GuideLayer />
          </div>
          <div className="toolbox canvas-width-frame">
            <div>
              <b>{t('colors')}</b>
              <div className="swatches">
                {colors.map((item) => (
                  <button
                    key={item}
                    className={`swatch ${item === color && !eraser ? 'active' : ''}`}
                    style={{ background: item }}
                    onClick={() => chooseColor(item)}
                    aria-label={`${t('useColor')} ${item}`}
                  />
                ))}
                <label className={`swatch color-picker-swatch ${customColor === color && !eraser ? 'active' : ''}`} style={{ background: customColor }}>
                  <input
                    type="color"
                    value={customColor}
                    onInput={chooseCustomColor}
                    onChange={chooseCustomColor}
                    aria-label={`${t('useColor')} ${customColor}`}
                  />
                </label>
              </div>
            </div>
            <div className="tool-mini">
              <b>{t('brushSize')}</b>
              <div className="size-row">{brushSizes.map((size) => <button key={size} className={`size-dot ${size === brushSize ? 'active' : ''}`} style={{ width: size, height: size }} onClick={() => setBrushSize(size)} aria-label={`${t('brushSizeAria')} ${size}`} />)}</div>
            </div>
            <button className={`tool-mini icon-tool ${eraser ? 'active' : ''}`} type="button" onClick={() => setEraser((value) => !value)}><b>{t('eraser')}</b><Eraser /></button>
            <button className="tool-mini icon-tool" type="button" onClick={undo}><b>{t('undo')}</b><RotateCcw /></button>
          </div>
          <div className="background-tools canvas-width-frame">
            <b>{t('background')}</b>
            <div className="bg-swatches">{backgrounds.map((item) => <button key={item} className={`bg-swatch ${item === backgroundColor ? 'active' : ''}`} style={{ background: item }} onClick={() => setBackground(item)} aria-label={`${t('setBackground')} ${item}`} />)}</div>
          </div>
          {adjustingUpload ? (
            <div className="upload-adjust">
              <label>
                <b>{t('photoZoom')}</b>
                <input type="range" min="1" max="2.5" step="0.05" value={uploadZoom} onChange={(event) => updateUploadZoom(Number(event.target.value))} />
              </label>
              <button className="ghost-button" type="button" onClick={centerUpload}>{t('center')}</button>
              <button className="primary-button" type="button" onClick={applyUpload}>{t('applyPhoto')}</button>
            </div>
          ) : null}
        </div>

        <aside className="tips-panel card">
          <h3><Sparkles size={22} /> {t('tipsAvatar')}</h3>
          <div className="tip-item"><span className="tip-icon"><Target /></span><span><h4>{t('centerFace')}</h4><p>{t('centerFaceCopy')}</p></span></div>
          <div className="tip-item"><span className="tip-icon">▢</span><span><h4>{t('margin')}</h4><p>{t('marginCopy')}</p></span></div>
          <div className="tip-item"><span className="tip-icon"><Eye /></span><span><h4>{t('openEyes')}</h4><p>{t('openEyesCopy')}</p></span></div>
          <div className="tip-item"><span className="tip-icon">🎨</span><span><h4>{t('clearColors')}</h4><p>{t('clearColorsCopy')}</p></span></div>
          <div className="dashed-note"><Sparkles size={20} /> {t('guideRemoved')}</div>
          <div className="bottom-nav">
            <button className="ghost-button" type="button" onClick={clearCanvas}><Trash2 size={18} /> {t('clear')}</button>
            <button className="primary-button" type="button" onClick={exportDrawing}>{t('continueToStyle')} →</button>
          </div>
        </aside>
      </div>
    </section>
  );
}

function replaceBackgroundPixels(imageData: ImageData, fromColor: string, toColor: string) {
  const from = hexToRgb(fromColor);
  const to = hexToRgb(toColor);
  for (let index = 0; index < imageData.data.length; index += 4) {
    const r = imageData.data[index];
    const g = imageData.data[index + 1];
    const b = imageData.data[index + 2];
    const distance = Math.hypot(r - from[0], g - from[1], b - from[2]);
    if (distance < 18) {
      imageData.data[index] = to[0];
      imageData.data[index + 1] = to[1];
      imageData.data[index + 2] = to[2];
    }
  }
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '').padEnd(6, 'f');
  return [0, 2, 4].map((start) => Number.parseInt(normalized.slice(start, start + 2), 16));
}

function GuideLayer() {
  return (
    <svg className="guide-layer" viewBox="0 0 1024 1024" aria-hidden="true">
      <line x1="512" y1="210" x2="512" y2="840" />
      <ellipse cx="512" cy="384" rx="205" ry="150" />
      <circle cx="432" cy="365" r="26" />
      <circle cx="592" cy="365" r="26" />
      <path d="M512 392 L492 430 L532 430 Z" />
      <path d="M452 470 Q512 510 572 470" />
      <path d="M294 690 Q512 570 730 690" />
      <path d="M320 870 Q355 690 512 680 Q670 690 704 870" />
    </svg>
  );
}
