import React, { useEffect, useRef } from 'react';
import { Participant } from '../types';
import { MicOffIcon } from './Icons';

interface VideoTileProps {
  participant: Participant;
  stream?: MediaStream | null;
  className?: string;
  isMirror?: boolean;
}

const VideoTile: React.FC<VideoTileProps> = ({ participant, stream, className = '', isMirror = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
        if (stream) {
            if (videoRef.current.srcObject !== stream) {
                videoRef.current.srcObject = stream;
            }
        } else {
            videoRef.current.srcObject = null;
        }
    }
  }, [stream]);

  return (
    <div className={`relative bg-gray-800 rounded-lg overflow-hidden shadow-lg border border-gray-700 flex flex-col ${className}`}>
      {participant.videoEnabled && stream ? (
        <video
          ref={videoRef}
          autoPlay
          muted={participant.isLocal} // Mute local to prevent feedback
          playsInline
          className={`w-full h-full object-cover ${isMirror ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-700">
          {participant.avatarUrl ? (
             <img src={participant.avatarUrl} alt={participant.name} className="w-24 h-24 rounded-full object-cover border-2 border-gray-600" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center text-3xl font-bold text-white uppercase">
              {participant.name.slice(0, 2)}
            </div>
          )}
        </div>
      )}
      
      {/* Overlay Info */}
      <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-xs font-medium text-white flex items-center gap-2">
        <span>{participant.name} {participant.isLocal && "(You)"}</span>
        {!participant.audioEnabled && <MicOffIcon className="w-3 h-3 text-red-500" />}
      </div>
      
      {participant.isScreenSharing && (
        <div className="absolute top-2 right-2 bg-green-600/90 px-2 py-1 rounded text-xs font-bold text-white animate-pulse">
            Sharing Screen
        </div>
      )}
    </div>
  );
};

export default VideoTile;