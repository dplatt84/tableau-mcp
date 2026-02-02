/**
 * Normalizes a description string by:
 * - Trimming leading/trailing whitespace
 * - Collapsing all whitespace sequences (newlines, tabs, multiple spaces) into single spaces
 *
 * This matches Salesforce's normalization pattern for tool descriptions.
 *
 * @param description - The description string to normalize, or undefined
 * @returns The normalized description string, or undefined if input was undefined
 */
export function normalizeDescription(description: string | undefined): string | undefined {
  if (description === undefined) {
    return undefined;
  }

  return description.trim().replace(/\s+/g, ' ');
}
