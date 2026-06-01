import type { DidAvatarResult, ImageProviderType } from './types';

const DID_API_BASE = 'https://api.d-id.com';

type DidStreamStatus = 'idle' | 'connecting' | 'ready' | 'speaking' | 'error';

interface DidStreamingAvatarInput {
  apiKey: string;
  sourceUrl: string;
  videoElement: HTMLVideoElement;
  language?: 'en' | 'zh';
  onStatusChange?: (status: DidStreamStatus, message?: string) => void;
  onVideoStreamStart?: () => void;
}

type DidStreamSessionResponse = {
  id?: string;
  stream_id?: string;
  session_id?: string;
  offer?: RTCSessionDescriptionInit;
  ice_servers?: RTCIceServer[];
};

type DidImageUploadResponse = {
  url?: string;
  image_url?: string;
  source_url?: string;
  id?: string;
};
const FRIENDLY_FACE_FAILURE = '角色还没准备好，试试画得更清楚或换个风格';

interface CreateDidAvatarInput {
  apiKey: string;
  imageUrl?: string;
  imageDataUrl?: string;
  imageBlob?: Blob;
  provider: ImageProviderType;
  timeoutMs?: number;
}

export async function createDidAvatar(input: CreateDidAvatarInput): Promise<DidAvatarResult> {
  if (!input.apiKey) {
    return {
      ok: false,
      status: 'failed',
      message: 'D-ID API Key is missing. Please add it in Settings.',
      recoverable: false,
    };
  }

  try {
    const imageUrl = await resolveDidImageUrl(input);
    const response = await fetchWithTimeout(`${DID_API_BASE}/talks/streams`, {
      method: 'POST',
      headers: didHeaders(input.apiKey),
      body: JSON.stringify({
        source_url: imageUrl,
        config: {
          stitch: true,
          result_format: 'mp4',
        },
      }),
    }, input.timeoutMs ?? 30000);

    const data = await response.json();
    const streamId = String(data?.id || data?.stream_id || '');
    if (!streamId) throw new Error('D-ID did not return a streaming resource id.');

    return {
      ok: true,
      avatarId: streamId,
      streamId,
      avatarSourceUrl: imageUrl,
      status: 'passed',
      message: 'D-ID face validation passed and streaming resources are ready.',
      recoverable: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : FRIENDLY_FACE_FAILURE;
    const faceFailed = /face|detect|source|image|422|400/i.test(message);
    return {
      ok: false,
      status: 'failed',
      message: faceFailed ? FRIENDLY_FACE_FAILURE : `D-ID setup failed: ${message}`,
      recoverable: true,
    };
  }
}

export async function testDidKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  try {
    await fetch(`${DID_API_BASE}/scenes/avatars`, { headers: didHeaders(apiKey, false) });
    return true;
  } catch {
    return false;
  }
}

export async function uploadDidImage(input: { apiKey: string; imageDataUrl?: string; imageBlob?: Blob; timeoutMs?: number }) {
  const imageBlob = input.imageBlob || (input.imageDataUrl ? await dataUrlToBlob(input.imageDataUrl) : undefined);
  if (!imageBlob) throw new Error('D-ID needs a character image to upload.');

  const formData = new FormData();
  formData.append('image', imageBlob, `doodle-avatar.${imageBlob.type.includes('png') ? 'png' : 'jpg'}`);
  const response = await fetchWithTimeout(`${DID_API_BASE}/images`, {
    method: 'POST',
    headers: didHeaders(input.apiKey, false),
    body: formData,
  }, input.timeoutMs ?? 30000);
  const data = await response.json() as DidImageUploadResponse;
  const imageUrl = String(data.url || data.image_url || data.source_url || '');
  if (!imageUrl) throw new Error('D-ID image upload did not return a URL.');
  return imageUrl;
}

