import React, { useEffect, useState } from 'react';
import { useInterviewCopilot } from './hooks/useInterviewCopilot';
import { Header } from './components/Header';
import { Console } from './components/Console';
import { Controls } from './components/Controls';
import { UserManual } from './components/UserManual';
import { Sidebar } from './components/Sidebar';

export default function App() {
  const { audioSource, setAudioSource, autoAnswer, setAutoAnswer, answerLength, setAnswerLength, jobContext, setJobContext, regenerate, isRecording, status, notice, dismissNotice, isPaused, transcript, interimTranscript, resume, resumeLoading, resumeError, uploadResume, removeResume, startRecording, stopRecording, togglePause, requestAnswer, deleteTranscript, clearTranscript } = useInterviewCopilot();

  const [showProfile, setShowProfile] = useState(false);

  const [fontScale, setFontScaleState] = useState(() => {
    try {
      const saved = Number(localStorage.getItem('helply_font_scale'));
      return [1, 1.25, 1.5].includes(saved) ? saved : 1;
    } catch {
      return 1;
    }
  });
  const setFontScale = (value) => {
    setFontScaleState(value);
    try { localStorage.setItem('helply_font_scale', String(value)); } catch { /* ignore */ }
  };

  const downloadTranscript = () => {
    const labels = { interviewer: 'Interviewer', you: 'You', ai: 'AI Copilot' };
    const body = transcript.map((t) => `[${labels[t.role] || t.role}]\n${t.text}`).join('\n\n');
    const url = URL.createObjectURL(new Blob([body], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Show manual only on first visit
  const [showManual, setShowManual] = useState(() => {
    try {
      return !localStorage.getItem('helply_manual_seen');
    } catch {
      return true;
    }
  });

  // Keyboard shortcuts during a session: Space = answer, P = pause, R = redo, S = shorter
  useEffect(() => {
    const onKey = (e) => {
      if (!isRecording || showProfile || showManual || e.ctrlKey || e.metaKey || e.altKey) return;
      if (['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(e.target.tagName)) return;
      const key = e.key.toLowerCase();
      if (key === ' ') requestAnswer();
      else if (key === 'p') togglePause();
      else if (key === 'r') regenerate('again');
      else if (key === 's') regenerate('shorter');
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isRecording, showProfile, showManual, requestAnswer, togglePause, regenerate]);

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950/80 to-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30">
      <Header isRecording={isRecording} isPaused={isPaused} status={status} onOpenSettings={() => setShowProfile(true)} onDownload={downloadTranscript} hasTranscript={transcript.length > 0} />
      {notice && (
        <div role="alert" className="flex items-start gap-2 px-3 py-2 md:px-8 text-xs md:text-sm text-amber-200 bg-amber-500/10 border-b border-amber-500/30 shrink-0">
          <span>⚠️</span>
          <span className="flex-1">{notice}</span>
          <button onClick={dismissNotice} aria-label="Dismiss" className="px-1 text-amber-300 hover:text-white">✕</button>
        </div>
      )}
      <Console transcript={transcript} interimTranscript={interimTranscript} onDelete={deleteTranscript} fontScale={fontScale} />
      <Controls
        audioSource={audioSource}
        onChangeAudioSource={setAudioSource}
        autoAnswer={autoAnswer}
        onChangeAutoAnswer={setAutoAnswer}
        answerLength={answerLength}
        onChangeAnswerLength={setAnswerLength}
        jobContext={jobContext}
        hasAnswer={transcript.some((t) => t.role === 'ai')}
        onRegenerate={regenerate}
        isRecording={isRecording}
        isPaused={isPaused}
        resume={resume}
        onOpenProfile={() => setShowProfile(true)}
        onStart={startRecording}
        onStop={stopRecording}
        onTogglePause={togglePause}
        onRequestAnswer={requestAnswer}
        onClearAll={clearTranscript}
      />
      <Sidebar
        open={showProfile}
        onClose={() => setShowProfile(false)}
        resume={resume}
        resumeLoading={resumeLoading}
        resumeError={resumeError}
        onUploadResume={uploadResume}
        onRemoveResume={removeResume}
        jobContext={jobContext}
        onChangeJobContext={setJobContext}
        fontScale={fontScale}
        onChangeFontScale={setFontScale}
      />
      {showManual && <UserManual onClose={() => setShowManual(false)} />}
    </div>
  );
}
