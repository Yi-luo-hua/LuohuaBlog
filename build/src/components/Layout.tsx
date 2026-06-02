import { useEffect, type CSSProperties } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { RainCanvas } from '../weather/RainCanvas';

const SPARKLES = [
  ['34%', '25%', '9px', '5.6s', '-1.2s'],
  ['48%', '36%', '12px', '6.4s', '-3.6s'],
  ['58%', '22%', '8px', '5.2s', '-2.1s'],
  ['42%', '66%', '10px', '6.8s', '-4.4s'],
  ['68%', '52%', '11px', '7.2s', '-1.8s'],
  ['76%', '28%', '8px', '6s', '-5s'],
] as const;

const PARTICLES = [
  ['28%', '22%', '8px', 'rgba(183,220,255,0.55)', '0.48', '24px', '10s', '-2s'],
  ['38%', '30%', '14px', 'rgba(246,190,236,0.46)', '0.38', '-18px', '12s', '-6s'],
  ['50%', '20%', '10px', 'rgba(182,248,236,0.52)', '0.5', '28px', '11s', '-4s'],
  ['63%', '32%', '18px', 'rgba(224,196,255,0.42)', '0.34', '-24px', '14s', '-8s'],
  ['72%', '18%', '7px', 'rgba(255,218,240,0.5)', '0.46', '18px', '9s', '-1s'],
  ['82%', '44%', '16px', 'rgba(183,235,255,0.44)', '0.36', '-22px', '13s', '-7s'],
  ['31%', '58%', '12px', 'rgba(210,194,255,0.44)', '0.42', '22px', '12s', '-9s'],
  ['44%', '70%', '7px', 'rgba(255,212,232,0.48)', '0.44', '-16px', '10s', '-5s'],
  ['56%', '62%', '20px', 'rgba(190,245,230,0.38)', '0.32', '30px', '15s', '-10s'],
  ['67%', '72%', '9px', 'rgba(180,210,255,0.48)', '0.46', '-20px', '11s', '-3s'],
  ['75%', '58%', '13px', 'rgba(246,188,238,0.44)', '0.4', '26px', '13s', '-11s'],
  ['86%', '72%', '8px', 'rgba(194,250,240,0.48)', '0.44', '-18px', '10s', '-4s'],
  ['24%', '42%', '6px', 'rgba(255,255,255,0.7)', '0.6', '14px', '8s', '-6s'],
  ['53%', '44%', '6px', 'rgba(255,255,255,0.7)', '0.58', '-12px', '9s', '-2s'],
  ['70%', '38%', '6px', 'rgba(255,255,255,0.72)', '0.62', '16px', '8.5s', '-5s'],
  ['90%', '26%', '5px', 'rgba(255,255,255,0.72)', '0.58', '-14px', '9.5s', '-7s'],
] as const;

const SUNSHOWERS = [
  ['18%', '84px', '0.26', '6.4s', '-1.2s'],
  ['24%', '110px', '0.34', '7.2s', '-4.4s'],
  ['31%', '76px', '0.24', '5.8s', '-2.8s'],
  ['38%', '118px', '0.36', '7.6s', '-6.1s'],
  ['45%', '92px', '0.28', '6.8s', '-3.5s'],
  ['52%', '128px', '0.32', '8s', '-7.2s'],
  ['59%', '78px', '0.22', '5.9s', '-1.7s'],
  ['66%', '112px', '0.34', '7.4s', '-5.3s'],
  ['72%', '86px', '0.26', '6.3s', '-2.2s'],
  ['78%', '122px', '0.3', '7.9s', '-6.8s'],
  ['84%', '96px', '0.24', '6.7s', '-4.9s'],
  ['90%', '132px', '0.3', '8.2s', '-8.1s'],
  ['12%', '72px', '0.2', '6.1s', '-3.9s'],
  ['35%', '98px', '0.24', '7s', '-8.8s'],
  ['69%', '104px', '0.26', '7.1s', '-9.4s'],
  ['94%', '82px', '0.2', '6.5s', '-2.6s'],
  ['8%', '118px', '0.3', '6.8s', '-5.6s'],
  ['16%', '136px', '0.38', '7.8s', '-9.2s'],
  ['28%', '126px', '0.36', '6.9s', '-7.4s'],
  ['42%', '142px', '0.4', '8.4s', '-10.8s'],
  ['49%', '108px', '0.34', '6.2s', '-4.8s'],
  ['57%', '148px', '0.42', '8.6s', '-11.6s'],
  ['63%', '116px', '0.34', '6.5s', '-3.2s'],
  ['74%', '140px', '0.4', '8s', '-12.2s'],
  ['88%', '116px', '0.32', '6.4s', '-6.6s'],
  ['98%', '134px', '0.34', '7.5s', '-10.1s'],
] as const;

