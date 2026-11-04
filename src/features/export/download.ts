// The zip's download (spec R3-34): the bytes become a `Blob`, the `Blob` an object URL, and a
// temporary link with `download` set is clicked. The URL is revoked on the next task, after the
// click has started the download: two downloads in a row each use a URL of their own (F-EXP-RF2).

/** Starts the download of `bytes` as the file `name`. */
export function downloadBlob(name: string, bytes: Uint8Array): void {
  if (typeof name !== "string" || name === "") {
    throw new TypeError("downloadBlob: name must be a non-empty string");
  }
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError("downloadBlob: bytes must be a Uint8Array");
  }
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/zip" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.hidden = true;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
