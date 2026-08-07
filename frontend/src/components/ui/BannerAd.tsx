import React, { useEffect, useRef } from 'react';

interface BannerAdProps {
  adClient?: string; // e.g., 'ca-pub-XXXXXXXXXXXXXXXX'
  adSlot?: string;   // e.g., '1234567890'
  format?: 'auto' | 'fluid' | 'rectangle' | 'vertical';
  responsive?: boolean;
  className?: string;
}

export function BannerAd({ 
  adClient = 'ca-pub-1548704351257520', 
  adSlot = 'YOUR_AD_SLOT_ID', 
  format = 'auto', 
  responsive = true,
  className = ''
}: BannerAdProps) {
  const adRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    // This pushes the ad to google adsense script when the component mounts
    // Ensure the Google AdSense script is added to your index.html:
    // <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossOrigin="anonymous"></script>
    try {
      const adsbygoogle = (window as any).adsbygoogle || [];
      // Only push if it hasn't been filled yet to avoid errors during re-renders
      if (adRef.current && adRef.current.innerHTML === '') {
          adsbygoogle.push({});
      }
    } catch (e) {
      console.error('Google AdSense error:', e);
    }
  }, []);

  return (
    <div className={`flex justify-center items-center overflow-hidden my-4 ${className}`} style={{ minHeight: '90px', background: 'var(--bg-secondary)', border: '1px dashed var(--border-default)', borderRadius: '8px' }}>
      {/* Placeholder for development - remove this when real ads are active */}
      <div className="absolute text-xs text-[var(--text-muted)] pointer-events-none flex flex-col items-center">
        <span>Advertisement Space</span>
        <span className="text-[9px] mt-1 opacity-50">(Google AdSense)</span>
      </div>

      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block', width: '100%' }}
        data-ad-client={adClient}
        data-ad-slot={adSlot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? 'true' : 'false'}
      />
    </div>
  );
}
