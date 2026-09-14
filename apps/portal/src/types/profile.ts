export interface CustomerAddress {
  street?: string;
  number?: string;
  complement?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

export interface CustomerProfile {
  name: string;
  email: string;
  phone: string | null;
  document?: string | null;
  address: CustomerAddress | null;
  company?: string | null;
  country?: string | null;
  locale?: string | null;
  currency?: string | null;
}

export const emptyProfile: CustomerProfile = {
  name: "",
  email: "",
  phone: null,
  document: null,
  address: null,
};
