import { Keyboard } from "grammy";

export const mainKeyboard = new Keyboard()
  .text("📊 Опоздавшие")
  .row()
  .text("📈 Посещаемость")
  .row()
  .resized();
