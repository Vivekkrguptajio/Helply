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

            // Initialize Socket.io connection using the .env variable
            // Provide a fallback just in case
            const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";
            socketRef.current = io(backendUrl, {
                transports: ['websocket', 'polling']
            });

            socketRef.current.on('interviewer_transcription', (data) => {
                if (data.text) {
                    addTranscript('interviewer', data.text);
                    setInterimTranscript(""); // Clear interim when final
                }
            });

            socketRef.current.on('interviewer_interim', (data) => {
                if (data.text) {
                    setInterimTranscript(data.text);
                }
            });

            socketRef.current.on('ai_answer', (data) => {
                if (data.text) addTranscript('ai', data.text);
            });

            socketRef.current.on('disconnect', () => {
                console.warn('Socket disconnected from server');
                stopRecording();
            });

            // Request audio stream with Echo Cancellation
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });

            // Initialize MediaRecorder
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0 && socketRef.current?.connected && !isPausedRef.current) {
                    socketRef.current.emit('audio_data', event.data);
                }
            };

            // Start capturing with timeslice of 200ms
            mediaRecorder.start(200);
            setIsRecording(true);
        } catch (err) {
            console.error('Error starting recording:', err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            // stop all audio tracks to release the microphone
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }

        if (socketRef.current) {
            socketRef.current.off('interviewer_transcription');
            socketRef.current.off('interviewer_interim');
            socketRef.current.off('ai_answer');
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

    return {
        isRecording,
        isPaused,
        transcript,
        interimTranscript,
        startRecording,
        stopRecording,
        togglePause
    };
}
