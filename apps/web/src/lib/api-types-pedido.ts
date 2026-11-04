// Pedido anticipado shapes of the owner panel (S20), re-exported by api-types.ts.
// The public customer endpoints live in public-order-api.ts.

/** Pedido anticipado of a sucursal; url is the public link, null while disabled. */
export interface PedidoAnticipadoSucursal {
  sucursalId: string;
  name: string;
  enabled: boolean;
  url: string | null;
}

export interface PedidoAnticipadoStatus {
  sucursales: PedidoAnticipadoSucursal[];
}

/** Reply of enabling: enabling again keeps the same slug, so a printed QR keeps working. */
export interface EnabledPedidoAnticipado {
  sucursalId: string;
  enabled: true;
  slug: string;
  url: string;
}
