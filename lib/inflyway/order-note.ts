type NoteItem = {
  title: string;
  quantity: number;
};

type NoteAddress = {
  email?: string;
  fullName?: string;
  phone?: string;
  country?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
};

type NoteParams = {
  orderNumber: string;
  email?: string;
  name?: string;
  phone?: string;
  items?: NoteItem[];
  total?: number;
  currency?: string;
  address?: NoteAddress;
};

const MAX_NOTE_LENGTH = 500;

const formatAddress = (address?: NoteAddress) => {
  if (!address) return "";
  const parts = [
    address.address1,
    address.address2,
    address.city,
    address.state,
    address.postalCode,
    address.country,
  ].filter(Boolean);
  return parts.join(", ");
};

export function buildInflywayOrderNote(params: NoteParams) {
  const lines: Array<string | null> = [
    params.orderNumber ? `Order: ${params.orderNumber}` : null,
    params.email ? `Email: ${params.email}` : null,
    params.name ? `Name: ${params.name}` : null,
    params.phone ? `Phone: ${params.phone}` : null,
  ];

  const addressLine = formatAddress(params.address);
  if (addressLine) {
    lines.push(`Address: ${addressLine}`);
  }

  const itemsLine = params.items?.length
    ? `Items: ${params.items
        .map((item) => `${item.title} x${item.quantity}`)
        .join(" | ")}`
    : null;
  if (itemsLine) {
    lines.push(itemsLine);
  }

  if (typeof params.total === "number" && params.currency) {
    lines.push(`Total: ${params.total.toFixed(2)} ${params.currency}`);
  }

  const note = lines.filter(Boolean).join("\n").trim();
  if (!note) return "";
  return note.length > MAX_NOTE_LENGTH ? note.slice(0, MAX_NOTE_LENGTH) : note;
}