async function resolveDidImageUrl(input: CreateDidAvatarInput) {
  if (input.imageUrl && /^https?:\/\//i.test(input.imageUrl)) return input.imageUrl;
  if (input.imageBlob || input.imageDataUrl) {
    return uploadDidImage({
      apiKey: input.apiKey,
      imageBlob: input.imageBlob,
      imageDataUrl: input.imageDataUrl,
      timeoutMs: input.timeoutMs,
    });
  }
  throw new Error('D-ID needs a public image URL or an uploaded local character image.');
}

export class DidStreamingAvatar {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private streamId = '';
  private sessionId = '';
  private connectPromise: Promise<void> | null = null;
  private ready = false;
  private closed = false;
  private speaking = false;
  private pendingTexts: string[] = [];
  private readyFallbackTimer: number | undefined;
  private speechFallbackTimer: number | undefined;

  constructor(private readonly input: DidStreamingAvatarInput) {}

  connect() {
    if (this.connectPromise) return this.connectPromise;
    this.closed = false;
    this.connectPromise = this.createStream();
    return this.connectPromise;
  }

  async speak(text: string) {
    const trimmed = text.trim();
    if (!trimmed || this.closed) return;
    this.pendingTexts.push(trimmed);
    await this.connect();
    this.processQueue();
  }

  async destroy() {
    this.closed = true;
    this.ready = false;
    this.pendingTexts = [];
    this.finishSpeech(false);
    if (this.readyFallbackTimer) window.clearTimeout(this.readyFallbackTimer);

    const streamId = this.streamId;
    const sessionId = this.sessionId;
    this.streamId = '';
    this.sessionId = '';

    if (streamId && sessionId) {
      await fetch(`${DID_API_BASE}/talks/streams/${streamId}`, {
        method: 'DELETE',
        headers: didHeaders(this.input.apiKey),
        body: JSON.stringify({ session_id: sessionId }),
      }).catch(() => {});
    }

    this.dataChannel?.close();
    this.dataChannel = null;
    this.peerConnection?.close();
    this.peerConnection = null;

    const stream = this.input.videoElement.srcObject;
    if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
    this.input.videoElement.srcObject = null;
    this.emit('idle');
  }

  private async createStream() {
    if (!this.input.apiKey) throw new Error('D-ID API key is missing. Add it in Settings, then try again.');
    if (!/^https:\/\//i.test(this.input.sourceUrl)) throw new Error('D-ID needs a public HTTPS character image URL.');

    this.emit('connecting');
    const sessionResponse = await fetchWithTimeout(`${DID_API_BASE}/talks/streams`, {
      method: 'POST',
      headers: didHeaders(this.input.apiKey),
      body: JSON.stringify({
        source_url: this.input.sourceUrl,
        stream_warmup: true,
        config: { stitch: true },
      }),
    }, 30000);
    const sessionData = await sessionResponse.json() as DidStreamSessionResponse;
    this.streamId = String(sessionData.id || sessionData.stream_id || '');
    this.sessionId = String(sessionData.session_id || '');
    if (!this.streamId || !this.sessionId || !sessionData.offer) throw new Error('D-ID did not return a complete streaming session.');

    const answer = await this.createPeerConnection(sessionData.offer, sessionData.ice_servers || []);
    await fetchWithTimeout(`${DID_API_BASE}/talks/streams/${this.streamId}/sdp`, {
      method: 'POST',
      headers: didHeaders(this.input.apiKey),
      body: JSON.stringify({ answer, session_id: this.sessionId }),
    }, 30000);

    this.readyFallbackTimer = window.setTimeout(() => this.markReady(), 5000);
  }

  private async createPeerConnection(offer: RTCSessionDescriptionInit, iceServers: RTCIceServer[]) {
    this.peerConnection = new RTCPeerConnection({ iceServers });
    this.dataChannel = this.peerConnection.createDataChannel('JanusDataChannel');

    this.peerConnection.addEventListener('icecandidate', (event) => {
      void this.sendIceCandidate(event.candidate);
    });

    this.peerConnection.addEventListener('iceconnectionstatechange', () => {
      const state = this.peerConnection?.iceConnectionState;
      if (state === 'failed' || state === 'closed' || state === 'disconnected') this.emit('error', 'D-ID avatar stream disconnected.');
    });

    this.peerConnection.addEventListener('connectionstatechange', () => {
      if (this.peerConnection?.connectionState === 'connected') this.markReady();
      if (this.peerConnection?.connectionState === 'failed') this.emit('error', 'D-ID avatar stream failed.');
    });

    this.peerConnection.addEventListener('track', (event) => {
      const [stream] = event.streams;
      if (!stream) return;
      const video = this.input.videoElement;
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      this.input.onVideoStreamStart?.();
      void video.play().catch(() => {});
    });

    this.dataChannel.addEventListener('message', (message) => this.handleStreamEvent(message));

    await this.peerConnection.setRemoteDescription(offer);
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  private async sendIceCandidate(candidate: RTCIceCandidate | null) {
    if (!this.streamId || !this.sessionId || this.closed) return;
    await fetch(`${DID_API_BASE}/talks/streams/${this.streamId}/ice`, {
      method: 'POST',
      headers: didHeaders(this.input.apiKey),
      body: JSON.stringify(candidate ? {
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
        session_id: this.sessionId,
      } : { session_id: this.sessionId }),
    }).catch(() => {});
  }

  private handleStreamEvent(message: MessageEvent) {
    const [eventName] = String(message.data || '').split(':');
    if (eventName === 'stream/ready') this.markReady();
    if (eventName === 'stream/started') this.emit('speaking');
    if (eventName === 'stream/done') this.finishSpeech(true);
    if (eventName === 'stream/error') this.finishSpeech(true, 'D-ID could not animate that reply.');
  }

  private markReady() {
    if (this.closed || this.ready) return;
    this.ready = true;
    this.emit('ready');
    this.processQueue();
  }

  private processQueue() {
    if (!this.ready || this.speaking || this.closed || !this.pendingTexts.length) return;
    const nextText = this.pendingTexts.shift();
    if (!nextText) return;
    this.speaking = true;
    this.emit('speaking');
    void this.startStreamWithText(nextText).catch((error) => {
      this.finishSpeech(true, error instanceof Error ? error.message : 'D-ID avatar speech failed.');
    });
  }

  private async startStreamWithText(text: string) {
    if (!this.streamId || !this.sessionId) throw new Error('D-ID avatar stream is not ready yet.');
    const response = await fetchWithTimeout(`${DID_API_BASE}/talks/streams/${this.streamId}`, {
      method: 'POST',
      headers: didHeaders(this.input.apiKey),
      body: JSON.stringify({
        script: {
          type: 'text',
          input: text,
          provider: {
            type: 'microsoft',
            voice_id: this.input.language === 'zh' ? 'zh-CN-XiaoxiaoNeural' : 'en-US-JennyNeural',
          },
        },
        config: { stitch: true, fluent: true },
        session_id: this.sessionId,
      }),
    }, 30000);
    await response.text().catch(() => '');
    const fallbackMs = Math.min(22000, Math.max(4500, text.length * 130));
    this.speechFallbackTimer = window.setTimeout(() => this.finishSpeech(true), fallbackMs);
  }

  private finishSpeech(continueQueue: boolean, errorMessage?: string) {
    if (this.speechFallbackTimer) window.clearTimeout(this.speechFallbackTimer);
    this.speechFallbackTimer = undefined;
    this.speaking = false;
    if (errorMessage) this.emit('error', errorMessage);
    else if (this.ready && !this.closed) this.emit('ready');
    if (continueQueue) this.processQueue();
  }

  private emit(status: DidStreamStatus, message?: string) {
    this.input.onStatusChange?.(status, message);
  }
}

export function didHeaders(apiKey: string, includeJson = true): HeadersInit {
  return {
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    Accept: 'application/json',
    Authorization: apiKey.includes(':') ? `Basic ${btoa(apiKey)}` : `Basic ${apiKey}`,
  };
}

async function dataUrlToBlob(dataUrl: string) {
  return fetch(dataUrl).then((response) => response.blob());
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`D-ID request failed: ${response.status} ${text.slice(0, 180)}`);
    }
    return response;
  } finally {
    window.clearTimeout(timeout);
  }
}
