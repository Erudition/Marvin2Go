

import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { ConnectionState, VoiceMode, TranscriptItem } from '../types';
import { GEMINI_MODEL, TOOLS } from '../constants';
import { base64ToUint8Array, decodeAudioData, pcmToBlob, resampleTo16k } from '../utils/audio';
import { v4 as uuidv4 } from 'uuid';

interface UseLiveClientProps {
  apiKey: string;
  onToolCall: (name: string, args: any) => Promise<any>;
  systemInstruction?: string;
}

export const useLiveClient = ({ apiKey, onToolCall, systemInstruction }: UseLiveClientProps) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [volume, setVolume] = useState(0);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>(VoiceMode.VAD);
  const [isPttPressed, setIsPttPressed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aiRef = useRef<GoogleGenAI | null>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  const audioBufferRef = useRef<Blob[]>([]);
  const isSessionOpenRef = useRef(false);
  
  // Track if the disconnect was initiated by the user
  const isUserDisconnectingRef = useRef(false);
  // Store the latest callback to use in retries
  const transcriptsCallbackRef = useRef<((updater: (prev: TranscriptItem[]) => TranscriptItem[]) => void) | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onToolCallRef = useRef(onToolCall);
  
  useEffect(() => {
    onToolCallRef.current = onToolCall;
  }, [onToolCall]);

  useEffect(() => {
    if (apiKey) {
      aiRef.current = new GoogleGenAI({ apiKey });
    }
  }, [apiKey]);

  const playDisconnectSound = () => {
    const ctx = audioContextRef.current;
    if (!ctx) return;
    try {
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.3);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        osc.start(t);
        osc.stop(t + 0.3);
    } catch (e) {
        console.warn("Could not play disconnect sound", e);
    }
  };

  const disconnect = useCallback(() => {
    isUserDisconnectingRef.current = true; // Signal that this is intentional

    // Clear any pending retries
    if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
    }

    if (sessionRef.current) {
        try {
            sessionRef.current.close();
        } catch (e) {
            console.warn("Error closing session", e);
        }
        sessionRef.current = null;
    }
    isSessionOpenRef.current = false;

    if (inputSourceRef.current) {
        inputSourceRef.current.disconnect();
        inputSourceRef.current = null;
    }
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
    }

    if (inputAudioContextRef.current?.state !== 'closed') {
        inputAudioContextRef.current?.close();
    }
    inputAudioContextRef.current = null;

    if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close();
    }
    audioContextRef.current = null;

    setConnectionState(ConnectionState.DISCONNECTED);
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
    audioBufferRef.current = [];
    setVolume(0);
  }, []);

  const connect = useCallback(async (transcriptsCallback: (updater: (prev: TranscriptItem[]) => TranscriptItem[]) => void) => {
    if (!aiRef.current) return;
    if (connectionState === ConnectionState.CONNECTING || connectionState === ConnectionState.CONNECTED) return;

    // Reset state for new connection
    isUserDisconnectingRef.current = false;
    transcriptsCallbackRef.current = transcriptsCallback;
    setConnectionState(ConnectionState.CONNECTING);
    setError(null);
    audioBufferRef.current = []; // Clear buffer only on user-initiated connect
    isSessionOpenRef.current = false;

    // 1. Setup Audio (Reuse logic)
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      
      const inputCtx = new AudioContextClass(); 
      const outputCtx = new AudioContextClass(); 

      inputAudioContextRef.current = inputCtx;
      audioContextRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = inputCtx.createMediaStreamSource(stream);
      inputSourceRef.current = source;
      
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
        }
        setVolume(Math.sqrt(sum / inputData.length));

        const currentVoiceMode = voiceModeRef.current;
        const currentPttState = isPttPressedRef.current;

        const shouldSend = 
            currentVoiceMode === VoiceMode.VAD || 
            (currentVoiceMode === VoiceMode.PTT && currentPttState);

        if (shouldSend) {
            const data16k = resampleTo16k(inputData, inputCtx.sampleRate);
            const pcmBlob = pcmToBlob(data16k, 16000);
            
            if (isSessionOpenRef.current && sessionRef.current) {
                try {
                  sessionRef.current.sendRealtimeInput({ media: pcmBlob });
                } catch(err) {
                  console.error("Error sending realtime input", err);
                }
            } else {
                // Buffer audio if session is not open (connecting or retrying)
                audioBufferRef.current.push(pcmBlob);
            }
        }
      };

      source.connect(processor);
      processor.connect(inputCtx.destination);

    } catch (err: any) {
       console.error("Audio setup failed", err);
       setError(err.message);
       disconnect();
       setConnectionState(ConnectionState.ERROR);
       return;
    }

    // 2. Connect to API with Recursive Retry Logic
    const connectSocket = async (attempt: number) => {
        if (isUserDisconnectingRef.current) return;
        
        // Ensure connection state reflects we are trying
        setConnectionState(ConnectionState.CONNECTING);

        const config: any = {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } },
            },
            systemInstruction: { parts: [{ text: systemInstruction || "You are a helpful assistant." }] },
            tools: [{ functionDeclarations: TOOLS }],
        };
        // Explicitly enable transcription with empty objects
        config.inputAudioTranscription = {};
        config.outputAudioTranscription = {};

        try {
            if (!aiRef.current) return;
            const session = await aiRef.current.live.connect({
                model: GEMINI_MODEL,
                config,
                callbacks: {
                    onopen: () => {
                        console.log('Gemini Live Connected');
                        setConnectionState(ConnectionState.CONNECTED);
                        isSessionOpenRef.current = true;
                        
                        // Flush buffer
                        if (audioBufferRef.current.length > 0) {
                            console.log(`Flushing ${audioBufferRef.current.length} buffered audio chunks`);
                            audioBufferRef.current.forEach(chunk => {
                                sessionRef.current?.sendRealtimeInput({ media: chunk });
                            });
                            audioBufferRef.current = [];
                        }
                    },
                    onmessage: async (msg: LiveServerMessage) => {
                        const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (base64Audio && audioContextRef.current) {
                            const ctx = audioContextRef.current;
                            const audioData = base64ToUint8Array(base64Audio);
                            const audioBuffer = await decodeAudioData(audioData, ctx, 24000, 1);
                            
                            const source = ctx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(ctx.destination);
                            
                            const startTime = Math.max(nextStartTimeRef.current, ctx.currentTime);
                            source.start(startTime);
                            nextStartTimeRef.current = startTime + audioBuffer.duration;
                            
                            source.addEventListener('ended', () => sourcesRef.current.delete(source));
                            sourcesRef.current.add(source);
                        }

                        // Handle Transcripts
                        if (transcriptsCallbackRef.current) {
                            const cb = transcriptsCallbackRef.current;
                            if (msg.serverContent?.outputTranscription) {
                                cb(prev => {
                                    const last = prev[prev.length - 1];
                                    if (last && last.role === 'model' && !last.isComplete && !last.toolDetails) {
                                        return [...prev.slice(0, -1), { ...last, text: (last.text || '') + msg.serverContent?.outputTranscription?.text }];
                                    }
                                    return [...prev, { id: uuidv4(), role: 'model', text: msg.serverContent?.outputTranscription?.text, timestamp: Date.now() }];
                                });
                            }
                            if (msg.serverContent?.inputTranscription) {
                                cb(prev => {
                                    const last = prev[prev.length - 1];
                                    if (last && last.role === 'user' && !last.isComplete) {
                                        return [...prev.slice(0, -1), { ...last, text: (last.text || '') + msg.serverContent?.inputTranscription?.text }];
                                    }
                                    return [...prev, { id: uuidv4(), role: 'user', text: msg.serverContent?.inputTranscription?.text, timestamp: Date.now() }];
                                });
                            }
                            
                            if (msg.serverContent?.turnComplete) {
                                cb(prev => {
                                    const last = prev[prev.length - 1];
                                    if (last) return [...prev.slice(0, -1), { ...last, isComplete: true }];
                                    return prev;
                                });
                            }
                            
                            // Handle Tools
                            if (msg.toolCall) {
                                const callId = uuidv4();
                                cb(prev => [
                                    ...prev, 
                                    { 
                                    id: callId, 
                                    role: 'tool', 
                                    timestamp: Date.now(), 
                                    toolDetails: { 
                                        functionCalls: (msg.toolCall?.functionCalls || []).map(fc => ({
                                        id: fc.id,
                                        name: fc.name ?? 'UnknownTool',
                                        args: fc.args || {}
                                        })), 
                                        functionResponses: [] 
                                    },
                                    isComplete: false 
                                    }
                                ]);
                                
                                for (const fc of msg.toolCall.functionCalls) {
                                    if (fc.name === 'endSession') {
                                        const ctx = audioContextRef.current;
                                        let waitMs = 0;
                                        if (ctx) {
                                            const remaining = Math.max(0, nextStartTimeRef.current - ctx.currentTime);
                                            waitMs = remaining * 1000 + 500; 
                                        }
                                        cb(prev => prev.map(t => t.id === callId ? { 
                                            ...t, 
                                            toolDetails: { ...t.toolDetails!, functionResponses: [...(t.toolDetails?.functionResponses || []), { id: fc.id, name: fc.name || 'endSession', response: { result: "Ending session..." } }] },
                                            isComplete: true 
                                        } : t));
                                        sessionRef.current?.sendToolResponse({
                                            functionResponses: [{ id: fc.id, name: fc.name, response: { result: "Session ending" } }]
                                        });
                                        setTimeout(() => disconnect(), waitMs);
                                        return;
                                    }

                                    try {
                                        const result = await onToolCallRef.current(fc.name || 'unknown', fc.args || {});
                                        cb(prev => prev.map(t => t.id === callId ? { 
                                            ...t, 
                                            toolDetails: { ...t.toolDetails!, functionResponses: [...(t.toolDetails?.functionResponses || []), { id: fc.id, name: fc.name || 'unknown', response: { result } }] },
                                            isComplete: true 
                                        } : t));
                                        sessionRef.current?.sendToolResponse({
                                            functionResponses: [{ id: fc.id, name: fc.name, response: { result } }]
                                        });
                                    } catch (err: any) {
                                        const result = { error: err.message || "Unknown error" };
                                        cb(prev => prev.map(t => t.id === callId ? { 
                                            ...t, 
                                            toolDetails: { ...t.toolDetails!, functionResponses: [...(t.toolDetails?.functionResponses || []), { id: fc.id, name: fc.name || 'unknown', response: { result } }] },
                                            isComplete: true 
                                        } : t));
                                        sessionRef.current?.sendToolResponse({
                                            functionResponses: [{ id: fc.id, name: fc.name, response: { result } }]
                                        });
                                    }
                                }
                            }
                        }

                        if (msg.serverContent?.interrupted) {
                            sourcesRef.current.forEach(s => s.stop());
                            sourcesRef.current.clear();
                            nextStartTimeRef.current = audioContextRef.current?.currentTime || 0;
                        }
                    },
                    onclose: () => {
                        console.log('Session closed');
                        isSessionOpenRef.current = false;
                        sessionRef.current = null;
                        
                        if (!isUserDisconnectingRef.current) {
                            console.log('Unexpected disconnect, attempting retry...');
                            playDisconnectSound();
                            // Attempt to reconnect if this wasn't a manual disconnect
                            const delays = [1000, 2000, 5000];
                            const delay = attempt < delays.length ? delays[attempt] : 5000;
                            
                            retryTimeoutRef.current = setTimeout(() => connectSocket(0), delay); 
                        }
                    },
                    onerror: (err) => {
                        console.error('Session error', err);
                        isSessionOpenRef.current = false;
                        sessionRef.current = null;

                        if (!isUserDisconnectingRef.current) {
                             playDisconnectSound();
                             const delays = [1000, 2000, 5000];
                             if (attempt < 3) {
                                const delay = delays[attempt];
                                console.log(`Error encountered. Retrying in ${delay}ms...`);
                                retryTimeoutRef.current = setTimeout(() => connectSocket(attempt + 1), delay);
                             } else {
                                setError("Connection failed after multiple attempts.");
                                setConnectionState(ConnectionState.ERROR);
                             }
                        }
                    }
                }
            });
            sessionRef.current = session;
        } catch (err: any) {
            console.error(`Connection attempt ${attempt + 1} failed`, err);
            isSessionOpenRef.current = false;
            sessionRef.current = null;

            if (attempt < 3 && !isUserDisconnectingRef.current) {
                const delays = [1000, 2000, 5000];
                const delay = delays[attempt];
                console.log(`Retrying in ${delay}ms...`);
                retryTimeoutRef.current = setTimeout(() => connectSocket(attempt + 1), delay);
            } else if (!isUserDisconnectingRef.current) {
                setError(err.message);
                setConnectionState(ConnectionState.ERROR);
                playDisconnectSound();
            }
        }
    };

    // Start the initial connection
    connectSocket(0);

  }, [apiKey, disconnect, systemInstruction]); 

  const isPttPressedRef = useRef(isPttPressed);
  const voiceModeRef = useRef(voiceMode);
  
  useEffect(() => { isPttPressedRef.current = isPttPressed; }, [isPttPressed]);
  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);

  return {
    connect,
    disconnect,
    connectionState,
    volume,
    voiceMode,
    setVoiceMode,
    isPttPressed,
    setIsPttPressed,
    error
  };
};