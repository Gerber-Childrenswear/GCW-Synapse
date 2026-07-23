import "./types";
import { getOrCreateSession, syncCartAttributes } from "./session";
import { pushDataLayerEvent } from "./push";
import { attachObservers } from "./observers";
import { attachElevarMirror } from "./elevarMirror";
import {
  emitUserData,
  emitViewItem,
  emitViewItemList,
  emitViewSearchResults,
  emitViewCart
} from "./events";
import type { SynapseConfig, SynapseDataLayerEvent } from "./types";

const VERSION = "1.4.0";

function isPasswordGatePage(config: SynapseConfig): boolean {
  const type = (config.page?.type || "").toLowerCase();
  const path = (config.page?.path || (typeof location !== "undefined" ? location.pathname : "")).toLowerCase();
  return type === "password" || path === "/password" || path.endsWith("/password");
}

function boot(): void {
  const config = window.SynapseConfig;
  if (!config || config.enabled === false) {
    return;
  }

  // Storefront password wall — avoid noisy dual-run beacons until unlocked.
  if (isPasswordGatePage(config)) {
    if (config.debug) {
      // eslint-disable-next-line no-console
      console.info("[Synapse] skip boot on password page");
    }
    return;
  }

  const session = getOrCreateSession();
  syncCartAttributes(session);

  window.SynapseInvalidateContext = () => {
    emitUserData(config);
  };

  window.Synapse = {
    version: VERSION,
    getSession: () => ({ ...session }),
    push: (event: SynapseDataLayerEvent) => {
      pushDataLayerEvent(event, { shop: config.shop, debug: Boolean(config.debug) });
    }
  };

  // Dual-run: mirror Elevar (non-Synapse) dl_* into Worker before we emit.
  attachElevarMirror(config);

  // Base page event first (Elevar contract).
  emitUserData(config);

  const pageType = (config.page?.type || "").toLowerCase();
  if (pageType === "product" || config.product) {
    emitViewItem(config);
  }
  if (pageType === "collection" || config.collection) {
    emitViewItemList(config);
  }
  if (pageType === "search" || config.search) {
    emitViewSearchResults(config);
  }
  if (pageType === "cart") {
    emitViewCart(config);
  }

  attachObservers(config);

  if (config.debug) {
    // eslint-disable-next-line no-console
    console.info("[Synapse] boot", VERSION, config.shop, session.session_id);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
