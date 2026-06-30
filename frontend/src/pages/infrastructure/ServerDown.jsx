import { useEffect, useState } from "react";
import serverDownIllustration from "../../assets/server-down-illustration.svg";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30
const WINDOW_START_H = 9;  // 9 AM IST
const WINDOW_END_H = 21;   // 9 PM IST

const getISTHour = (now = new Date()) => {
  const istMs = now.getTime() + IST_OFFSET_MS;
  return new Date(istMs).getUTCHours() + new Date(istMs).getUTCMinutes() / 60;
};

const formatISTTime = (now = new Date()) => {
  const istMs = now.getTime() + IST_OFFSET_MS;
  const d = new Date(istMs);
  const h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  const s = String(d.getUTCSeconds()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m}:${s} ${ampm} IST`;
};

const getCountdownToNextWindow = (now = new Date()) => {
  const istMs = now.getTime() + IST_OFFSET_MS;
  const istNow = new Date(istMs);
  const nextStart = new Date(istNow);
  nextStart.setUTCHours(WINDOW_START_H, 0, 0, 0);
  if (istNow.getUTCHours() >= WINDOW_START_H) {
    nextStart.setUTCDate(nextStart.getUTCDate() + 1);
  }
  return Math.max(0, nextStart.getTime() - istNow.getTime());
};

const formatCountdown = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
};

export default function ServerDown() {
  const [now, setNow] = useState(() => new Date());
  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    const tickInterval = setInterval(() => setNow(new Date()), 1000);
    const pulseInterval = setInterval(() => setPulseKey((k) => k + 1), 15000);
    return () => {
      clearInterval(tickInterval);
      clearInterval(pulseInterval);
    };
  }, []);

  const istHour = getISTHour(now);
  const inActiveWindow = istHour >= WINDOW_START_H && istHour < WINDOW_END_H;
  const countdownMs = getCountdownToNextWindow(now);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .sd-root {
          font-family: 'Plus Jakarta Sans', sans-serif;
          min-height: 100vh;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          position: relative;
        }

        .sd-bg {
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse 70% 60% at 10% 100%, rgba(64,123,255,0.07) 0%, transparent 70%),
            radial-gradient(ellipse 60% 50% at 90% 0%, rgba(64,123,255,0.06) 0%, transparent 70%);
          pointer-events: none;
        }

        .sd-grid {
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(64,123,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(64,123,255,0.04) 1px, transparent 1px);
          background-size: 56px 56px;
          pointer-events: none;
        }

        .sd-layout {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          max-width: 1220px;
          width: calc(100% - 56px);
          padding: 56px 0;
          animation: fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) both;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .sd-illus {
          flex: 0 0 540px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .sd-illus img {
          width: 100%;
          max-width: 520px;
          filter: drop-shadow(0 24px 48px rgba(64,123,255,0.12));
        }

        .sd-illus-glow {
          position: absolute;
          width: 320px;
          height: 320px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(64,123,255,0.12) 0%, transparent 70%);
          pointer-events: none;
        }

        .sd-content {
          flex: 1;
          padding-left: 72px;
        }

        .sd-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(64,123,255,0.08);
          border: 1px solid rgba(64,123,255,0.2);
          border-radius: 100px;
          padding: 6px 16px 6px 11px;
          margin-bottom: 28px;
          animation: fadeUp 0.7s 0.1s cubic-bezier(0.16,1,0.3,1) both;
        }

        .sd-badge-dot {
          width: 9px; height: 9px;
          border-radius: 50%;
          background: #407BFF;
          flex-shrink: 0;
          animation: blink 1.4s ease-in-out infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(64,123,255,0.4); }
          50%       { opacity: 0.6; box-shadow: 0 0 0 5px rgba(64,123,255,0); }
        }

        .sd-badge-text {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11.5px;
          font-weight: 500;
          color: #407BFF;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .sd-heading {
          font-size: 52px;
          font-weight: 800;
          color: #0b1537;
          line-height: 1.15;
          letter-spacing: -0.03em;
          margin-bottom: 18px;
          animation: fadeUp 0.7s 0.15s cubic-bezier(0.16,1,0.3,1) both;
        }

        .sd-heading span { color: #407BFF; }

        .sd-body {
          font-size: 20px;
          color: #6b7a9e;
          line-height: 1.7;
          margin-bottom: 36px;
          max-width: 580px;
          font-weight: 400;
          animation: fadeUp 0.7s 0.2s cubic-bezier(0.16,1,0.3,1) both;
        }

        .sd-status-card {
          background: #f8faff;
          border: 1px solid rgba(64,123,255,0.14);
          border-radius: 18px;
          overflow: hidden;
          margin-bottom: 32px;
          animation: fadeUp 0.7s 0.25s cubic-bezier(0.16,1,0.3,1) both;
        }

        .sd-progress-wrap {
          height: 4px;
          background: rgba(64,123,255,0.1);
        }

        .sd-progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #407BFF 0%, #7aaaff 100%);
          border-radius: 0 2px 2px 0;
          animation: progressFill 15s linear infinite;
        }

        @keyframes progressFill {
          0%   { width: 0%; }
          100% { width: 100%; }
        }

        .sd-status-rows { padding: 4px 0; }

        .sd-status-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 24px;
          border-bottom: 1px solid rgba(64,123,255,0.07);
        }
        .sd-status-row:last-child { border-bottom: none; }

        .sd-status-label {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11.5px;
          color: #9bacc8;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          font-weight: 500;
        }

        .sd-status-value {
          font-family: 'JetBrains Mono', monospace;
          font-size: 16px;
          font-weight: 500;
          color: #0b1537;
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .sd-status-value.active { color: #407BFF; }
        .sd-status-value.active::before {
          content: '';
          display: inline-block;
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #407BFF;
          animation: blink 1.4s ease-in-out infinite;
        }

        .sd-info {
          display: flex;
          flex-direction: column;
          gap: 12px;
          animation: fadeUp 0.7s 0.3s cubic-bezier(0.16,1,0.3,1) both;
        }

        .sd-info-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 18px;
          color: #8494b7;
          line-height: 1.65;
        }

        .sd-info-icon {
          width: 22px; height: 22px;
          border-radius: 50%;
          background: rgba(64,123,255,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 2px;
        }
        .sd-info-icon svg { width: 12px; height: 12px; color: #407BFF; }

        .sd-info-item strong { color: #0b1537; font-weight: 600; }

        @media (max-width: 1200px) {
          .sd-layout {
            max-width: 1080px;
          }
          .sd-illus {
            flex: 0 0 470px;
          }
          .sd-illus img {
            max-width: 450px;
          }
          .sd-content {
            padding-left: 56px;
          }
          .sd-heading {
            font-size: 46px;
          }
          .sd-body {
            font-size: 18px;
            max-width: 520px;
          }
          .sd-info-item {
            font-size: 16px;
          }
        }

        @media (max-width: 768px) {
          .sd-layout {
            flex-direction: column;
            text-align: center;
            width: calc(100% - 32px);
            padding: 44px 0;
          }
          .sd-illus { flex: none; width: 100%; }
          .sd-illus img { max-width: 350px; }
          .sd-content { padding-left: 0; padding-top: 32px; }
          .sd-body { max-width: 100%; }
          .sd-badge { margin-left: auto; margin-right: auto; }
          .sd-heading { font-size: 40px; }
          .sd-body { font-size: 18px; }
          .sd-info-item { font-size: 16px; }
          .sd-status-value { font-size: 14px; }
          .sd-info-item { text-align: left; }
        }
      `}</style>

      <div className="sd-root">
        <div className="sd-bg" />
        <div className="sd-grid" />

        <div className="sd-layout">
          <div className="sd-illus">
            <div className="sd-illus-glow" />
            <img src={serverDownIllustration} alt="Server down illustration" />
          </div>

          <div className="sd-content">
            <div className="sd-badge">
              <span className="sd-badge-dot" />
              <span className="sd-badge-text">Backend Status</span>
            </div>

            <h1 className="sd-heading">
              Clyro is <span>{inActiveWindow ? "starting up" : "sleeping"}</span>
            </h1>

            <p className="sd-body">
              Clyro runs on AWS <strong style={{color:"#0b1537"}}>9 AM – 9 PM IST</strong> every day to keep cloud costs low. Come back during those hours and you&apos;ll be all set.
            </p>

            <div className="sd-status-card">
              <div className="sd-progress-wrap">
                <div className="sd-progress-bar" key={pulseKey} />
              </div>
              <div className="sd-status-rows">
                <div className="sd-status-row">
                  <span className="sd-status-label">Service window</span>
                  <span className="sd-status-value">9:00 AM – 9:00 PM IST, daily</span>
                </div>
                <div className="sd-status-row">
                  <span className="sd-status-label">Current IST time</span>
                  <span className="sd-status-value active">{formatISTTime(now)}</span>
                </div>
                <div className="sd-status-row">
                  <span className="sd-status-label">Next active window</span>
                  <span className="sd-status-value">
                    {inActiveWindow ? "Now (starting up…)" : `in ${formatCountdown(countdownMs)}`}
                  </span>
                </div>
                <div className="sd-status-row">
                  <span className="sd-status-label">Status</span>
                  <span className="sd-status-value">
                    {inActiveWindow ? "Starting…" : "Offline (outside service hours)"}
                  </span>
                </div>
              </div>
            </div>

            <div className="sd-info">
              <div className="sd-info-item">
                <div className="sd-info-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span>No action needed. <strong>Come back between 9 AM and 9 PM IST</strong> and the service will be live.</span>
              </div>
              <div className="sd-info-item">
                <div className="sd-info-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <span>Service state: <strong>Offline — resumes at 9:00 AM IST tomorrow</strong>.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
