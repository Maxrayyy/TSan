import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home.js';
import Room from './pages/Room.js';
import Game from './pages/Game.js';
import Result from './pages/Result.js';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:roomId" element={<Room />} />
        <Route path="/game/:roomId" element={<Game />} />
        <Route path="/result/:roomId" element={<Result />} />
      </Routes>
    </BrowserRouter>
  );
}
