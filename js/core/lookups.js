/**
 * lookups.js — маленькие функции доступа к справочникам js/data.
 * Раньше жили в ui/demo.js; теперь это точка доступа и для core, и для ui.
 */

import { ITEMS } from '../data/items.js';
import { DISTRICTS } from '../data/districts.js';
import { WEATHER } from '../data/weather.js';
import { BUYERS } from '../data/buyers.js';
import { EXPERTS } from '../data/experts.js';
import { LIVING } from '../data/balance.js';

export const findItem = (id) => ITEMS.find((i) => i.id === id);
export const findDistrict = (id) => DISTRICTS.find((d) => d.id === id);
export const findWeather = (id) => WEATHER.find((w) => w.id === id);
export const findBuyer = (id) => BUYERS.find((b) => b.id === id);
export const findExpert = (id) => EXPERTS.find((e) => e.id === id);
export const findShelter = (id) => LIVING.shelter.find((s) => s.id === id);
