import React, { useState, useEffect } from 'react';

const content = {
    en: {
        title: "👋 Welcome to Interview Copilot",
        subtitle: "Your AI-powered interview assistant",
        steps: [
            {
                icon: "🎙️",
                title: "Start Session",
                desc: "Tap the green 'Start Session' button and allow microphone access. The app will listen to the interviewer's questions."
            },
            {
                icon: "👂",
                title: "Listen & Transcribe",
                desc: "The app transcribes the interviewer's speech in real-time. You'll see the text appear on screen as they speak."
            },
            {
                icon: "✨",
                title: "Get AI Answer",
                desc: "Once the interviewer finishes a question, tap 'Get AI Answer'. The AI will generate concise answer points for you."
            },
            {
                icon: "⏸️",
                title: "Pause / Resume",
                desc: "Tap 'Pause' while you're speaking your answer so the app doesn't capture your voice. Tap 'Resume' when interviewer speaks again."
            },
            {
                icon: "🗑️",
                title: "Delete Transcript",
                desc: "Tap the trash icon next to any interviewer message to remove it."
            },
        ],
        tip: "💡 Tip: Keep screen on & volume low. Use earbuds for the best experience.",
        button: "Got it, let's go!",
    },
    hi: {
        title: "👋 Interview Copilot में आपका स्वागत है",
        subtitle: "AI-संचालित इंटरव्यू सहायक",
        steps: [
            {
                icon: "🎙️",
                title: "सेशन शुरू करें",
                desc: "हरे 'Start Session' बटन पर टैप करें और माइक्रोफ़ोन की अनुमति दें। ऐप इंटरव्यूअर के सवालों को सुनेगा।"
            },
            {
                icon: "👂",
                title: "सुनें और ट्रांसक्राइब करें",
                desc: "ऐप इंटरव्यूअर की बात को रियल-टाइम में टेक्स्ट में बदलेगा। स्क्रीन पर टेक्स्ट दिखाई देगा।"
            },
            {
                icon: "✨",
                title: "AI जवाब पाएं",
                desc: "जब इंटरव्यूअर सवाल पूरा करे, 'Get AI Answer' टैप करें। AI आपके लिए संक्षिप्त जवाब तैयार करेगा।"
            },
            {
                icon: "⏸️",
                title: "पॉज़ / रिज़्यूम",
                desc: "जब आप जवाब दे रहे हों तो 'Pause' करें ताकि ऐप आपकी आवाज़ न पकड़े। इंटरव्यूअर बोले तो 'Resume' करें।"
            },
            {
                icon: "🗑️",
                title: "ट्रांसक्रिप्ट हटाएं",
                desc: "किसी भी इंटरव्यूअर मैसेज के बगल में डिलीट आइकन पर टैप करें।"
            },
        ],
        tip: "💡 सुझाव: स्क्रीन ऑन रखें और वॉल्यूम कम। इयरबड्स का इस्तेमाल करें।",
        button: "समझ गया, चलो शुरू करें!",
    }
};

export function UserManual({ onClose }) {
    const [lang, setLang] = useState('en');
    const [visible, setVisible] = useState(false);

    const t = content[lang];

    useEffect(() => {
        // Trigger fade-in animation
        requestAnimationFrame(() => setVisible(true));
    }, []);

    const handleClose = () => {
        setVisible(false);
        // Store in localStorage so it won't show again
        localStorage.setItem('helply_manual_seen', 'true');
        setTimeout(onClose, 250);
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

            {/* Modal */}
            <div className={`relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-white/10 shadow-2xl shadow-indigo-900/20 transition-all duration-300 ${visible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}>
                {/* Language Toggle */}
                <div className="sticky top-0 z-10 flex justify-end p-3 pb-0">
                    <div className="flex bg-white/5 rounded-full p-0.5 border border-white/10">
                        <button
                            onClick={() => setLang('en')}
                            className={`px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200 ${lang === 'en'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-zinc-400 hover:text-white'
                                }`}
                        >
                            English
                        </button>
                        <button
                            onClick={() => setLang('hi')}
                            className={`px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200 ${lang === 'hi'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-zinc-400 hover:text-white'
                                }`}
                        >
                            हिन्दी
                        </button>
                    </div>
                </div>

                <div className="px-5 pb-5 pt-2">
                    {/* Header */}
                    <h2 className="text-xl font-bold text-white text-center">{t.title}</h2>
                    <p className="text-sm text-zinc-400 text-center mt-1 mb-5">{t.subtitle}</p>

                    {/* Steps */}
                    <div className="space-y-3.5">
                        {t.steps.map((step, i) => (
                            <div key={i} className="flex gap-3 items-start bg-white/5 rounded-xl p-3 border border-white/5">
                                <span className="text-2xl flex-shrink-0 mt-0.5">{step.icon}</span>
                                <div>
                                    <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                                    <p className="text-xs text-zinc-400 leading-relaxed mt-0.5">{step.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Tip */}
                    <div className="mt-4 px-3 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                        <p className="text-xs text-amber-300 leading-relaxed">{t.tip}</p>
                    </div>

                    {/* CTA Button */}
                    <button
                        onClick={handleClose}
                        className="w-full mt-4 py-3 text-base font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-lg shadow-indigo-900/40 active:scale-[0.97] transition-all duration-300 tap-target"
                    >
                        {t.button}
                    </button>
                </div>
            </div>
        </div>
    );
}
