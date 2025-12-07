import React from 'react';
import { 
  MicIcon, MicOffIcon, 
  VideoIcon, VideoOffIcon, 
  ShareScreenIcon, StopShareIcon, 
  SparklesIcon, PhoneOffIcon,
  BackgroundIcon,
  RecordIcon, StopRecordIcon
} from './Icons';
import { BackgroundMode } from '../types';

interface ControlsProps {
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isAiPanelOpen: boolean;
  isRecording: boolean;
  backgroundMode: BackgroundMode;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleAiPanel: () => void;
  onToggleRecording: () => void;
  onCycleBackground: () => void;
  onEndCall: () => void;
}

const ControlButton: React.FC<{
  onClick: () => void;
  isActive?: boolean;
  activeColor?: string;
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  pulse?: boolean;
}> = ({ onClick, isActive = true, activeColor = 'bg-gray-700', icon, label, danger, pulse }) => (
  <div className="flex flex-col items-center gap-1 group">
    <button
      onClick={onClick}
      className={`p-3 sm:p-4 rounded-xl transition-all duration-200 ${
        danger 
          ? 'bg-red-600 hover:bg-red-700 text-white' 
          : isActive 
            ? 'bg-gray-700 hover:bg-gray-600 text-white'
            : 'bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500/20'
      } ${pulse ? 'animate-pulse ring-2 ring-red-500 ring-offset-2 ring-offset-gray-900' : ''}`}
    >
      {icon}
    </button>
    <span className="text-[10px] sm:text-xs text-gray-400 group-hover:text-white transition-colors font-medium">
      {label}
    </span>
  </div>
);

const Controls: React.FC<ControlsProps> = ({
  isAudioEnabled,
  isVideoEnabled,
  isScreenSharing,
  isAiPanelOpen,
  isRecording,
  backgroundMode,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleAiPanel,
  onToggleRecording,
  onCycleBackground,
  onEndCall,
}) => {
  return (
    <div className="h-20 sm:h-24 bg-gray-900 border-t border-gray-800 flex items-center justify-center gap-4 sm:gap-6 px-4 w-full z-30 overflow-x-auto">
      <ControlButton
        onClick={onToggleAudio}
        isActive={isAudioEnabled}
        icon={isAudioEnabled ? <MicIcon className="w-5 h-5 sm:w-6 sm:h-6" /> : <MicOffIcon className="w-5 h-5 sm:w-6 sm:h-6" />}
        label={isAudioEnabled ? "Mute" : "Unmute"}
      />
      
      <ControlButton
        onClick={onToggleVideo}
        isActive={isVideoEnabled}
        icon={isVideoEnabled ? <VideoIcon className="w-5 h-5 sm:w-6 sm:h-6" /> : <VideoOffIcon className="w-5 h-5 sm:w-6 sm:h-6" />}
        label={isVideoEnabled ? "Stop Video" : "Start Video"}
      />

      <ControlButton
        onClick={onToggleScreenShare}
        isActive={!isScreenSharing}
        icon={isScreenSharing ? <StopShareIcon className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" /> : <ShareScreenIcon className="w-5 h-5 sm:w-6 sm:h-6" />}
        label={isScreenSharing ? "Stop Share" : "Share"}
      />
      
      <ControlButton
        onClick={onToggleRecording}
        isActive={!isRecording}
        pulse={isRecording}
        icon={isRecording ? <StopRecordIcon className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" /> : <RecordIcon className="w-5 h-5 sm:w-6 sm:h-6" />}
        label={isRecording ? "Stop Rec" : "Record"}
      />

      <ControlButton
        onClick={onCycleBackground}
        isActive={backgroundMode !== 'NONE'}
        icon={<BackgroundIcon className={`w-5 h-5 sm:w-6 sm:h-6 ${backgroundMode !== 'NONE' ? 'text-blue-400' : ''}`} />}
        label={backgroundMode === 'NONE' ? "Background" : backgroundMode === 'BLUR' ? "Blur On" : "Image On"}
      />

      <ControlButton
        onClick={onToggleAiPanel}
        isActive={isAiPanelOpen}
        icon={<SparklesIcon className={`w-5 h-5 sm:w-6 sm:h-6 ${isAiPanelOpen ? 'text-purple-400' : ''}`} />}
        label="AI Companion"
      />

      <div className="w-px h-10 bg-gray-700 mx-2 hidden sm:block"></div>

      <ControlButton
        onClick={onEndCall}
        danger
        icon={<PhoneOffIcon className="w-5 h-5 sm:w-6 sm:h-6" />}
        label="End"
      />
    </div>
  );
};

export default Controls;