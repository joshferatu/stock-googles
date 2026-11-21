import { notFound } from "next/navigation";

import { StockView } from "@/components/stock/stock-view";

function decodeSymbol(raw: string): string | null {
  let symbol = raw;
  try {
    symbol = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return /^[A-Za-z0-9^][A-Za-z0-9.^=_-]{0,23}$/.test(symbol) ? symbol : null;
}

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const decoded = decodeSymbol(symbol);
  return {
    title: decoded ? `${decoded} quote` : "Stock",
  };
}

export default async function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const decoded = decodeSymbol(symbol);
  if (!decoded) notFound();
  return <StockView symbol={decoded} />;
}
