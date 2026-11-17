// Feature demo player for the Features grid. Demo cards are plain links to the
// MP4, so they still work without JavaScript; this opens them in a dialog instead.
(function () {
  const dialog = document.getElementById('demo-dialog');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  const video = document.getElementById('demo-video');
  const title = document.getElementById('demo-title');
  const caption = document.getElementById('demo-caption');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let opener = null;

  function open(link) {
    opener = link;
    title.textContent = link.querySelector('h3').textContent;
    caption.textContent = (link.dataset.caption || '') + ' Recorded frame by frame from the app, with OpenSCAD render time cut.';
    video.poster = link.dataset.poster || '';
    video.src = link.getAttribute('href');
    dialog.showModal();
    if (!reduceMotion.matches) {
      const playing = video.play();
      if (playing) playing.catch(() => {});
    }
  }

  dialog.addEventListener('close', () => {
    video.pause();
    video.removeAttribute('src');
    video.load();
    if (opener) opener.focus();
  });

  dialog.querySelector('.demo-close').addEventListener('click', () => dialog.close());

  // A click on the backdrop lands on the dialog element itself, outside its box.
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    const inside = event.clientX >= box.left && event.clientX <= box.right
      && event.clientY >= box.top && event.clientY <= box.bottom;
    if (!inside) dialog.close();
  });

  document.querySelectorAll('.demo-link').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      open(link);
    });
  });
})();
