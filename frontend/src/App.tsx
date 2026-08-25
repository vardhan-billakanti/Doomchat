import { useState, useEffect } from 'react';
import type { AppView, RoomCreatedState, ErrorType } from './types';
import LandingPage from './components/LandingPage';
import CreateRoom from './components/CreateRoom';
import JoinRoom from './components/JoinRoom';
import RoomCreated from './components/RoomCreated';
import ChatRoom from './components/ChatRoom';
import ErrorScreen from './components/ErrorScreen';

// ─────────────────────────────────────────────────────────────────────────────
// App — top-level state machine
// Views: landing → create_form → room_created → chat_room
//         landing → join_form → chat_room
//         any → error
// ─────────────────────────────────────────────────────────────────────────────

interface ChatState {
  roomCode: string;
  nickname: string;
}

interface ErrorState {
  type: ErrorType;
  message: string;
}

export default function App() {
  const [view, setView] = useState<AppView>('landing');
  const [roomCreated, setRoomCreated] = useState<RoomCreatedState | null>(null);
  const [chatState, setChatState] = useState<ChatState | null>(null);
  const [errorState, setErrorState] = useState<ErrorState | null>(null);
  const [prefillCode, setPrefillCode] = useState('');

  // Check URL for ?join=CODE on load (from Share link)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    if (joinCode) {
      setPrefillCode(joinCode.toUpperCase());
      setView('join_form');
      // Clean the URL without reloading
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleRoomCreated = (roomCode: string, nickname: string) => {
    setRoomCreated({ roomCode, nickname });
    setView('room_created');
  };

  const handleEnterRoom = () => {
    if (!roomCreated) return;
    setChatState({ roomCode: roomCreated.roomCode, nickname: roomCreated.nickname });
    setView('chat_room');
  };

  const handleJoined = (roomCode: string, nickname: string) => {
    setChatState({ roomCode, nickname });
    setView('chat_room');
  };

  const handleLeave = () => {
    setChatState(null);
    setView('landing');
  };

  const handleDisbanded = (message: string) => {
    setErrorState({
      type: 'room_disbanded',
      message,
    });
    setChatState(null);
    setView('error');
  };

  const handleGoHome = () => {
    setView('landing');
    setErrorState(null);
    setChatState(null);
    setRoomCreated(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  switch (view) {
    case 'landing':
      return (
        <LandingPage
          onCreate={() => setView('create_form')}
          onJoin={() => setView('join_form')}
        />
      );

    case 'create_form':
      return (
        <CreateRoom
          onRoomCreated={handleRoomCreated}
          onBack={() => setView('landing')}
        />
      );

    case 'join_form':
      return (
        <JoinRoom
          onJoined={handleJoined}
          onBack={() => setView('landing')}
          prefillCode={prefillCode}
        />
      );

    case 'room_created':
      if (!roomCreated) return null;
      return (
        <RoomCreated
          roomCode={roomCreated.roomCode}
          nickname={roomCreated.nickname}
          onEnterRoom={handleEnterRoom}
          onBack={handleGoHome}
        />
      );

    case 'chat_room':
      if (!chatState) return null;
      return (
        <ChatRoom
          roomCode={chatState.roomCode}
          nickname={chatState.nickname}
          onLeave={handleLeave}
          onDisbanded={handleDisbanded}
        />
      );

    case 'error':
      return (
        <ErrorScreen
          type={errorState?.type ?? 'server_error'}
          message={errorState?.message ?? 'An unexpected error occurred.'}
          onGoHome={handleGoHome}
        />
      );

    default:
      return null;
  }
}
