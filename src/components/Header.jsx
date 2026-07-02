import React from 'react'

export default function Header() {
  return (
    <div className="text-center mb-4 animate-fade-in">
      <div className="flex items-center justify-center gap-2 mb-1">
        {/* Logo 区域 */}
        <a
          href="https://github.com/chnbsdan/cf-pico"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2"
        >
          <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
            <i className="fas fa-cloud-upload-alt text-xl text-white"></i>
          </div>
        </a>

        {/* ✅ 蜡笔风格标题 */}
        <h1 className="title-crayon text-xl md:text-2xl font-bold drop-shadow-lg">
          <span className="title-main">Hangdn ImgBed</span>
          <span className="title-crayon-text" aria-hidden="true">Hangdn ImgBed</span>
        </h1>
      </div>
      <p className="text-white/70 dark:text-white/50 text-xs">
        支持 GitHub / R2 / Telegram 三种存储
      </p>

      <style>{`
        .title-crayon {
          position: relative;
          display: inline-block;
        }

        .title-main {
          background: linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          transition: opacity 0.3s ease;
        }

        .title-crayon-text {
          position: absolute;
          left: 0;
          top: 0;
          z-index: 2;
          width: 100%;
          height: 100%;
          pointer-events: none;
          white-space: nowrap;
          color: transparent;
          opacity: 0;
          background:
            repeating-linear-gradient(108deg,
              #f472b6 0 5px,
              #fb923c 5px 8px,
              transparent 8px 10px),
            repeating-linear-gradient(72deg,
              transparent 0 7px,
              #a78bfa 7px 8px,
              transparent 8px 12px),
            linear-gradient(90deg,
              #ec4899,
              #8b5cf6,
              #3b82f6,
              #06b6d4,
              #22d3ee);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          -webkit-text-stroke: 0.35px rgba(255,255,255,0.15);
          text-shadow:
            -1.2px 0.4px 0 rgba(255,255,255,0.08),
            0.9px -0.7px 0 rgba(255,255,255,0.12),
            1.5px 0.5px 0 rgba(255,255,255,0.05);
          transform: rotate(-0.8deg);
          transform-origin: left 68%;
          clip-path: inset(-10px 100% -10px -10px);
          filter: saturate(1.08) contrast(1.06);
        }

        .title-crayon:hover .title-main {
          opacity: 0;
        }

        .title-crayon:hover .title-crayon-text {
          animation:
            crayonWrite 0.82s steps(18, end) forwards,
            crayonScratch 0.16s steps(2, end) 0.82s 3;
        }

        @keyframes crayonWrite {
          0% {
            opacity: 0;
            clip-path: inset(-10px 100% -10px -10px);
          }
          12% {
            opacity: 0.92;
          }
          32% {
            clip-path: inset(-10px 68% -10px -10px);
          }
          47% {
            clip-path: inset(-10px 52% -10px -10px);
          }
          63% {
            clip-path: inset(-10px 34% -10px -10px);
          }
          78% {
            clip-path: inset(-10px 18% -10px -10px);
          }
          100% {
            opacity: 0.92;
            clip-path: inset(-10px -10px -10px -10px);
          }
        }

        @keyframes crayonScratch {
          0%, 100% {
            transform: rotate(-0.8deg);
          }
          50% {
            transform: rotate(-0.45deg);
          }
        }
      `}</style>
    </div>
  )
}
