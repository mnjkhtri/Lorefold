// Unicode bidi controls can make hostile text appear to say something else.
const BIDI_CONTROL_PATTERN = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu;

export function displayText(value: string): string {
  return value.replace(BIDI_CONTROL_PATTERN, "");
}
