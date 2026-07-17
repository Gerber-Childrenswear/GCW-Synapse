export type FacebookProductGroupInput = {
  productId?: string | number | undefined;
  contentType?: string | undefined;
};

function normalizeString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function normalizeId(value: string | number | undefined): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }

  if (typeof value === "string") {
    return normalizeString(value);
  }

  return undefined;
}

export type FacebookProductGroupResult = {
  content_type: string;
  item_group_id?: string | undefined;
};

/**
 * Elevar "Facebook - product group" resolves to the Meta content_type constant
 * "product_group". Optionally surfaces Shopify product_id as item_group_id.
 */
export function resolveFacebookProductGroup(input: FacebookProductGroupInput): FacebookProductGroupResult {
  const contentType = normalizeString(input.contentType) ?? "product_group";
  const itemGroupId = normalizeId(input.productId);

  return {
    content_type: contentType,
    item_group_id: itemGroupId
  };
}
