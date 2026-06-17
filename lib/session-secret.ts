export const sessionSecret = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "dev-secret-minimum-32-characters-long!",
);
