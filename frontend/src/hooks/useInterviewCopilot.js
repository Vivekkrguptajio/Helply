import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import NoSleep from 'nosleep.js';

export function useInterviewCopilot() {
    const [isRecording, setIsRecording] = useState(false);
    const [transcript, setTranscript] = useState([]);
    const [interimTranscript, setInterimTranscript] = useState("");
    const [isPaused, setIsPaused] = useState(false);

    const isPausedRef = useRef(false);

    const socketRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const mediaStreamRef = useRef(null);
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
            if (noSleepRef.current && noSleepRef.current.isEnabled) {
                noSleepRef.current.disable();
            }
            if (keepAliveIntervalRef.current) {
                clearInterval(keepAliveIntervalRef.current);
            }
        };
    }, []);

    const addTranscript = useCallback((role, text) => {
        setTranscript(prev => [...prev, { role, text }]);
    }, []);

    const deleteTranscript = useCallback((index) => {
        setTranscript(prev => prev.filter((_, i) => i !== index));
    }, []);

    const togglePause = useCallback(() => {
        setIsPaused(prev => {
            const next = !prev;
            isPausedRef.current = next;

            // Handle KeepAlive interval
            if (next) {
                // If paused, start sending KeepAlive every 3 seconds
                keepAliveIntervalRef.current = setInterval(() => {
                    if (socketRef.current?.connected) {
                        socketRef.current.emit('audio_data', 'KeepAlive');
                    }
                }, 3000);
            } else {
                // If resumed, clear the interval
                if (keepAliveIntervalRef.current) {
                    clearInterval(keepAliveIntervalRef.current);
                    keepAliveIntervalRef.current = null;
                }
            }

            return next;
        });
    }, []);

    const startRecording = async () => {
        try {
            // Enable NoSleep (must be triggered by user action)
            if (noSleepRef.current && !noSleepRef.current.isEnabled) {
                noSleepRef.current.enable();
            }

            // 1. Get microphone access FIRST (before socket, so user sees the permission prompt immediately)
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            mediaStreamRef.current = stream;

            // 2. Initialize MediaRecorder but DON'T start yet
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0 && socketRef.current?.connected && !isPausedRef.current) {
                    socketRef.current.emit('audio_data', event.data);
                }
            };

            // 3. Create Socket.io connection
            const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";
            console.log('[Socket] Connecting to backend:', backendUrl);
            socketRef.current = io(backendUrl, {
                transports: ['websocket', 'polling'],
            });

            // 4. Start MediaRecorder ONLY after socket is confirmed connected
            socketRef.current.on('connect', () => {
                console.log('Socket connected! Starting audio capture.');
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
                    mediaRecorderRef.current.start(200);
                    setIsRecording(true);
                }
            });

            // Log connection errors — do NOT stopRecording here (that breaks local too)
            socketRef.current.on('connect_error', (err) => {
                console.error('[Socket] Connection error:', err.message, '| Backend URL:', backendUrl);
            });

            // Handle backend error events (e.g. Deepgram failure)
            socketRef.current.on('error', (data) => {
                console.error('[Backend Error]', data.message);
                alert(`⚠️ Backend Error: ${data.message}`);
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

            socketRef.current.on('disconnect', () => {
                console.warn('Socket disconnected from server');
                stopRecording();
            });

        } catch (err) {
            console.error('Error starting recording:', err);
            alert(`Microphone Error: ${err.message || err.name || 'Unknown Error'}. Please check browser permissions and ensure the site is HTTPS.`);
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

        if (socketRef.current) {
            socketRef.current.off('connect');
            socketRef.current.off('interviewer_transcription');
            socketRef.current.off('interviewer_interim');
            socketRef.current.off('ai_answer_chunk');
            socketRef.current.off('ai_answer_done');
            socketRef.current.off('disconnect');
            socketRef.current.disconnect();
            socketRef.current = null;
        }

        if (noSleepRef.current && noSleepRef.current.isEnabled) {
            noSleepRef.current.disable();
        }

        if (keepAliveIntervalRef.current) {
            clearInterval(keepAliveIntervalRef.current);
            keepAliveIntervalRef.current = null;
        }

        setInterimTranscript("");
        setIsRecording(false);
        setIsPaused(false);
        isPausedRef.current = false;
    };

    const requestAnswer = () => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('get_answer');

            // Auto-pause audio so user can speak the answer undisturbed
            if (!isPausedRef.current) {
                isPausedRef.current = true;
                setIsPaused(true);
                setInterimTranscript(""); // Hide the LISTENING... bubble immediately
                // Start KeepAlive to keep Deepgram connection alive while paused
                keepAliveIntervalRef.current = setInterval(() => {
                    if (socketRef.current?.connected) {
                        socketRef.current.emit('audio_data', 'KeepAlive');
                    }
                }, 3000);
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
        // Also clear the backend buffer so old text doesn't mix in
        if (socketRef.current?.connected) {
            socketRef.current.emit('clear_buffer');
        }
    }, []);

    return {
        isRecording,
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
