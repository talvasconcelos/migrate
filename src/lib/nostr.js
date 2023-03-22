import { SimplePool } from "nostr-tools";

const defaultRelays = [
  "wss://nostr-relay.untethr.me",
  "wss://nostr.bg",
  "wss://nostr-pub.wellorder.net",
  "wss://nostr-pub.semisol.dev",
  "wss://eden.nostr.land",
  "wss://nostr.mom",
  "wss://nostr.fmt.wiz.biz",
  "wss://nostr.zebedee.cloud"
];

const pool = new SimplePool();

async function poolPublish(event) {
  let relays = Object.keys((await window.nostr?.getRelays?.()) || []);
  if (relays.length === 0) relays = defaultRelays;
  let pub = pool.publish(relays, event);
  pub.on("ok", (msg) => {
    console.debug(msg);
    return;
  });
}

export { poolPublish };
