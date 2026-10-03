import React, { useEffect, useRef, useState } from 'react';

// Shared motion helpers for the landing hero.

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return undefined;
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

const LATIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=<>/\\';
const HANGUL = '가각간갈감갑강개객거건검게격견결경계고곡곤골공과관광교구국군굴권귀규균그극근글금급기긴길김나낙난날남납낭내냉너널녀년노녹논농뇌누눈뉴느늘능니다단달담답당대덕도독돈동두득등라락란람랑래략량려력련렬령례로록론료루류륙륜률르륵름릉리린림립마막만말망매맥먼멀메면멸명모목몰몽묘무묵문물미민밀박반발방배백번벌범법벽변별병보복본봉부북분불붕비빈빙사삭산살삼상새색생서석선설섬섭성세소속손송수숙순술숭습승시식신실심십아악안알암압앙애액야약양어억언엄업여역연열염엽영예오옥온옹와완왕외요욕용우운울웅원월위유육윤율은을음읍응의이익인일임입자작잔잠장재쟁저적전절점접정제조족존종좌죄주죽준중즉증지직진질집징차착찬찰참창채책처척천철첨청체초촉촌총최추축춘출충취측층치칙친칠침칭쾌타탁탄탈탐탑탕태택토통퇴투특파판팔패편평폐포폭표품풍피필하학한할함합항해핵행향허헌험혁현혈협형혜호혹혼홍화확환활황회획횡효후훈훼휘휴흉흑흔흥희';

function glyphFor(ch) {
  const code = ch.codePointAt(0);
  const pool = code >= 0xac00 && code <= 0xd7a3 ? HANGUL : LATIN;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Decrypts `text` into place: each character shows random glyphs (drawn
 * by a pseudo-element, so layout never shifts) until it locks, left to
 * right. The real characters are in the DOM from the first frame.
 */
export function DecryptText({ text, delay = 0, step = 34, hold = 240, className = '' }) {
  const ref = useRef(null);
  const reduced = usePrefersReducedMotion();
  const chars = Array.from(text);

  useEffect(() => {
    const root = ref.current;
    if (!root || reduced) return undefined;
    const nodes = [...root.querySelectorAll('[data-dc]')];
    const order = nodes.map((el, i) => ({ el, at: delay + i * step + Math.random() * step * 2.5, done: false, ch: el.textContent }));
    nodes.forEach((el) => el.classList.add('dc-hidden'));
    const t0 = performance.now();
    let raf = 0;
    let last = 0;
    const tick = (now) => {
      const t = now - t0;
      const swap = now - last > 42;
      let pending = 0;
      for (const o of order) {
        if (o.done) continue;
        if (t >= o.at + hold) {
          o.el.classList.remove('dc-hidden', 'dc-scramble');
          o.el.removeAttribute('data-g');
          o.el.classList.add('dc-flash');
          o.done = true;
          continue;
        }
        pending += 1;
        if (t >= o.at) {
          o.el.classList.add('dc-scramble');
          if (swap) o.el.setAttribute('data-g', glyphFor(o.ch));
        }
      }
      if (swap) last = now;
      if (pending) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      nodes.forEach((el) => {
        el.classList.remove('dc-hidden', 'dc-scramble');
        el.removeAttribute('data-g');
      });
    };
  }, [text, delay, step, hold, reduced]);

  return (
    <span ref={ref} className={className}>
      {chars.map((ch, i) => (ch === ' ' ? ' ' : <span key={`${i}-${ch}`} data-dc="" className="dc">{ch}</span>))}
    </span>
  );
}
