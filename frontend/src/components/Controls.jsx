import React from 'react';

export function Controls({ isRecording, isPaused, hasTranscript, onStart, onStop, onTogglePause, onRequestAnswer }) {
    return (
        <div className="p-4 md:p-6 backdrop-blur-md bg-black/40 border-t border-white/10 shrink-0 z-10 w-full">
            <div className="max-w-2xl mx-auto flex flex-col gap-3">
                {!isRecording ? (
                    <button
                        onClick={onStart}
                        className="relative w-full py-4 text-xl font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.15)] active:scale-95 transition-all duration-300 hover:bg-emerald-500/20 hover:shadow-[0_0_25px_rgba(16,185,129,0.25)] flex items-center justify-center gap-2"
                    >
                        <span>Start Session</span>
                    </button>
                ) : (
                    <div className="flex flex-row gap-3">
                        <button
                            onClick={onRequestAnswer}
                            className="relative flex-1 py-4 text-base font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 border border-violet-500/40 rounded-2xl shadow-[0_0_25px_rgba(139,92,246,0.35)] active:scale-95 transition-all duration-300 hover:shadow-[0_0_35px_rgba(139,92,246,0.55)] hover:from-violet-500 hover:to-indigo-500 flex items-center justify-center gap-2"
                        >
                            <span>✨</span>
                            <span>Get AI Answer</span>
                        </button>
                        <button
                            onClick={onTogglePause}
                            className={`relative flex-1 py-4 text-base font-bold rounded-2xl active:scale-95 transition-all duration-300 flex items-center justify-center gap-2 ${isPaused
                                ? "text-amber-400 bg-amber-500/10 border border-amber-500/30 shadow-[0_0_20px_rgba(251,191,36,0.15)] hover:bg-amber-500/20"
                                : "text-blue-400 bg-blue-500/10 border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.15)] hover:bg-blue-500/20"
                                }`}
                        >
                            {isPaused ? (
                                <>
                                    <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
                                    <span>Resume AI</span>
                                </>
                            ) : (
                                <span>Pause AI</span>
                            )}
                        </button>
                        <button
                            onClick={onStop}
                            className="relative flex-1 py-4 text-base font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-2xl shadow-[0_0_20px_rgba(244,63,94,0.15)] active:scale-95 transition-all duration-300 hover:bg-rose-500/20 hover:shadow-[0_0_25px_rgba(244,63,94,0.25)] flex items-center justify-center gap-2"
                        >
                            <span className="animate-pulse w-2 h-2 bg-rose-500 rounded-full"></span>
                            <span>Stop</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
