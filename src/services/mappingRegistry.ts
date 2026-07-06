import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type MappingRegistry = {
  mappings: Record<string, string>;
  revision: number;
  persistenceConfigured: boolean;
  storePath?: string;
};

type RegistryFile = {
  mappings: Record<string, string>;
  revision: number;
};

let storePath: string | undefined;
let state: RegistryFile = {
  mappings: {},
  revision: 0
};

const DEFAULT_MAPPINGS: Record<string, string> = {
  user_data: "dl_user_data",
  page_view: "dl_user_data",
  view_item: "dl_view_item",
  view_item_list: "dl_view_item_list",
  view_search_results: "dl_view_search_results",
  add_to_cart: "dl_add_to_cart",
  remove_from_cart: "dl_remove_from_cart",
  view_cart: "dl_view_cart",
  begin_checkout: "dl_begin_checkout",
  add_shipping_info: "dl_add_shipping_info",
  add_payment_info: "dl_add_payment_info",
  purchase: "dl_purchase",
  sign_up: "dl_sign_up",
  login: "dl_login",
  newsletter_signup: "dl_subscribe"
};

export function configureMappingRegistry(input: { storePath?: string }): void {
  storePath = input.storePath;
  if (!storePath) {
    state = {
      mappings: { ...DEFAULT_MAPPINGS },
      revision: 1
    };
    return;
  }

  void loadFromDisk(storePath).catch(() => {
    state = {
      mappings: { ...DEFAULT_MAPPINGS },
      revision: 1
    };
  });
}

async function loadFromDisk(filePath: string): Promise<void> {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as RegistryFile;

  state = {
    mappings: parsed.mappings ?? { ...DEFAULT_MAPPINGS },
    revision: Number.isFinite(parsed.revision) ? parsed.revision : 1
  };
}

async function persistToDisk(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(state, null, 2), "utf8");
}

export async function getMappingRegistry(): Promise<MappingRegistry> {
  if (storePath) {
    try {
      await loadFromDisk(storePath);
    } catch {
      // Keep in-memory state when store is missing on first read.
    }
  }

  return {
    mappings: { ...state.mappings },
    revision: state.revision,
    persistenceConfigured: Boolean(storePath),
    ...(storePath ? { storePath } : {})
  };
}

export async function replaceMappingRegistry(
  mappings: unknown,
  options?: { expectedRevision?: number }
): Promise<MappingRegistry> {
  if (!mappings || typeof mappings !== "object" || Array.isArray(mappings)) {
    throw new Error("mappings must be an object");
  }

  const nextMappings = mappings as Record<string, string>;

  if (options?.expectedRevision !== undefined && options.expectedRevision !== state.revision) {
    throw new Error(`mapping_revision_conflict:${state.revision}`);
  }

  state = {
    mappings: { ...nextMappings },
    revision: state.revision + 1
  };

  if (storePath) {
    await persistToDisk(storePath);
  }

  return getMappingRegistry();
}
