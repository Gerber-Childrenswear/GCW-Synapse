import type { SynapseConfig, SynapseUserProperties } from "./types";

export function buildUserProperties(config: SynapseConfig): SynapseUserProperties {
  const customer = config.customer;
  const props: SynapseUserProperties = {
    // Match Elevar / resolveVisitorType title-case for GTM dlv - Global - Visitor Type.
    visitor_type: customer?.id || customer?.email ? "Logged In" : "Guest"
  };

  if (customer?.id != null) props.customer_id = String(customer.id);
  if (customer?.email) props.customer_email = customer.email;
  if (customer?.firstName) props.customer_first_name = customer.firstName;
  if (customer?.lastName) props.customer_last_name = customer.lastName;
  if (customer?.phone) props.customer_phone = customer.phone;
  if (customer?.orderCount != null) props.customer_order_count = String(customer.orderCount);
  if (customer?.totalSpent) props.customer_total_spent = customer.totalSpent;
  if (customer?.address1) props.customer_address_1 = customer.address1;
  if (customer?.city) props.customer_city = customer.city;
  if (customer?.province) props.customer_province = customer.province;
  if (customer?.provinceCode) props.customer_province_code = customer.provinceCode;
  if (customer?.zip) props.customer_zip = customer.zip;
  if (customer?.country) props.customer_country = customer.country;
  if (customer?.countryCode) props.customer_country_code = customer.countryCode;

  return props;
}
