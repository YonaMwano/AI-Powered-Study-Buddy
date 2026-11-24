declare module "officeparser" {
  export function parseOffice(
    file: Buffer | string,
    callback: (data: string, err: Error | null) => void
  ): void;
}
