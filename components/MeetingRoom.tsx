import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import { Participant, BackgroundMode } from '../types';
import VideoTile from './VideoTile';
import Controls from './Controls';
import ChatPanel from './ChatPanel';
import { UsersIcon } from './Icons';
import { backgroundService } from '../services/backgroundService';

interface MeetingRoomProps {
  userName: string;
  meetingId: string;
  initialVideo: boolean;
  initialAudio: boolean;
  initialBackgroundMode: BackgroundMode;
  initialStream: MediaStream | null;
  onEndCall: () => void;
}

const MeetingRoom: React.FC<MeetingRoomProps> = ({ 
    userName, 
    meetingId: targetMeetingId, 
    initialVideo, 
    initialAudio, 
    initialBackgroundMode,
    initialStream,
    onEndCall 
}) => {
  // Streams
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(initialStream);
  const [processedStream, setProcessedStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null); // The stream currently being sent

  // State
  const [isVideoEnabled, setIsVideoEnabled] = useState(initialVideo);
  const [isAudioEnabled, setIsAudioEnabled] = useState(initialAudio);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>(initialBackgroundMode);
  
  const [myPeerId, setMyPeerId] = useState<string>('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  
  // Refs
  const peerRef = useRef<Peer | null>(null);
  const activeCallsRef = useRef<any[]>([]);
  const videoProcessRef = useRef<HTMLVideoElement>(document.createElement('video'));
  const canvasProcessRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));

  // --- 1. Stream Initialization & Management ---
  useEffect(() => {
    const initStream = async () => {
        let stream = webcamStream;
        if (!stream) {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                    audio: true
                });
                // Apply initial settings
                stream.getVideoTracks().forEach(t => t.enabled = initialVideo);
                stream.getAudioTracks().forEach(t => t.enabled = initialAudio);
                setWebcamStream(stream);
            } catch (e) {
                console.error("Failed to get user media", e);
                return;
            }
        } else {
            // Ensure settings are applied to passed stream
            stream.getVideoTracks().forEach(t => t.enabled = initialVideo);
            stream.getAudioTracks().forEach(t => t.enabled = initialAudio);
        }
    };
    initStream();
  }, []);

  // --- 2. Background Processing Loop ---
  useEffect(() => {
      if (!webcamStream || !isVideoEnabled) {
          backgroundService.stop();
          return;
      }

      const updateProcessing = async () => {
          if (backgroundMode === 'NONE') {
              backgroundService.stop();
              setProcessedStream(null);
          } else {
              // Setup hidden video element for processing source
              const vid = videoProcessRef.current;
              vid.srcObject = webcamStream;
              await vid.play().catch(() => {});

              backgroundService.setMode(backgroundMode);
              backgroundService.processStream(vid, canvasProcessRef.current);
              
              // Get stream from canvas
              const cvsStream = canvasProcessRef.current.captureStream(30);
              // Important: Add audio track from webcam to canvas stream so it is self-contained
              if (webcamStream.getAudioTracks().length > 0) {
                  cvsStream.addTrack(webcamStream.getAudioTracks()[0]);
              }
              setProcessedStream(cvsStream);
          }
      };

      updateProcessing();
  }, [backgroundMode, webcamStream, isVideoEnabled]);

  // --- 3. Determine Active Stream ---
  useEffect(() => {
      if (screenStream) {
          setActiveStream(screenStream);
      } else if (backgroundMode !== 'NONE' && processedStream) {
          setActiveStream(processedStream);
      } else {
          setActiveStream(webcamStream);
      }
  }, [screenStream, processedStream, webcamStream, backgroundMode]);

  // --- 4. PeerJS Integration ---
  useEffect(() => {
    // Only init peer when we have an active stream to answer with
    if (!activeStream || peerRef.current) return;

    const newPeerId = Math.random().toString(36).substr(2, 9);
    const peer = new Peer(newPeerId);

    peer.on('open', (id) => {
        setMyPeerId(id);
        if (targetMeetingId) {
            connectToHost(targetMeetingId, activeStream);
        }
    });

    peer.on('call', (call) => {
        call.answer(activeStream);
        handleCallStream(call);
    });

    peerRef.current = peer;

    return () => {
        peer.destroy();
    };
  }, [activeStream]); // Start peer once we have a stream

  // --- 5. Handle Track Replacement when Active Stream Changes ---
  useEffect(() => {
      if (!activeStream) return;

      const videoTrack = activeStream.getVideoTracks()[0];
      const audioTrack = activeStream.getAudioTracks()[0];

      activeCallsRef.current.forEach(call => {
          const senders = call.peerConnection.getSenders();
          
          const videoSender = senders.find((s:any) => s.track?.kind === 'video');
          if (videoSender && videoTrack) {
              videoSender.replaceTrack(videoTrack);
          }
          
          const audioSender = senders.find((s:any) => s.track?.kind === 'audio');
          if (audioSender && audioTrack) {
              audioSender.replaceTrack(audioTrack);
          }
      });
  }, [activeStream]);

  const connectToHost = (hostId: string, stream: MediaStream) => {
    if (!peerRef.current) return;
    const call = peerRef.current.call(hostId, stream, {
        metadata: { name: userName }
    });
    handleCallStream(call);
  };

  const handleCallStream = (call: any) => {
    activeCallsRef.current.push(call);
    
    call.on('stream', (remoteStream: MediaStream) => {
        setParticipants(prev => {
            if (prev.find(p => p.peerId === call.peer)) return prev;
            return [...prev, {
                id: call.peer,
                peerId: call.peer,
                name: call.metadata?.name || `User ${call.peer.substr(0,4)}`,
                isLocal: false,
                videoEnabled: true,
                audioEnabled: true,
                stream: remoteStream
            } as any];
        });
    });

    call.on('close', () => {
        setParticipants(prev => prev.filter(p => p.peerId !== call.peer));
        activeCallsRef.current = activeCallsRef.current.filter(c => c !== call);
    });
  };

  // --- Actions ---

  const toggleVideo = () => {
    if (webcamStream) {
      const newState = !isVideoEnabled;
      webcamStream.getVideoTracks().forEach(t => t.enabled = newState);
      setIsVideoEnabled(newState);
    }
  };

  const toggleAudio = () => {
    if (webcamStream) {
      const newState = !isAudioEnabled;
      webcamStream.getAudioTracks().forEach(t => t.enabled = newState);
      setIsAudioEnabled(newState);
    }
  };

  const cycleBackground = () => {
      if (backgroundMode === 'NONE') setBackgroundMode('BLUR');
      else if (backgroundMode === 'BLUR') setBackgroundMode('IMAGE');
      else setBackgroundMode('NONE');
  };

  const toggleScreenShare = async () => {
    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop());
      setScreenStream(null);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        setScreenStream(stream);
        stream.getVideoTracks()[0].onended = () => {
            setScreenStream(null);
        };
      } catch (e: any) {
        console.error("Error sharing screen", e);
        if (e.name === 'NotAllowedError' && e.message.includes('disallowed by permissions policy')) {
             alert("Screen sharing permission is required. Please reload the page and try again.");
        } else {
             alert("Could not start screen share. Permission denied or not supported.");
        }
      }
    }
  };

  const copyId = () => {
      navigator.clipboard.writeText(myPeerId);
      alert("Meeting ID copied!");
  };

  const localParticipant: Participant = {
    id: 'local',
    name: `${userName} (You)`,
    isLocal: true,
    videoEnabled: isVideoEnabled,
    audioEnabled: isAudioEnabled,
    isScreenSharing: !!screenStream,
  };

  const displayParticipants = [localParticipant, ...participants];
  const activeScreenShare = screenStream ? localParticipant : participants.find(p => p.isScreenSharing);

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
      
      {/* Header Info */}
      <div className="absolute top-4 left-4 z-40 bg-gray-900/80 backdrop-blur border border-gray-700 rounded-lg p-3 shadow-lg flex flex-col gap-1">
          <div className="text-xs text-gray-400 font-semibold">MEETING ID</div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-mono font-bold text-green-400 tracking-wider">{myPeerId || "..."}</span>
            <button onClick={copyId} className="p-1 hover:bg-gray-700 rounded text-gray-300 transition-colors" title="Copy ID">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
          </div>
          {targetMeetingId && (
              <div className="text-xs text-blue-400 mt-1">Joined Room: {targetMeetingId}</div>
          )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Video Grid / Stage */}
        <div className={`flex-1 p-4 overflow-y-auto transition-all duration-300 ${isAiPanelOpen ? 'mr-0' : ''} flex flex-col`}>
          
          {participants.length === 0 && !targetMeetingId && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-gray-500 z-0">
                  <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800">
                    <UsersIcon className="w-12 h-12 mx-auto mb-2 opacity-50"/>
                    <p className="text-lg font-medium mb-2">You are the only one here</p>
                    <p className="text-sm">Share the Meeting ID at the top left to invite others.</p>
                  </div>
              </div>
          )}

          {activeScreenShare ? (
            // Screen Share Layout
            <div className="h-full flex flex-col gap-4 z-10">
              <div className="flex-1 bg-black rounded-xl overflow-hidden border border-gray-800 relative shadow-2xl">
                 <VideoTile 
                   participant={activeScreenShare} 
                   stream={activeStream} // Show active stream (screen)
                   className="w-full h-full"
                   isMirror={false}
                 />
                 <div className="absolute top-4 left-4 bg-green-600 px-3 py-1 rounded text-sm font-bold shadow-lg">
                    {activeScreenShare.isLocal ? "You are sharing your screen" : `${activeScreenShare.name} is sharing`}
                 </div>
              </div>
              <div className="h-32 flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                 {displayParticipants.filter(p => p.id !== activeScreenShare.id).map(p => (
                   <div key={p.id} className="min-w-[180px] w-[180px] h-full">
                     <VideoTile 
                       participant={p} 
                       stream={p.isLocal ? activeStream : (p as any).stream}
                       isMirror={p.isLocal && !screenStream} // Mirror only if local and NOT screen sharing
                       className="w-full h-full text-xs"
                     />
                   </div>
                 ))}
                 <div className="min-w-[180px] w-[180px] h-full">
                    <VideoTile 
                       participant={activeScreenShare}
                       stream={activeStream}
                       isMirror={false}
                       className="w-full h-full text-xs border-2 border-green-500"
                    />
                 </div>
              </div>
            </div>
          ) : (
            // Standard Grid Layout
            <div className="h-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr content-center z-10">
              {displayParticipants.map((p) => (
                <div key={p.id} className="w-full h-full min-h-[200px] flex justify-center relative">
                   <VideoTile
                     participant={p}
                     stream={p.isLocal ? activeStream : (p as any).stream}
                     isMirror={p.isLocal} // Mirror local cam
                     className="w-full h-full max-w-full"
                   />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Sidebar (AI) */}
        <div className={`${isAiPanelOpen ? 'w-full md:w-80 translate-x-0' : 'w-0 translate-x-full'} transition-all duration-300 ease-in-out absolute md:relative right-0 h-full z-20`}>
           <ChatPanel isOpen={isAiPanelOpen} onClose={() => setIsAiPanelOpen(false)} />
        </div>

      </div>

      {/* Bottom Controls */}
      <Controls
        isAudioEnabled={isAudioEnabled}
        isVideoEnabled={isVideoEnabled}
        isScreenSharing={!!screenStream}
        isAiPanelOpen={isAiPanelOpen}
        backgroundMode={backgroundMode}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleScreenShare={toggleScreenShare}
        onToggleAiPanel={() => setIsAiPanelOpen(!isAiPanelOpen)}
        onCycleBackground={cycleBackground}
        onEndCall={onEndCall}
      />
    </div>
  );
};

export default MeetingRoom;