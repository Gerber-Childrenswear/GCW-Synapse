import type { SynapseConfig, SynapseUserProperties } from "./types";

export function buildUserProperties(config: SynapseConfig): SynapseUserProperties {
  const customer = config.customer;
  const props: SynapseUserProperties = {
    visitor_type: customer?.id ? "logged_in" : "guest"
  };

  if (customer?.id != null) props.customer_id = String(customer.id);
  if (customer?.email) props.customer_email = customer.email;
  if (customer?.firstName) props.customer_first_name = customer.firstName;
  if (customer?.lastName) props.customer_last_name = customer.lastName;
  if (customer?.phone) props.customer_phone = customer.phone;
  if (customer?.orderCount != null) props.customer_order_count = String(customer.orderCount);
  if (customer?.totalSpent) props.customer_total_spent = customer.totalSpent;

  return props;
}
