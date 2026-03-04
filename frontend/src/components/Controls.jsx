import React from 'react';

export function Controls({ isRecording, isPaused, hasTranscript, onStart, onStop, onTogglePause, onRequestAnswer }) {
    return (
        <div className="px-3 py-3 md:p-6 backdrop-blur-md bg-black/40 border-t border-white/10 shrink-0 z-10 w-full"
            style={{ paddingBottom: 'max(0.75rem, var(--safe-bottom))' }}
        >
            <div className="max-w-2xl mx-auto flex flex-col gap-2.5 md:gap-3">
                {!isRecording ? (
                    <button
                        onClick={onStart}
                        className="relative w-full py-3.5 md:py-4 text-lg md:text-xl font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.15)] active:scale-[0.97] transition-all duration-300 hover:bg-emerald-500/20 hover:shadow-[0_0_25px_rgba(16,185,129,0.25)] flex items-center justify-center gap-2 tap-target"
                    >
                        {/* Mic Icon */}
                        <svg className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                        </svg>
                        <span>Start Session</span>
                    </button>
                ) : (
                    <div className="flex flex-col gap-2.5 md:gap-3">
                        {/* Get AI Answer — full width, prominent */}
                        <button
                            onClick={onRequestAnswer}
                            className="relative w-full py-3.5 md:py-4 text-base md:text-lg font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 border border-violet-500/40 rounded-2xl shadow-[0_0_25px_rgba(139,92,246,0.35)] active:scale-[0.97] transition-all duration-300 hover:shadow-[0_0_35px_rgba(139,92,246,0.55)] hover:from-violet-500 hover:to-indigo-500 flex items-center justify-center gap-2 tap-target"
                        >
                            <span className="text-lg">✨</span>
                            <span>Get AI Answer</span>
                        </button>
                        {/* Pause + Stop — side by side */}
                        <div className="flex flex-row gap-2.5 md:gap-3">
                            <button
                                onClick={onTogglePause}
                                className={`relative flex-1 py-3 md:py-4 text-sm md:text-base font-bold rounded-2xl active:scale-[0.97] transition-all duration-300 flex items-center justify-center gap-1.5 md:gap-2 tap-target ${isPaused
                                    ? "text-amber-400 bg-amber-500/10 border border-amber-500/30 shadow-[0_0_20px_rgba(251,191,36,0.15)] hover:bg-amber-500/20"
                                    : "text-blue-400 bg-blue-500/10 border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.15)] hover:bg-blue-500/20"
                                    }`}
                            >
                                {isPaused ? (
                                    <>
                                        {/* Play icon */}
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                        <span>Resume</span>
                                    </>
                                ) : (
                                    <>
                                        {/* Pause icon */}
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                                        </svg>
                                        <span>Pause</span>
                                    </>
                                )}
                            </button>
                            <button
                                onClick={onStop}
                                className="relative flex-1 py-3 md:py-4 text-sm md:text-base font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-2xl shadow-[0_0_20px_rgba(244,63,94,0.15)] active:scale-[0.97] transition-all duration-300 hover:bg-rose-500/20 hover:shadow-[0_0_25px_rgba(244,63,94,0.25)] flex items-center justify-center gap-1.5 md:gap-2 tap-target"
                            >
                                {/* Stop icon */}
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <rect x="6" y="6" width="12" height="12" rx="1" />
                                </svg>
                                <span>Stop</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
