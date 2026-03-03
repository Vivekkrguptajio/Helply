import React, { useEffect, useRef } from 'react';

export function Console({ transcript, interimTranscript, onDelete }) {
    const containerRef = useRef(null);

    // Auto-scroll logic to push view to bottom automatically
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [transcript, interimTranscript]);

    // Check if the last transcript entry is an accumulating interviewer bubble
    const lastItem = transcript[transcript.length - 1];
    const lastIsAccumulating = lastItem && lastItem.role === 'interviewer' && lastItem.accumulating;

    return (
        <div
            ref={containerRef}
            className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 scroll-smooth z-0"
        >
            <div className="max-w-4xl mx-auto space-y-6">
                {transcript.length === 0 && !interimTranscript ? (
                    <div className="flex flex-col items-center justify-center h-full mt-20 text-zinc-500 space-y-4">
                        <div className="w-16 h-16 rounded-full border border-white/10 bg-white/5 flex items-center justify-center shadow-inner">
                            <svg className="w-8 h-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                        </div>
                        <p className="text-lg font-medium tracking-wide">Ready to start the interview...</p>
                    </div>
                ) : (
                    <>
                        {transcript.map((item, index) => {
                            const isLast = index === transcript.length - 1;
                            const showInlineInterim = isLast && item.role === 'interviewer' && item.accumulating && interimTranscript;
                            return (
                                <div key={index} className={`flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300 ${item.role === 'ai' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[90%] md:max-w-[80%] flex flex-col gap-1.5`}>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-semibold tracking-wider uppercase px-1 ${item.role === 'ai' ? 'text-indigo-400' : 'text-zinc-500'}`}>
                                                {item.role === 'interviewer' ? 'Interviewer' : 'AI Copilot'}
                                            </span>
                                            {/* Listening indicator in label when accumulating */}
                                            {showInlineInterim && (
                                                <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold tracking-wider uppercase">
                                                    <span className="relative flex h-1.5 w-1.5">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                                    </span>
                                                    Listening
                                                </span>
                                            )}
                                        </div>
                                        {/* Bubble + delete button side by side */}
                                        <div className="flex items-start gap-2">
                                            <div className={`p-4 md:p-5 text-[1.1rem] md:text-[1.15rem] leading-relaxed whitespace-pre-wrap ${item.role === 'ai'
                                                ? 'bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-2xl rounded-tr-sm shadow-lg shadow-indigo-900/40'
                                                : 'bg-white/10 backdrop-blur-md border border-white/10 text-zinc-100 rounded-2xl rounded-tl-sm shadow-md shadow-black/20'
                                                }`}>
                                                {item.text}
                                                {/* Inline interim text inside the same bubble */}
                                                {showInlineInterim && (
                                                    <span className="text-zinc-400 italic"> {interimTranscript}</span>
                                                )}
                                                {/* Blinking cursor while AI streaming */}
                                                {item.streaming && (
                                                    <span className="inline-block w-0.5 h-5 bg-white/80 ml-0.5 align-middle animate-pulse" />
                                                )}
                                            </div>
                                            {item.role === 'interviewer' && (
                                                <button
                                                    onClick={() => onDelete(index)}
                                                    className="mt-1 flex-shrink-0 text-rose-400 hover:text-rose-300 hover:scale-110 transition-all duration-200 p-1"
                                                    title="Delete"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Standalone Listening bubble — only when no accumulating entry exists */}
                        {interimTranscript && !lastIsAccumulating && (
                            <div className="flex w-full justify-start animate-in fade-in duration-200">
                                <div className="max-w-[90%] md:max-w-[80%] flex flex-col gap-1.5 opacity-80">
                                    <span className="text-xs font-semibold tracking-wider uppercase px-1 text-emerald-400 text-left flex items-center gap-2">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </span>
                                        Listening...
                                    </span>
                                    <div className="p-4 md:p-5 text-[1.1rem] md:text-[1.15rem] leading-relaxed whitespace-pre-wrap bg-white/5 backdrop-blur-md border border-white/5 text-zinc-300 rounded-2xl rounded-tl-sm italic shadow-md shadow-black/20">
                                        {interimTranscript}
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

