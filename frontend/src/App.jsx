import React, { useState, useEffect } from 'react';
import { useInterviewCopilot } from './hooks/useInterviewCopilot';
import { Header } from './components/Header';
import { Console } from './components/Console';
import { Controls } from './components/Controls';
import { UserManual } from './components/UserManual';

export default function App() {
  const { isRecording, isPaused, transcript, interimTranscript, hasTranscript, startRecording, stopRecording, togglePause, requestAnswer, deleteTranscript } = useInterviewCopilot();

  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    // Show manual only on first visit
    const seen = localStorage.getItem('helply_manual_seen');
    if (!seen) {
      setShowManual(true);
    }
  }, []);

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950/80 to-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30">
      <Header isRecording={isRecording} isPaused={isPaused} />
      <Console transcript={transcript} interimTranscript={interimTranscript} onDelete={deleteTranscript} />
      <Controls
        isRecording={isRecording}
        isPaused={isPaused}
        hasTranscript={hasTranscript}
        onStart={startRecording}
        onStop={stopRecording}
        onTogglePause={togglePause}
        onRequestAnswer={requestAnswer}
      />
      {showManual && <UserManual onClose={() => setShowManual(false)} />}
    </div>
  );
}
