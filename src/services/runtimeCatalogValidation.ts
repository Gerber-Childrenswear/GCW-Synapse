import { getControlPanelSchemas, type EventField, type EventSchema } from "./controlPanelData";
import type { SynapseRuntimeEvent } from "../types/synapse";

export type CatalogValidationIssue = {
  level: "error" | "warning";
  field?: string;
  path?: string;
  message: string;
};

export type CatalogValidationResult = {
  valid: boolean;
  catalogEventName: string | null;
  issues: CatalogValidationIssue[];
};

const RUNTIME_TO_CATALOG: Record<string, string> = {
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

function resolveCatalogEventName(event: SynapseRuntimeEvent): string | null {
  if (event.event_name.startsWith("dl_")) {
    return event.event_name;
  }

  return RUNTIME_TO_CATALOG[event.event_name] ?? `dl_${event.event_name}`;
}

function readPathValue(source: unknown, path: string): unknown {
  const segments = path.replace(/\[\]/g, ".0.").split(".").filter(Boolean);
  let current: unknown = source;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (Array.isArray(current)) {
      const index = Number.parseInt(segment, 10);
      current = Number.isFinite(index) ? current[index] : undefined;
      continue;
    }

    if (typeof current !== "object") {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function buildRuntimePayloadView(event: SynapseRuntimeEvent): Record<string, unknown> {
  const userProperties: Record<string, unknown> = {
    visitor_type: event.customer.visitor_type,
    customer_id: event.customer.id,
    customer_email: event.customer.email,
    user_consent: event.consent.ad_user_data ?? event.consent.analytics_storage
  };

  const ecommerce: Record<string, unknown> = {
    currency: event.cart.currency ?? event.checkout.currency,
    cart_total: event.cart.total != null ? String(event.cart.total) : undefined,
    value: event.cart.total ?? event.checkout.revenue,
    cart_id: event.cart.cart_id,
    search_term: event.marketing.term,
    item_list_name: event.collection.name,
    items: event.cart.items
  };

  return {
    user_properties: userProperties,
    ecommerce,
    customer: event.customer,
    cart: event.cart,
    checkout: event.checkout,
    product: event.product,
    collection: event.collection,
    marketing: event.marketing,
    session: event.session,
    consent: event.consent
  };
}

function validateField(field: EventField, payload: Record<string, unknown>): CatalogValidationIssue | null {
  const value = readPathValue(payload, field.path);

  if (field.required && (value === undefined || value === null || value === "")) {
    return {
      level: "error",
      field: field.name,
      path: field.path,
      message: `Required catalog field "${field.name}" is missing at ${field.path}`
    };
  }

  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (field.type === "number" && typeof value !== "number") {
    return {
      level: "warning",
      field: field.name,
      path: field.path,
      message: `Expected number for "${field.name}" at ${field.path}`
    };
  }

  if ((field.type === "string" || field.type === "boolean") && typeof value !== "string" && typeof value !== "boolean") {
    return {
      level: "warning",
      field: field.name,
      path: field.path,
      message: `Expected string/boolean for "${field.name}" at ${field.path}`
    };
  }

  return null;
}

function findSchema(catalogEventName: string): EventSchema | undefined {
  return getControlPanelSchemas().find((schema) => schema.eventName === catalogEventName);
}

export function validateRuntimeEventAgainstCatalog(event: SynapseRuntimeEvent): CatalogValidationResult {
  const catalogEventName = resolveCatalogEventName(event);
  const schema = catalogEventName ? findSchema(catalogEventName) : undefined;
  const issues: CatalogValidationIssue[] = [];

  if (!catalogEventName || !schema) {
    return {
      valid: true,
      catalogEventName,
      issues: [
        {
          level: "warning",
          message: catalogEventName
            ? `No canonical catalog schema registered for ${catalogEventName}`
            : `No catalog mapping for runtime event ${event.event_name}`
        }
      ]
    };
  }

  const payload = buildRuntimePayloadView(event);

  for (const field of schema.fields) {
    const issue = validateField(field, payload);
    if (issue) {
      issues.push(issue);
    }
  }

  return {
    valid: !issues.some((issue) => issue.level === "error"),
    catalogEventName,
    issues
  };
}

export function getCanonicalEventCatalog(): {
  runtime_events: string[];
  catalog_events: EventSchema[];
  mappings: Record<string, string>;
} {
  return {
    runtime_events: Object.keys(RUNTIME_TO_CATALOG),
    catalog_events: getControlPanelSchemas(),
    mappings: { ...RUNTIME_TO_CATALOG }
  };
}
