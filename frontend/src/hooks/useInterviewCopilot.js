import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import NoSleep from 'nosleep.js';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";
const RESUME_STORAGE_KEY = 'helply_resume';
const AUDIO_SOURCE_KEY = 'helply_audio_source';

const AUTO_ANSWER_KEY = 'helply_auto_answer';
const LENGTH_KEY = 'helply_answer_length';
const CONTEXT_KEY = 'helply_job_context';

function loadLength() {
    try {
        const saved = localStorage.getItem(LENGTH_KEY);
        return ['short', 'normal', 'detailed'].includes(saved) ? saved : 'normal';
    } catch {
        return 'normal';
    }
}

function loadContext() {
    try {
        return localStorage.getItem(CONTEXT_KEY) || '';
    } catch {
        return '';
    }
}

function loadAudioSource() {
    try {
        const saved = localStorage.getItem(AUDIO_SOURCE_KEY);
        return ['mic', 'system', 'both'].includes(saved) ? saved : 'mic';
    } catch {
        return 'mic';
    }
}

function loadAutoAnswer() {
    try {
        return localStorage.getItem(AUTO_ANSWER_KEY) !== 'off'; // on by default
    } catch {
        return true;
    }
}

function loadStoredResume() {
    try {
        const raw = localStorage.getItem(RESUME_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed?.text ? parsed : null;
    } catch {
        return null;
    }
}

export function useInterviewCopilot() {
    const [resume, setResume] = useState(loadStoredResume); // { name, text } | null
    const [resumeLoading, setResumeLoading] = useState(false);
    const [resumeError, setResumeError] = useState("");
    const resumeRef = useRef(resume);

    // 'mic' = your microphone, 'system' = computer/tab audio (interviewer on a call; your own voice is not captured),
    // 'both' = system audio as the interviewer + your mic as the candidate (heard for context, never answered)
    const [audioSource, setAudioSourceState] = useState(loadAudioSource);
    const [autoAnswer, setAutoAnswerState] = useState(loadAutoAnswer);
    const autoAnswerRef = useRef(autoAnswer);
    const [answerLength, setAnswerLengthState] = useState(loadLength); // 'short' | 'normal' | 'detailed'
    const [jobContext, setJobContextState] = useState(loadContext); // target role / JD / company
    const answerLengthRef = useRef(answerLength);
    const jobContextRef = useRef(jobContext);
    const [isRecording, setIsRecording] = useState(false);
    const [status, setStatus] = useState('idle'); // 'idle' | 'connecting' | 'live'
    const [notice, setNotice] = useState(""); // error/info banner text
    const [transcript, setTranscript] = useState([]);
    const [interimTranscript, setInterimTranscript] = useState("");
    const [isPaused, setIsPaused] = useState(false);

    const isPausedRef = useRef(false);

    const socketRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const micRecorderRef = useRef(null);
    const micStreamRef = useRef(null);
    const noSleepRef = useRef(null);
    const keepAliveIntervalRef = useRef(null);

    useEffect(() => {
        // Initialize NoSleep
        noSleepRef.current = new NoSleep();

        // Cleanup on unmount
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            if (micRecorderRef.current && micRecorderRef.current.state !== 'inactive') {
                micRecorderRef.current.stop();
            }
            if (noSleepRef.current && noSleepRef.current.isEnabled) {
                noSleepRef.current.disable();
            }
            if (keepAliveIntervalRef.current) {
                clearInterval(keepAliveIntervalRef.current);
            }
        };
    }, []);

    const applyResume = useCallback((next) => {
        resumeRef.current = next;
        setResume(next);
        try {
            if (next) localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(next));
            else localStorage.removeItem(RESUME_STORAGE_KEY);
        } catch { /* storage unavailable — resume just won't persist */ }
        // Push to a live session straight away
        if (socketRef.current?.connected) {
            socketRef.current.emit('set_resume', { text: next?.text || "" });
        }
    }, []);

    const uploadResume = useCallback(async (file) => {
        setResumeError("");
        setResumeLoading(true);
        try {
            const body = new FormData();
            body.append('file', file);
            const res = await fetch(`${BACKEND_URL}/resume/parse`, { method: 'POST', body });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.detail || `Upload failed (${res.status})`);
            applyResume({ name: data.filename || file.name, text: data.text });
        } catch (err) {
            setResumeError(err.message || "Could not upload resume.");
        } finally {
            setResumeLoading(false);
        }
    }, [applyResume]);

    const removeResume = useCallback(() => {
        setResumeError("");
        applyResume(null);
    }, [applyResume]);

    const deleteTranscript = useCallback((index) => {
        setTranscript(prev => prev.filter((_, i) => i !== index));
    }, []);

    const stopKeepAlive = useCallback(() => {
        if (keepAliveIntervalRef.current) {
            clearInterval(keepAliveIntervalRef.current);
            keepAliveIntervalRef.current = null;
        }
    }, []);

    // Keeps the Deepgram connection alive while audio is paused (never stacks two intervals)
    const startKeepAlive = useCallback(() => {
        stopKeepAlive();
        keepAliveIntervalRef.current = setInterval(() => {
            if (socketRef.current?.connected) {
                socketRef.current.emit('audio_data', 'KeepAlive');
                socketRef.current.emit('mic_audio', 'KeepAlive');
            }
        }, 3000);
    }, [stopKeepAlive]);

    const togglePause = useCallback(() => {
        const next = !isPausedRef.current;
        isPausedRef.current = next;
        setIsPaused(next);
        if (next) {
            startKeepAlive();
        } else {
            stopKeepAlive();
        }
    }, [startKeepAlive, stopKeepAlive]);

    const setAudioSource = useCallback((source) => {
        setAudioSourceState(source);
        try { localStorage.setItem(AUDIO_SOURCE_KEY, source); } catch { /* ignore */ }
    }, []);

    const setAutoAnswer = useCallback((on) => {
        autoAnswerRef.current = on;
        setAutoAnswerState(on);
        try { localStorage.setItem(AUTO_ANSWER_KEY, on ? 'on' : 'off'); } catch { /* ignore */ }
        if (socketRef.current?.connected) {
            socketRef.current.emit('set_options', { auto: on });
        }
    }, []);

    const setAnswerLength = useCallback((length) => {
        answerLengthRef.current = length;
        setAnswerLengthState(length);
        try { localStorage.setItem(LENGTH_KEY, length); } catch { /* ignore */ }
        if (socketRef.current?.connected) {
            socketRef.current.emit('set_options', { length });
        }
    }, []);

    const setJobContext = useCallback((text) => {
        jobContextRef.current = text;
        setJobContextState(text);
        try { localStorage.setItem(CONTEXT_KEY, text); } catch { /* ignore */ }
    }, []);

    // Redo / Shorter / Simpler for the last answered question
    const regenerate = useCallback((mode) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('regenerate', { mode });
        }
    }, []);

    // System / tab audio (the interviewer on a call). Video is required by the API, so it is dropped right away.
    const getSystemStream = async () => {
        if (!navigator.mediaDevices?.getDisplayMedia) {
            throw new Error('System audio capture is not supported on this device. Use desktop Chrome/Edge, or switch to Microphone.');
        }
        const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const audioTracks = display.getAudioTracks();
        display.getVideoTracks().forEach(track => track.stop());
        if (audioTracks.length === 0) {
            throw new Error('No audio was shared. In the share window pick "Entire screen" and tick "Share system audio" (or pick the call tab and tick "Share tab audio").');
        }
        // If the user clicks the browser's "Stop sharing" bar, end the session cleanly
        audioTracks[0].addEventListener('ended', () => stopRecording());
        return new MediaStream(audioTracks);
    };

    const getMicStream = () => navigator.mediaDevices.getUserMedia({
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
        },
    });

    const startRecording = async () => {
        try {
            // Enable NoSleep (must be triggered by user action)
            if (noSleepRef.current && !noSleepRef.current.isEnabled) {
                noSleepRef.current.enable();
            }

            // 1. Get microphone access FIRST (before socket, so user sees the permission prompt immediately)
            // Main stream = the interviewer: system audio, or the mic in single-source mic mode.
            const stream = audioSource === 'mic' ? await getMicStream() : await getSystemStream();
            mediaStreamRef.current = stream;
            // 'both': additionally capture the candidate's own mic (context only, never answered)
            if (audioSource === 'both') {
                micStreamRef.current = await getMicStream();
            }
            setNotice("");
            // Show the controls (incl. Stop) right away so the mic can always be released,
            // even if the server is slow to respond (e.g. Render cold start).
            setIsRecording(true);
            setStatus('connecting');

            // 2. Initialize MediaRecorder but DON'T start yet
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0 && socketRef.current?.connected && !isPausedRef.current) {
                    socketRef.current.emit('audio_data', event.data);
                }
            };

            if (micStreamRef.current) {
                const micRecorder = new MediaRecorder(micStreamRef.current);
                micRecorderRef.current = micRecorder;
                micRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0 && socketRef.current?.connected && !isPausedRef.current) {
                        socketRef.current.emit('mic_audio', event.data);
                    }
                };
            }

            // 3. Create Socket.io connection
            const backendUrl = BACKEND_URL;
            console.log('[Socket] Connecting to backend:', backendUrl);
            socketRef.current = io(backendUrl, {
                transports: ['websocket', 'polling'],
            });

            // 4. Start MediaRecorder ONLY after socket is confirmed connected
            socketRef.current.on('connect', () => {
                console.log('Socket connected! Starting audio capture.');
                setStatus('live');
                setNotice("");
                if (resumeRef.current?.text) {
                    socketRef.current.emit('set_resume', { text: resumeRef.current.text });
                }
                socketRef.current.emit('set_options', {
                    auto: autoAnswerRef.current,
                    candidate: audioSource === 'both',
                    length: answerLengthRef.current,
                    context: jobContextRef.current,
                });
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
                    mediaRecorderRef.current.start(200);
                }
                if (micRecorderRef.current && micRecorderRef.current.state === 'inactive') {
                    micRecorderRef.current.start(200);
                }
            });

            // Log connection errors — do NOT stopRecording here (that breaks local too)
            socketRef.current.on('connect_error', (err) => {
                console.error('[Socket] Connection error:', err.message, '| Backend URL:', backendUrl);
                setNotice("Can't reach the server. Retrying… (it may be waking up)");
            });

            // Handle backend error events (e.g. Deepgram failure)
            socketRef.current.on('error', (data) => {
                console.error('[Backend Error]', data.message);
                setNotice(data.message);
            });

            socketRef.current.on('interviewer_transcription', (data) => {
                if (data.text) {
                    // Update the last accumulating interviewer entry, or create a new one
                    setTranscript(prev => {
                        const last = prev[prev.length - 1];
                        if (last && last.role === 'interviewer' && last.accumulating) {
                            // Replace last entry with updated text
                            return [...prev.slice(0, -1), { role: 'interviewer', text: data.text, accumulating: true }];
                        }
                        // New question started — add fresh entry
                        return [...prev, { role: 'interviewer', text: data.text, accumulating: true }];
                    });
                    setInterimTranscript(""); // Clear interim when final
                }
            });

            // The candidate's own speech (heard for context, never answered)
            socketRef.current.on('candidate_transcription', (data) => {
                if (data.text) {
                    setTranscript(prev => {
                        const last = prev[prev.length - 1];
                        if (last && last.role === 'you') {
                            return [...prev.slice(0, -1), { role: 'you', text: `${last.text} ${data.text}` }];
                        }
                        return [...prev, { role: 'you', text: data.text }];
                    });
                }
            });

            socketRef.current.on('interviewer_interim', (data) => {
                if (data.text) {
                    setInterimTranscript(data.text);
                }
            });

            socketRef.current.on('ai_answer_chunk', (data) => {
                if (data.text) {
                    // Append chunk to the last streaming AI entry, or create a new one
                    setTranscript(prev => {
                        const last = prev[prev.length - 1];
                        if (last && last.role === 'ai' && last.streaming) {
                            return [...prev.slice(0, -1), { role: 'ai', text: last.text + data.text, streaming: true }];
                        }
                        return [...prev, { role: 'ai', text: data.text, streaming: true }];
                    });
                }
            });

            // Specifics in the answer that the resume doesn't back up
            socketRef.current.on('ai_answer_flags', (data) => {
                if (data.items?.length) {
                    setTranscript(prev => {
                        const last = prev[prev.length - 1];
                        if (last && last.role === 'ai') {
                            return [...prev.slice(0, -1), { ...last, flags: data.items }];
                        }
                        return prev;
                    });
                }
            });

            // Non-streamed message from backend (e.g. "no question detected yet")
            socketRef.current.on('ai_answer', (data) => {
                if (data.text) {
                    setTranscript(prev => [...prev, { role: 'ai', text: data.text }]);
                }
            });

            socketRef.current.on('ai_answer_done', () => {
                // Mark the last AI entry as finalized
                setTranscript(prev => {
                    const last = prev[prev.length - 1];
                    if (last && last.role === 'ai' && last.streaming) {
                        return [...prev.slice(0, -1), { role: 'ai', text: last.text }];
                    }
                    return prev;
                });
            });

            // Keep the mic running and let socket.io reconnect; 'connect' re-sends resume/options on success.
            socketRef.current.on('disconnect', (reason) => {
                console.warn('Socket disconnected from server:', reason);
                setStatus('connecting');
                setNotice('Connection lost. Reconnecting…');
                if (reason === 'io server disconnect') {
                    socketRef.current?.connect(); // the server closed it, so socket.io won't retry by itself
                }
            });

        } catch (err) {
            console.error('Error starting recording:', err);
            setNotice(`Audio error: ${err.message || err.name || 'Unknown error'}. Check browser permissions and make sure the site is on HTTPS.`);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }

        // Stop all mic tracks via the stored stream reference
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        mediaRecorderRef.current = null;

        if (micRecorderRef.current && micRecorderRef.current.state !== 'inactive') {
            micRecorderRef.current.stop();
        }
        micRecorderRef.current = null;
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(track => track.stop());
            micStreamRef.current = null;
        }

        if (socketRef.current) {
            socketRef.current.off('connect');
            socketRef.current.off('candidate_transcription');
            socketRef.current.off('interviewer_transcription');
            socketRef.current.off('interviewer_interim');
            socketRef.current.off('ai_answer_chunk');
            socketRef.current.off('ai_answer');
            socketRef.current.off('ai_answer_flags');
            socketRef.current.off('ai_answer_done');
            socketRef.current.off('connect_error');
            socketRef.current.off('error');
            socketRef.current.off('disconnect');
            socketRef.current.disconnect();
            socketRef.current = null;
        }

        if (noSleepRef.current && noSleepRef.current.isEnabled) {
            noSleepRef.current.disable();
        }

        stopKeepAlive();

        setInterimTranscript("");
        setIsRecording(false);
        setStatus('idle');
        setIsPaused(false);
        isPausedRef.current = false;
    };

    const requestAnswer = () => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('get_answer');

            // Auto-pause the mic so the user can speak the answer undisturbed.
            // Not needed for system audio, which never picks up the user's own voice.
            if (audioSource === 'mic' && !isPausedRef.current) {
                isPausedRef.current = true;
                setIsPaused(true);
                setInterimTranscript(""); // Hide the LISTENING... bubble immediately
                // Start KeepAlive to keep Deepgram connection alive while paused
                startKeepAlive();
            }

            // Finalize the current accumulating entry (remove accumulating flag)
            setTranscript(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'interviewer' && last.accumulating) {
                    return [...prev.slice(0, -1), { role: 'interviewer', text: last.text }];
                }
                return prev;
            });
        }
    };

    const clearTranscript = useCallback(() => {
        setTranscript([]);
        setInterimTranscript("");
        // Auto-resume if paused
        if (isPausedRef.current) {
            isPausedRef.current = false;
            setIsPaused(false);
            stopKeepAlive();
        }
        // Also clear the backend buffer so old text doesn't mix in
        if (socketRef.current?.connected) {
            socketRef.current.emit('clear_buffer');
        }
    }, [stopKeepAlive]);

    return {
        resume,
        resumeLoading,
        resumeError,
        uploadResume,
        removeResume,
        audioSource,
        setAudioSource,
        autoAnswer,
        setAutoAnswer,
        answerLength,
        setAnswerLength,
        jobContext,
        setJobContext,
        regenerate,
        isRecording,
        status,
        notice,
        dismissNotice: () => setNotice(""),
        isPaused,
        transcript,
        interimTranscript,
        hasTranscript: transcript.length > 0 || interimTranscript.length > 0,
        startRecording,
        stopRecording,
        togglePause,
        requestAnswer,
        deleteTranscript,
        clearTranscript,
    };
}
