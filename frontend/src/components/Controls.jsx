import React from 'react';

export function Controls({ isRecording, isPaused, hasTranscript, onStart, onStop, onTogglePause, onRequestAnswer }) {
    return (
        <div className="p-3 md:p-6 backdrop-blur-md bg-black/40 border-t border-white/10 shrink-0 z-10 w-full" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <div className="max-w-2xl mx-auto flex flex-col gap-2 md:gap-3">
                {!isRecording ? (
                    <button
                        onClick={onStart}
                        className="w-full py-3 md:py-4 text-lg md:text-xl font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl active:scale-95 transition-all duration-300 hover:bg-emerald-500/20 flex items-center justify-center gap-2"
                    >
                        <span>🎙️</span>
                        <span>Start Session</span>
                    </button>
                ) : (
                    <div className="flex flex-row gap-2 md:gap-3">
                        {/* Get AI Answer — flex-[2] so it's wider than others */}
                        <button
                            onClick={onRequestAnswer}
                            className="flex-[2] py-3 md:py-4 text-sm md:text-base font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 border border-violet-500/40 rounded-2xl active:scale-95 transition-all duration-300 flex items-center justify-center gap-1.5"
                        >
                            <span>✨</span>
                            <span>Get Answer</span>
                        </button>

                        {/* Pause / Resume */}
                        <button
                            onClick={onTogglePause}
                            className={`flex-1 py-3 md:py-4 text-sm md:text-base font-bold rounded-2xl active:scale-95 transition-all duration-300 flex items-center justify-center gap-1.5 ${isPaused
                                    ? 'text-amber-400 bg-amber-500/10 border border-amber-500/30'
                                    : 'text-blue-400 bg-blue-500/10 border border-blue-500/30'
                                }`}
                        >
                            {isPaused ? (
                                <>
                                    <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse shrink-0" />
                                    <span>Resume</span>
                                </>
                            ) : (
                                <span>Pause</span>
                            )}
                        </button>

                        {/* Stop */}
                        <button
                            onClick={onStop}
                            className="flex-1 py-3 md:py-4 text-sm md:text-base font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-2xl active:scale-95 transition-all duration-300 hover:bg-rose-500/20 flex items-center justify-center gap-1.5"
                        >
                            <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse shrink-0" />
                            <span>Stop</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
