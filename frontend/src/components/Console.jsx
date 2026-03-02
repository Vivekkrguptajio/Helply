import React, { useEffect, useRef } from 'react';

export function Console({ transcript, interimTranscript }) {
    const containerRef = useRef(null);

    // Auto-scroll logic to push view to bottom automatically
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [transcript, interimTranscript]);

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
                        {transcript.map((item, index) => (
                            <div key={index} className={`flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300 ${item.role === 'ai' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[90%] md:max-w-[80%] flex flex-col gap-1.5`}>
                                    <span className={`text-xs font-semibold tracking-wider uppercase px-1 ${item.role === 'ai' ? 'text-indigo-400 text-right' : 'text-zinc-500 text-left'}`}>
                                        {item.role === 'interviewer' ? 'Interviewer' : 'AI Copilot'}
                                    </span>
                                    <div className={`p-4 md:p-5 text-[1.1rem] md:text-[1.15rem] leading-relaxed whitespace-pre-wrap ${item.role === 'ai'
                                            ? 'bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-2xl rounded-tr-sm shadow-lg shadow-indigo-900/40'
                                            : 'bg-white/10 backdrop-blur-md border border-white/10 text-zinc-100 rounded-2xl rounded-tl-sm shadow-md shadow-black/20'
                                        }`}>
                                        {item.text}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {interimTranscript && (
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
