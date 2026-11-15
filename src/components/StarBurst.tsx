import { useEffect, useRef } from 'react';

const COLORS = ['#ffcf3f', '#ffe9a3', '#c3b3ff', '#ffb3d9', '#fff6d6'];

/** 点击星尘：在指针位置绽放一圈金色 / 紫罗兰小星星（纯装饰，不拦截任何交互） */
export function StarBurst() {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const burst = (event: PointerEvent) => {
      if (event.button !== 0 || reduceMotion.matches) return;
      const ring = document.createElement('span');
      ring.className = 'star-ring';
      ring.style.left = `${event.clientX}px`;
      ring.style.top = `${event.clientY}px`;
      layer.appendChild(ring);
      window.setTimeout(() => ring.remove(), 700);

      const count = 16;
      for (let i = 0; i < count; i += 1) {
        const star = document.createElement('span');
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const distance = 40 + Math.random() * 55;
        const size = 11 + Math.random() * 10;
        star.className = 'star-particle';
        star.style.left = `${event.clientX - size / 2}px`;
        star.style.top = `${event.clientY - size / 2}px`;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        star.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
        star.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
        star.style.setProperty('--rot', `${(Math.random() - 0.5) * 320}deg`);
        star.style.setProperty('--star-color', COLORS[i % COLORS.length]);
        star.style.animationDelay = `${Math.random() * 70}ms`;
        layer.appendChild(star);
        window.setTimeout(() => star.remove(), 900);
      }
    };

    window.addEventListener('pointerdown', burst);
    return () => window.removeEventListener('pointerdown', burst);
  }, []);

  return <div className="star-burst-layer" ref={layerRef} aria-hidden="true" />;
}
