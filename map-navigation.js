const destinations = ['tone', 'rail'];
const navigationKeys = new Set(['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'Home', 'End']);

/** Keep map shortcuts scoped to the home view and out of native form controls. */
export function bindMapNavigation({document, container, getDestination, onSelect, onStart, isBlocked = () => false}) {
  function keydown(event) {
    if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || isBlocked()) return;
    const enter = event.key === 'Enter';
    if (!enter && !navigationKeys.has(event.key)) return;
    const target = event.target ?? document.activeElement ?? document.body;
    const pageFocus = target === document.body || target === document.documentElement || target === container;
    if (!pageFocus && !container.contains(target)) return;
    if (target?.isContentEditable || target?.closest?.('input, textarea, select, [contenteditable]')) return;
    const control = target?.closest?.('button, a, summary, [role="button"], [role="link"]');
    const mode = target?.closest?.('[data-destination]');
    const modeButton = mode && container.contains(mode) && destinations.includes(mode.dataset.destination) && control === mode ? mode : null;
    if (control && !modeButton || modeButton?.disabled) return;
    if (enter) {
      if (event.repeat) return;
      event.preventDefault();
      // Tab can focus a different mode before it has been selected.
      if (modeButton && modeButton.dataset.destination !== getDestination()) onSelect(modeButton.dataset.destination);
      onStart();
      return;
    }
    const selectedIndex = destinations.indexOf(getDestination());
    const index = selectedIndex < 0 ? 0 : selectedIndex;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? destinations.length - 1 :
      (index + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1) + destinations.length) % destinations.length;
    const value = destinations[next];
    event.preventDefault();
    onSelect(value);
    container.querySelector('[data-mode-card][data-destination="' + value + '"]')?.focus({preventScroll: true});
  }
  document.addEventListener('keydown', keydown);
  return () => document.removeEventListener('keydown', keydown);
}
