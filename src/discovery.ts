import dgram from "node:dgram";

const SSDP_ADDRESS = "239.255.255.250";
const SSDP_PORT = 1900;
const SEARCH_TARGET = "urn:schemas-upnp-org:device:ZonePlayer:1";

export async function discoverLocations(timeoutMs = 1_500): Promise<string[]> {
  const socket = dgram.createSocket("udp4");
  const locations = new Set<string>();
  const message = Buffer.from(
    [
      "M-SEARCH * HTTP/1.1",
      `HOST: ${SSDP_ADDRESS}:${SSDP_PORT}`,
      'MAN: "ssdp:discover"',
      "MX: 1",
      `ST: ${SEARCH_TARGET}`,
      "",
      "",
    ].join("\r\n"),
  );

  return await new Promise<string[]>((resolve, reject) => {
    const finish = () => {
      socket.close();
      resolve([...locations].sort());
    };
    socket.on("message", (data) => {
      const match = data.toString().match(/^location:\s*(.+)$/im);
      if (match?.[1]) locations.add(match[1].trim());
    });
    socket.once("error", reject);
    socket.bind(0, () => {
      socket.send(message, SSDP_PORT, SSDP_ADDRESS);
      setTimeout(finish, timeoutMs).unref();
    });
  });
}
