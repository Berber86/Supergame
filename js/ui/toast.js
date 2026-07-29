/**
 * toast.js — крошечное всплывающее уведомление внизу экрана.
 * Кнопки-плейсхолдеры каркаса не работают — они кокетливо об этом сообщают.
 */

let hideTimer = null;

export function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('toast--visible');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => toast.classList.remove('toast--visible'), 2400);
}
