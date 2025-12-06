import React, { useState } from 'react';
import { AppState, BackgroundMode } from './types';
import Lobby from './components/Lobby';
import MeetingRoom from './components/MeetingRoom';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.LOBBY);
  const [userSettings, setUserSettings] = useState({
    name: '',
    meetingId: '',
    video: true,
    audio: true,
    backgroundMode: 'NONE' as BackgroundMode
  });
  const [initialStream, setInitialStream] = useState<MediaStream | null>(null);

  const handleJoin = (name: string, video: boolean, audio: boolean, meetingId: string, stream: MediaStream | null, backgroundMode: BackgroundMode) => {
    setUserSettings({ name, video, audio, meetingId, backgroundMode });
    setInitialStream(stream);
    setAppState(AppState.MEETING);
  };

  const handleEndCall = () => {
    // If there is an active stream, stop it now
    if (initialStream) {
        initialStream.getTracks().forEach(t => t.stop());
    }
    setInitialStream(null);
    setAppState(AppState.LOBBY);
    setUserSettings({ name: '', meetingId: '', video: true, audio: true, backgroundMode: 'NONE' });
  };

  return (
    <>
      {appState === AppState.LOBBY ? (
        <Lobby onJoin={handleJoin} />
      ) : (
        <MeetingRoom
          userName={userSettings.name}
          meetingId={userSettings.meetingId}
          initialVideo={userSettings.video}
          initialAudio={userSettings.audio}
          initialBackgroundMode={userSettings.backgroundMode}
          initialStream={initialStream}
          onEndCall={handleEndCall}
        />
      )}
    </>
  );
};

export default App;