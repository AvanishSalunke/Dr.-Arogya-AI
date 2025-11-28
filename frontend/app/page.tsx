"use client";
import React, { useState, useEffect, useRef } from 'react';
import ChatMap from '@/components/ChatMap';
import { v4 as uuidv4 } from 'uuid';

// --- TYPES ---
interface Message {
  id: number;
  sender: 'user' | 'ai';
  text: string;
}

interface ChatState {
  is_final: boolean;
  status: string;
  voice_response: string;
  treatment_plan?: string;
  map_data?: any;
}

export default function ChatApp() {
  // --- STATE ---
  const [isMounted, setIsMounted] = useState(false); // 🔑 Fixes Hydration Error
  const [messages, setMessages] = useState<Message[]>([]);
  const [listening, setListening] = useState(false);
  const [sessionId] = useState<string>(uuidv4()); 
  const [chatStatus, setChatStatus] = useState<ChatState>({
    is_final: false,
    status: 'INTAKE_START',
    voice_response: "Hello, I am Dr. Arogya. How can I help you today?"
  });
  const [inputMessage, setInputMessage] = useState('');
  const [userLang, setUserLang] = useState('en-US');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Refs
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- 1. INITIALIZATION & HYDRATION FIX ---
  useEffect(() => {
    setIsMounted(true); // Signal that we are on the client

    // A. Setup Speech Recognition (Browser Only)
    if (typeof window !== 'undefined') {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
        }
    }

    // B. Load Voices (Fix for "Only Speaking English")
    const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
            setAvailableVoices(voices);
        }
    };

    // Chrome loads voices asynchronously, so we must listen for the event
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices(); // Try immediately in case they are already there

    return () => {
        if (recognitionRef.current) recognitionRef.current.stop();
        window.speechSynthesis.cancel();
    }
  }, []);

  // --- 2. INITIAL GREETING ---
  // We use a separate effect to speak the greeting ONLY once voices are loaded
  useEffect(() => {
    if (isMounted && availableVoices.length > 0 && messages.length === 0) {
        const initialMsg: Message = { id: 1, sender: 'ai', text: chatStatus.voice_response };
        setMessages([initialMsg]);
        // Small delay to ensure UI is ready
        setTimeout(() => speak(chatStatus.voice_response, 'en-US'), 500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, availableVoices]); // Run when voices are finally loaded

  // --- 3. ROBUST TTS FUNCTION ---
  const speak = (text: string, langCode: string) => {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    // INTELLIGENT VOICE MATCHING
    // 1. Exact match (e.g., 'hi-IN')
    let selectedVoice = availableVoices.find(v => v.lang === langCode);
    
    // 2. Loose match (e.g., 'hi' matches 'hi-IN')
    if (!selectedVoice) {
        const baseLang = langCode.split('-')[0];
        selectedVoice = availableVoices.find(v => v.lang.startsWith(baseLang));
    }

    // 3. Fallback to Google versions specifically (common in Chrome)
    if (!selectedVoice && langCode.startsWith('hi')) {
        selectedVoice = availableVoices.find(v => v.name.includes('Google Hindi'));
    }

    if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
    } 

    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  // --- 4. SEND MESSAGE ---
  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = { id: Date.now(), sender: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    window.speechSynthesis.cancel();

    try {
      const res = await fetch('http://127.0.0.1:5000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: sessionId }),
      });

      const data: ChatState = await res.json();
      setChatStatus(data);

      const aiText = data.voice_response || data.treatment_plan || "Processing...";
      const aiMsg: Message = { id: Date.now() + 1, sender: 'ai', text: aiText };
      setMessages(prev => [...prev, aiMsg]);

      // Speak result in the USER'S selected language
      speak(data.voice_response, userLang);

    } catch (err) {
      console.error(err);
      const errMsg: Message = { id: Date.now() + 1, sender: 'ai', text: "Connection Error. Is the backend running?" };
      setMessages(prev => [...prev, errMsg]);
    }
  };

  // --- 5. MICROPHONE HANDLER ---
  const toggleMic = () => {
    if (!recognitionRef.current) {
      alert("Speech Recognition not available.");
      return;
    }

    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      // FORCE LANGUAGE UPDATE
      recognitionRef.current.lang = userLang;
      recognitionRef.current.start();
      setListening(true);

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputMessage(transcript);
        // Optional: Auto send
        // sendMessage(transcript);
      };
      
      recognitionRef.current.onend = () => setListening(false);
      recognitionRef.current.onerror = (e: any) => {
          console.error("Mic Error", e); 
          setListening(false);
      };
    }
  };

  useEffect(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight), [messages]);

  // --- RENDER ---
  // 🔑 KEY FIX: If we are not mounted yet, render NOTHING. 
  // This prevents the server HTML (which has no knowledge of window) 
  // from mismatching the client HTML.
  if (!isMounted) {
      return <div className="h-screen bg-slate-900 flex items-center justify-center text-blue-400">Loading Arogya.AI...</div>;
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white font-sans">
      <div className="w-full max-w-4xl mx-auto flex flex-col h-full shadow-2xl overflow-hidden border-x border-slate-700">
        
        {/* Header */}
        <div className="bg-slate-900/80 backdrop-blur-md p-4 border-b border-slate-700 flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/50">
              <span className="text-2xl">🩺</span>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-teal-400">
                Arogya.AI
              </h1>
              <p className="text-xs text-slate-400">Advanced Medical Triage Agent</p>
            </div>
          </div>
          
          <select 
            value={userLang} 
            onChange={(e) => setUserLang(e.target.value)}
            className="bg-slate-800 text-sm border border-slate-600 rounded-lg px-3 py-1 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="en-US">🇬🇧 English</option>
            <option value="hi-IN">🇮🇳 Hindi</option>
            <option value="mr-IN">🚩 Marathi</option>
          </select>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-900/50" ref={scrollRef}>
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.sender === 'ai' && (
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center mr-2 mt-1 text-xs">AI</div>
              )}
              <div className={`max-w-[80%] p-4 rounded-2xl shadow-md ${
                msg.sender === 'user' 
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-tr-none' 
                  : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-none'
              }`}>
                <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))}

          {/* Final Plan */}
          {chatStatus.is_final && (
            <div className="mt-6 p-6 bg-emerald-900/30 border border-emerald-500/30 rounded-xl animate-fade-in">
              <h2 className="text-xl font-bold text-emerald-400 mb-4 flex items-center gap-2">
                ✅ Diagnosis & Treatment Plan
              </h2>
              <div className="bg-slate-950/50 p-4 rounded-lg text-sm text-slate-300 whitespace-pre-wrap leading-7 border border-slate-800">
                {chatStatus.treatment_plan || "No detailed plan available."}
              </div>
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-blue-400 mb-2">📍 Suggested Clinics Nearby</h3>
                {chatStatus.map_data 
                  ? <ChatMap mapData={chatStatus.map_data} />
                  : <p className="text-slate-400">Location data is currently unavailable.</p>
                }
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-slate-900 border-t border-slate-700">
          <div className="flex items-center gap-3 bg-slate-800 p-2 rounded-full border border-slate-600 focus-within:border-blue-500 transition-all">
            <button
              onClick={toggleMic}
              // This is safe now because 'recognitionRef.current' is checked inside toggleMic
              // and we are definitely on the client side.
              disabled={chatStatus.is_final} 
              className={`p-3 rounded-full transition-all duration-300 ${
                listening 
                  ? 'bg-red-500 shadow-lg shadow-red-500/50 animate-pulse' 
                  : 'bg-slate-700 hover:bg-slate-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span className="text-xl">🎙️</span>
            </button>

            <input
              type="text"
              className="flex-1 bg-transparent text-white placeholder-slate-400 px-2 focus:outline-none"
              placeholder={listening ? "Listening..." : chatStatus.is_final ? "Triage complete." : "Type your symptoms..."}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage(inputMessage)}
              disabled={chatStatus.is_final} 
            />

            <button
              onClick={() => sendMessage(inputMessage)}
              disabled={!inputMessage.trim() || chatStatus.is_final}
              className="p-3 bg-blue-600 rounded-full hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-95"
            >
              ➡️
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}