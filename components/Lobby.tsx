import React, { useState, useEffect, useRef } from 'react';
import { VideoIcon, VideoOffIcon, MicIcon, MicOffIcon, BackgroundIcon } from './Icons';
import { BackgroundMode } from '../types';

interface LobbyProps {
  onJoin: (name: string, video: boolean, audio: boolean, meetingId: string, stream: MediaStream | null, backgroundMode: BackgroundMode) => void;
}

const Lobby: React.FC<LobbyProps> = ({ onJoin }) => {
  const [name, setName] = useState('');
  const [meetingId, setMeetingId] = useState('');
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('NONE');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const isJoiningRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    let localStream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        // Use 'ideal' constraints to prevent over-constraining failures
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true
        });

        if (!isMounted) {
            // Component unmounted while waiting for camera. 
            // Stop this stream immediately to release the camera lock.
            mediaStream.getTracks().forEach(track => track.stop());
            return;
        }

        localStream = mediaStream;
        setStream(mediaStream);
      } catch (err) {
        if (isMounted) {
            console.error("Error accessing media devices:", err);
            setVideoEnabled(false);
            setAudioEnabled(false);
        }
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      // Only stop tracks if we are NOT joining (i.e. component unmount due to tab close or refresh)
      // If we are joining, we pass the stream to the next component so we don't stop it here.
      if (!isJoiningRef.current && localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (stream) {
        stream.getVideoTracks().forEach(track => track.enabled = videoEnabled);
        stream.getAudioTracks().forEach(track => track.enabled = audioEnabled);
        
        if (videoRef.current && videoRef.current.srcObject !== stream) {
            videoRef.current.srcObject = stream;
        }
    }
  }, [stream, videoEnabled, audioEnabled]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
        isJoiningRef.current = true;
        // Pass the ACTIVE stream to the parent
        onJoin(name, videoEnabled, audioEnabled, meetingId.trim(), stream, backgroundMode);
    }
  };

  const cycleBackground = () => {
      if (backgroundMode === 'NONE') setBackgroundMode('BLUR');
      else if (backgroundMode === 'BLUR') setBackgroundMode('IMAGE');
      else setBackgroundMode('NONE');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 bg-gray-900 p-8 rounded-3xl shadow-2xl border border-gray-800">
        
        {/* Preview Area */}
        <div className="flex flex-col gap-4">
          <div className="relative aspect-video bg-gray-800 rounded-2xl overflow-hidden shadow-inner border border-gray-700 group">
            {videoEnabled && stream ? (
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                        <div className="w-20 h-20 bg-gray-700 rounded-full mx-auto mb-3 flex items-center justify-center">
                           <VideoOffIcon className="w-8 h-8 opacity-50"/>
                        </div>
                        <p>Camera is off</p>
                    </div>
                </div>
            )}
             <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4">
                <button 
                    type="button"
                    onClick={() => setAudioEnabled(!audioEnabled)}
                    className={`p-3 rounded-full transition-all ${audioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500/20 text-red-500 border border-red-500/50'}`}
                >
                    {audioEnabled ? <MicIcon /> : <MicOffIcon />}
                </button>
                <button 
                    type="button"
                    onClick={() => setVideoEnabled(!videoEnabled)}
                    className={`p-3 rounded-full transition-all ${videoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500/20 text-red-500 border border-red-500/50'}`}
                >
                    {videoEnabled ? <VideoIcon /> : <VideoOffIcon />}
                </button>
                <button 
                    type="button"
                    onClick={cycleBackground}
                    className={`p-3 rounded-full transition-all ${backgroundMode !== 'NONE' ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
                    title="Change Background"
                >
                    <BackgroundIcon />
                </button>
             </div>
             <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-xs text-white">
                 {backgroundMode === 'NONE' ? 'No Effect' : backgroundMode === 'BLUR' ? 'Blur' : 'Virtual Image'}
             </div>
          </div>
          <p className="text-center text-gray-400 text-sm">Preview your video and audio before joining</p>
        </div>

        {/* Form Area */}
        <div className="flex flex-col justify-center gap-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">SwiftDigital Meet</h1>
            <p className="text-gray-400">Webinar platform with AI assistance.</p>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Display Name</label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                    required
                />
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Meeting ID <span className="text-gray-500 text-xs font-normal">(Optional)</span></label>
                <input
                    type="text"
                    value={meetingId}
                    onChange={(e) => setMeetingId(e.target.value)}
                    placeholder="Enter ID to join, or leave empty to start new"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all"
                />
            </div>
            
            <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-blue-500/25"
            >
                {meetingId ? "Join Meeting" : "Start New Meeting"}
            </button>
          </form>

          <div className="pt-6 border-t border-gray-800">
             <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span>System ready</span>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Lobby;