export function Layout() {
  const { pathname } = useLocation();
  const isHome = pathname === '/';

  useEffect(() => {
    document.body.classList.toggle('page-home', isHome);
    return () => document.body.classList.remove('page-home');
  }, [isHome]);

  return (
    <>
      <div className="bg" />
      <div className="weather-mist" aria-hidden="true" />
      <RainCanvas />

      {isHome && (
        <>
          <div className="motion-ribbons" aria-hidden="true">
            <svg viewBox="0 0 1440 900" preserveAspectRatio="none">
              <path className="motion-ribbon motion-ribbon--blue" d="M160 620 C360 500 520 560 700 420 S1080 240 1280 330" />
              <path className="motion-ribbon motion-ribbon--pink" d="M280 260 C470 150 660 220 820 170 S1110 120 1320 220" />
              <path className="motion-ribbon motion-ribbon--mint" d="M210 760 C410 690 570 740 750 650 S1030 520 1220 590" />
            </svg>
          </div>
          <div className="sparkle-field" aria-hidden="true">
            {SPARKLES.map(([x, y, s, dur, delay], i) => (
              <span key={`sp-${i}`} style={{ '--x': x, '--y': y, '--s': s, '--dur': dur, '--delay': delay } as CSSProperties} />
            ))}
          </div>
          <div className="particle-layer" aria-hidden="true">
            {PARTICLES.map(([x, y, s, c, o, dx, dur, delay], i) => (
              <span key={`pl-${i}`} style={{ '--x': x, '--y': y, '--s': s, '--c': c, '--o': o, '--dx': dx, '--dur': dur, '--delay': delay } as CSSProperties} />
            ))}
          </div>
          <div className="sunshower-layer" aria-hidden="true">
            {SUNSHOWERS.map(([x, h, o, dur, delay], i) => (
              <span key={`ss-${i}`} style={{ '--x': x, '--h': h, '--o': o, '--dur': dur, '--delay': delay } as CSSProperties} />
            ))}
          </div>
          <div className="hero-figure" aria-hidden="true">
            <img src="https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/AI%E8%87%AA%E5%8A%A8%E5%8C%96%E5%8D%9A%E5%AE%A2%E5%9B%BE%E7%89%87/build/hero.png" alt="人物立绘" decoding="async" />
          </div>
          <div className="cat-stickers" aria-hidden="true">
            <img className="cat-sticker cat-sticker--draw" src="https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/AI%E8%87%AA%E5%8A%A8%E5%8C%96%E5%8D%9A%E5%AE%A2%E5%9B%BE%E7%89%87/build/cutout-cat-draw.png" alt="" decoding="async" />
            <img className="cat-sticker cat-sticker--flower" src="https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/AI%E8%87%AA%E5%8A%A8%E5%8C%96%E5%8D%9A%E5%AE%A2%E5%9B%BE%E7%89%87/build/cutout-cat-flower.png" alt="" decoding="async" />
            <img className="cat-sticker cat-sticker--reading" src="https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/AI%E8%87%AA%E5%8A%A8%E5%8C%96%E5%8D%9A%E5%AE%A2%E5%9B%BE%E7%89%87/build/cutout-cat-reading.png" alt="" decoding="async" />
          </div>
          <div className="soul-quote" aria-hidden="true">
            <img src="https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/AI%E8%87%AA%E5%8A%A8%E5%8C%96%E5%8D%9A%E5%AE%A2%E5%9B%BE%E7%89%87/build/souls.png" alt="" decoding="async" />
          </div>
        </>
      )}

      <Sidebar />
      <main className="main">
        <Outlet />
      </main>
    </>
  );
}
