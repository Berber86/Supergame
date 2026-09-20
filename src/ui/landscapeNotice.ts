/** Quiet, dismissible explanation of automatic thinning — never a modal or a gameplay penalty. */
import type { GardenStore, LandscapeLoadNotice } from '../world/gardens';
import type { World } from '../world/world';

export class LandscapeNotice {
  readonly el: HTMLElement;

  constructor(
    private parent: HTMLElement,
    private store: GardenStore,
    private world: World,
    private onVisibility?: (visible: boolean) => void,
  ) {
    this.el = document.createElement('section');
    this.el.className = 'landscape-notice paper';
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'polite');
    this.el.hidden = true;
    parent.appendChild(this.el);
  }

  show(notice: LandscapeLoadNotice | null): void {
    this.el.hidden = !notice;
    this.onVisibility?.(!!notice);
    this.el.innerHTML = '';
    if (!notice) return;
    this.el.innerHTML = `
      <h2 class="ln-title"></h2>
      <p class="ln-text"></p>
      <p class="ln-feedback" hidden></p>
      <div class="ln-actions">
        <button type="button" class="ln-backup"></button>
        <button type="button" class="ln-close">Понятно</button>
      </div>`;
    const thinned = notice.kind === 'thinned';
    this.el.querySelector('.ln-title')!.textContent = thinned ? 'Саду стало просторнее' : 'Сад оставлен как есть';
    this.el.querySelector('.ln-text')!.textContent = thinned
      ? `При загрузке убрано близких повторений: ${notice.removed}. Постройки, мебель и животные не тронуты. Копия до прореживания доступна здесь и в «Усадьбах».`
      : `Найдены плотные повторения, но ${notice.reason === 'quota' ? 'хранилище браузера заполнено' : 'не удалось безопасно записать копию и результат'}. Ничего не удалено. Скачайте сад, прежде чем освобождать место.`;
    const backup = this.el.querySelector<HTMLButtonElement>('.ln-backup')!;
    backup.textContent = thinned ? 'Скачать копию' : 'Скачать сад';
    backup.addEventListener('click', () => {
      if (!thinned) this.store.exportFile(this.world);
      else if (!this.store.exportThinningBackup(notice.gardenId)) {
        const feedback = this.el.querySelector<HTMLElement>('.ln-feedback')!;
        feedback.textContent = 'Не удалось прочитать копию. Текущий сад можно выгрузить через «Усадьбы».';
        feedback.hidden = false;
      }
    });
    this.el.querySelector('.ln-close')!.addEventListener('click', () => {
      this.el.hidden = true;
      this.onVisibility?.(false);
      this.parent.querySelector<HTMLElement>('#garden')?.focus({ preventScroll: true });
    });
  }
}
