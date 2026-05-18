// ---------------------------------------------------------------------------
// Nostr profile fetching — queries indexer relays for kind-0 metadata
// ---------------------------------------------------------------------------

const INDEXER_RELAYS = [
  'wss://relay.nostr.band',
  'wss://purplepag.es',
  'wss://relay.damus.io',
];

export interface NostrProfile {
  name?: string;
  display_name?: string;
  picture?: string;
  banner?: string;
  about?: string;
  nip05?: string;
}

const profileCache = new Map<string, NostrProfile>();

/**
 * Fetch kind-0 profile from indexer relays.
 * Returns the first valid profile found.
 */
export async function fetchNostrProfile(pubkey: string): Promise<NostrProfile | null> {
  if (profileCache.has(pubkey)) return profileCache.get(pubkey)!;

  const subId = 'p_' + Math.random().toString(36).slice(2, 8);
  const filter = { kinds: [0], authors: [pubkey], limit: 1 };

  return new Promise((resolve) => {
    let resolved = false;
    const cleanup = () => {
      if (resolved) return;
      resolved = true;
    };

    // Hard timeout
    setTimeout(() => {
      cleanup();
      resolve(null);
    }, 6000);

    for (const url of INDEXER_RELAYS) {
      try {
        const ws = new WebSocket(url);

        ws.onopen = () => {
          ws.send(JSON.stringify(['REQ', subId, filter]));
        };

        ws.onmessage = (msg) => {
          try {
            const data = JSON.parse(msg.data);
            if (data[0] === 'EVENT' && data[1] === subId && data[2]) {
              const event = data[2];
              if (event.content) {
                const profile = JSON.parse(event.content) as NostrProfile;
                profileCache.set(pubkey, profile);
                if (!resolved) {
                  resolved = true;
                  resolve(profile);
                }
              }
            }
          } catch { /* ignore */ }
        };

        ws.onerror = () => { try { ws.close(); } catch {} };

        // Close after timeout
        setTimeout(() => { try { ws.close(); } catch {} }, 5000);
      } catch { /* skip */ }
    }
  });
}
