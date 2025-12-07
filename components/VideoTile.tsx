import React, { useEffect, useRef, useState } from 'react';
import { Participant } from '../types';
import { MicOffIcon, MaximizeIcon, MinimizeIcon } from './Icons';

interface VideoTileProps {
  participant: Participant;
  stream?: MediaStream | null;
  className?: string;
  isMirror?: boolean;
}

const VideoTile: React.FC<VideoTileProps> = ({ participant, stream, className = '', isMirror = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (stream) {
        videoEl.srcObject = stream;
        
        // Listen for track changes (e.g. screen share toggle) to force a refresh if needed
        const handleTrackChange = () => {
            // Re-assigning srcObject can help some browsers pick up the new track dimensions/type
            videoEl.srcObject = stream; 
            setForceUpdate(n => n + 1);
        };

        stream.addEventListener('addtrack', handleTrackChange);
        stream.addEventListener('removetrack', handleTrackChange);

        // Attempt to play if paused
        videoEl.play().catch(e => {
            // Auto-play policies might block this if not muted, but we are in a meeting app
        });

        return () => {
            stream.removeEventListener('addtrack', handleTrackChange);
            stream.removeEventListener('removetrack', handleTrackChange);
        };
    } else {
        videoEl.srcObject = null;
    }
  }, [stream, forceUpdate]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange); // Safari support
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
        // Try container first (standard)
        if (containerRef.current?.requestFullscreen) {
            containerRef.current.requestFullscreen().catch(err => {
                 console.warn("Container fullscreen failed", err);
                 // Fallback to video element (often needed on iOS)
                 if (videoRef.current && (videoRef.current as any).webkitEnterFullscreen) {
                     (videoRef.current as any).webkitEnterFullscreen();
                 }
            });
        } 
        // iOS Safari special handling for video
        else if (videoRef.current && (videoRef.current as any).webkitEnterFullscreen) {
            (videoRef.current as any).webkitEnterFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
  };

  // Determine object-fit style: 'contain' for screen shares (so full screen is visible on mobile), 'cover' for camera
  const objectFitClass = participant.isScreenSharing ? 'object-contain' : 'object-cover';

  return (
    <div 
        ref={containerRef}
        className={`relative bg-gray-800 rounded-lg overflow-hidden shadow-lg border border-gray-700 flex flex-col group ${className}`}
    >
      {participant.videoEnabled && stream ? (
        <video
          ref={videoRef}
          autoPlay
          muted={participant.isLocal} // Mute local to prevent feedback
          playsInline
          className={`w-full h-full bg-black ${objectFitClass} ${isMirror ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-700">
          {participant.avatarUrl ? (
             <img src={participant.avatarUrl} alt={participant.name} className="w-24 h-24 rounded-full object-cover border-2 border-gray-600" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center text-3xl font-bold text-white uppercase select-none">
              {participant.name.slice(0, 2)}
            </div>
          )}
        </div>
      )}
      
      {/* Overlay Info - Name Tag */}
      <div className={`absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-xs font-medium text-white flex items-center gap-2 max-w-[80%] z-10 transition-opacity duration-300 ${isFullscreen ? 'opacity-0 group-hover:opacity-100' : ''}`}>
        <span className="truncate">{participant.name}</span>
        {!participant.audioEnabled && <MicOffIcon className="w-3 h-3 text-red-500 shrink-0" />}
      </div>
      
      {/* Screen Sharing Badge - Moved to top-left to avoid conflict with maximize button */}
      {participant.isScreenSharing && (
        <div className="absolute top-2 left-2 bg-green-600/90 px-2 py-1 rounded text-xs font-bold text-white animate-pulse z-10 pointer-events-none">
            Sharing Screen
        </div>
      )}

      {/* Fullscreen Button - Top Right */}
      {participant.videoEnabled && stream && (
          <button 
            onClick={toggleFullscreen}
            className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 md:opacity-0"
            // On mobile, we might want it always visible or visible on tap. The group-hover covers tap on mobile mostly.
            // Adding a class to ensure it's easier to find on mobile:
            style={{ opacity: 'var(--btn-opacity, 0)' }}
          >
              {isFullscreen ? <MinimizeIcon className="w-4 h-4"/> : <MaximizeIcon className="w-4 h-4" />}
          </button>
      )}

      {/* Helper to show button on mobile tap (CSS trick or just rely on hover/active states) */}
      <style>{`
        @media (hover: none) {
            .group:active button, .group:focus-within button {
                opacity: 1 !important;
                --btn-opacity: 1;
            }
            /* Make it always visible on screen share for clarity on mobile */
            ${participant.isScreenSharing ? `
            button {
                opacity: 1 !important;
                --btn-opacity: 1;
                background-color: rgba(0,0,0,0.6);
            }
            ` : ''}
        }
      `}</style>
    </div>
  );
};

export default VideoTile;