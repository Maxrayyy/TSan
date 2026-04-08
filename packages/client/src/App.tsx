import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home.js';
import Login from './pages/Login.js';
import Room from './pages/Room.js';
import Game from './pages/Game.js';
import Result from './pages/Result.js';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/room/:roomId" element={<Room />} />
        <Route path="/join/:roomId" element={<JoinRedirect />} />
        <Route path="/game/:roomId" element={<Game />} />
        <Route path="/result/:roomId" element={<Result />} />
      </Routes>
    </BrowserRouter>
  );
}

function JoinRedirect() {
  const roomId = window.location.pathname.split('/join/')[1];
  return <Navigate to={`/room/${roomId}`} replace />;
}
