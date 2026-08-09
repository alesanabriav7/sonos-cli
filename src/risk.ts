export type ActionRisk = "read" | "write" | "destructive";

const READ_PREFIXES = ["Get", "List", "Browse", "Search", "Is", "Check"];
const DESTRUCTIVE =
  /^(Destroy|Remove|Reset|Separate|BeginSoftwareUpdate|EnterConfigMode|ExitConfigMode|AddBondedZones|RemoveBondedZones|CreateStereoPair|AddHTSatellite|RemoveHTSatellite|FactoryReset)/;

export function classifyAction(name: string): ActionRisk {
  if (READ_PREFIXES.some((prefix) => name.startsWith(prefix))) return "read";
  if (DESTRUCTIVE.test(name)) return "destructive";
  return "write";
}

export function assertActionAuthorized(
  action: string,
  risk: ActionRisk,
  options: {
    allowWrite?: boolean;
    allowDestructive?: boolean;
    confirm?: string;
  },
): void {
  if (risk === "read") return;
  if (!options.allowWrite || options.confirm !== action) {
    throw new Error(`Write requires --allow-write --confirm ${action}`);
  }
  if (risk === "destructive" && !options.allowDestructive) {
    throw new Error(
      `Destructive action requires --allow-destructive: ${action}`,
    );
  }
}
