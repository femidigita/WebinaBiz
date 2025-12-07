import React, { useState, useRef, useEffect } from 'react';
import { SendIcon, SparklesIcon } from './Icons';
import { ChatMessage } from '../types';
import { geminiService } from '../services/geminiService';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'Hello! I am your AI Webinar Assistant. How can I help you today?',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userText = inputValue.trim();
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: userText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newMessage]);
    setInputValue('');
    setIsLoading(true);

    const tempId = 'temp-ai-response';
    // Add placeholder for AI response
    setMessages(prev => [
      ...prev, 
      { id: tempId, role: 'model', text: '', timestamp: new Date() }
    ]);

    try {
        await geminiService.sendMessageStream(userText, (streamText) => {
            setMessages(prev => prev.map(msg => 
                msg.id === tempId ? { ...msg, text: streamText } : msg
            ));
        });
        // Update ID after completion to finalize
        setMessages(prev => prev.map(msg => 
            msg.id === tempId ? { ...msg, id: Date.now().toString() } : msg
        ));
    } catch (e) {
        setMessages(prev => prev.map(msg => 
            msg.id === tempId ? { ...msg, text: "Sorry, I encountered an error." } : msg
        ));
    } finally {
        setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-full md:w-80 bg-gray-900 border-l border-gray-700 flex flex-col h-[100dvh] md:h-full absolute right-0 top-0 z-20 md:relative md:border-l-0 shadow-xl md:shadow-none">
      <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800 shrink-0">
        <h3 className="font-semibold flex items-center gap-2">
          <SparklesIcon className="w-5 h-5 text-purple-400" />
          AI Assistant
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white md:hidden p-2">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-gray-800 text-gray-200 border border-gray-700 rounded-bl-none'
              }`}
            >
              {msg.text}
            </div>
            <span className="text-[10px] text-gray-500 mt-1">
              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        {isLoading && messages.length > 0 && messages[messages.length-1].text === '' && (
            <div className="flex items-start">
               <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-bl-none px-4 py-2 text-sm text-gray-400 animate-pulse">
                  Thinking...
               </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-gray-800 border-t border-gray-700 shrink-0 mb-safe">
        <div className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI assistant..."
            disabled={isLoading}
            className="w-full bg-gray-900 border border-gray-600 rounded-full pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:opacity-50 text-white"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-purple-600 rounded-full hover:bg-purple-700 disabled:opacity-50 disabled:hover:bg-purple-600 transition-colors"
          >
            <SendIcon className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;