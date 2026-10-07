// All launch values live here. Edit, commit, push to main; Vercel rebuilds.
// A value is a placeholder if it equals "REPLACE_ME" or is empty.
export const SITE = {
  contractAddress: "REPLACE_ME",   // full contract address
  buyUrl:          "REPLACE_ME",   // e.g. pump.fun or DEX link
  xUrl:            "REPLACE_ME",   // X profile URL
  siteUrl:         "REPLACE_ME",   // canonical site URL
  chain:           "SOLANA",
  showLaunchMetaBridge: true,
};

export const isPlaceholder = (value) =>
  value == null || String(value).trim() === "" || String(value).trim() === "REPLACE_ME";
