import { Campaign } from './Campaign';

/** Минимальный интерфейс реестра, чтобы мета-слой не зависел от Phaser. */
interface RegistryLike {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}

/** Получить кампанию из реестра игры; при отсутствии — загрузить/создать. */
export function campaignOf(registry: RegistryLike): Campaign {
  let c = registry.get('campaign') as Campaign | undefined;
  if (!c) {
    c = Campaign.load();
    registry.set('campaign', c);
  }
  return c;
}
