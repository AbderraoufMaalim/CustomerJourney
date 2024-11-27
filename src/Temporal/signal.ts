import { defineSignal } from "@temporalio/workflow";

export interface JoinInput {
  targetedProduct: string | null;
  productType: string | null;
  email: string | null;
}

export const productRecommendationSignal = defineSignal<[JoinInput]>("join");

export interface SocketId {
  changedSocketId: string;
}

export const socketChangedSignal = defineSignal<[SocketId]>("socketId");

export interface OrderPlaced {
  cartId: string;
}

export const orderPlacedSignal = defineSignal<[OrderPlaced]>("orderPlaced");
