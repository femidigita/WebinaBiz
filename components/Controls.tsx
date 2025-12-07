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
  <div className="flex flex-col items-center justify-center gap-1 group min-w-[3rem] sm:min-w-0">
    <button
      onClick={onClick}
      className={`p-2 sm:p-4 rounded-xl transition-all duration-200 shadow-sm ${
        danger 
          ? 'bg-red-600 hover:bg-red-700 text-white' 
          : isActive 
            ? 'bg-gray-700 hover:bg-gray-600 text-white'
            : 'bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500/20'
      } ${pulse ? 'animate-pulse ring-2 ring-red-500 ring-offset-2 ring-offset-gray-900' : ''}`}
      title={label}
    >
      {React.cloneElement(icon as React.ReactElement, { 
        className: "w-5 h-5 sm:w-6 sm:h-6" // Force icon size
      })}
    </button>
    <span className="hidden sm:block text-[10px] sm:text-xs text-gray-400 group-hover:text-white transition-colors font-medium whitespace-nowrap">
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
    <div className="
      absolute bottom-12 left-1/2 -translate-x-1/2 w-[95%] max-w-lg z-50
      bg-gray-900/90 backdrop-blur-md border border-gray-700 rounded-2xl shadow-2xl
      flex items-center justify-between px-3 py-3 overflow-x-auto no-scrollbar
      sm:static sm:translate-x-0 sm:w-full sm:max-w-none sm:rounded-none sm:border-x-0 sm:border-b-0 sm:bg-gray-900 sm:h-24 sm:justify-center sm:py-0
    ">
      <div className="flex items-center gap-2 sm:gap-6 mx-auto w-full sm:w-auto justify-between sm:justify-center">
        <ControlButton
          onClick={onToggleAudio}
          isActive={isAudioEnabled}
          icon={isAudioEnabled ? <MicIcon /> : <MicOffIcon />}
          label={isAudioEnabled ? "Mute" : "Unmute"}
        />
        
        <ControlButton
          onClick={onToggleVideo}
          isActive={isVideoEnabled}
          icon={isVideoEnabled ? <VideoIcon /> : <VideoOffIcon />}
          label={isVideoEnabled ? "Stop Video" : "Start Video"}
        />

        <ControlButton
          onClick={onToggleScreenShare}
          isActive={!isScreenSharing}
          icon={isScreenSharing ? <StopShareIcon className="text-green-400" /> : <ShareScreenIcon />}
          label={isScreenSharing ? "Stop Share" : "Share"}
        />
        
        <ControlButton
          onClick={onToggleRecording}
          isActive={!isRecording}
          pulse={isRecording}
          icon={isRecording ? <StopRecordIcon className="text-red-400" /> : <RecordIcon />}
          label={isRecording ? "Stop Rec" : "Record"}
        />

        <ControlButton
          onClick={onCycleBackground}
          isActive={backgroundMode !== 'NONE'}
          icon={<BackgroundIcon className={backgroundMode !== 'NONE' ? 'text-blue-400' : ''} />}
          label={backgroundMode === 'NONE' ? "Background" : backgroundMode === 'BLUR' ? "Blur On" : "Image On"}
        />

        <ControlButton
          onClick={onToggleAiPanel}
          isActive={isAiPanelOpen}
          icon={<SparklesIcon className={isAiPanelOpen ? 'text-purple-400' : ''} />}
          label="AI Companion"
        />

        <div className="w-px h-8 bg-gray-700 mx-1 hidden sm:block"></div>

        <ControlButton
          onClick={onEndCall}
          danger
          icon={<PhoneOffIcon />}
          label="End"
        />
      </div>
    </div>
  );
};

export default Controls;