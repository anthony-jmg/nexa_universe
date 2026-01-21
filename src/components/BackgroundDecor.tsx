export function BackgroundDecor() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div className="absolute top-20 right-[5%] w-2 h-2 bg-gold-400 opacity-40 rounded-full animate-pulse"></div>
      <div className="absolute top-[15%] left-[8%] w-1.5 h-1.5 bg-gold-500 opacity-50 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
      <div className="absolute bottom-[25%] right-[12%] w-2 h-2 bg-gold-400 opacity-40 rounded-full animate-pulse" style={{ animationDelay: '1.5s' }}></div>
      <div className="absolute top-[65%] left-[15%] w-1.5 h-1.5 bg-gold-500 opacity-45 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute top-[45%] right-[20%] w-1 h-1 bg-gold-400 opacity-35 rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>
      <div className="absolute bottom-[30%] left-[45%] w-2 h-2 bg-gold-500 opacity-40 rounded-full animate-pulse" style={{ animationDelay: '0.8s' }}></div>
      <div className="absolute top-[80%] right-[8%] w-1.5 h-1.5 bg-gold-400 opacity-45 rounded-full animate-pulse" style={{ animationDelay: '1.3s' }}></div>
      <div className="absolute bottom-[15%] left-[90%] w-2 h-2 bg-gold-500 opacity-40 rounded-full animate-pulse" style={{ animationDelay: '2.1s' }}></div>

      <svg
        className="absolute top-0 left-0 w-full h-full opacity-[0.015]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="grid"
            width="80"
            height="80"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 80 0 L 0 0 0 80"
              fill="none"
              stroke="#B8913D"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      <div className="absolute top-[20%] right-[10%] w-48 h-48 border border-[#D4AC5B] opacity-8 rounded-full animate-pulse-slow"></div>
      <div className="absolute bottom-[20%] left-[8%] w-64 h-64 border border-[#A07F35] opacity-8 rounded-full animate-float"></div>
      <div className="absolute top-[50%] left-[50%] w-32 h-32 border border-[#B8913D] opacity-6 rounded-full animate-pulse-slow" style={{ animationDelay: '1.5s' }}></div>
      <div className="absolute top-[18%] right-[75%] w-40 h-40 border border-[#D4AC5B] opacity-7 rounded-full animate-float" style={{ animationDelay: '2s' }}></div>
      <div className="absolute bottom-[35%] left-[82%] w-56 h-56 border border-[#B8913D] opacity-6 rounded-full animate-pulse-slow" style={{ animationDelay: '3s' }}></div>
      <div className="absolute top-[70%] right-[85%] w-36 h-36 border border-[#A07F35] opacity-7 rounded-full animate-float" style={{ animationDelay: '1s' }}></div>
      <div className="absolute bottom-[10%] right-[5%] w-44 h-44 border border-[#D4AC5B] opacity-7 rounded-full animate-pulse-slow" style={{ animationDelay: '2.5s' }}></div>
      <div className="absolute top-[8%] left-[92%] w-38 h-38 border border-[#A07F35] opacity-6 rounded-full animate-float" style={{ animationDelay: '1.8s' }}></div>

      <div className="absolute top-[50%] left-0 w-px h-32 bg-gradient-to-b from-transparent via-gold-500/20 to-transparent"></div>
      <div className="absolute top-[30%] right-0 w-px h-40 bg-gradient-to-b from-transparent via-gold-500/20 to-transparent"></div>
      <div className="absolute top-[65%] left-[15%] w-px h-24 bg-gradient-to-b from-transparent via-gold-500/15 to-transparent animate-pulse-slow"></div>
      <div className="absolute bottom-[40%] right-[18%] w-px h-36 bg-gradient-to-b from-transparent via-gold-500/15 to-transparent animate-pulse-slow" style={{ animationDelay: '1.5s' }}></div>
      <div className="absolute top-[25%] left-[88%] w-px h-28 bg-gradient-to-b from-transparent via-gold-500/18 to-transparent animate-pulse-slow" style={{ animationDelay: '2.2s' }}></div>
      <div className="absolute bottom-[25%] right-[92%] w-px h-32 bg-gradient-to-b from-transparent via-gold-500/15 to-transparent animate-pulse-slow" style={{ animationDelay: '0.9s' }}></div>

      <div className="absolute top-[22%] left-[12%] w-24 h-24 border border-[#D4AC5B] opacity-8 rotate-45 animate-float"></div>
      <div className="absolute bottom-[28%] right-[15%] w-32 h-32 border border-[#A07F35] opacity-8 rotate-12 animate-pulse-slow"></div>
      <div className="absolute top-[35%] left-[85%] w-20 h-20 border border-[#B8913D] opacity-7 rotate-[30deg] animate-float" style={{ animationDelay: '2.5s' }}></div>
      <div className="absolute bottom-[55%] right-[88%] w-28 h-28 border border-[#D4AC5B] opacity-6 -rotate-12 animate-pulse-slow" style={{ animationDelay: '1.8s' }}></div>
      <div className="absolute top-[52%] right-[8%] w-16 h-16 border border-[#A07F35] opacity-8 rotate-[60deg] animate-float" style={{ animationDelay: '0.7s' }}></div>
      <div className="absolute top-[68%] left-[25%] w-22 h-22 border border-[#B8913D] opacity-7 rotate-[25deg] animate-pulse-slow" style={{ animationDelay: '3.2s' }}></div>
      <div className="absolute bottom-[12%] left-[78%] w-26 h-26 border border-[#D4AC5B] opacity-8 -rotate-[35deg] animate-float" style={{ animationDelay: '2.7s' }}></div>
      <div className="absolute top-[12%] right-[92%] w-20 h-20 border border-[#A07F35] opacity-7 rotate-[15deg] animate-pulse-slow" style={{ animationDelay: '1.4s' }}></div>

      <div className="absolute top-[28%] left-[18%] w-12 h-12 border-l-2 border-t-2 border-[#D4AC5B] opacity-10 rotate-45 animate-float"></div>
      <div className="absolute bottom-[20%] right-[22%] w-16 h-16 border-r-2 border-b-2 border-[#A07F35] opacity-10 -rotate-12 animate-pulse-slow" style={{ animationDelay: '1.2s' }}></div>
      <div className="absolute top-[58%] left-[72%] w-10 h-10 border-l-2 border-b-2 border-[#B8913D] opacity-12 rotate-[70deg] animate-float" style={{ animationDelay: '2.8s' }}></div>
      <div className="absolute bottom-[45%] right-[5%] w-14 h-14 border-r-2 border-t-2 border-[#D4AC5B] opacity-11 rotate-[25deg] animate-pulse-slow" style={{ animationDelay: '1.9s' }}></div>
      <div className="absolute top-[15%] left-[5%] w-11 h-11 border-l-2 border-t-2 border-[#A07F35] opacity-10 -rotate-[20deg] animate-float" style={{ animationDelay: '3.1s' }}></div>

      <div className="absolute top-[10%] right-[48%] w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[14px] border-b-[#D4AC5B] opacity-8 animate-pulse-slow"></div>
      <div className="absolute bottom-[38%] left-[20%] w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[17px] border-b-[#A07F35] opacity-7 rotate-180 animate-float" style={{ animationDelay: '1.5s' }}></div>
      <div className="absolute top-[75%] right-[28%] w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-[#B8913D] opacity-9 rotate-90 animate-pulse-slow" style={{ animationDelay: '2.3s' }}></div>
      <div className="absolute bottom-[18%] left-[92%] w-0 h-0 border-l-[9px] border-l-transparent border-r-[9px] border-r-transparent border-b-[15px] border-b-[#D4AC5B] opacity-8 -rotate-45 animate-float" style={{ animationDelay: '2.9s' }}></div>
      <div className="absolute top-[42%] right-[95%] w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-b-[12px] border-b-[#A07F35] opacity-7 rotate-[135deg] animate-pulse-slow" style={{ animationDelay: '0.6s' }}></div>
    </div>
  );
}
