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
  
  // Initialize activeStream immediately if possible to avoid delays
  const [activeStream, setActiveStream] = useState<MediaStream | null>(initialStream);

  // Refs for State (to avoid stale closures in PeerJS callbacks)
  const activeStreamRef = useRef<MediaStream | null>(initialStream);

  // State
  const [isVideoEnabled, setIsVideoEnabled] = useState(initialVideo);
  const [isAudioEnabled, setIsAudioEnabled] = useState(initialAudio);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>(initialBackgroundMode);
  
  const [myPeerId, setMyPeerId] = useState<string>('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  
  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  
  // Refs
  const peerRef = useRef<Peer | null>(null);
  const activeCallsRef = useRef<any[]>([]);
  const videoProcessRef = useRef<HTMLVideoElement>(document.createElement('video'));
  const canvasProcessRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const hasJoinedRef = useRef(false);
  
  // Name mapping ref to solve the "Receiver sees their own name" issue
  const peerNamesRef = useRef<Record<string, string>>({});

  // --- 1. Stream Initialization & Management ---
  useEffect(() => {
    const initStream = async () => {
        if (!initialStream) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                    audio: true
                });
                setWebcamStream(stream);
                // If we didn't have an initial stream, this is our first active stream
                if (!activeStreamRef.current) {
                    setActiveStream(stream);
                    activeStreamRef.current = stream;
                }
            } catch (e) {
                console.error("Failed to get user media", e);
            }
        }
    };
    initStream();
  }, []); // Run once on mount

  // --- 2. Background Processing Loop ---
  useEffect(() => {
      if (!webcamStream || !isVideoEnabled) {
          backgroundService.stop();
          setProcessedStream(null);
          return;
      }

      const updateProcessing = async () => {
          if (backgroundMode === 'NONE') {
              backgroundService.stop();
              setProcessedStream(null);
          } else {
              // Setup hidden video element for processing source
              const vid = videoProcessRef.current;
              // Only update source if different
              if (vid.srcObject !== webcamStream) {
                vid.srcObject = webcamStream;
                await vid.play().catch(() => {});
              }

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
      let nextStream: MediaStream | null = null;

      if (screenStream) {
          nextStream = screenStream;
      } else if (backgroundMode !== 'NONE' && processedStream) {
          nextStream = processedStream;
      } else {
          nextStream = webcamStream;
      }

      // Only update if actually different to prevent unnecessary re-renders/track replacements
      if (nextStream !== activeStreamRef.current) {
          setActiveStream(nextStream);
          activeStreamRef.current = nextStream; // Sync Ref
      }
  }, [screenStream, processedStream, webcamStream, backgroundMode]);

  // --- 4. PeerJS Initialization (Run Once) ---
  useEffect(() => {
    // Generate ID or use random
    const newPeerId = Math.random().toString(36).substr(2, 9);
    
    console.log("Initializing PeerJS with ID:", newPeerId);
    
    const peer = new Peer(newPeerId, {
        debug: 1,
    });

    peer.on('open', (id) => {
        console.log("PeerJS Connected. My ID:", id);
        setMyPeerId(id);
    });

    // Handle Incoming Data Connections (For Name Exchange)
    peer.on('connection', (conn) => {
        setupDataConnection(conn);
    });

    // Handle Incoming Media Calls
    peer.on('call', (call) => {
        console.log("Incoming call from:", call.peer);
        // Answer with the current active stream
        const currentStream = activeStreamRef.current;
        if (currentStream) {
            call.answer(currentStream);
            handleCallStream(call);
        } else {
            console.warn("Answering call without stream (not ready)");
            call.answer(); 
        }
    });

    peer.on('error', (err) => {
        console.error("PeerJS Error:", err);
        if (err.type === 'peer-unavailable') {
            alert("The meeting ID you are trying to join does not exist or the host is offline.");
        }
    });

    peerRef.current = peer;

    return () => {
        peer.destroy();
    };
  }, []); 

  // --- 5. Join Meeting Logic (Wait for Peer + Stream) ---
  useEffect(() => {
      // If we are supposed to join a meeting, we have our ID, and we have a stream, and we haven't joined yet
      if (targetMeetingId && myPeerId && activeStreamRef.current && !hasJoinedRef.current) {
          console.log("Joining Meeting:", targetMeetingId);
          connectToHost(targetMeetingId, activeStreamRef.current);
          hasJoinedRef.current = true;
      }
  }, [targetMeetingId, myPeerId, activeStream]);

  // --- 6. Handle Track Replacement when Active Stream Changes ---
  useEffect(() => {
      const currentStream = activeStream;
      if (!currentStream) return;

      const videoTrack = currentStream.getVideoTracks()[0];
      const audioTrack = currentStream.getAudioTracks()[0];

      activeCallsRef.current.forEach(call => {
          if (!call.peerConnection) return;
          const senders = call.peerConnection.getSenders();
          
          if (videoTrack) {
            const videoSender = senders.find((s:any) => s.track?.kind === 'video');
            if (videoSender) {
                videoSender.replaceTrack(videoTrack).catch((err: any) => console.error("Track replacement failed", err));
            }
          }
          
          if (audioTrack) {
            const audioSender = senders.find((s:any) => s.track?.kind === 'audio');
            if (audioSender) {
                audioSender.replaceTrack(audioTrack).catch((err: any) => console.error("Audio replacement failed", err));
            }
          }
      });
  }, [activeStream]);

  // --- Helper: Data Connection for Name Exchange ---
  const setupDataConnection = (conn: any) => {
      conn.on('open', () => {
          // Send my name to the peer
          conn.send({ type: 'identify', name: userName });
      });

      conn.on('data', (data: any) => {
          if (data && data.type === 'identify' && data.name) {
              console.log("Received identity:", data.name, "from", conn.peer);
              peerNamesRef.current[conn.peer] = data.name;
              
              // Update participant if they already exist
              setParticipants(prev => prev.map(p => 
                  p.peerId === conn.peer ? { ...p, name: data.name } : p
              ));
          }
      });
  };

  const connectToHost = (hostId: string, stream: MediaStream) => {
    if (!peerRef.current) return;
    
    // 1. Establish Data Connection for metadata exchange
    const conn = peerRef.current.connect(hostId);
    setupDataConnection(conn);

    // 2. Establish Media Call
    const call = peerRef.current.call(hostId, stream, {
        metadata: { name: userName }
    });
    handleCallStream(call);
  };

  const handleCallStream = (call: any) => {
    if (activeCallsRef.current.find(c => c.peer === call.peer)) return;

    activeCallsRef.current.push(call);
    
    call.on('stream', (remoteStream: MediaStream) => {
        console.log("Received remote stream from:", call.peer);
        
        setParticipants(prev => {
            if (prev.find(p => p.peerId === call.peer)) return prev;
            
            // Try to resolve name: 
            // 1. From our DataConnection map (best)
            // 2. From call metadata (works for host receiving call)
            // 3. Fallback
            const resolvedName = peerNamesRef.current[call.peer] 
                || call.metadata?.name 
                || `User ${call.peer.substr(0,4)}`;

            return [...prev, {
                id: call.peer,
                peerId: call.peer,
                name: resolvedName,
                isLocal: false,
                videoEnabled: true,
                audioEnabled: true,
                stream: remoteStream
            } as any];
        });
    });

    call.on('close', () => {
        console.log("Call closed:", call.peer);
        setParticipants(prev => prev.filter(p => p.peerId !== call.peer));
        activeCallsRef.current = activeCallsRef.current.filter(c => c !== call);
    });

    call.on('error', (err: any) => {
        console.error("Call error:", err);
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
      // Stop screen share
      screenStream.getTracks().forEach(t => t.stop());
      setScreenStream(null);
    } else {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        
        // MIXING LOGIC: Combine Screen Video + Mic Audio
        const videoTrack = displayStream.getVideoTracks()[0];
        let audioTrack = webcamStream?.getAudioTracks()[0]; 

        const tracks = [videoTrack];
        if (audioTrack) tracks.push(audioTrack);
        
        const mixedStream = new MediaStream(tracks);

        setScreenStream(mixedStream);

        videoTrack.onended = () => {
            setScreenStream(null);
        };
      } catch (e: any) {
        console.error("Error sharing screen", e);
        if (e.name === 'NotAllowedError') {
             // User cancelled, ignore
             return;
        }
        alert("Screen sharing permission is required.");
      }
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
    } else {
      // Start recording
      
      // Notify user about the upcoming browser prompt
      alert("To record this meeting, please select 'Entire Screen' or the current 'Tab' in the popup window. Ensure 'Share system audio' is checked to capture sound.");

      try {
        // We use getDisplayMedia for high quality recording of the meeting content (screen or window)
        const recordStream = await navigator.mediaDevices.getDisplayMedia({
            video: { displaySurface: 'browser' },
            audio: true // Capture system audio
        });

        // Determine supported mime type
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
             ? 'video/webm;codecs=vp9' 
             : 'video/webm';

        const mediaRecorder = new MediaRecorder(recordStream, { mimeType });
        mediaRecorderRef.current = mediaRecorder;
        recordedChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunksRef.current.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            document.body.appendChild(a);
            a.style.display = 'none';
            a.href = url;
            a.download = `meeting-recording-${new Date().toISOString()}.webm`;
            a.click();
            window.URL.revokeObjectURL(url);
            
            // Stop the stream used for recording
            recordStream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);

        // Handle case where user stops sharing via browser UI
        recordStream.getVideoTracks()[0].onended = () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
                setIsRecording(false);
            }
        };

      } catch (e: any) {
          if (e.name === 'NotAllowedError') {
              // User cancelled the prompt - do nothing and don't alert
              return;
          }
          console.error("Error starting recording:", e);
          alert("Recording cancelled or failed to start.");
      }
    }
  };

  const handleEndCallSafe = () => {
      // 1. Stop recording if active
      if (isRecording && mediaRecorderRef.current) {
          mediaRecorderRef.current.stop();
      }

      // 2. Explicitly stop ALL local tracks to ensure camera light turns off
      if (webcamStream) {
          webcamStream.getTracks().forEach(track => track.stop());
      }
      if (screenStream) {
          screenStream.getTracks().forEach(track => track.stop());
      }
      if (processedStream) {
          processedStream.getTracks().forEach(track => track.stop());
      }

      // 3. Cleanup background service
      backgroundService.stop();

      // 4. Call parent handler
      onEndCall();
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

  // Filter out the local participant (You) from the filmstrip if someone is sharing.
  // This cleans up the UI for the viewer, removing the distraction of their own face ("another meet").
  const filmstripParticipants = displayParticipants.filter(p => {
    // Always hide the person currently on the main stage
    if (activeScreenShare && p.id === activeScreenShare.id) return false;
    
    // If we are watching a screen share (and not the one sharing), hide ourself to focus on the content
    if (activeScreenShare && !activeScreenShare.isLocal && p.isLocal) return false;

    return true;
  });

  return (
    <div className="relative h-[100dvh] w-full bg-gray-950 text-white overflow-hidden flex flex-col">
      
      {/* Header Info */}
      <div className="absolute top-4 left-4 z-40 bg-gray-900/80 backdrop-blur border border-gray-700 rounded-lg p-3 shadow-lg flex flex-col gap-1 pointer-events-auto max-w-[50%] sm:max-w-none">
          <div className="text-xs text-gray-400 font-semibold">MEETING ID</div>
          <div className="flex items-center gap-2">
            <span className="text-sm sm:text-lg font-mono font-bold text-green-400 tracking-wider select-all truncate">
                {myPeerId ? myPeerId : <span className="animate-pulse">Connecting...</span>}
            </span>
            {myPeerId && (
                <button onClick={copyId} className="p-1 hover:bg-gray-700 rounded text-gray-300 transition-colors shrink-0" title="Copy ID">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                </button>
            )}
          </div>
          {targetMeetingId && (
              <div className="text-xs text-blue-400 mt-1 truncate">Joined: {targetMeetingId}</div>
          )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden flex flex-row">
        
        {/* Video Grid / Stage */}
        <div 
          className={`flex-1 overflow-y-auto transition-all duration-300 ${isAiPanelOpen ? 'mr-0' : ''} flex flex-col 
          ${activeScreenShare ? 'p-0 sm:p-4' : 'p-2 sm:p-4'} pb-32 sm:pb-4`} 
        >
          
          {participants.length === 0 && !targetMeetingId && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-gray-500 z-0 w-full px-4">
                  <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800 backdrop-blur-sm">
                    <UsersIcon className="w-12 h-12 mx-auto mb-2 opacity-50"/>
                    <p className="text-lg font-medium mb-2">You are the only one here</p>
                    <p className="text-sm">Share the Meeting ID at the top left to invite others.</p>
                  </div>
              </div>
          )}

          {activeScreenShare ? (
            // Screen Share Layout
            <div className="h-full flex flex-col gap-4 z-10">
              {/* Main Screen Share Area */}
              <div className="flex-1 bg-black rounded-none sm:rounded-xl overflow-hidden border-0 sm:border border-gray-800 relative shadow-2xl flex items-center justify-center">
                 <VideoTile 
                   participant={activeScreenShare} 
                   stream={activeScreenShare.isLocal ? activeStream : (activeScreenShare as any).stream} 
                   className="w-full h-full"
                   isMirror={false}
                 />
              </div>
              
              {/* Filmstrip - Only show if there are participants to show */}
              {filmstripParticipants.length > 0 && (
                  <div className="h-20 sm:h-32 flex gap-2 sm:gap-4 overflow-x-auto pb-2 scrollbar-hide px-2 sm:px-0">
                    {filmstripParticipants.map(p => (
                      <div key={p.id} className="min-w-[100px] w-[100px] sm:min-w-[180px] sm:w-[180px] h-full">
                        <VideoTile 
                          participant={p} 
                          stream={p.isLocal ? activeStream : (p as any).stream}
                          isMirror={p.isLocal && !screenStream}
                          className="w-full h-full text-xs"
                        />
                      </div>
                    ))}
                  </div>
              )}
            </div>
          ) : (
            // Standard Grid Layout
            <div className="min-h-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 auto-rows-fr content-start z-10">
              {displayParticipants.map((p) => (
                <div key={p.id} className="w-full h-full min-h-[180px] sm:min-h-[200px] flex justify-center relative">
                   <VideoTile
                     participant={p}
                     stream={p.isLocal ? activeStream : (p as any).stream}
                     isMirror={p.isLocal} 
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

      {/* Bottom Controls - Now absolute positioned inside relative container */}
      <Controls
        isAudioEnabled={isAudioEnabled}
        isVideoEnabled={isVideoEnabled}
        isScreenSharing={!!screenStream}
        isAiPanelOpen={isAiPanelOpen}
        isRecording={isRecording}
        backgroundMode={backgroundMode}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleScreenShare={toggleScreenShare}
        onToggleAiPanel={() => setIsAiPanelOpen(!isAiPanelOpen)}
        onToggleRecording={toggleRecording}
        onCycleBackground={cycleBackground}
        onEndCall={handleEndCallSafe}
      />
    </div>
  );
};

export default MeetingRoom;