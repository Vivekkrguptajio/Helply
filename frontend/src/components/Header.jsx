import React from 'react';

export function Header({ isRecording, isPaused, status, onOpenSettings, onDownload, hasTranscript }) {
    return (
        <header className="flex items-center justify-between px-3 py-2.5 md:px-8 md:py-4 backdrop-blur-xl bg-white/5 border-b border-white/10 shrink-0 z-10 shadow-lg shadow-black/20"
            style={{ paddingTop: 'max(0.625rem, var(--safe-top))' }}
        >
            <div className="flex items-center gap-2 md:gap-3">
                <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                    <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                    </svg>
                </div>
                <h1 className="text-base md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400 tracking-tight">Interview Copilot</h1>
            </div>
            <div className="flex items-center gap-2 justify-center">
                {isRecording && status === 'connecting' && (
                    <div className="flex items-center gap-1.5 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20 animate-pulse">
                        <span className="text-[10px] md:text-xs font-semibold text-indigo-300 tracking-wide uppercase">Connecting…</span>
                    </div>
                )}
                {isRecording && status === 'live' && !isPaused && (
                    <div className="flex items-center gap-1.5 bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20 animate-breathe">
                        <span className="relative flex h-1.5 w-1.5 md:h-2 md:w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 md:h-2 md:w-2 bg-red-500"></span>
                        </span>
                        <span className="text-[10px] md:text-xs font-semibold text-red-400 tracking-wide uppercase">Live</span>
                    </div>
                )}
                {isRecording && status === 'live' && isPaused && (
                    <div className="flex items-center gap-1.5 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                        <span className="relative flex h-1.5 w-1.5 md:h-2 md:w-2">
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 md:h-2 md:w-2 bg-amber-500"></span>
                        </span>
                        <span className="text-[10px] md:text-xs font-semibold text-amber-400 tracking-wide uppercase">Paused</span>
                    </div>
                )}
                {hasTranscript && (
                    <button
                        onClick={onDownload}
                        aria-label="Download transcript"
                        title="Download transcript"
                        className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                    >
                        💾
                    </button>
                )}
                <button
                    onClick={onOpenSettings}
                    aria-label="Resume and role settings"
                    title="Resume & target role"
                    className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                >
                    ⚙️
                </button>
            </div>
        </header>
    );
}
