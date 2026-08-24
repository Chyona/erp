/** 仅保留首字符，其余用 * 代替 */
export function maskSensitiveText(text: string): string {
  const value = text.trim();
  if (!value) return '';
  if (value.length <= 1) return value;
  return `${value.charAt(0)}${'*'.repeat(value.length - 1)}`;
}

export function formatSensitiveText(text: string, visible: boolean): string {
  if (visible) return text;
  return maskSensitiveText(text);
}
