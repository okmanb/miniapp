/**
 * Set de íconos: Material Symbols Outlined (Google), la misma familia
 * que ya comprometía la referencia de Horizon — reemplaza el set de
 * SVG dibujados a mano de "La Cartelera". El componente por nombre se
 * mantiene (WalletIcon, CheckIcon, etc.) para que las pantallas que
 * todavía no recibieron la pasada bespoke sigan funcionando sin editar
 * cada call site: solo cambia qué renderizan por dentro.
 */
import type { CSSProperties } from "react";

type IconProps = {
  width?: number;
  height?: number;
  style?: CSSProperties;
  className?: string;
};

function symbol(name: string) {
  return function Icon({ width = 20, height = 20, style, className }: IconProps) {
    return (
      <span
        className={`material-symbols-outlined${className ? ` ${className}` : ""}`}
        style={{ fontSize: width || height, lineHeight: 1, ...style }}
        aria-hidden="true"
      >
        {name}
      </span>
    );
  };
}

export const ArrowLeftIcon = symbol("arrow_back");
export const WalletIcon = symbol("account_balance_wallet");
export const TargetIcon = symbol("target");
export const BellIcon = symbol("notifications");
export const BridgeIcon = symbol("swap_horiz");
export const FileUpIcon = symbol("upload_file");
export const ClipboardIcon = symbol("assignment");
export const AlertTriangleIcon = symbol("warning");
export const CheckIcon = symbol("check_circle");
export const CircleIcon = symbol("radio_button_unchecked");
export const FactoryIcon = symbol("factory");
export const FrownIcon = symbol("sentiment_dissatisfied");
export const DotIcon = symbol("circle");
export const RefreshIcon = symbol("refresh");
export const XCircleIcon = symbol("cancel");

// Un ícono por tipo de deuda — para el avatar circular de cada tarjeta
// (idea tomada de Lumina: banco para préstamo personal, auto para
// prendario ya que en Argentina es literalmente el vehículo en garantía,
// etc.) en vez de solo la inicial del nombre.
export const CreditCardIcon = symbol("credit_card");
export const BankIcon = symbol("account_balance");
export const ReceiptIcon = symbol("receipt_long");
export const HomeIcon = symbol("home");
export const CarIcon = symbol("directions_car");
export const HandshakeIcon = symbol("handshake");
export const AvalancheIcon = symbol("ac_unit");
export const SnowballIcon = symbol("bubble_chart");
export const HeartIcon = symbol("favorite");
export const LightbulbIcon = symbol("lightbulb");
export const ChartIcon = symbol("show_chart");
export const HistoryIcon = symbol("history");
export const TrendingUpIcon = symbol("trending_up");
export const DownloadIcon = symbol("download");
