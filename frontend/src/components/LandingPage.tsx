import { useEffect, useRef } from 'react';
import './LandingPage.css';

interface LandingPageProps {
  onCreate: () => void;
  onJoin: () => void;
}

export default function LandingPage({ onCreate, onJoin }: LandingPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Animated particle background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const particles: Array<{
      x: number; y: number; vx: number; vy: number;
      size: number; opacity: number;
    }> = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.4 + 0.05,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220, 38, 38, ${p.opacity})`;
        ctx.fill();
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <main className="landing" role="main">
      <canvas ref={canvasRef} className="landing-canvas" aria-hidden="true" />

      <div className="landing-content animate-fade-in">
        <div className="landing-badge">
          <svg className="badge-lock-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>End-to-end encrypted</span>
        </div>

        <h1 className="landing-title">
          <span className="wordmark">DOOM</span>
          <span className="wordmark wordmark-accent">CHAT</span>
        </h1>

        <p className="landing-tagline">
          Create a room. Share the code. Start talking.
        </p>

        <p className="landing-subtitle">
          Temporary rooms. Real-time chat. Zero sign-up.
        </p>

        <div className="landing-actions">
          <button
            id="landing-create-btn"
            className="btn btn-primary btn-lg"
            onClick={onCreate}
            aria-label="Create a new chat room"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create Room
          </button>

          <button
            id="landing-join-btn"
            className="btn btn-secondary btn-lg"
            onClick={onJoin}
            aria-label="Join an existing chat room"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            Join Room
          </button>
        </div>

        <div className="landing-features">
          <div className="feature-item">
            <span className="feature-icon" aria-hidden="true">⚡</span>
            <span>Real-time</span>
          </div>
          <div className="feature-divider" aria-hidden="true" />
          <div className="feature-item">
            <span className="feature-icon" aria-hidden="true">🛡️</span>
            <span>AES-GCM E2EE</span>
          </div>
          <div className="feature-divider" aria-hidden="true" />
          <div className="feature-item">
            <span className="feature-icon" aria-hidden="true">⏳</span>
            <span>Ephemeral</span>
          </div>
        </div>
      </div>

      <footer className="landing-footer">
        <span>DoomChat — zero-storage encrypted rooms</span>
      </footer>
    </main>
  );
}
