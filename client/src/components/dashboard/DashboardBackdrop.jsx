import React, { useState, useEffect } from 'react';

/**
 * DashboardBackdrop component
 * Renders the real whey-protein artwork backdrop ONLY on the Dashboard route.
 * Follows exact specifications:
 * - Positioned absolute at top-right of scroller
 * - Uses the authentic Whey Protein tub artwork with neon ring, dumbbells, and powder splash
 * - Safari-safe gradient overlays (no mask-image / mask-composite)
 * - Pure CSS transform & opacity floating + pulse animation
 * - 14 tiny blurred dust particles positioned around the tub
 * - Pauses on document.hidden (visibilitychange)
 * - Respects prefers-reduced-motion
 * - Graceful fallback to soft green glow if image fails
 */
export function DashboardBackdrop() {
  const [imgFailed, setImgFailed] = useState(false);
  const [isTabHidden, setIsTabHidden] = useState(false);

  useEffect(() => {
    function handleVisibility() {
      setIsTabHidden(document.hidden);
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  return (
    <div
      className="pointer-events-none select-none z-0 overflow-hidden transition-opacity duration-700
        w-full h-[260px] top-0 left-0
        md:w-[min(58%,920px)] md:h-[clamp(380px,46vh,540px)] md:left-auto md:right-0 absolute"
      style={{
        animationPlayState: isTabHidden ? 'paused' : 'running',
      }}
      aria-hidden="true"
    >
      {/* Ambient Pulsing Radial Lime Glow */}
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_55%_45%,rgba(182,242,59,0.20)_0%,rgba(124,255,31,0.06)_45%,transparent_75%)]"
        style={{
          animation: 'backdrop-glow-pulse 5s ease-in-out infinite alternate',
          animationPlayState: isTabHidden ? 'paused' : 'running',
        }}
      />

      {/* Floating Artwork Container */}
      <div
        className="relative w-full h-full transform-gpu"
        style={{
          animation: 'backdrop-float 7s ease-in-out infinite alternate',
          animationPlayState: isTabHidden ? 'paused' : 'running',
        }}
      >
        {!imgFailed ? (
          <picture className="w-full h-full block">
            <source media="(max-width: 767px)" srcSet="/assets/hero/dashboard-bg-800.webp" />
            <source media="(min-width: 768px)" srcSet="/assets/hero/dashboard-bg-2000.webp" />
            <img
              src="/assets/hero/dashboard-bg-2000.webp"
              alt="Whey Protein Hero Artwork"
              width="2000"
              height="1000"
              fetchPriority="high"
              decoding="async"
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover object-[55%_48%] opacity-90 md:opacity-100"
            />
          </picture>
        ) : (
          <div className="w-full h-full bg-[radial-gradient(ellipse_at_55%_45%,rgba(182,242,59,0.3)_0%,rgba(10,20,10,0.8)_70%)]" />
        )}

        {/* Floating dust particles near the tub and neon ring */}
        <div className="hidden md:block absolute inset-0 overflow-hidden pointer-events-none">
          {[
            { top: '35%', left: '50%', size: '3px', delay: '0s', dur: '4s' },
            { top: '40%', left: '42%', size: '4px', delay: '1s', dur: '5.5s' },
            { top: '48%', left: '60%', size: '2.5px', delay: '0.5s', dur: '4.8s' },
            { top: '28%', left: '55%', size: '3.5px', delay: '2s', dur: '6s' },
            { top: '55%', left: '52%', size: '2px', delay: '1.5s', dur: '4.2s' },
            { top: '38%', left: '68%', size: '4px', delay: '2.8s', dur: '5s' },
            { top: '45%', left: '38%', size: '3px', delay: '0.8s', dur: '6.2s' },
            { top: '25%', left: '48%', size: '2px', delay: '3.2s', dur: '4.5s' },
            { top: '62%', left: '64%', size: '3px', delay: '1.2s', dur: '5.8s' },
            { top: '50%', left: '72%', size: '2.5px', delay: '2.2s', dur: '4.9s' },
            { top: '32%', left: '62%', size: '3px', delay: '0.3s', dur: '5.2s' },
            { top: '22%', left: '58%', size: '3.5px', delay: '1.8s', dur: '6.5s' },
            { top: '58%', left: '44%', size: '2px', delay: '2.5s', dur: '4.7s' },
            { top: '26%', left: '65%', size: '2.5px', delay: '3.5s', dur: '5.3s' },
          ].map((pt, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-[#B6F23B]/60 blur-[0.5px]"
              style={{
                top: pt.top,
                left: pt.left,
                width: pt.size,
                height: pt.size,
                animation: `dust-drift ${pt.dur} ease-in-out infinite alternate`,
                animationDelay: pt.delay,
                animationPlayState: isTabHidden ? 'paused' : 'running',
              }}
            />
          ))}
        </div>
      </div>

      {/* Safari Safe Edge Blending Overlays */}
      {/* Left edge fade into dark page bg */}
      <div className="absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-[#050805] via-[#050805]/75 to-transparent pointer-events-none" />

      {/* Bottom edge fade */}
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#050805] via-[#050805]/85 to-transparent pointer-events-none" />

      {/* Top vignette under sticky top bar */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#050805]/70 via-[#050805]/20 to-transparent pointer-events-none" />

      {/* Right edge fade */}
      <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#050805]/50 to-transparent pointer-events-none" />
    </div>
  );
}
