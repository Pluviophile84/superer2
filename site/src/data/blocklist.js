// Brand-safety blocklist for the Renaming Office: common slurs and hate terms.
// Stored base64-encoded so the source is not a wall of slurs. Matching is
// done on whole words / whole phrases after normalization (see rename.js).
// Only slurs and hate terms belong here: never ordinary words, brands or names.
const ENCODED = [
  "TklHR0VS", "TklHR0E=", "U0FORE5JR0dFUg==", "S0lLRQ==", "S1lLRQ==", "Q0hJTks=",
  "R09PSw==", "U1BJQw==", "U1BJQ0s=", "V0VUQkFDSw==", "QkVBTkVS", "UEFLSQ==",
  "UkFHSEVBRA==", "VE9XRUxIRUFE", "SklHQUJPTw==", "SklHR0FCT08=", "UE9SQ0hNT05LRVk=", "UE9SQ0ggTU9OS0VZ",
  "WklQUEVSSEVBRA==", "R1lQUE8=", "U0xBTlRFWUU=", "Q09PTkFTUw==", "REFSS0lF", "TkVHUk9JRA==",
  "R09MTElXT0c=", "V09H", "RkFH", "RkFHR09U", "RkFHR09UUw==", "RFlLRQ==",
  "VFJBTk5Z", "U0hFTUFMRQ==", "UkVUQVJE", "UkVUQVJERUQ=", "TkFaSQ==", "TkVPTkFaSQ==",
  "SEVJTA==", "U0lFRyBIRUlM", "SEVJTCBISVRMRVI=", "S0tL", "MTQ4OA==", "V0hJVEUgUE9XRVI=",
  "R0FTIFRIRSBKRVdT", "V0hJVEUgR0VOT0NJREU=", "UkFIT1dB",
];

const decode = (s) =>
  typeof atob === "function" ? atob(s) : Buffer.from(s, "base64").toString("utf8");

export const BLOCKLIST = ENCODED.map(decode);
