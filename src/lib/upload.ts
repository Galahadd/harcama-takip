export type UploadedFile = {
  name: string;
  type?: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

export function isUploadedFile(value: unknown): value is UploadedFile {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "arrayBuffer" in value &&
    typeof (value as { name?: unknown }).name === "string" &&
    typeof (value as { arrayBuffer?: unknown }).arrayBuffer === "function"
  );
}
