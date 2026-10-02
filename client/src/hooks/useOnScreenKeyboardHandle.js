import { useImperativeHandle } from "react";

// Триггерим нативный сеттер value, чтобы React-контроллируемый инпут
// подхватил изменение через обычное событие "input".
const setNativeValue = (el, value) => {
  const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

const insertAtCursor = (el, text) => {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  setNativeValue(el, el.value.slice(0, start) + text + el.value.slice(end));
  const pos = start + text.length;
  requestAnimationFrame(() => el.setSelectionRange(pos, pos));
};

const backspaceAtCursor = (el) => {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const pos = start === end ? Math.max(0, start - 1) : start;
  const next =
    start === end
      ? el.value.slice(0, pos) + el.value.slice(start)
      : el.value.slice(0, start) + el.value.slice(end);
  setNativeValue(el, next);
  requestAnimationFrame(() => el.setSelectionRange(pos, pos));
};

// Отдаёт родителю (через ref) методы для экранной клавиатуры: ввод идёт
// в сфокусированное поле внутри формы `formRef`.
export const useOnScreenKeyboardHandle = (ref, formRef) => {
  const getActiveField = () => {
    const el = document.activeElement;
    if (!formRef.current || !el || !formRef.current.contains(el)) return null;
    return el.tagName === "INPUT" || el.tagName === "TEXTAREA" ? el : null;
  };

  useImperativeHandle(ref, () => ({
    insertChar: (ch) => {
      const el = getActiveField();
      if (el) insertAtCursor(el, ch);
    },
    backspace: () => {
      const el = getActiveField();
      if (el) backspaceAtCursor(el);
    },
    space: () => {
      const el = getActiveField();
      if (el) insertAtCursor(el, " ");
    },
    pressEnter: () => {
      const el = getActiveField();
      if (el) el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
    },
  }));
};
