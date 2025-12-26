import React, { useState, useEffect, useRef } from 'react';

// TypeScript Interfaces
interface AnalysisResult {
  total_grains: number;
  whole_grains: number;
  broken_grains: number;
  broken_percentage: number;
  avg_model_confidence: number;
  processed_image: string;
}

const RiceGuardApp: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const particlesRef = useRef<HTMLDivElement>(null);

  // Create floating particles on mount
  useEffect(() => {
    const container = particlesRef.current;
    if (!container) return;

    for (let i = 0; i < 60; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.cssText = `
        position: absolute;
        width: 4px;
        height: 4px;
        background: #10b981;
        border-radius: 50%;
        box-shadow: 0 0 10px #10b981, 0 0 20px #10b981;
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 100}%;
        animation: floatParticle ${10 + Math.random() * 10}s infinite ease-in-out;
        animation-delay: ${Math.random() * 15}s;
      `;
      container.appendChild(particle);
    }
  }, []);

  // Mouse follower effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Primary dots
      if (Math.random() > 0.3) {
        createMouseDot(e.clientX, e.clientY, 12, 1500);
      }

      // Scattered particles
      if (Math.random() > 0.5) {
        const offsetX = Math.random() * 60 - 30;
        const offsetY = Math.random() * 60 - 30;
        const size = Math.random() * 10 + 4;
        createMouseDot(e.clientX + offsetX, e.clientY + offsetY, size, 1200);
      }

      // Dense trail
      for (let i = 0; i < 2; i++) {
        const offsetX = Math.random() * 20 - 10;
        const offsetY = Math.random() * 20 - 10;
        createMouseDot(e.clientX + offsetX, e.clientY + offsetY, 6, 800);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const createMouseDot = (x: number, y: number, size: number, duration: number) => {
    const dot = document.createElement('div');
    dot.style.cssText = `
      position: fixed;
      width: ${size}px;
      height: ${size}px;
      background: #10b981;
      border-radius: 50%;
      left: ${x - size / 2}px;
      top: ${y - size / 2}px;
      pointer-events: none;
      z-index: 9999;
      box-shadow: 0 0 15px #10b981, 0 0 30px #10b981, 0 0 45px #10b981;
      animation: fadeDot 1.5s ease-out forwards;
    `;
    document.body.appendChild(dot);
    setTimeout(() => dot.remove(), duration);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError('');
      setResults(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setError('');
      setResults(null);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setError('');
    setResults(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let message = `Server error: ${response.status}`;
        try {
          const errBody = await response.json();
          if (errBody && typeof errBody === 'object' && 'detail' in errBody) {
            const detail = (errBody as any).detail;
            if (typeof detail === 'string' && detail.trim().length > 0) {
              message = detail;
            } else {
              message = JSON.stringify(errBody);
            }
          } else {
            message = JSON.stringify(errBody);
          }
        } catch {
          try {
            const text = await response.text();
            if (text && text.trim().length > 0) {
              message = text;
            }
          } catch {
            // ignore
          }
        }
        throw new Error(message);
      }

      const data: AnalysisResult = await response.json();
      setResults(data);

      setTimeout(() => {
        document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    } catch (err) {
      setError(`Analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}. Please check your connection and try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <style>{`
        @keyframes floatParticle {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0; }
          10% { opacity: 1; }
          50% { transform: translate(50vw, 50vh) scale(1.5); opacity: 0.8; }
          90% { opacity: 1; }
          100% { transform: translate(100vw, 100vh) scale(1); opacity: 0; }
        }

        @keyframes fadeDot {
          to { opacity: 0; transform: scale(3); }
        }

        @keyframes logoPulse {
          0%, 100% { transform: scale(1) rotate(0deg); box-shadow: 0 0 20px rgba(16, 185, 129, 0.6), 0 0 40px rgba(16, 185, 129, 0.4); }
          50% { transform: scale(1.08) rotate(5deg); box-shadow: 0 0 30px rgba(16, 185, 129, 0.8), 0 0 60px rgba(16, 185, 129, 0.6); }
        }

        @keyframes typing {
          0%, 100% { width: 0; }
          30%, 70% { width: 100%; }
        }

        @keyframes blink {
          50% { border-color: transparent; }
        }

        @keyframes floatCredit {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        @keyframes pulseGlow {
          0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 15px #10b981, 0 0 30px #10b981; }
          50% { opacity: 0.7; transform: scale(1.4); box-shadow: 0 0 25px #10b981, 0 0 50px #10b981; }
        }

        @keyframes iconBounce {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-8px) rotate(-10deg); }
          75% { transform: translateY(-8px) rotate(10deg); }
        }

        @keyframes rotateGradient {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes floatRotateGlow {
          0%, 100% { transform: translateY(0) rotate(0deg); box-shadow: 0 0 30px rgba(16, 185, 129, 0.6), 0 0 60px rgba(16, 185, 129, 0.4); }
          25% { transform: translateY(-15px) rotate(-10deg); box-shadow: 0 0 40px rgba(16, 185, 129, 0.8), 0 0 80px rgba(16, 185, 129, 0.6); }
          75% { transform: translateY(-15px) rotate(10deg); box-shadow: 0 0 40px rgba(16, 185, 129, 0.8), 0 0 80px rgba(16, 185, 129, 0.6); }
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.8) rotate(-5deg); }
          to { opacity: 1; transform: scale(1) rotate(0deg); }
        }

        @keyframes iconBounceWhite {
          0%, 100% { transform: translateY(0) scale(1); filter: drop-shadow(0 0 15px rgba(255, 255, 255, 0.8)) drop-shadow(0 0 30px rgba(255, 255, 255, 0.5)); }
          50% { transform: translateY(-10px) scale(1.1); filter: drop-shadow(0 0 25px rgba(255, 255, 255, 1)) drop-shadow(0 0 50px rgba(255, 255, 255, 0.8)); }
        }

        @keyframes iconBounceRed {
          0%, 100% { transform: translateY(0) rotate(0deg) scale(1); filter: drop-shadow(0 0 15px rgba(239, 68, 68, 0.8)) drop-shadow(0 0 30px rgba(239, 68, 68, 0.5)); }
          50% { transform: translateY(-10px) rotate(10deg) scale(1.1); filter: drop-shadow(0 0 25px rgba(239, 68, 68, 1)) drop-shadow(0 0 50px rgba(239, 68, 68, 0.8)); }
        }

        @keyframes iconBounceGreen {
          0%, 100% { transform: translateY(0) rotate(0deg) scale(1); filter: drop-shadow(0 0 15px rgba(16, 185, 129, 0.8)) drop-shadow(0 0 30px rgba(16, 185, 129, 0.5)); }
          50% { transform: translateY(-10px) rotate(-10deg) scale(1.1); filter: drop-shadow(0 0 25px rgba(16, 185, 129, 1)) drop-shadow(0 0 50px rgba(16, 185, 129, 0.8)); }
        }

        @keyframes iconSpinWhite {
          0% { transform: rotate(0deg) scale(1); filter: drop-shadow(0 0 15px rgba(255, 255, 255, 0.8)) drop-shadow(0 0 30px rgba(255, 255, 255, 0.5)); }
          50% { transform: rotate(180deg) scale(1.1); filter: drop-shadow(0 0 25px rgba(255, 255, 255, 1)) drop-shadow(0 0 50px rgba(255, 255, 255, 0.8)); }
          100% { transform: rotate(360deg) scale(1); filter: drop-shadow(0 0 15px rgba(255, 255, 255, 0.8)) drop-shadow(0 0 30px rgba(255, 255, 255, 0.5)); }
        }

        @keyframes legendPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.3); }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          background: #ffffff;
          color: #1a1a1a;
          overflow-x: hidden;
        }

        .app-container {
          min-height: 100vh;
          position: relative;
        }

        .particles-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 0;
        }

        .header {
          background: #1a1a1a;
          padding: 20px 24px;
          border-bottom: 1px solid #2a2a2a;
          position: sticky;
          top: 0;
          z-index: 100;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logo {
          width: 52px;
          height: 52px;
          background: #1a1a1a;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 900;
          color: #ffffff;
          border: 2px solid #10b981;
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.6), 0 0 40px rgba(16, 185, 129, 0.4);
          animation: logoPulse 3s ease-in-out infinite;
        }

        .brand-text h1 {
          font-size: 1.3rem;
          font-weight: 700;
          color: #ffffff;
          text-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
          overflow: hidden;
          white-space: nowrap;
          border-right: 3px solid #10b981;
          animation: typing 3s steps(10) infinite, blink 0.75s step-end infinite;
        }

        .brand-text p {
          font-size: 0.75rem;
          color: #10b981;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          font-weight: 600;
          text-shadow: 0 0 10px rgba(16, 185, 129, 0.8);
        }

        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 24px;
          position: relative;
          z-index: 1;
        }

        .status-badge {
          background: #1a1a1a;
          border-radius: 16px;
          padding: 16px 24px;
          text-align: center;
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.2);
          margin-bottom: 24px;
          animation: fadeIn 0.5s ease;
          border: 1px solid #10b981;
        }

        .status-text {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-weight: 600;
          color: #10b981;
          text-shadow: 0 0 10px rgba(16, 185, 129, 0.8);
        }

        .status-dot {
          width: 10px;
          height: 10px;
          background: #10b981;
          border-radius: 50%;
          animation: pulseGlow 1.5s ease-in-out infinite;
        }

        .card {
          background: #1a1a1a;
          border-radius: 20px;
          padding: 32px 24px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2), 0 0 40px rgba(16, 185, 129, 0.1);
          margin-bottom: 24px;
          animation: fadeIn 0.5s ease;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .card-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 1.1rem;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 24px;
          text-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
        }

        .card-icon {
          font-size: 1.5rem;
          animation: iconBounce 2s ease-in-out infinite;
          filter: drop-shadow(0 0 10px #10b981);
        }

        .upload-area {
          border: 2px dashed #3a3a3a;
          border-radius: 16px;
          padding: 48px 24px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.02);
        }

        .upload-area.dragging {
          border-color: #10b981;
          background: rgba(16, 185, 129, 0.1);
          transform: scale(1.02);
          box-shadow: 0 0 40px rgba(16, 185, 129, 0.5);
        }

        .upload-area:hover {
          border-color: #10b981;
          background: rgba(16, 185, 129, 0.05);
          transform: translateY(-2px);
          box-shadow: 0 0 30px rgba(16, 185, 129, 0.3);
        }

        .upload-icon {
          width: 70px;
          height: 70px;
          margin: 0 auto 16px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          animation: floatRotateGlow 4s ease-in-out infinite;
        }

        .upload-text {
          font-size: 1.05rem;
          font-weight: 600;
          color: #ffffff;
          margin-bottom: 8px;
          text-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
        }

        .upload-hint {
          font-size: 0.875rem;
          color: #9ca3af;
        }

        .file-info {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 16px;
          padding: 12px;
          background: rgba(16, 185, 129, 0.1);
          border-radius: 12px;
          font-size: 0.9rem;
          color: #10b981;
          animation: slideIn 0.3s ease;
          border: 1px solid rgba(16, 185, 129, 0.3);
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.2);
        }

        .tip {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-top: 16px;
          padding: 12px;
          background: rgba(16, 185, 129, 0.05);
          border-radius: 12px;
          font-size: 0.85rem;
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.2);
          text-shadow: 0 0 5px rgba(16, 185, 129, 0.3);
        }

        .analyze-btn {
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          border: none;
          border-radius: 12px;
          color: white;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          margin-top: 24px;
          box-shadow: 0 0 30px rgba(16, 185, 129, 0.5), 0 4px 20px rgba(16, 185, 129, 0.4);
          position: relative;
          overflow: hidden;
        }

        .analyze-btn:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 0 50px rgba(16, 185, 129, 0.8), 0 6px 30px rgba(16, 185, 129, 0.6);
        }

        .analyze-btn:disabled {
          background: #3a3a3a;
          color: #6b7280;
          cursor: not-allowed;
          box-shadow: none;
        }

        .loading-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(26, 26, 26, 0.98);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .spinner {
          width: 70px;
          height: 70px;
          border: 5px solid #2a2a2a;
          border-top-color: #10b981;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 16px;
          box-shadow: 0 0 30px rgba(16, 185, 129, 0.6), 0 0 60px rgba(16, 185, 129, 0.4);
        }

        .loading-text {
          font-size: 1.1rem;
          font-weight: 600;
          color: #ffffff;
          text-shadow: 0 0 15px rgba(16, 185, 129, 0.8);
        }

        .error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid #ef4444;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 24px;
          color: #fca5a5;
          font-size: 0.9rem;
          animation: shake 0.5s ease;
          box-shadow: 0 0 20px rgba(239, 68, 68, 0.3);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .metric-box {
          background: linear-gradient(135deg, #2a2a2a 0%, #1f1f1f 100%);
          padding: 24px 16px;
          border-radius: 16px;
          text-align: center;
          border: 1px solid rgba(16, 185, 129, 0.3);
          transition: all 0.3s ease;
          animation: scaleIn 0.4s ease;
          position: relative;
          overflow: hidden;
        }

        .metric-box:hover {
          transform: translateY(-6px);
          box-shadow: 0 0 30px rgba(16, 185, 129, 0.4);
          border-color: #10b981;
        }

        .metric-box:nth-child(1) { animation-delay: 0.1s; }
        .metric-box:nth-child(2) { animation-delay: 0.2s; }
        .metric-box:nth-child(3) { animation-delay: 0.3s; }
        .metric-box:nth-child(4) { animation-delay: 0.4s; }

        .metric-icon {
          font-size: 2.5rem;
          margin-bottom: 12px;
          display: inline-block;
        }

        .metric-box:nth-child(1) .metric-icon {
          animation: iconBounceWhite 2s ease-in-out infinite;
        }

        .metric-box:nth-child(2) .metric-icon {
          animation: iconBounceRed 2s ease-in-out infinite;
        }

        .metric-box:nth-child(3) .metric-icon {
          animation: iconBounceGreen 2s ease-in-out infinite;
        }

        .metric-box:nth-child(4) .metric-icon {
          animation: iconSpinWhite 3s linear infinite;
        }

        .metric-value {
          font-size: 2.5rem;
          font-weight: 800;
          margin-bottom: 4px;
          line-height: 1;
        }

        .metric-box:nth-child(1) .metric-value {
          color: #ffffff;
          text-shadow: 0 0 20px rgba(255, 255, 255, 0.8), 0 0 40px rgba(255, 255, 255, 0.5);
        }

        .metric-box:nth-child(2) .metric-value {
          color: #ef4444;
          text-shadow: 0 0 20px rgba(239, 68, 68, 0.8), 0 0 40px rgba(239, 68, 68, 0.5);
        }

        .metric-box:nth-child(3) .metric-value {
          color: #10b981;
          text-shadow: 0 0 20px rgba(16, 185, 129, 0.8), 0 0 40px rgba(16, 185, 129, 0.5);
        }

        .metric-box:nth-child(4) .metric-value {
          color: #ffffff;
          text-shadow: 0 0 20px rgba(255, 255, 255, 0.8), 0 0 40px rgba(255, 255, 255, 0.5);
        }

        .metric-label {
          font-size: 0.8rem;
          color: #9ca3af;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .result-image {
          width: 100%;
          border-radius: 16px;
          box-shadow: 0 0 40px rgba(16, 185, 129, 0.3);
          border: 2px solid rgba(16, 185, 129, 0.4);
          transition: transform 0.3s ease;
        }

        .result-image:hover {
          transform: scale(1.02);
          box-shadow: 0 0 60px rgba(16, 185, 129, 0.5);
        }

        .legend {
          display: flex;
          justify-content: center;
          gap: 24px;
          margin-top: 16px;
          padding: 12px;
          background: #2a2a2a;
          border-radius: 12px;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.875rem;
          font-weight: 600;
          color: #ffffff;
        }

        .legend-dot {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          animation: legendPulse 1.5s ease-in-out infinite;
        }

        .legend-dot.green {
          background: #10b981;
          box-shadow: 0 0 15px #10b981, 0 0 30px #10b981;
        }

        .legend-dot.red {
          background: #ef4444;
          box-shadow: 0 0 15px #ef4444, 0 0 30px #ef4444;
        }

        .footer-credit {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: rgba(26, 26, 26, 0.95);
          padding: 10px 16px;
          border-radius: 20px;
          font-size: 0.75rem;
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.3);
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.3);
          z-index: 1000;
          animation: floatCredit 3s ease-in-out infinite;
        }

        input[type="file"] {
          display: none;
        }

        @media (max-width: 480px) {
          .container {
            padding: 16px;
          }
          .card {
            padding: 24px 16px;
          }
          .metrics-grid {
            gap: 12px;
          }
          .metric-value {
            font-size: 2rem;
          }
          .footer-credit {
            bottom: 10px;
            right: 10px;
            font-size: 0.65rem;
            padding: 8px 12px;
          }
        }
      `}</style>

      {/* Particles Container */}
      <div className="particles-container" ref={particlesRef}></div>

      {/* Header */}
      <div className="header">
        <div className="brand">
          <div className="logo">Qi</div>
          <div className="brand-text">
            <h1>RiceGuard</h1>
            <p>Quality AI</p>
          </div>
        </div>
      </div>

      <div className="container">
        {/* System Status */}
        <div className="status-badge">
          <div className="status-text">
            <span className="status-dot"></span>
            <span>System Operational</span>
          </div>
        </div>

        {/* Upload Card */}
        <div className="card">
          <div className="card-title">
            <span className="card-icon">📥</span>
            Input Source
          </div>

          <label htmlFor="fileInput">
            <div
              className={`upload-area ${isDragging ? 'dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="upload-icon">📤</div>
              <div className="upload-text">Click to upload or drag and drop</div>
              <div className="upload-hint">Supports JPG, PNG (High contrast background recommended)</div>
            </div>
          </label>
          <input
            type="file"
            id="fileInput"
            accept="image/*"
            onChange={handleFileChange}
          />

          {selectedFile && (
            <div className="file-info">
              <span>✓</span>
              <span>{selectedFile.name}</span>
            </div>
          )}

          <div className="tip">
            <span>💡</span>
            <span>For best results, use a dark, solid background.</span>
          </div>

          <button
            className="analyze-btn"
            disabled={!selectedFile || loading}
            onClick={handleAnalyze}
          >
            Analyze Image
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Results */}
        {results && (
          <div id="results">
            <div className="card">
              <div className="card-title">
                <span className="card-icon">📊</span>
                Analysis Results
              </div>

              <div className="metrics-grid">
                <div className="metric-box">
                  <div className="metric-icon">🌾</div>
                  <div className="metric-value">{results.total_grains}</div>
                  <div className="metric-label">Total Grains</div>
                </div>
                <div className="metric-box">
                  <div className="metric-icon">💔</div>
                  <div className="metric-value">{results.broken_grains}</div>
                  <div className="metric-label">Broken Grains</div>
                </div>
                <div className="metric-box">
                  <div className="metric-icon">✨</div>
                  <div className="metric-value">{results.whole_grains}</div>
                  <div className="metric-label">Whole Grains</div>
                </div>
                <div className="metric-box">
                  <div className="metric-icon">📊</div>
                  <div className="metric-value">{results.broken_percentage.toFixed(1)}%</div>
                  <div className="metric-label">Broken %</div>
                </div>
              </div>

              <div className="image-result">
                <img
                  src={`data:image/jpeg;base64,${results.processed_image}`}
                  alt="Annotated results"
                  className="result-image"
                />
                <div className="legend">
                  <div className="legend-item">
                    <div className="legend-dot green"></div>
                    <span>Whole</span>
                  </div>
                  <div className="legend-item">
                    <div className="legend-dot red"></div>
                    <span>Broken</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Credit */}
      <div className="footer-credit">
        Done by Akash
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="loading-overlay">
          <div style={{ textAlign: 'center' }}>
            <div className="spinner"></div>
            <div className="loading-text">Analyzing image...</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RiceGuardApp;
