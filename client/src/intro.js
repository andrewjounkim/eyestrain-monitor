// Cinematic intro: a large animated eye. Clicking it zooms into the pupil and
// the app opens out of the darkness.
//
// How the zoom works:
// 1. The eye scales up around its center, which is the pupil.
// 2. At the same time a page-colored circle placed exactly over the pupil grows
//    (CSS clip-path) until it covers the screen, so it looks like we fall into
//    the pupil. (Scaling the eye itself 50x+ would make the browser paint a
//    gigantic layer; a growing clip-path is cheap and stays sharp.)
// 3. The app (#app) is then revealed with a growing circular clip-path from
//    the center, like an iris opening, and the intro is removed.
// With "reduce motion" turned on in the OS, it's a short crossfade instead.

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// How much the eye scales during the zoom. Must match `scale(6)` in style.css.
const ZOOM = 6;

export function setupIntro({ skip = false } = {}) {
  const intro = document.getElementById('intro');
  const app = document.getElementById('app');
  if (!intro) return;

  if (skip) {
    intro.remove();
    return;
  }
  document.body.classList.add('intro-active'); // no page scrolling under the intro

  const iris = intro.querySelector('.eye-iris');
  const eyeButton = intro.querySelector('.intro-eye-button');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The iris follows the pointer a little, as if the eye is watching you.
  let raf = 0;
  function onPointerMove(event) {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const box = eyeButton.getBoundingClientRect();
      const dx = (event.clientX - (box.left + box.width / 2)) / window.innerWidth;
      const dy = (event.clientY - (box.top + box.height / 2)) / window.innerHeight;
      // SVG units; the eye opening allows roughly ±60 horizontally, ±30 vertically.
      iris.style.transform = `translate(${(dx * 120).toFixed(1)}px, ${(dy * 50).toFixed(1)}px)`;
    });
  }
  if (!reducedMotion) intro.addEventListener('pointermove', onPointerMove);

  let started = false;
  async function begin() {
    if (started) return;
    started = true;
    intro.removeEventListener('pointermove', onPointerMove);
    cancelAnimationFrame(raf);

    if (reducedMotion) {
      intro.classList.add('intro-fade');
      await wait(350);
    } else {
      // Re-center the iris instantly so the zoom lands exactly on the pupil.
      iris.style.transition = 'none';
      iris.style.transform = '';
      // Where the pupil is on screen: the center of the eye button, with a
      // radius of 32 (of 432) SVG units scaled to the button's on-screen width.
      const box = eyeButton.getBoundingClientRect();
      intro.style.setProperty('--px', `${box.left + box.width / 2}px`);
      intro.style.setProperty('--py', `${box.top + box.height / 2}px`);
      const pupilRadius = (32 / 432) * box.width;
      intro.style.setProperty('--pr', `${pupilRadius}px`);
      intro.style.setProperty('--pr-zoomed', `${pupilRadius * ZOOM}px`); // pupil size once the eye is zoomed
      intro.classList.add('intro-zoom');
      await wait(1300); // zoom (0.9 s) + pupil burst (0.4 s): the screen is now dark
      app.classList.add('app-reveal');
      intro.classList.add('intro-done');
      await wait(900);
      app.classList.remove('app-reveal');
    }

    intro.remove();
    document.body.classList.remove('intro-active');
    // Put keyboard focus somewhere sensible in the app.
    document.getElementById('start-btn')?.focus({ preventScroll: true });
  }

  intro.querySelectorAll('[data-begin]').forEach((el) => el.addEventListener('click', begin));
}
