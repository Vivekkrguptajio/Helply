import React, { useRef } from 'react';

export function ResumeUpload({ resume, loading, error, onUpload, onRemove }) {
    const inputRef = useRef(null);

    const handleChange = (e) => {
        const file = e.target.files?.[0];
        if (file) onUpload(file);
        e.target.value = ''; // allow re-selecting the same file
    };

    return (
        <div className="flex flex-col gap-1">
            <input
                ref={inputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                onChange={handleChange}
                className="hidden"
            />
            {resume ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs md:text-sm">
                    <span>📄</span>
                    <span className="flex-1 truncate" title={resume.name}>{resume.name}</span>
                    <button
                        onClick={() => inputRef.current?.click()}
                        disabled={loading}
                        className="px-2 py-0.5 rounded-lg text-zinc-300 hover:bg-white/10 transition-colors"
                    >
                        Replace
                    </button>
                    <button
                        onClick={onRemove}
                        aria-label="Remove resume"
                        className="px-2 py-0.5 rounded-lg text-rose-300 hover:bg-rose-500/10 transition-colors"
                    >
                        ✕
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => inputRef.current?.click()}
                    disabled={loading}
                    className="w-full py-2.5 text-sm md:text-base font-semibold text-indigo-300 bg-indigo-500/10 border border-dashed border-indigo-500/40 rounded-xl hover:bg-indigo-500/20 transition-colors disabled:opacity-60"
                >
                    {loading ? 'Reading resume…' : '📄 Upload Resume (PDF / DOCX / TXT)'}
                </button>
            )}
            {!resume && !loading && !error && (
                <p className="text-[11px] md:text-xs text-amber-300/80 px-1">No resume added: answers about you will be generic.</p>
            )}
            {error && <p className="text-xs text-rose-400 px-1">{error}</p>}
        </div>
    );
}
