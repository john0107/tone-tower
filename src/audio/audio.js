export class Player {
  constructor() {
    this.current = null;
    this.cache = new Map();
    this.token = 0;
  }
  preload(paths) {
    for (const path of paths) {
      if (!this.cache.has(path)) {
        const a = new Audio(path);
        a.preload = 'auto';
        a.load();
        this.cache.set(path, a);
      }
    }
  }
  stop() {
    this.token++;
    this.cancel?.();
    this.cancel = null;
    if (this.current) {
      this.current.pause();
      this.current.currentTime = 0;
      this.current = null;
    }
  }
  async play(path) {
    this.stop();
    const token = this.token;
    const a = this.cache.get(path) || new Audio(path);
    this.current = a;
    return new Promise((resolve, reject) => {
      let timer;
      const finish = (error) => {
        clearTimeout(timer);
        a.onended = null;
        a.onerror = null;
        if (token === this.token) this.cancel = null;
        error ? reject(error) : resolve();
      };
      this.cancel = () => finish();
      timer = setTimeout(() => {
        a.pause();
        finish(Error('Audio could not load.'));
      }, 10000);
      a.onended = () => finish();
      a.onerror = () => finish(Error('Recording unavailable.'));
      a.play()
        .then(() => {
          if (token !== this.token) return;
          clearTimeout(timer);
          timer = setTimeout(() => {
            a.pause();
            finish(Error('Playback did not finish.'));
          }, 15000);
        })
        .catch((e) => {
          if (token === this.token) finish(e);
        });
    });
  }
}
