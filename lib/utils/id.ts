let _idc = 1000;

export function uid(prefix: string): string {
  return `${prefix}${++_idc}`;
}
