import React, { useEffect } from 'react';
import { ResumeUpload } from './ResumeUpload';

// Slide-in panel for settings that are set once and rarely changed (resume, target role).
export function Sidebar({ open, onClose, resume, resumeLoading, resumeError, onUploadResume, onRemoveResume, jobContext, onChangeJobContext, fontScale, onChangeFontScale }) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    return (
        <div className={`fixed inset-0 z-40 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
            <div
                onClick={onClose}
                className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
            />
            <aside
                className={`absolute right-0 top-0 h-full w-full max-w-sm bg-slate-950 border-l border-white/10 shadow-2xl flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
                style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <h2 className="text-base font-bold text-white">Your Profile</h2>
                    <button onClick={onClose} aria-label="Close" className="px-2 py-1 text-zinc-400 hover:text-white">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
                    <section className="flex flex-col gap-2">
                        <h3 className="text-sm font-semibold text-zinc-200">📄 Resume</h3>
                        <p className="text-xs text-zinc-500">Used to answer "tell me about yourself" and project questions from your real experience. Saved in this browser.</p>
                        <ResumeUpload
                            resume={resume}
                            loading={resumeLoading}
                            error={resumeError}
                            onUpload={onUploadResume}
                            onRemove={onRemoveResume}
                        />
                    </section>

                    <section className="flex flex-col gap-2">
                        <h3 className="text-sm font-semibold text-zinc-200">🎯 Target role / job description</h3>
                        <p className="text-xs text-zinc-500">Optional. Answers get tailored to this role and its skills.</p>
                        <textarea
                            value={jobContext}
                            onChange={(e) => onChangeJobContext(e.target.value)}
                            rows={7}
                            maxLength={3000}
                            placeholder="e.g. Junior Java Backend Developer at XYZ. Spring Boot, REST APIs, MySQL, microservices..."
                            className="w-full rounded-lg bg-white/5 border border-white/10 p-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-400/60"
                        />
                    </section>

                    <section className="flex flex-col gap-2">
                        <h3 className="text-sm font-semibold text-zinc-200">🔠 Text size</h3>
                        <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold">
                            {[[1, 'Normal'], [1.25, 'Large'], [1.5, 'Extra large']].map(([value, label]) => (
                                <button
                                    key={value}
                                    onClick={() => onChangeFontScale(value)}
                                    className={`py-1.5 rounded-md transition-colors ${fontScale === value ? 'bg-indigo-500/30 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </section>
                </div>

                <div className="p-4 border-t border-white/10">
                    <button onClick={onClose} className="w-full py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors">
                        Done
                    </button>
                </div>
            </aside>
        </div>
    );
}
