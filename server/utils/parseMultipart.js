// utils/parseMultipart.js
export function parseMultipartResponse(buffer, boundary) {
  const sep = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = 0;

  while (true) {
    const idx = buffer.indexOf(sep, start);
    if (idx === -1) break;
    const end = buffer.indexOf(sep, idx + sep.length);
    if (end === -1) break;

    const part = buffer.slice(idx + sep.length, end);

    // Разделяем заголовки и тело (двойной CRLF)
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) {
      start = end;
      continue;
    }

    const headers = part.slice(0, headerEnd).toString();
    const body = part.slice(headerEnd + 4, part.length - 2); // trim trailing \r\n

    parts.push({ headers, body });
    start = end;
  }

  return parts;
}
