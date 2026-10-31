/** Turn a ZodError into "path.to.field: message" lines that point at the bad JSON. */
export function formatZodError(error, limit = 20) {
  const lines = error.issues.slice(0, limit).map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`);
  if (error.issues.length > limit) lines.push(`  …and ${error.issues.length - limit} more`);
  return lines.join('\n');
}

export function validateOrThrow(schema, data, label) {
  const result = schema.safeParse(data);
  if (!result.success) throw new Error(`${label} is invalid:\n${formatZodError(result.error)}`);
  return result.data;
}
