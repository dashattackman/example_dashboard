// Ambient typing for city JSON content imported by pure-TS modules.
// The data is validated at load by zod (schema.ts), so `unknown` is correct
// here — nothing may touch it before CityPlanSchema.parse().
declare module '*/city/uptown.json' {
  const data: unknown;
  export default data;
}
