const fetchFontAsBase64 = async (url) => {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(arrayBuffer).reduce(
      (data, byte) => data + String.fromCharCode(byte),
      ''
    )
  );
  return base64;
};

export default fetchFontAsBase64;
